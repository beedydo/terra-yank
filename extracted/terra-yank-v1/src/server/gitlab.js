const https = require("https");
const { slugify } = require("./utils");
const { encrypt, decrypt } = require("./crypto");

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function publicIntegration(integration) {
  if (!integration) return null;
  const { encryptedToken, ...safe } = integration;
  return { ...safe, connected: Boolean(integration.connected), hasToken: Boolean(encryptedToken) };
}

function decryptGitlabToken(gitlabSetting) {
  if (!gitlabSetting?.encryptedToken) throw new Error("GitLab token is not configured.");
  return { token: decrypt(gitlabSetting.encryptedToken), integration: gitlabSetting };
}

function requestJson({ url, token, method, body, rejectUnauthorized }) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        rejectUnauthorized,
        headers: {
          "Content-Type": "application/json",
          "PRIVATE-TOKEN": token,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (_) {
            data = null;
          }
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, text, data });
        });
      },
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function gitlabRequest({ baseUrl, token, path, method = "GET", body, allowSelfSignedCert = true }) {
  if (!token) throw new Error("GitLab token is required.");

  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  try {
    const response = await requestJson({
      url,
      token,
      method,
      body,
      rejectUnauthorized: !allowSelfSignedCert,
    });

    if (!response.ok) {
      const message = response.data?.message || response.data?.error || response.text || `GitLab request failed with ${response.status}`;
      const detail = typeof message === "object" ? JSON.stringify(message) : String(message);
      const friendlyDetail = detail.includes("\"namespace\"")
        ? `${detail}. Select a GitLab group where your token has permission to create projects.`
        : detail;
      const error = new Error(`GitLab ${method} ${path} failed: ${friendlyDetail}`);
      error.status = response.status;
      error.data = response.data;
      console.error(`GitLab API error ${response.status} ${method} ${url}: ${detail}`);
      throw error;
    }
    return response.data;
  } catch (error) {
    if (error.code === "SELF_SIGNED_CERT_IN_CHAIN" || error.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      throw new Error("GitLab TLS certificate is not trusted by this container. Add the CA with NODE_EXTRA_CA_CERTS or enable internal/self-signed certificate trust for this integration.");
    }
    throw error;
  }
}

async function upsertGitlabIntegration(token, input, existing) {
  if (!token) throw new Error("GitLab token is required.");
  const baseUrl = normalizeBaseUrl(input.baseUrl);

  const user = await gitlabRequest({
    baseUrl,
    token,
    path: "/api/v4/user",
    allowSelfSignedCert: true,
  });

  return {
    id: input.id || existing?.id || "gitlab-default",
    type: "gitlab",
    name: input.name || existing?.name || "GitLab",
    baseUrl,
    encryptedToken: encrypt(token),
    defaultProject: input.defaultProject || existing?.defaultProject || "",
    defaultBranch: input.defaultBranch || existing?.defaultBranch || "main",
    filePrefix: input.filePrefix || existing?.filePrefix || "terra-yank",
    allowSelfSignedCert: input.allowSelfSignedCert !== false,
    connected: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      webUrl: user.web_url,
    },
    updatedAt: new Date().toISOString(),
  };
}

function groupProjects(projects) {
  const groups = {};
  for (const project of projects) {
    const namespace = project.namespace?.full_path || project.namespace?.path || "personal";
    if (!groups[namespace]) {
      groups[namespace] = {
        namespace,
        namespaceId: project.namespace?.id,
        projects: [],
      };
    }
    groups[namespace].projects.push({
      id: project.id,
      name: project.name,
      path: project.path,
      pathWithNamespace: project.path_with_namespace,
      defaultBranch: project.default_branch,
      webUrl: project.web_url,
      namespaceId: project.namespace?.id,
    });
  }

  return Object.values(groups)
    .sort((a, b) => a.namespace.localeCompare(b.namespace))
    .map((group) => ({
      ...group,
      projects: group.projects.sort((a, b) => a.pathWithNamespace.localeCompare(b.pathWithNamespace)),
    }));
}

async function listGitlabProjects(gitlabSetting) {
  const { token, integration } = decryptGitlabToken(gitlabSetting);
  if (!integration?.connected) throw new Error("Configure GitLab integration first.");

  const projects = await gitlabRequest({
    baseUrl: integration.baseUrl,
    token,
    path: "/api/v4/projects?membership=true&simple=true&per_page=100&order_by=last_activity_at",
    allowSelfSignedCert: integration.allowSelfSignedCert !== false,
  });

  return {
    integration: publicIntegration(integration),
    groups: groupProjects(projects || []),
  };
}

async function createGitlabProject({ gitlabSetting, name, namespaceId, visibility = "private" }) {
  const { token, integration } = decryptGitlabToken(gitlabSetting);
  if (!integration?.connected) throw new Error("Configure GitLab integration first.");
  if (!name) throw new Error("Project name is required.");
  if (!namespaceId) throw new Error("GitLab namespace is required. Load repositories, select a namespace/group, then create the repository.");

  const project = await gitlabRequest({
    baseUrl: integration.baseUrl,
    token,
    path: "/api/v4/projects",
    method: "POST",
    allowSelfSignedCert: integration.allowSelfSignedCert !== false,
    body: {
      name,
      path: slugify(name).replace(/_/g, "-"),
      namespace_id: namespaceId || undefined,
      visibility,
      initialize_with_readme: true,
    },
  });

  return {
    id: project.id,
    name: project.name,
    pathWithNamespace: project.path_with_namespace,
    defaultBranch: project.default_branch || "main",
    webUrl: project.web_url,
  };
}

async function putRepositoryFile({ token, integration, project, branch, filePath, content, message }) {
  const encodedProject = encodeURIComponent(project);
  const encodedPath = encodeURIComponent(filePath);
  const body = {
    branch,
    content,
    commit_message: message,
  };

  try {
    return await gitlabRequest({
      baseUrl: integration.baseUrl,
      token,
      path: `/api/v4/projects/${encodedProject}/repository/files/${encodedPath}`,
      method: "PUT",
      allowSelfSignedCert: integration.allowSelfSignedCert !== false,
      body,
    });
  } catch (error) {
    if (![400, 404].includes(error.status)) throw error;
    return gitlabRequest({
      baseUrl: integration.baseUrl,
      token,
      path: `/api/v4/projects/${encodedProject}/repository/files/${encodedPath}`,
      method: "POST",
      allowSelfSignedCert: integration.allowSelfSignedCert !== false,
      body,
    });
  }
}

async function commitImportArtifact({ gitlabSetting, project, branch, filePrefix, artifact }) {
  const { token, integration } = decryptGitlabToken(gitlabSetting);
  if (!integration?.connected) throw new Error("Configure GitLab integration first.");
  if (!project) throw new Error("GitLab project is required.");
  if (!artifact?.files?.length) throw new Error("Generate an import report before exporting.");

  const targetBranch = branch || integration.defaultBranch || "main";
  const prefix = slugify(filePrefix || integration.filePrefix || "terra-yank");
  const actions = [];

  for (const file of artifact.files) {
    const base = `${prefix}/${file.project}`;
    actions.push({
      filePath: `${base}/imports.tf`,
      content: file.importsTf,
    });
    actions.push({
      filePath: `${base}/selection.json`,
      content: JSON.stringify({
        generatedAt: artifact.generatedAt,
        region: artifact.region,
        account: artifact.account,
        resources: file.resources,
      }, null, 2),
    });
  }

  const results = [];
  for (const action of actions) {
    const result = await putRepositoryFile({
      token,
      integration,
      project,
      branch: targetBranch,
      filePath: action.filePath,
      content: action.content,
      message: `terra-yank export: ${prefix}`,
    });
    results.push({ path: action.filePath, result });
  }

  return {
    project,
    branch: targetBranch,
    files: results.map((item) => item.path),
    committedAt: new Date().toISOString(),
  };
}

async function commitWorkspaceFiles({ gitlabSetting, project, branch, filePrefix, files }) {
  const { token, integration } = decryptGitlabToken(gitlabSetting);
  if (!integration?.connected) throw new Error("Configure GitLab integration first.");
  if (!project) throw new Error("GitLab project is required.");
  if (!files || !Object.keys(files).length) throw new Error("No files to commit.");

  const targetBranch = branch || integration.defaultBranch || "main";
  const prefix = slugify(filePrefix || integration.filePrefix || "terra-yank");
  const results = [];

  for (const [name, content] of Object.entries(files)) {
    const filePath = `${prefix}/${name}`;
    const result = await putRepositoryFile({
      token, integration, project, branch: targetBranch,
      filePath, content, message: `terra-yank: update ${name}`,
    });
    results.push(filePath);
  }

  return { project, branch: targetBranch, files: results, committedAt: new Date().toISOString() };
}

module.exports = {
  commitImportArtifact,
  commitWorkspaceFiles,
  createGitlabProject,
  listGitlabProjects,
  publicIntegration,
  upsertGitlabIntegration,
};
