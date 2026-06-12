const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const { discoverResources, getAccountInfo, groupBy, categoryLabel } = require("./awsDiscovery");
const { parseTfstate, buildTfstateIndex, compareTfstate } = require("./tfstate");
const { buildImportArtifact, mapToTerraformImport, resolveConfigRuleNames } = require("./imports");
const { getUserSetting, setUserSetting, deleteUserSetting } = require("./db");
const {
  commitImportArtifact,
  commitWorkspaceFiles,
  createGitlabProject,
  listGitlabProjects,
  publicIntegration,
  upsertGitlabIntegration,
} = require("./gitlab");
const { slugify } = require("./utils");
const { createWorkspace, getTerraformVersion, initWorkspace, planGenerateConfig, plan, readWorkspaceFiles, writeWorkspaceFiles, destroyWorkspace, validateFilename } = require("./workspace");
const { runAgentLoop, runSingleRefinement, preProcessWorkspace } = require("./agent");
const { encrypt, decrypt } = require("./crypto");

// Minimal valid stubs for resource types that terraform couldn't auto-generate config for.
// These pass schema validation; actual values get overwritten by the import.
const RESOURCE_STUBS = {
  aws_config_config_rule: (name) => `  name = "${name}"\n  source {\n    owner = "AWS"\n    source_identifier = "PLACEHOLDER"\n  }`,
  aws_lambda_function: (name) => `  function_name = "${name}"\n  role = "arn:aws:iam::000000000000:role/placeholder"\n  filename = "/tmp/placeholder.zip"`,
  aws_lambda_layer_version: (name) => `  layer_name = "${name}"\n  compatible_runtimes = ["nodejs20.x"]`,
  aws_lb: () => `  subnets = []`,
  aws_lb_listener: () => `  load_balancer_arn = "arn:aws:elasticloadbalancing:ap-southeast-1:000000000000:loadbalancer/placeholder"\n  default_action {\n    type = "forward"\n    target_group_arn = "arn:aws:elasticloadbalancing:ap-southeast-1:000000000000:targetgroup/placeholder/0000000000000000"\n  }`,
  aws_lb_listener_rule: () => `  listener_arn = "arn:aws:elasticloadbalancing:ap-southeast-1:000000000000:listener/placeholder"\n  action {\n    type = "forward"\n  }\n  condition {\n    path_pattern {\n      values = ["/placeholder"]\n    }\n  }`,
  aws_lb_target_group: () => `  vpc_id = "vpc-placeholder"`,
  aws_backup_plan: (name) => `  name = "${name}"\n  rule {\n    rule_name = "placeholder"\n    target_vault_name = "Default"\n  }`,
  aws_vpc_security_group_ingress_rule: () => `  security_group_id = "sg-placeholder"\n  ip_protocol = "-1"\n  cidr_ipv4 = "0.0.0.0/0"`,
  aws_vpc_security_group_egress_rule: () => `  security_group_id = "sg-placeholder"\n  ip_protocol = "-1"\n  cidr_ipv4 = "0.0.0.0/0"`,
  aws_cloudwatch_event_rule: (name) => `  name = "${name}"\n  event_pattern = jsonencode({ source = ["placeholder"] })`,
  aws_cloudformation_stack: (name) => `  name = "${name}"\n  template_body = "{\\"AWSTemplateFormatVersion\\":\\"2010-09-09\\",\\"Description\\":\\"placeholder\\"}"`,
  aws_s3_bucket: (name) => `  bucket = "${name}"`,
  aws_secretsmanager_secret: (name) => `  name = "${name}"`,
  aws_kms_key: () => `  description = "placeholder"`,
  aws_db_parameter_group: (name) => `  name = "${name.replace(/_/g, "-")}"\n  family = "postgres16"`,
  aws_db_option_group: (name) => `  name = "${name.replace(/_/g, "-")}"\n  engine_name = "sqlserver-se"\n  major_engine_version = "15.00"`,
  aws_memorydb_parameter_group: (name) => `  name = "${name.replace(/_/g, "-")}"\n  family = "memorydb_redis7"`,
  aws_ses_domain_identity: (name) => `  domain = "${name}"`,
  aws_ssm_association: (name) => `  name = "${name}"`,
  aws_ssm_document: (name) => `  name = "${name}"\n  document_type = "Command"\n  content = jsonencode({ schemaVersion = "2.2", description = "placeholder", mainSteps = [] })`,
  aws_ssm_parameter: (name) => `  name = "${name}"\n  type = "String"\n  value = "placeholder"`,
  aws_guardduty_detector: () => `  enable = true`,
  aws_guardduty_filter: (name) => `  name = "${name}"\n  detector_id = "placeholder"\n  rank = 1\n  action = "ARCHIVE"\n  finding_criteria {\n    criterion {\n      field = "type"\n      equals = ["placeholder"]\n    }\n  }`,
  aws_guardduty_threatintelset: (name) => `  name = "${name}"\n  detector_id = "placeholder"\n  format = "TXT"\n  location = "https://example.com/placeholder.txt"\n  activate = false`,
  aws_acm_certificate: () => `  domain_name = "placeholder.example.com"\n  validation_method = "DNS"`,
  aws_key_pair: (name) => `  key_name = "${name}"\n  public_key = "ssh-rsa AAAAB3placeholder"`,
  aws_ebs_snapshot: () => `  volume_id = "vol-placeholder"`,
};

function buildMinimalStub(type, logicalName) {
  const stubFn = RESOURCE_STUBS[type];
  // Extract a human-readable name from the logical name (last segment after last _)
  const shortName = logicalName.replace(/^.*?_(?=\D)/, "").replace(/_\d+$/, "") || logicalName;
  const body = stubFn ? stubFn(shortName) : `  # placeholder — terraform could not auto-generate config for this resource`;
  return `resource "${type}" "${logicalName}" {\n${body}\n}\n`;
}

const DEFAULT_USER = { id: "default-user", name: "User", email: "user@localhost" };
const DEFAULT_SESSION = { user: DEFAULT_USER, session: { id: "default-session", userId: DEFAULT_USER.id } };

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function tfstateSummary(tfstate) {
  return {
    files: tfstate.files.map((f) => ({ name: f.name, uploadedAt: f.uploadedAt, resourceCount: f.parsed.length })),
    totalManagedResources: tfstate.files.reduce((sum, f) => sum + f.parsed.length, 0),
  };
}

function rebuildTfstateIndex(tfstate) {
  const all = tfstate.files.flatMap((f) => f.parsed);
  tfstate.index = all.length ? buildTfstateIndex(all) : null;
}

async function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "..", "public");
  const tfstateByUser = new Map();
  function getUserTfstate(userId) {
    if (!tfstateByUser.has(userId)) tfstateByUser.set(userId, { files: [], index: null });
    return tfstateByUser.get(userId);
  }

  app.use(express.json({ limit: "20mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'");
    next();
  });
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api/")) {
        console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
      }
    });
    next();
  });
  app.use(express.static(publicDir));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "terra-yank" });
  });

  app.get("/api/me", (_req, res) => {
    res.json({ user: DEFAULT_USER });
  });

  app.use("/api", (req, _res, next) => {
    req.session = DEFAULT_SESSION;
    next();
  });

  const VALID_AWS_REGION = /^[a-z]{2}-[a-z]+-\d{1,2}$/;
  const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  const ALLOWED_MODELS = new Set(["bedrock.claude-sonnet-4-6", "bedrock.claude-haiku-4-5"]);

  function decryptAwsCredentials(aws) {
    if (!aws?.encryptedAccessKeyId) return undefined;
    return {
      accessKeyId: decrypt(aws.encryptedAccessKeyId),
      secretAccessKey: decrypt(aws.encryptedSecretAccessKey),
      ...(aws.encryptedSessionToken && { sessionToken: decrypt(aws.encryptedSessionToken) }),
    };
  }

  function awsEnvFromCredentials(credentials) {
    if (!credentials) return undefined;
    return {
      AWS_ACCESS_KEY_ID: credentials.accessKeyId,
      AWS_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      ...(credentials.sessionToken && { AWS_SESSION_TOKEN: credentials.sessionToken }),
    };
  }

  app.get("/api/account", asyncRoute(async (req, res) => {
    const region = req.query.region || "ap-southeast-1";
    if (!VALID_AWS_REGION.test(region)) return res.status(400).json({ error: "Invalid AWS region." });
    const aws = await getUserSetting(req.session.user.id, "aws");
    const credentials = decryptAwsCredentials(aws);
    res.json(await getAccountInfo(region, credentials));
  }));

  app.post("/api/discovery/runs", asyncRoute(async (req, res) => {
    const region = req.body.region || "ap-southeast-1";
    if (!VALID_AWS_REGION.test(region)) return res.status(400).json({ error: "Invalid AWS region." });

    const aws = await getUserSetting(req.session.user.id, "aws");
    if (!aws?.encryptedAccessKeyId) {
      return res.status(400).json({ error: "AWS credentials not configured. Go to Settings and enter your AWS Access Key ID, Secret Access Key, and optional Session Token." });
    }

    let credentials;
    try {
      credentials = decryptAwsCredentials(aws);
    } catch (err) {
      console.error("Failed to decrypt AWS credentials:", err.message);
      return res.status(500).json({ error: "Failed to decrypt AWS credentials. Check that ENCRYPTION_KEY env var matches the key used when credentials were saved." });
    }

    let account;
    try {
      account = await getAccountInfo(region, credentials);
    } catch (err) {
      console.error("AWS getAccountInfo failed:", err.message);
      if (err.name === "ExpiredTokenException" || err.message?.includes("expired")) {
        return res.status(401).json({ error: "AWS session token has expired. Go to Settings and update your credentials." });
      }
      if (err.name === "InvalidClientTokenId" || err.name === "SignatureDoesNotMatch") {
        return res.status(401).json({ error: `AWS credentials invalid: ${err.name}. Check your Access Key ID and Secret Access Key in Settings.` });
      }
      return res.status(502).json({ error: `AWS account lookup failed: ${err.message}` });
    }

    let discovery;
    try {
      discovery = await discoverResources(region, credentials);
    } catch (err) {
      console.error("AWS discoverResources failed:", err.message);
      if (err.name === "AccessDeniedException") {
        return res.status(403).json({ error: `AWS Resource Explorer access denied: ${err.message}. Ensure your IAM role has resource-explorer-2:Search permission.` });
      }
      if (err.name === "ExpiredTokenException" || err.message?.includes("expired")) {
        return res.status(401).json({ error: "AWS session token has expired. Go to Settings and update your credentials." });
      }
      return res.status(502).json({ error: `AWS resource discovery failed: ${err.message}` });
    }

    const tfstate = getUserTfstate(req.session.user.id);
    if (!tfstate.index) {
      return res.json({ ...discovery, account, scannedAt: new Date().toISOString(), tfstateLoaded: false });
    }

    const allDiscovered = [
      ...(discovery.platformGroups || []),
      ...(discovery.notTaggedCategoryGroups || []),
    ].flatMap((g) => g.resources);

    const { managed, unmanaged, staleStateResources, subResources } = compareTfstate(allDiscovered, tfstate.index, region);
    const managedArns = new Set(managed.map((r) => r.arn));
    const managedByArn = new Map(managed.map((r) => [r.arn, r.managedBy]));

    const filterGroups = (groups) => groups
      .map((g) => ({ ...g, resources: g.resources.filter((r) => !managedArns.has(r.arn)), count: 0 }))
      .map((g) => ({ ...g, count: g.resources.length }))
      .filter((g) => g.count > 0);

    const platformGroups = (discovery.platformGroups || []).map((g) => ({
      ...g,
      resources: g.resources.map((r) => {
        const managedBy = managedByArn.get(r.arn);
        return managedBy ? { ...r, managedBy } : r;
      }),
    }));
    const notTaggedCategoryGroups = filterGroups(discovery.notTaggedCategoryGroups || []);

    const managedCategoryGroups = groupBy(
      managed,
      (r) => r.category || "other/unknown",
      (r, key) => ({ category: key, label: categoryLabel(key), count: 0, services: {}, resources: [] }),
    );

    res.json({
      region: discovery.region,
      totalDiscovered: discovery.totalDiscovered,
      platformTaggedCount: platformGroups.reduce((sum, g) => sum + g.count, 0),
      notTaggedCount: notTaggedCategoryGroups.reduce((sum, g) => sum + g.count, 0),
      managedCount: managed.length,
      platformGroups,
      notTaggedCategoryGroups,
      managedCategoryGroups,
      staleStateResources,
      subResources,
      tfstateLoaded: true,
      account,
      scannedAt: new Date().toISOString(),
    });
  }));

  app.post("/api/imports/generate", asyncRoute(async (req, res) => {
    const aws = await getUserSetting(req.session.user.id, "aws");
    const credentials = decryptAwsCredentials(aws);
    const artifact = await buildImportArtifact({
      selection: req.body.selection || [],
      region: req.body.region,
      account: req.body.account,
      credentials,
    });
    res.json(artifact);
  }));

  app.get("/api/projects", asyncRoute(async (req, res) => {
    const projects = await getUserSetting(req.session.user.id, "projects") || [];
    res.json({ projects });
  }));

  app.post("/api/projects", asyncRoute(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) throw new Error("Project name is required.");

    const projects = await getUserSetting(req.session.user.id, "projects") || [];
    const id = req.body.id || slugify(name);
    const now = new Date().toISOString();

    const existing = projects.find((item) => item.id === id);
    if (existing) {
      existing.name = name;
      existing.description = req.body.description || "";
      existing.updatedAt = now;
      await setUserSetting(req.session.user.id, "projects", projects);
      return res.status(201).json(existing);
    }

    const project = { id, name, description: req.body.description || "", createdAt: now, updatedAt: now };
    projects.push(project);
    await setUserSetting(req.session.user.id, "projects", projects);
    res.status(201).json(project);
  }));

  app.get("/api/integrations", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    const [aws, llm, gitlab] = await Promise.all([
      getUserSetting(userId, "aws"),
      getUserSetting(userId, "llm"),
      getUserSetting(userId, "gitlab"),
    ]);
    res.json({
      integrations: gitlab ? [publicIntegration(gitlab)] : [],
      gitlab: publicIntegration(gitlab),
      aws: { configured: Boolean(aws?.encryptedAccessKeyId) },
      llm: {
        configured: Boolean(llm?.encryptedApiKey),
        model: llm?.model || "bedrock.claude-sonnet-4-6",
        tokenBudget: llm?.tokenBudget || 100000,
      },
    });
  }));

  app.post("/api/integrations/gitlab", asyncRoute(async (req, res) => {
    const token = req.body.token;
    if (!token) return res.status(400).json({ error: "GitLab token is required." });
    const existing = await getUserSetting(req.session.user.id, "gitlab");
    const integration = await upsertGitlabIntegration(token, req.body, existing);
    await setUserSetting(req.session.user.id, "gitlab", integration);
    res.status(201).json(publicIntegration(integration));
  }));

  app.get("/api/integrations/gitlab/projects", asyncRoute(async (req, res) => {
    const gitlab = await getUserSetting(req.session.user.id, "gitlab");
    res.json(await listGitlabProjects(gitlab));
  }));

  app.post("/api/integrations/gitlab/projects/create", asyncRoute(async (req, res) => {
    const gitlab = await getUserSetting(req.session.user.id, "gitlab");
    const { name, namespaceId, visibility } = req.body;
    const project = await createGitlabProject({ gitlabSetting: gitlab, name, namespaceId, visibility });
    res.status(201).json(project);
  }));

  app.post("/api/gitlab/commit-import", asyncRoute(async (req, res) => {
    const gitlab = await getUserSetting(req.session.user.id, "gitlab");
    const { project: projectPath, branch, filePrefix, artifact } = req.body;
    const result = await commitImportArtifact({ gitlabSetting: gitlab, project: projectPath, branch, filePrefix, artifact });
    res.status(201).json(result);
  }));

  app.post("/api/credentials/aws", asyncRoute(async (req, res) => {
    const { accessKeyId, secretAccessKey, sessionToken } = req.body;
    if (!accessKeyId || !secretAccessKey) return res.status(400).json({ error: "Access key ID and secret access key are required." });
    await setUserSetting(req.session.user.id, "aws", {
      encryptedAccessKeyId: encrypt(accessKeyId),
      encryptedSecretAccessKey: encrypt(secretAccessKey),
      encryptedSessionToken: sessionToken ? encrypt(sessionToken) : null,
      configuredAt: new Date().toISOString(),
    });
    res.status(201).json({ configured: true });
  }));

  app.post("/api/credentials/aws/test", asyncRoute(async (req, res) => {
    const aws = await getUserSetting(req.session.user.id, "aws");
    if (!aws?.encryptedAccessKeyId) {
      return res.status(400).json({ error: "No AWS credentials saved." });
    }
    let credentials;
    try {
      credentials = decryptAwsCredentials(aws);
    } catch (err) {
      return res.status(500).json({ error: `Decrypt failed: ${err.message}` });
    }
    const keyPreview = credentials.accessKeyId.slice(0, 4) + "..." + credentials.accessKeyId.slice(-4);
    const secretLen = credentials.secretAccessKey.length;
    console.log(`[aws-test] Decrypted key: ${keyPreview}, secret length: ${secretLen}, hasSessionToken: ${!!credentials.sessionToken}`);
    try {
      const region = req.body.region || "ap-southeast-1";
      const account = await getAccountInfo(region, credentials);
      res.json({ ok: true, account, keyPreview, secretLength: secretLen, hasSessionToken: !!credentials.sessionToken });
    } catch (err) {
      console.error(`[aws-test] STS call failed:`, err.name, err.message);
      res.status(401).json({
        ok: false,
        error: `${err.name}: ${err.message}`,
        keyPreview,
        secretLength: secretLen,
        hasSessionToken: !!credentials.sessionToken,
      });
    }
  }));

  app.delete("/api/credentials/aws", asyncRoute(async (req, res) => {
    await deleteUserSetting(req.session.user.id, "aws");
    res.json({ configured: false });
  }));

  app.post("/api/credentials/llm", asyncRoute(async (req, res) => {
    const { apiKey, model, tokenBudget } = req.body;
    const existing = await getUserSetting(req.session.user.id, "llm");
    if (!apiKey && !existing?.encryptedApiKey) return res.status(400).json({ error: "API key is required." });
    const llm = {
      encryptedApiKey: apiKey ? encrypt(apiKey) : existing.encryptedApiKey,
      model: model || existing?.model || "bedrock.claude-sonnet-4-6",
      tokenBudget: tokenBudget || existing?.tokenBudget || 100000,
      configuredAt: new Date().toISOString(),
    };
    await setUserSetting(req.session.user.id, "llm", llm);
    res.status(201).json({ configured: true, model: llm.model, tokenBudget: llm.tokenBudget });
  }));

  app.delete("/api/credentials/llm", asyncRoute(async (req, res) => {
    await deleteUserSetting(req.session.user.id, "llm");
    res.json({ configured: false });
  }));

  // DEBUG: verify key decryption and API call (remove before prod)
  app.get("/api/debug/llm-key", asyncRoute(async (req, res) => {
    const llm = await getUserSetting(req.session.user.id, "llm");
    if (!llm?.encryptedApiKey) return res.json({ error: "no key saved" });
    const key = decrypt(llm.encryptedApiKey);
    const Anthropic = require("@anthropic-ai/sdk");
    const baseURL = ANTHROPIC_BASE_URL;
    try {
      const client = new Anthropic({ apiKey: key, baseURL });
      const r = await client.messages.create({ model: "bedrock.claude-sonnet-4-6", max_tokens: 20, messages: [{ role: "user", content: "Say ok" }] });
      res.json({ prefix: key.slice(0, 10), suffix: key.slice(-4), length: key.length, baseURL, apiTest: "SUCCESS", response: r.content[0].text });
    } catch(e) {
      res.json({ prefix: key.slice(0, 10), suffix: key.slice(-4), length: key.length, baseURL, apiTest: "FAILED", error: e.message, status: e.status });
    }
  }));

  app.post("/api/tfstate/upload", asyncRoute(async (req, res) => {
    const { name, content } = req.body;
    if (!name || !content) throw Object.assign(new Error("name and content are required."), { status: 400 });
    const tfstate = getUserTfstate(req.session.user.id);
    if (tfstate.files.length >= 20) throw Object.assign(new Error("Maximum 20 state files per user. Remove existing files before uploading more."), { status: 400 });
    const parsed = parseTfstate(content, name);
    tfstate.files.push({ name, uploadedAt: new Date().toISOString(), parsed });
    rebuildTfstateIndex(tfstate);
    res.status(201).json(tfstateSummary(tfstate));
  }));

  app.get("/api/tfstate", (req, res) => {
    res.json(tfstateSummary(getUserTfstate(req.session.user.id)));
  });

  app.delete("/api/tfstate/:index", (req, res) => {
    const tfstate = getUserTfstate(req.session.user.id);
    const idx = Number(req.params.index);
    if (idx < 0 || idx >= tfstate.files.length) throw Object.assign(new Error("Invalid file index."), { status: 400 });
    tfstate.files.splice(idx, 1);
    rebuildTfstateIndex(tfstate);
    res.json(tfstateSummary(tfstate));
  });

  app.delete("/api/tfstate", (req, res) => {
    const tfstate = getUserTfstate(req.session.user.id);
    tfstate.files.length = 0;
    tfstate.index = null;
    res.json(tfstateSummary(tfstate));
  });

  // --- Interactive workspace endpoints ---
  const workspaceByUser = new Map();
  function getUserWorkspace(userId) { return workspaceByUser.get(userId) || null; }

  function sseHeaders(res) {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    return (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  app.post("/api/workspace", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    if (workspaceByUser.has(userId)) return res.status(409).json({ error: "Workspace already exists. Close it first." });
    const { selection, region } = req.body;
    if (!selection || !selection.length) return res.status(400).json({ error: "No resources selected." });
    if (!region || !VALID_AWS_REGION.test(region)) return res.status(400).json({ error: "Invalid region." });

    const send = sseHeaders(res);
    const ac = new AbortController();
    let done = false;
    res.on("close", () => { if (!done) ac.abort(); });

    try {
      const aws = await getUserSetting(userId, "aws");
      const credentials = decryptAwsCredentials(aws);
      const awsEnv = awsEnvFromCredentials(credentials);

      send({ phase: "init", message: `Mapping ${selection.length} resource(s) to Terraform types...` });
      const unmapped = [];
      const mapped = selection.map((resource, idx) => {
        const m = mapToTerraformImport(resource);
        if (!m) { unmapped.push(resource.arn || resource.service || "unknown"); return null; }
        return { ...m, logicalName: `${m.tfType}_${slugify(resource.resourceType || resource.service)}_${idx + 1}` };
      }).filter(Boolean);
      if (unmapped.length) send({ phase: "init", message: `${unmapped.length} resource(s) could not be mapped.` });
      if (!mapped.length) { send({ phase: "error", message: "No resources could be mapped to Terraform types." }); return res.end(); }

      // Resolve config rule names (import ID must be rule name, not config-rule-id)
      const configRules = mapped.filter((r) => r.tfType === "aws_config_config_rule");
      if (configRules.length) {
        send({ phase: "init", message: `Resolving ${configRules.length} config rule name(s)...` });
        const resolved = await resolveConfigRuleNames(configRules.map((r) => r.importId), region, credentials);
        let resolvedCount = 0;
        for (const r of configRules) {
          const name = resolved[r.importId];
          if (name) { r.importId = name; resolvedCount++; }
        }
        if (resolvedCount < configRules.length) {
          send({ phase: "init", message: `Resolved ${resolvedCount}/${configRules.length} config rule names. ${configRules.length - resolvedCount} may fail import.` });
        }
      }

      send({ phase: "init", message: `Creating Terraform workspace in ${region}...` });
      const ws = await createWorkspace({ region, resources: mapped });

      send({ phase: "init", message: "Running terraform init (downloading providers)..." });
      await initWorkspace(ws.dir, { signal: ac.signal, env: awsEnv });
      send({ phase: "init", message: "terraform init complete." });

      try {
        const ver = await getTerraformVersion();
        const providers = Object.entries(ver.providers).map(([k, v]) => `${k.split("/").pop()} ${v}`).join(", ");
        send({ phase: "init", message: `Terraform ${ver.terraform}${providers ? ` | Providers: ${providers}` : ""}` });
      } catch {}

      send({ phase: "plan", message: "Running terraform plan -generate-config-out..." });
      const genResult = await planGenerateConfig(ws.dir, { signal: ac.signal, env: awsEnv });
      if (!genResult.generated) {
        const hint = genResult.stderr ? `\n\nterraform output:\n${genResult.stderr.slice(0, 500)}` : "";
        send({ phase: "error", message: `terraform plan did not generate configuration.${hint}` });
        await destroyWorkspace(ws.dir);
        return res.end();
      }
      send({ phase: "plan", message: `Config generated (${genResult.generated.split("\n").length} lines). Checking for missing resource blocks...` });

      // Find imports that have no generated resource block — retry generation for them
      const generatedAddresses = new Set();
      const resRegex = /^resource\s+"([^"]+)"\s+"([^"]+)"/gm;
      let rm;
      while ((rm = resRegex.exec(genResult.generated)) !== null) {
        generatedAddresses.add(`${rm[1]}.${rm[2]}`);
      }
      const importsPath = path.join(ws.dir, "imports.tf");
      const importsContent = await fs.readFile(importsPath, "utf8");
      const missingResources = [];
      const importBlockRegex = /import\s*\{[^}]*to\s*=\s*(\S+)[^}]*\}/g;
      let im;
      while ((im = importBlockRegex.exec(importsContent)) !== null) {
        const addr = im[1];
        if (!generatedAddresses.has(addr)) {
          const parts = addr.match(/^([^.]+)\.(.+)$/);
          if (parts) missingResources.push({ type: parts[1], name: parts[2] });
        }
      }
      if (missingResources.length > 0) {
        send({ phase: "plan", message: `${missingResources.length} resource(s) missing config. Retrying generate for them...` });
        // Retry: isolate missing imports, re-run generate, merge results
        const generatedPath = path.join(ws.dir, "generated.tf");
        const savedGenerated = await fs.readFile(generatedPath, "utf8");
        const missingAddrs = new Set(missingResources.map((r) => `${r.type}.${r.name}`));
        // Rewrite imports.tf with ONLY missing imports
        const allImportBlocks = importsContent.match(/import\s*\{[^}]*\}/g) || [];
        const missingImportBlocks = allImportBlocks.filter((b) => {
          const toM = b.match(/to\s*=\s*(\S+)/);
          return toM && missingAddrs.has(toM[1]);
        });
        await fs.writeFile(importsPath, missingImportBlocks.join("\n\n") + "\n");
        // Remove generated.tf so planGenerateConfig can recreate it
        await fs.unlink(generatedPath).catch(() => {});
        const retryResult = await planGenerateConfig(ws.dir, { signal: ac.signal, env: awsEnv });
        // Merge: original generated + retry generated
        const mergedGenerated = savedGenerated + "\n" + (retryResult.generated || "");
        await fs.writeFile(generatedPath, mergedGenerated);
        // Restore full imports.tf
        await fs.writeFile(importsPath, importsContent);
        // Check what's still missing after retry
        const retryAddresses = new Set();
        let rm2;
        const retryRegex = /^resource\s+"([^"]+)"\s+"([^"]+)"/gm;
        while ((rm2 = retryRegex.exec(retryResult.generated || "")) !== null) {
          retryAddresses.add(`${rm2[1]}.${rm2[2]}`);
        }
        const stillMissing = missingResources.filter((r) => !retryAddresses.has(`${r.type}.${r.name}`));
        if (stillMissing.length > 0) {
          // Generate minimal valid stubs for resources that still have no config
          const stubs = stillMissing.map((r) => buildMinimalStub(r.type, r.name)).join("\n");
          const currentGen = await fs.readFile(generatedPath, "utf8");
          await fs.writeFile(generatedPath, currentGen + "\n" + stubs);
          send({ phase: "plan", message: `Retry recovered ${missingResources.length - stillMissing.length} resource(s). Created minimal stubs for ${stillMissing.length} remaining.` });
        } else {
          send({ phase: "plan", message: `Retry recovered all ${missingResources.length} missing resource(s). Running pre-processor...` });
        }
      } else {
        send({ phase: "plan", message: "All imports have config. Running pre-processor..." });
      }

      await preProcessWorkspace(ws.dir, send);

      const files = await readWorkspaceFiles(ws.dir);
      workspaceByUser.set(userId, {
        id: ws.id, dir: ws.dir, region, awsEnv, createdAt: new Date().toISOString(),
        lastPlanOutput: null, lastPlanClean: null,
        totalInputTokens: 0, totalOutputTokens: 0, refinementCount: 0, busy: false,
      });

      send({ phase: "done", message: "Workspace ready.", files });
    } catch (err) {
      send({ phase: "error", message: err.message || "Workspace creation failed." });
    } finally {
      done = true;
      res.end();
    }
  }));

  app.get("/api/workspace", asyncRoute(async (req, res) => {
    const ws = getUserWorkspace(req.session.user.id);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    const files = await readWorkspaceFiles(ws.dir);
    res.json({ id: ws.id, region: ws.region, createdAt: ws.createdAt, files, lastPlanOutput: ws.lastPlanOutput, lastPlanClean: ws.lastPlanClean, totalInputTokens: ws.totalInputTokens, totalOutputTokens: ws.totalOutputTokens, refinementCount: ws.refinementCount, busy: ws.busy });
  }));

  app.put("/api/workspace/files", asyncRoute(async (req, res) => {
    const ws = getUserWorkspace(req.session.user.id);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    if (ws.busy) return res.status(409).json({ error: "Workspace is busy." });
    const { files } = req.body;
    if (!files || typeof files !== "object") return res.status(400).json({ error: "files object is required." });

    const protectedFiles = new Set(["main.tf", "imports.tf"]);
    const toWrite = {};
    for (const [name, content] of Object.entries(files)) {
      if (protectedFiles.has(name)) continue;
      validateFilename(name);
      toWrite[name] = content;
    }

    const existing = await readWorkspaceFiles(ws.dir);
    const fsLib = require("fs/promises");
    const pathLib = require("path");
    for (const name of Object.keys(existing)) {
      if (protectedFiles.has(name)) continue;
      if (!toWrite[name]) await fsLib.unlink(pathLib.join(ws.dir, name));
    }
    await writeWorkspaceFiles(ws.dir, toWrite);

    const updatedFiles = await readWorkspaceFiles(ws.dir);
    res.json({ files: updatedFiles });
  }));

  app.post("/api/workspace/plan", asyncRoute(async (req, res) => {
    const ws = getUserWorkspace(req.session.user.id);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    if (ws.busy) return res.status(409).json({ error: "Workspace is busy." });
    ws.busy = true;

    const send = sseHeaders(res);
    let done = false;
    const ac = new AbortController();
    res.on("close", () => { if (!done) ac.abort(); });

    try {
      send({ phase: "plan", message: "Running terraform plan..." });
      const result = await plan(ws.dir, { signal: ac.signal, env: ws.awsEnv });
      const planOutput = `${result.stdout}\n${result.stderr}`.trim();
      ws.lastPlanOutput = planOutput;
      ws.lastPlanClean = result.clean;
      const summary = (result.stdout || "").match(/Plan: .*/)?.[0] || (result.clean ? "No changes" : "see output");
      send({ phase: "done", message: `Plan complete (${summary}).`, stdout: result.stdout, stderr: result.stderr, clean: result.clean });
    } catch (err) {
      send({ phase: "error", message: err.message || "terraform plan failed." });
    } finally {
      ws.busy = false;
      done = true;
      res.end();
    }
  }));

  app.post("/api/workspace/refine", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    const ws = getUserWorkspace(userId);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    if (ws.busy) return res.status(409).json({ error: "Workspace is busy." });

    const llm = await getUserSetting(userId, "llm");
    if (!llm?.encryptedApiKey) return res.status(400).json({ error: "LLM API key is not configured." });
    const apiKey = decrypt(llm.encryptedApiKey);
    const model = ALLOWED_MODELS.has(req.body.model) ? req.body.model : (llm.model || "bedrock.claude-sonnet-4-6");
    const tokenBudget = llm.tokenBudget || 100000;
    const maxIterations = Number(req.body.maxIterations) || 5;

    ws.busy = true;
    const send = sseHeaders(res);
    let done = false;
    const ac = new AbortController();
    res.on("close", () => { if (!done) ac.abort(); });

    try {
      // Phase 1: Deterministic pre-processing
      send({ phase: "preprocess", message: "Running deterministic pre-processor to fix known issues..." });
      await preProcessWorkspace(ws.dir, send);

      // Phase 2: Multi-iteration LLM refinement loop
      const result = await runAgentLoop({
        workspaceDir: ws.dir,
        apiKey,
        baseURL: ANTHROPIC_BASE_URL,
        model,
        maxIterations,
        tokenBudget,
        signal: ac.signal,
        onProgress: (event) => {
          if (event.phase !== "done") send(event);
        },
      });

      ws.lastPlanClean = result.clean;
      ws.totalInputTokens += result.totalInputTokens;
      ws.totalOutputTokens += result.totalOutputTokens;
      ws.refinementCount += result.iterations || 1;

      const files = await readWorkspaceFiles(ws.dir);
      const planResult = await plan(ws.dir, { env: ws.awsEnv });
      ws.lastPlanOutput = `${planResult.stdout}\n${planResult.stderr}`.trim();

      send({ phase: "done", message: result.clean ? `Refinement complete — clean plan after ${result.iterations} iteration(s).` : `Refinement done after ${result.iterations} iteration(s) — plan still has changes.`, files, clean: result.clean, inputTokens: result.totalInputTokens, outputTokens: result.totalOutputTokens, iteration: result.iterations });
    } catch (err) {
      if (err.isAbort) {
        send({ phase: "error", message: "Refinement cancelled." });
      } else {
        send({ phase: "error", message: err.message || "Refinement failed." });
      }
    } finally {
      ws.busy = false;
      done = true;
      res.end();
    }
  }));

  app.delete("/api/workspace", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    const ws = getUserWorkspace(userId);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    if (ws.busy) return res.status(409).json({ error: "Workspace is busy. Wait for the current operation to finish." });
    await destroyWorkspace(ws.dir);
    workspaceByUser.delete(userId);
    res.json({ ok: true });
  }));

  app.post("/api/workspace/commit", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    const ws = getUserWorkspace(userId);
    if (!ws) return res.status(404).json({ error: "No active workspace." });
    const gitlab = await getUserSetting(userId, "gitlab");
    const { project, branch, filePrefix } = req.body;
    const files = await readWorkspaceFiles(ws.dir);
    const toCommit = {};
    for (const [name, content] of Object.entries(files)) {
      if (name !== "main.tf") toCommit[name] = content;
    }
    const result = await commitWorkspaceFiles({ gitlabSetting: gitlab, project, branch, filePrefix, files: toCommit });
    res.status(201).json(result);
  }));

  app.post("/api/import/generate", asyncRoute(async (req, res) => {
    const userId = req.session.user.id;
    const llm = await getUserSetting(userId, "llm");
    if (!llm?.encryptedApiKey) return res.status(400).json({ error: "LLM API key is not configured." });
    const apiKey = decrypt(llm.encryptedApiKey);

    const { selection, region } = req.body;
    const model = ALLOWED_MODELS.has(req.body.model) ? req.body.model : (llm.model || "bedrock.claude-sonnet-4-6");
    const maxIterations = Math.min(Number(req.body.maxIterations) || 10, 25);
    const tokenBudget = Math.min(Number(req.body.tokenBudget) || llm.tokenBudget || 100000, 500000);
    if (!selection || !selection.length) return res.status(400).json({ error: "No resources selected" });
    if (!region) return res.status(400).json({ error: "Region is required" });
    if (!VALID_AWS_REGION.test(region)) return res.status(400).json({ error: "Invalid AWS region." });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const ac = new AbortController();
    let userDisconnected = false;
    let generationDone = false;
    res.on("close", () => {
      if (!generationDone) {
        console.log("Client disconnected during generation");
        userDisconnected = true;
        ac.abort();
      }
    });

    (async () => {
      let workspaceDir = null;
      try {
        send({ phase: "init", message: `Mapping ${selection.length} selected resource(s) to Terraform types...` });

        const unmapped = [];
        const mapped = selection.map((resource, idx) => {
          const m = mapToTerraformImport(resource);
          if (!m) {
            unmapped.push(resource.arn || resource.service || "unknown");
            return null;
          }
          return {
            ...m,
            logicalName: `${m.tfType}_${slugify(resource.resourceType || resource.service)}_${idx + 1}`,
          };
        }).filter(Boolean);

        if (unmapped.length) {
          send({ phase: "init", message: `${unmapped.length} resource(s) could not be mapped and will be skipped: ${unmapped.slice(0, 3).join(", ")}${unmapped.length > 3 ? ` (+${unmapped.length - 3} more)` : ""}` });
        }

        if (!mapped.length) {
          send({ phase: "error", message: "No selected resources could be mapped to Terraform types. Ensure the resources you selected have import support." });
          return res.end();
        }

        const tfTypes = [...new Set(mapped.map((r) => r.tfType))];
        send({ phase: "init", message: `Mapped ${mapped.length} resource(s) across ${tfTypes.length} Terraform type(s): ${tfTypes.slice(0, 5).join(", ")}${tfTypes.length > 5 ? ` (+${tfTypes.length - 5} more)` : ""}` });

        const aws = await getUserSetting(userId, "aws");
        const credentials = decryptAwsCredentials(aws);
        const awsEnv = awsEnvFromCredentials(credentials);

        // Resolve config rule names (import ID must be rule name, not config-rule-id)
        const cfgRules = mapped.filter((r) => r.tfType === "aws_config_config_rule");
        if (cfgRules.length) {
          send({ phase: "init", message: `Resolving ${cfgRules.length} config rule name(s)...` });
          const resolved = await resolveConfigRuleNames(cfgRules.map((r) => r.importId), region, credentials);
          let cnt = 0;
          for (const r of cfgRules) {
            const name = resolved[r.importId];
            if (name) { r.importId = name; cnt++; }
          }
          if (cnt < cfgRules.length) {
            send({ phase: "init", message: `Resolved ${cnt}/${cfgRules.length} config rule names.` });
          }
        }

        send({ phase: "init", message: `Creating Terraform workspace in ${region}...` });
        const ws = await createWorkspace({ region, resources: mapped });
        workspaceDir = ws.dir;

        send({ phase: "init", message: "Running terraform init (downloading providers)..." });
        const initResult = await initWorkspace(ws.dir, { signal: ac.signal, env: awsEnv });
        if (initResult.stderr) {
          const warnings = initResult.stderr.split("\n").filter((l) => l.includes("Warning")).slice(0, 3);
          if (warnings.length) send({ phase: "init", message: `terraform init warnings: ${warnings.join("; ")}` });
        }
        send({ phase: "init", message: "terraform init complete." });

        try {
          const ver = await getTerraformVersion();
          const providers = Object.entries(ver.providers).map(([k, v]) => `${k.split("/").pop()} ${v}`).join(", ");
          send({ phase: "init", message: `Terraform ${ver.terraform}${providers ? ` | Providers: ${providers}` : ""}` });
        } catch {}

        send({ phase: "plan", message: "Running terraform plan -generate-config-out (this may take a minute)..." });
        const genResult = await planGenerateConfig(ws.dir, { signal: ac.signal, env: awsEnv });

        if (!genResult.generated) {
          const hint = genResult.stderr
            ? `\n\nterraform output:\n${genResult.stderr.slice(0, 500)}`
            : "";
          send({ phase: "error", message: `terraform plan did not generate any configuration. Check resource mappings and AWS credentials.${hint}` });
          return res.end();
        }

        send({ phase: "plan", message: `Initial config generated (${genResult.generated.split("\n").length} lines). Checking for missing resource blocks...` });

        // Find imports that have no generated resource block — retry then stub
        const generatedAddrs = new Set();
        const resRx = /^resource\s+"([^"]+)"\s+"([^"]+)"/gm;
        let rxm;
        while ((rxm = resRx.exec(genResult.generated)) !== null) {
          generatedAddrs.add(`${rxm[1]}.${rxm[2]}`);
        }
        const importsFilePath = path.join(ws.dir, "imports.tf");
        const importsRaw = await fs.readFile(importsFilePath, "utf8");
        const missingRes = [];
        const importRx = /import\s*\{[^}]*to\s*=\s*(\S+)[^}]*\}/g;
        let irm;
        while ((irm = importRx.exec(importsRaw)) !== null) {
          const addr = irm[1];
          if (!generatedAddrs.has(addr)) {
            const parts = addr.match(/^([^.]+)\.(.+)$/);
            if (parts) missingRes.push({ type: parts[1], name: parts[2] });
          }
        }
        if (missingRes.length > 0) {
          send({ phase: "plan", message: `${missingRes.length} resource(s) missing config. Retrying generate...` });
          const genPath = path.join(ws.dir, "generated.tf");
          const savedGen = await fs.readFile(genPath, "utf8");
          const missingSet = new Set(missingRes.map((r) => `${r.type}.${r.name}`));
          const allBlocks = importsRaw.match(/import\s*\{[^}]*\}/g) || [];
          const missingBlocks = allBlocks.filter((b) => {
            const toM = b.match(/to\s*=\s*(\S+)/);
            return toM && missingSet.has(toM[1]);
          });
          await fs.writeFile(importsFilePath, missingBlocks.join("\n\n") + "\n");
          await fs.unlink(genPath).catch(() => {});
          const retryRes = await planGenerateConfig(ws.dir, { signal: ac.signal, env: awsEnv });
          const merged = savedGen + "\n" + (retryRes.generated || "");
          await fs.writeFile(genPath, merged);
          await fs.writeFile(importsFilePath, importsRaw);
          const retryAddrs = new Set();
          const retryRx = /^resource\s+"([^"]+)"\s+"([^"]+)"/gm;
          let rm2;
          while ((rm2 = retryRx.exec(retryRes.generated || "")) !== null) {
            retryAddrs.add(`${rm2[1]}.${rm2[2]}`);
          }
          const stillMissing = missingRes.filter((r) => !retryAddrs.has(`${r.type}.${r.name}`));
          if (stillMissing.length > 0) {
            const stubs = stillMissing.map((r) => buildMinimalStub(r.type, r.name)).join("\n");
            const cur = await fs.readFile(genPath, "utf8");
            await fs.writeFile(genPath, cur + "\n" + stubs);
            send({ phase: "plan", message: `Retry recovered ${missingRes.length - stillMissing.length}. Stubbed ${stillMissing.length} remaining.` });
          } else {
            send({ phase: "plan", message: `Retry recovered all ${missingRes.length} missing resource(s).` });
          }
        } else {
          send({ phase: "plan", message: "All imports have config. Running pre-processor..." });
        }

        await preProcessWorkspace(ws.dir, send);

        send({ phase: "plan", message: `Starting LLM refinement with ${model}...` });
        send({ phase: "plan", message: `Budget: ${tokenBudget.toLocaleString()} tokens, max ${maxIterations} iterations.` });

        const result = await runAgentLoop({
          workspaceDir: ws.dir,
          apiKey,
          baseURL: ANTHROPIC_BASE_URL,
          model,
          maxIterations,
          tokenBudget,
          signal: ac.signal,
          onProgress: send,
        });

        const fileCount = result.files ? Object.keys(result.files).filter((f) => f !== "main.tf").length : 0;
        send({
          phase: "done",
          message: result.clean
            ? `Import generation complete — clean plan achieved in ${result.iterations} iteration(s). ${fileCount} file(s) generated.`
            : `Import generation complete after ${result.iterations} iteration(s) (${result.reason}). ${fileCount} file(s) generated — manual review recommended.`,
          files: result.files,
          iterations: result.iterations,
          totalInputTokens: result.totalInputTokens,
          totalOutputTokens: result.totalOutputTokens,
          clean: result.clean,
        });
      } catch (err) {
        console.error("Import generation error:", err);
        console.error("userDisconnected:", userDisconnected, "| error name:", err.name, "| error code:", err.code);
        if (userDisconnected) {
          send({ phase: "cancelled", message: "Generation cancelled — client disconnected." });
        } else {
          const detail = err.stderr ? `\n\nterraform output:\n${err.stderr.slice(0, 500)}` : "";
          send({ phase: "error", message: `${err.message || "Unexpected error during import generation."}${detail}` });
        }
      } finally {
        generationDone = true;
        if (workspaceDir) await destroyWorkspace(workspaceDir);
        res.end();
      }
    })();
  }));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use((error, _req, res, _next) => {
    const status = error.status && error.status >= 400 ? error.status : 500;
    console.error(`API error ${status}: ${error.message}`);
    if (status >= 500) console.error(error.stack);
    const safeMessage = status < 500
      ? (error.message || "Request failed")
      : "Unexpected server error";
    res.status(status).json({ error: safeMessage, status });
  });

  return app;
}

module.exports = { createApp };
