const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs/promises");
const path = require("path");
const { readWorkspaceFiles, writeWorkspaceFiles, plan, initWorkspace } = require("./workspace");

// --- Deterministic pre-processor for terraform plan -generate-config-out issues ---

function preProcessGeneratedConfig(content) {
  const lines = content.split("\n");
  const output = [];
  let removed = 0;

  // Patterns to remove entirely (line-based)
  const REMOVE_LINE_PATTERNS = [
    // Subnet conflicts
    /^\s*availability_zone_id\s*=\s*"[^"]*"\s*$/,
    /^\s*enable_lni_at_device_index\s*=\s*0\s*$/,
    /^\s*map_customer_owned_ip_on_launch\s*=\s*false\s*$/,
    /^\s*customer_owned_ipv4_pool\s*=\s*(""|null)\s*$/,
    /^\s*outpost_arn\s*=\s*(""|null)\s*$/,

    // LB target group: null attrs in target_failover / target_health_state blocks
    /^\s*on_deregistration\s*=\s*null\s*$/,
    /^\s*on_unhealthy\s*=\s*null\s*$/,
    /^\s*enable_unhealthy_connection_termination\s*=\s*null\s*$/,

    // GuardDuty filter: empty not_equals/equals lists (need min 1 item)
    /^\s*not_equals\s*=\s*\[\]\s*$/,
    /^\s*equals\s*=\s*\[\]\s*$/,
    /^\s*greater_than\s*=\s*null\s*$/,
    /^\s*less_than\s*=\s*null\s*$/,
    /^\s*greater_than_or_equal\s*=\s*null\s*$/,
    /^\s*less_than_or_equal\s*=\s*null\s*$/,

    // Lambda null source attrs (but keep filename placeholder — Terraform requires one of filename/image_uri/s3_bucket)
    /^\s*filename\s*=\s*null\s*$/,
    /^\s*image_uri\s*=\s*(null|"")\s*$/,
    /^\s*s3_bucket\s*=\s*(null|"")\s*$/,
    /^\s*s3_key\s*=\s*(null|"")\s*$/,
    /^\s*s3_object_version\s*=\s*(null|"")\s*$/,
    /^\s*publish\s*=\s*false\s*$/,

    // IPv6 / VPC zero/empty attrs
    /^\s*ipv6_netmask_length\s*=\s*0\s*$/,
    /^\s*ipv6_ipam_pool_id\s*=\s*""\s*$/,
    /^\s*ipv6_cidr_block\s*=\s*""\s*$/,
    /^\s*assign_generated_ipv6_cidr_block\s*=\s*false\s*$/,

    // DynamoDB recovery_period_in_days = 0
    /^\s*recovery_period_in_days\s*=\s*0\s*$/,

    // SNS signature_version = 0
    /^\s*signature_version\s*=\s*0\s*$/,

    // Route table: empty-string attrs in route blocks (invalid CIDR, empty gateway refs)
    /^\s*carrier_gateway_id\s*=\s*""\s*$/,
    /^\s*core_network_arn\s*=\s*""\s*$/,
    /^\s*destination_prefix_list_id\s*=\s*""\s*$/,
    /^\s*egress_only_gateway_id\s*=\s*""\s*$/,
    /^\s*local_gateway_id\s*=\s*""\s*$/,
    /^\s*nat_gateway_id\s*=\s*""\s*$/,
    /^\s*network_interface_id\s*=\s*""\s*$/,
    /^\s*transit_gateway_id\s*=\s*""\s*$/,
    /^\s*vpc_endpoint_id\s*=\s*""\s*$/,
    /^\s*vpc_peering_connection_id\s*=\s*""\s*$/,
    /^\s*ipv6_cidr_block\s*=\s*""\s*$/,

    // Computed-only attributes
    /^\s*owner_id\s*=\s*"[^"]*"\s*$/,
    /^\s*tags_all\s*=\s*\{\s*$/,

    // Generic zero/false/empty for known problematic attrs
    /^\s*enable_dns64\s*=\s*false\s*$/,
    /^\s*enable_resource_name_dns_aaaa_record_on_launch\s*=\s*false\s*$/,
    /^\s*enable_resource_name_dns_a_record_on_launch\s*=\s*false\s*$/,
    /^\s*private_dns_hostname_type_on_launch\s*=\s*""\s*$/,

    // Network interface: invalid interface_type values (only efa/efa-only/branch/trunk allowed)
    /^\s*interface_type\s*=\s*"(network_load_balancer|transit_gateway|lambda|nat_gateway|interface)"\s*$/,

    // Network interface: conflicting count/list pairs — remove counts and empty lists
    /^\s*ipv4_prefix_count\s*=\s*0\s*$/,
    /^\s*ipv4_prefixes\s*=\s*\[\]\s*$/,
    /^\s*ipv6_address_count\s*=\s*0\s*$/,
    /^\s*ipv6_address_list\s*=\s*\[\]\s*$/,
    /^\s*ipv6_addresses\s*=\s*\[\]\s*$/,
    /^\s*ipv6_prefix_count\s*=\s*0\s*$/,
    /^\s*ipv6_prefixes\s*=\s*\[\]\s*$/,
    /^\s*private_ip_list\s*=\s*\[.*\]\s*$/,
    /^\s*private_ip_list_enabled\s*=\s*false\s*$/,
    /^\s*private_ips_count\s*=\s*0\s*$/,

    // NAT gateway: conflicting secondary IP count/list
    /^\s*secondary_private_ip_address_count\s*=\s*0\s*$/,
    /^\s*secondary_private_ip_addresses\s*=\s*\[\]\s*$/,

    // RDS: domain_dns_ips empty (requires minimum 2 items)
    /^\s*domain_dns_ips\s*=\s*\[\]\s*$/,

    // EC2 instance: user_data causes hash drift on import (provider hashing mismatch)
    /^\s*user_data\s*=\s*"[a-f0-9]+"\s*$/,
    /^\s*user_data_base64\s*=\s*"[^"]*"\s*$/,
    /^\s*user_data_replace_on_change\s*=\s*(true|false)\s*$/,
  ];

  let insideTagsAll = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track tags_all block removal (multi-line)
    if (insideTagsAll) {
      if (line.includes("{")) braceDepth++;
      if (line.includes("}")) braceDepth--;
      if (braceDepth <= 0) { insideTagsAll = false; }
      removed++;
      continue;
    }

    // Check if this line starts a tags_all block
    if (/^\s*tags_all\s*=\s*\{/.test(line)) {
      // Single-line tags_all = {}
      if (/\}/.test(line)) { removed++; continue; }
      insideTagsAll = true;
      braceDepth = 1;
      removed++;
      continue;
    }

    // Check against removal patterns
    let shouldRemove = false;
    for (const pattern of REMOVE_LINE_PATTERNS) {
      if (pattern.test(line)) { shouldRemove = true; break; }
    }

    if (shouldRemove) {
      removed++;
      continue;
    }

    output.push(line);
  }

  // Clean up empty blocks left behind (e.g., "  route {\n  }")
  let result = output.join("\n");
  result = result.replace(/^(\s*)\w+\s*\{\s*\n\s*\}\s*$/gm, "");

  // Clean up point_in_time_recovery blocks that only had recovery_period_in_days = 0
  result = result.replace(/^\s*point_in_time_recovery\s*\{\s*\n(\s*enabled\s*=\s*(true|false)\s*\n)?\s*\}\s*$/gm, "");

  // Network ACL: add missing ipv6_cidr_block = null to egress/ingress rule objects
  result = result.replace(
    /^(\s*)(egress|ingress)\s*=\s*\[([\s\S]*?)\]/gm,
    (match, indent, attr, body) => {
      const fixed = body.replace(
        /\{([^}]*)\}/g,
        (ruleMatch, ruleBody) => {
          let patched = ruleBody;
          if (!patched.includes('ipv6_cidr_block')) {
            patched = patched.trimEnd() + `\n    ipv6_cidr_block = null\n  `;
          }
          return `{${patched}}`;
        }
      );
      return `${indent}${attr} = [${fixed}]`;
    }
  );

  // Route table: add missing required attrs to route objects
  // ipv6_cidr_block must be null (empty string is invalid CIDR), others can be ""
  const ROUTE_STRING_ATTRS = [
    'carrier_gateway_id', 'core_network_arn', 'destination_prefix_list_id',
    'egress_only_gateway_id', 'local_gateway_id',
    'nat_gateway_id', 'network_interface_id', 'vpc_endpoint_id', 'vpc_peering_connection_id'
  ];
  result = result.replace(
    /^(\s*)route\s*=\s*\[([\s\S]*?)\]/gm,
    (match, indent, body) => {
      const fixed = body.replace(
        /\{([^}]*)\}/g,
        (ruleMatch, ruleBody) => {
          let patched = ruleBody;
          for (const reqAttr of ROUTE_STRING_ATTRS) {
            if (!patched.includes(reqAttr)) {
              patched = patched.trimEnd() + `\n    ${reqAttr} = ""\n  `;
            }
          }
          if (!patched.includes('ipv6_cidr_block')) {
            patched = patched.trimEnd() + `\n    ipv6_cidr_block = null\n  `;
          }
          return `{${patched}}`;
        }
      );
      return `${indent}route = [${fixed}]`;
    }
  );

  // LB target group: remove target_failover and target_health_state blocks (contain null-only attrs)
  result = result.replace(/^\s*target_failover\s*\{[^}]*\}\s*$/gm, "");
  result = result.replace(/^\s*target_health_state\s*\{[^}]*\}\s*$/gm, "");

  // LB listener: remove stickiness blocks with duration = 0 (invalid/drift-causing)
  result = result.replace(
    /^\s*stickiness\s*\{[^}]*?duration\s*=\s*0[^}]*?\}\s*$/gm,
    ""
  );

  // LB listener forward action: remove stickiness blocks entirely (NLB forward stickiness
  // state can't be accurately captured by generate-config — always causes drift)
  result = result.replace(
    /^(\s*)stickiness\s*\{\s*\n(?:\s*(?:duration|enabled)\s*=\s*[^\n]*\n)*\s*\}\s*$/gm,
    ""
  );

  // LB: remove subnets line when subnet_mapping block is also present (conflict)
  result = result.replace(
    /(resource\s+"aws_lb"\s+"[^"]+"\s*\{)([\s\S]*?)(\n\})/g,
    (match, head, body, tail) => {
      if (body.includes("subnet_mapping") && /^\s*subnets\s*=/m.test(body)) {
        body = body.replace(/^\s*subnets\s*=\s*\[.*?\]\s*$/gm, "");
      }
      return head + body + tail;
    }
  );

  // Backup plan: remove advanced_backup_setting blocks with resource_type = "S3"
  // Only "EC2" is valid per Terraform AWS provider; "S3" causes validation error
  // Must handle nested braces (backup_options = { ... }) — scan line-by-line
  {
    const lines = result.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      if (/^\s*advanced_backup_setting\s*\{/.test(lines[i])) {
        const blockStart = i;
        let depth = 1;
        i++;
        while (i < lines.length && depth > 0) {
          if (lines[i].includes("{")) depth++;
          if (lines[i].includes("}")) depth--;
          i++;
        }
        const blockLines = lines.slice(blockStart, i);
        const hasS3 = blockLines.some(l => /resource_type\s*=\s*"S3"/.test(l));
        if (!hasS3) {
          out.push(...blockLines);
        }
      } else {
        out.push(lines[i]);
        i++;
      }
    }
    result = out.join("\n");
  }

  // ACM certificate: remove validation_method = "NONE" (invalid value)
  result = result.replace(/^\s*validation_method\s*=\s*"NONE"\s*$/gm, "");

  // Secrets Manager: inject provider defaults that terraform omits from generated config
  result = result.replace(
    /(resource\s+"aws_secretsmanager_secret"\s+"[^"]+"\s*\{)([\s\S]*?)(\n\})/g,
    (match, head, body, tail) => {
      if (!body.includes("recovery_window_in_days")) {
        body += `\n  recovery_window_in_days = 30`;
      }
      if (!body.includes("force_overwrite_replica_secret")) {
        body += `\n  force_overwrite_replica_secret = false`;
      }
      return head + body + tail;
    }
  );

  // EC2 instances: inject lifecycle ignore_changes for user_data (hash always drifts on import)
  result = result.replace(
    /(resource\s+"aws_instance"\s+"[^"]+"\s*\{)([\s\S]*?)(\n\})/g,
    (match, head, body, tail) => {
      if (!body.includes("lifecycle")) {
        body += `\n\n  lifecycle {\n    ignore_changes = [user_data, user_data_base64]\n  }`;
      }
      return head + body + tail;
    }
  );

  // Lambda functions: ensure at least one source attr exists (filename/image_uri/s3_bucket required)
  // After pre-processor strips null values, some Lambdas have none left — inject placeholder
  result = result.replace(
    /(resource\s+"aws_lambda_function"\s+"[^"]+"\s*\{)([\s\S]*?)(\n\})/g,
    (match, head, body, tail) => {
      const hasSource = /\b(filename|image_uri|s3_bucket)\s*=/.test(body);
      if (!hasSource) {
        const injected = body.replace(
          /(function_name\s*=\s*"[^"]*"\n)/,
          `$1  filename = "/tmp/placeholder.zip"\n`
        );
        if (injected !== body) {
          body = injected;
        } else {
          body = `\n  filename = "/tmp/placeholder.zip"` + body;
        }
      }
      if (!body.includes("lifecycle")) {
        body += `\n\n  lifecycle {\n    ignore_changes = [filename]\n  }`;
      }
      return head + body + tail;
    }
  );



  // Collapse triple+ blank lines
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

async function preProcessWorkspace(workspaceDir, onProgress) {
  const send = onProgress || (() => {});
  const files = await readWorkspaceFiles(workspaceDir);
  let totalFixes = 0;

  const fileNames = Object.keys(files).filter((k) => k !== "main.tf" && k !== "imports.tf");
  console.log(`[preprocess] Processing ${fileNames.length} file(s): ${fileNames.join(", ")}`);

  for (const [name, content] of Object.entries(files)) {
    if (name === "main.tf" || name === "imports.tf") continue;
    console.log(`[preprocess] ${name}: ${content.split("\n").length} lines, first 200 chars: ${content.slice(0, 200).replace(/\n/g, "\\n")}`);
    const processed = preProcessGeneratedConfig(content);
    if (processed !== content) {
      const linesBefore = content.split("\n").length;
      const linesAfter = processed.split("\n").length;
      const removed = linesBefore - linesAfter;
      totalFixes += removed;
      console.log(`[preprocess] ${name}: removed ${removed} lines`);
      await fs.writeFile(path.join(workspaceDir, name), processed);
    } else {
      console.log(`[preprocess] ${name}: no changes`);
    }
  }

  if (totalFixes > 0) {
    send({ phase: "preprocess", message: `Pre-processor removed ${totalFixes} problematic lines (conflicting args, zero values, computed attrs).` });
  } else {
    send({ phase: "preprocess", message: "Pre-processor: no known issues found." });
  }

  return totalFixes;
}

// --- End pre-processor ---

const SYSTEM_PROMPT = `You are a Terraform expert refining auto-generated import configuration.

You will receive the current Terraform files in a workspace and the output of terraform plan.

YOUR ONLY JOB: Fix all errors in the plan output. Do NOT reorganize, split files, create variables, or restructure. Keep everything in the same file(s) you received. Be concise and fast.

Error fixing rules:
- Remove arguments that are set to their provider default or are computed/read-only values.
- Fix conflicting arguments — keep the human-readable one, remove the internal/computed one:
  - availability_zone vs availability_zone_id → keep availability_zone, REMOVE availability_zone_id
  - subnet_id vs availability_zone → keep subnet_id, remove availability_zone
- Remove attributes set to zero or empty string when Terraform rejects them:
  - enable_lni_at_device_index = 0 → remove
  - signature_version = 0 → remove
  - recovery_period_in_days = 0 → remove entire point_in_time_recovery block
  - ipv6_netmask_length = 0 → remove (and ipv6_ipam_pool_id = "" if present)
- Remove co-dependent attribute groups when not all members have meaningful values:
  - map_customer_owned_ip_on_launch + customer_owned_ipv4_pool + outpost_arn → remove all three
- Remove null/empty source attributes for Lambda: filename = null, image_uri = null, s3_bucket = null
- In route blocks: remove ALL attributes set to "" (empty string). Keep only non-empty values.
- Remove computed-only attributes: arn, owner_id, tags_all

Import drift handling (these ALWAYS drift on import — fix with lifecycle blocks):
- aws_instance user_data: Remove user_data and user_data_base64 attributes entirely. Add lifecycle { ignore_changes = [user_data, user_data_base64] } if not already present.
- aws_lambda_function filename: Keep filename = "/tmp/placeholder.zip" (Terraform requires one source attr). Add lifecycle { ignore_changes = [filename] } if not already present. Do NOT include last_modified in ignore_changes (it is provider-decided, not configurable).
- aws_backup_plan advanced_backup_setting: Remove any advanced_backup_setting block with resource_type = "S3" — only "EC2" is valid per the Terraform AWS provider. Do NOT preserve or re-add S3 blocks.
- aws_config_config_rule input_parameters whitespace: These are cosmetic JSON formatting differences — leave as-is, they resolve on first apply.
- aws_lb_listener forward stickiness: Remove stickiness blocks inside forward actions (NLB stickiness state can't be captured accurately by generate-config).

Constraints:
- Keep import blocks in imports.tf unchanged — do not modify resource addresses or import IDs.
- Do NOT add or remove resources. Only refine the existing ones.
- Do NOT modify main.tf (provider configuration).
- Do NOT reorganize into multiple files. Keep the same file structure you received.
- Do NOT create variables.tf or extract variables.
- CRITICAL: You MUST output EVERY resource from the input. If you received 20 resources, output 20 resources. Never truncate or skip resources. Missing resources will cause "Configuration for import target does not exist" errors.

Output format — return the complete contents of each .tf file you want to write or update:
### FILE: <filename>
<full file content>

Include every .tf file that should exist in the workspace (except main.tf and imports.tf).
Files you do not mention will be deleted.

Correctness rule:
After your changes, terraform plan must show ONLY import actions and in-place updates (changes).
In-place updates on imported resources are ACCEPTABLE — these are read-only/computed attributes
that Terraform will reconcile after the first apply (e.g., tags_all, arn, owner_id).
The goal is: 0 errors, 0 to add, 0 to destroy. In-place changes are fine.
If your previous changes caused ADDITIONS or DESTRUCTIONS, the plan output below shows what went wrong — fix it.`;

function isSafeFilename(name) {
  return /^[a-zA-Z0-9_.-]+\.(tf|tfvars)$/.test(name) && !name.includes("..");
}

function parseFileBlocks(text) {
  const files = {};
  const regex = /### FILE:\s*(\S+)\s*\n([\s\S]*?)(?=### FILE:|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    const content = match[2].replace(/^```\w*\n?/, "").replace(/\n?```\s*$/, "").trimEnd() + "\n";
    if (name !== "main.tf" && name !== "imports.tf" && isSafeFilename(name)) {
      files[name] = content;
    }
  }
  return files;
}

function buildUserMessage(files, planOutput, iteration, customPrompt) {
  const fileSection = Object.entries(files)
    .filter(([name]) => name !== "main.tf" && name !== "imports.tf")
    .map(([name, content]) => `### FILE: ${name}\n${content}`)
    .join("\n\n");

  const prefix = iteration === 0
    ? "This is the initial generated configuration. Please refine it."
    : "Your previous changes caused issues. The plan output below shows what went wrong. Please fix it.";

  let msg = `${prefix}

Current Terraform files:

${fileSection}

Terraform plan output:

${planOutput}`;

  if (customPrompt) {
    msg += `\n\nAdditional instructions from the user:\n${customPrompt}`;
  }
  return msg;
}

async function applyLlmFiles(workspaceDir, newFiles, onProgress) {
  const allFiles = await readWorkspaceFiles(workspaceDir);
  const existingTfFiles = Object.keys(allFiles).filter((f) => f !== "main.tf" && f !== "imports.tf");
  const removed = [];
  for (const old of existingTfFiles) {
    if (!newFiles[old]) {
      await fs.unlink(path.join(workspaceDir, old));
      removed.push(old);
    }
  }
  if (removed.length && onProgress) {
    onProgress({ phase: "llm", message: `Removed ${removed.length} stale file(s): ${removed.join(", ")}` });
  }
  await writeWorkspaceFiles(workspaceDir, newFiles);
  const finalFiles = await readWorkspaceFiles(workspaceDir);
  return finalFiles;
}

async function runSingleRefinement({ workspaceDir, apiKey, baseURL, model, customPrompt, signal, onProgress }) {
  const resolvedBaseURL = baseURL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  const client = new Anthropic({ apiKey, baseURL: resolvedBaseURL });
  const modelId = model || "bedrock.claude-sonnet-4-6";
  const send = onProgress || (() => {});

  send({ phase: "llm", message: "Reading workspace files..." });
  const files = await readWorkspaceFiles(workspaceDir);

  send({ phase: "validate", message: "Running terraform plan to assess current state..." });
  if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });
  const planResult = await plan(workspaceDir, { signal });
  const planOutput = `${planResult.stdout}\n${planResult.stderr}`.trim();

  if (planResult.clean) {
    send({ phase: "done", message: "Plan is already clean — no refinement needed." });
    return { files, planOutput, clean: true, inputTokens: 0, outputTokens: 0 };
  }

  send({ phase: "llm", message: `Sending configuration to ${modelId}...` });
  const userMessage = buildUserMessage(files, planOutput, 0, customPrompt);

  let response;
  try {
    const stream = client.messages.stream({
      model: modelId,
      max_tokens: 128000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    let outputSoFar = 0;
    stream.on("text", (text) => {
      outputSoFar += text.length;
      if (outputSoFar % 2000 < text.length) {
        send({ phase: "llm", message: `Streaming response... (~${Math.round(outputSoFar / 1000)}k chars received)` });
      }
    });
    response = await stream.finalMessage();
  } catch (err) {
    const detail = err.status ? `(HTTP ${err.status})` : "";
    send({ phase: "error", message: `LLM API error ${detail}: ${err.message}` });
    throw err;
  }

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  send({ phase: "llm", message: `LLM responded (${(inputTokens + outputTokens).toLocaleString()} tokens). Parsing file changes...` });

  const assistantText = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const newFiles = parseFileBlocks(assistantText);
  const newFileNames = Object.keys(newFiles);

  if (newFileNames.length === 0) {
    send({ phase: "error", message: "LLM returned no parseable file blocks." });
    return { files, planOutput, clean: false, inputTokens, outputTokens };
  }

  send({ phase: "llm", message: `LLM produced ${newFileNames.length} file(s): ${newFileNames.join(", ")}. Writing to workspace...` });
  const updatedFiles = await applyLlmFiles(workspaceDir, newFiles, send);

  send({ phase: "validate", message: "Running terraform init -upgrade..." });
  if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });
  try { await initWorkspace(workspaceDir, { signal, upgrade: true }); } catch {}

  send({ phase: "validate", message: "Running terraform plan to validate changes..." });
  const validateResult = await plan(workspaceDir, { signal });
  const validateOutput = `${validateResult.stdout}\n${validateResult.stderr}`.trim();

  const summary = (validateResult.stdout || "").match(/Plan: .*/)?.[0] || (validateResult.clean ? "clean" : "changes pending");
  send({ phase: "done", message: `Refinement complete (${summary}).` });

  return { files: updatedFiles, planOutput: validateOutput, clean: validateResult.clean, inputTokens, outputTokens };
}

const CHUNK_SYSTEM_PROMPT = `You are a Terraform expert refining auto-generated import configuration.

You will receive a CHUNK of Terraform resources and relevant plan errors for those resources.

Your job is to FIX ERRORS only. Do NOT reorganize, rename files, or restructure.

Error fixing rules:
- Remove arguments that are set to their provider default or are computed/read-only values.
- Fix conflicting arguments — keep the human-readable one, remove the internal/computed one:
  - availability_zone vs availability_zone_id → keep availability_zone, REMOVE availability_zone_id
  - subnet_id vs availability_zone → keep subnet_id, remove availability_zone
- Remove attributes set to zero or empty string when Terraform rejects them:
  - enable_lni_at_device_index = 0 → remove
  - signature_version = 0 → remove
  - recovery_period_in_days = 0 → remove entire point_in_time_recovery block
  - ipv6_netmask_length = 0 → remove (and ipv6_ipam_pool_id = "" if present)
- Remove co-dependent attribute groups when not all members have meaningful values:
  - map_customer_owned_ip_on_launch + customer_owned_ipv4_pool + outpost_arn → remove all three
- Remove null/empty source attributes for Lambda: filename = null, image_uri = null, s3_bucket = null
- In route blocks: remove ALL attributes set to "" (empty string). Keep only non-empty values.
- Remove computed-only attributes: arn, owner_id, tags_all

Import drift handling:
- aws_instance: Remove user_data/user_data_base64 attrs. Add lifecycle { ignore_changes = [user_data, user_data_base64] }.
- aws_lambda_function: Keep filename = "/tmp/placeholder.zip" (required). Add lifecycle { ignore_changes = [filename] }. Do NOT include last_modified in ignore_changes.
- aws_backup_plan: Remove advanced_backup_setting blocks with resource_type = "S3" (only "EC2" is valid).
- aws_lb_listener forward stickiness: Remove stickiness blocks inside forward actions.

Constraints:
- Output EVERY resource you received. Do NOT skip or omit any.
- Do NOT add or remove resources. Only fix errors in existing ones.
- Keep import blocks unchanged.

Output format — return the fixed resources:
### FILE: generated.tf
<full content of all resources in this chunk, fixed>`;

function splitResourceChunks(content, maxResources = 150) {
  const blocks = [];
  const regex = /^(resource\s+"[^"]+"\s+"[^"]+"\s*\{)/gm;
  const positions = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    positions.push(m.index);
  }
  if (positions.length === 0) return [content];

  const chunks = [];
  for (let i = 0; i < positions.length; i += maxResources) {
    const start = positions[i];
    const end = i + maxResources < positions.length ? positions[i + maxResources] : content.length;
    chunks.push(content.slice(start, end).trim());
  }
  return chunks;
}

function extractPlanErrorsForChunk(planOutput, chunkContent) {
  const resourceNames = [];
  const regex = /resource\s+"([^"]+)"\s+"([^"]+)"/g;
  let m;
  while ((m = regex.exec(chunkContent)) !== null) {
    resourceNames.push(`${m[1]}.${m[2]}`);
  }
  const lines = planOutput.split("\n");
  const relevantLines = [];
  let capturing = false;
  for (const line of lines) {
    if (resourceNames.some((name) => line.includes(name))) {
      capturing = true;
    }
    if (capturing) {
      relevantLines.push(line);
      if (line.trim() === "" && relevantLines.length > 2) capturing = false;
    }
  }
  return relevantLines.length > 0 ? relevantLines.join("\n") : planOutput.slice(0, 3000);
}

async function runAgentLoop({ workspaceDir, apiKey, baseURL, model, maxIterations, tokenBudget, signal, onProgress }) {
  const resolvedBaseURL = baseURL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
  console.log(`[agent] baseURL=${resolvedBaseURL}, apiKey prefix=${apiKey?.slice(0,8)}, model=${model}`);
  const client = new Anthropic({ apiKey, baseURL: resolvedBaseURL });
  const modelId = model || "bedrock.claude-sonnet-4-6";

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iteration = 0;

  const files = await readWorkspaceFiles(workspaceDir);
  const fileCount = Object.keys(files).length;
  onProgress({ phase: "llm", message: `Workspace has ${fileCount} file(s). Running initial terraform plan to check baseline...`, iteration: 0, tokensUsed: 0 });

  const initialPlan = await plan(workspaceDir, { signal });
  if (initialPlan.clean) {
    onProgress({ phase: "done", message: "Generated config already produces a clean plan — no LLM refinement needed.", iteration: 0, tokensUsed: 0 });
    return { files, iterations: 0, totalInputTokens: 0, totalOutputTokens: 0, clean: true };
  }

  const planIssues = (initialPlan.stdout || "").match(/Plan: .*/)?.[0] || "plan has pending changes";
  let planOutput = `${initialPlan.stdout}\n${initialPlan.stderr}`.trim();
  let currentFiles = { ...files };

  const generatedContent = Object.entries(currentFiles)
    .filter(([k]) => k !== "main.tf" && k !== "imports.tf")
    .map(([, v]) => v).join("\n");
  const totalResources = (generatedContent.match(/^resource\s+"/gm) || []).length;

  if (totalResources > 200) {
    onProgress({ phase: "llm", message: `Large workspace detected (${totalResources} resources). Using chunked processing to avoid timeouts...`, iteration: 0, tokensUsed: 0 });

    const genFile = Object.entries(currentFiles).find(([k]) => k !== "main.tf" && k !== "imports.tf");
    if (!genFile) {
      onProgress({ phase: "error", message: "No generated file found to process.", iteration: 0, tokensUsed: 0 });
      return { files: currentFiles, iterations: 0, totalInputTokens, totalOutputTokens, clean: false, reason: "no_generated_file" };
    }

    const [genFileName, genContent] = genFile;
    const chunks = splitResourceChunks(genContent, 150);
    onProgress({ phase: "llm", message: `Split into ${chunks.length} chunks (~150 resources each). Processing sequentially...`, iteration: 0, tokensUsed: 0 });

    const processedChunks = [];
    for (let c = 0; c < chunks.length; c++) {
      if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });

      const budgetUsed = totalInputTokens + totalOutputTokens;
      if (budgetUsed >= tokenBudget) {
        onProgress({ phase: "done", message: `Token budget exhausted at chunk ${c + 1}/${chunks.length}.`, iteration: c, tokensUsed: budgetUsed });
        break;
      }

      const chunkErrors = extractPlanErrorsForChunk(planOutput, chunks[c]);
      const chunkResourceCount = (chunks[c].match(/^resource\s+"/gm) || []).length;
      onProgress({ phase: "llm", message: `Chunk ${c + 1}/${chunks.length}: Processing ${chunkResourceCount} resources with ${modelId}...`, iteration: c + 1, tokensUsed: budgetUsed });

      const userMsg = `Fix errors in these ${chunkResourceCount} resources.\n\nTerraform resources:\n\`\`\`hcl\n${chunks[c]}\n\`\`\`\n\nRelevant plan errors:\n${chunkErrors}`;

      let response;
      try {
        const stream = client.messages.stream({
          model: modelId,
          max_tokens: 32768,
          system: CHUNK_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        });
        let outputSoFar = 0;
        stream.on("text", (text) => {
          outputSoFar += text.length;
          if (outputSoFar % 2000 < text.length) {
            onProgress({ phase: "llm", message: `Chunk ${c + 1}/${chunks.length}: Streaming... (~${Math.round(outputSoFar / 1000)}k chars)`, iteration: c + 1, tokensUsed: budgetUsed });
          }
        });
        response = await stream.finalMessage();
      } catch (err) {
        const detail = err.status ? `(HTTP ${err.status})` : "";
        onProgress({ phase: "error", message: `Chunk ${c + 1} LLM error ${detail}: ${err.message}. Using original chunk.`, iteration: c + 1, tokensUsed: budgetUsed });
        processedChunks.push(chunks[c]);
        continue;
      }

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const assistantText = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const parsed = parseFileBlocks(assistantText);
      const chunkOutput = Object.values(parsed).join("\n").trim();

      if (chunkOutput) {
        const outCount = (chunkOutput.match(/^resource\s+"/gm) || []).length;
        if (outCount >= chunkResourceCount * 0.9) {
          processedChunks.push(chunkOutput);
          onProgress({ phase: "llm", message: `Chunk ${c + 1}/${chunks.length}: Done (${outCount} resources, ${(response.usage.input_tokens + response.usage.output_tokens).toLocaleString()} tokens).`, iteration: c + 1, tokensUsed: totalInputTokens + totalOutputTokens });
        } else {
          processedChunks.push(chunks[c]);
          onProgress({ phase: "error", message: `Chunk ${c + 1}: LLM dropped resources (${outCount}/${chunkResourceCount}). Using original.`, iteration: c + 1, tokensUsed: totalInputTokens + totalOutputTokens });
        }
      } else {
        processedChunks.push(chunks[c]);
        onProgress({ phase: "error", message: `Chunk ${c + 1}: No parseable output. Using original.`, iteration: c + 1, tokensUsed: totalInputTokens + totalOutputTokens });
      }
    }

    const combined = processedChunks.join("\n\n");
    await fs.writeFile(path.join(workspaceDir, genFileName), combined);
    currentFiles = await readWorkspaceFiles(workspaceDir);

    onProgress({ phase: "validate", message: `All chunks processed. Running terraform plan to validate...`, iteration: chunks.length, tokensUsed: totalInputTokens + totalOutputTokens });

    if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });
    try { await initWorkspace(workspaceDir, { signal, upgrade: true }); } catch {}
    const result = await plan(workspaceDir, { signal });
    planOutput = `${result.stdout}\n${result.stderr}`.trim();

    if (result.clean) {
      onProgress({ phase: "done", message: `Clean plan achieved after chunked processing. Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}.`, iteration: chunks.length, tokensUsed: totalInputTokens + totalOutputTokens });
      const finalFiles = await readWorkspaceFiles(workspaceDir);
      return { files: finalFiles, iterations: chunks.length, totalInputTokens, totalOutputTokens, clean: true };
    }

    const summary = (result.stdout || "").match(/Plan: .*/)?.[0] || "changes still pending";
    onProgress({ phase: "validate", message: `Chunked processing complete (${summary}). Running refinement pass...`, iteration: chunks.length, tokensUsed: totalInputTokens + totalOutputTokens });
    iteration = 1;
  } else {
    onProgress({ phase: "llm", message: `Baseline plan not clean (${planIssues}). Starting LLM refinement loop...`, iteration: 0, tokensUsed: 0 });
  }

  while (iteration < maxIterations) {
    if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });

    const budgetUsed = totalInputTokens + totalOutputTokens;
    if (budgetUsed >= tokenBudget) {
      onProgress({ phase: "done", message: `Token budget exhausted (${budgetUsed.toLocaleString()} / ${tokenBudget.toLocaleString()} tokens used). Returning best result after ${iteration} iteration(s).`, iteration, tokensUsed: budgetUsed });
      return { files: currentFiles, iterations: iteration, totalInputTokens, totalOutputTokens, clean: false, reason: "budget_exceeded" };
    }

    const remainingBudget = tokenBudget - budgetUsed;
    onProgress({ phase: "llm", message: `Iteration ${iteration + 1}/${maxIterations}: Sending configuration to ${modelId} (${remainingBudget.toLocaleString()} tokens remaining)...`, iteration: iteration + 1, tokensUsed: budgetUsed });

    const userMessage = buildUserMessage(currentFiles, planOutput, iteration);

    let response;
    try {
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: 32768,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      let outputSoFar = 0;
      stream.on("text", (text) => {
        outputSoFar += text.length;
        if (outputSoFar % 2000 < text.length) {
          onProgress({ phase: "llm", message: `Iteration ${iteration + 1}: Streaming... (~${Math.round(outputSoFar / 1000)}k chars received)`, iteration: iteration + 1, tokensUsed: budgetUsed });
        }
      });
      response = await stream.finalMessage();
    } catch (err) {
      const detail = err.status ? `(HTTP ${err.status})` : "";
      onProgress({ phase: "error", message: `LLM API error ${detail}: ${err.message}`, iteration: iteration + 1, tokensUsed: budgetUsed });
      throw err;
    }

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
    const roundTokens = response.usage.input_tokens + response.usage.output_tokens;

    onProgress({ phase: "llm", message: `Iteration ${iteration + 1}: LLM responded (${roundTokens.toLocaleString()} tokens this round). Parsing file changes...`, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });

    const assistantText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const newFiles = parseFileBlocks(assistantText);
    const newFileNames = Object.keys(newFiles);
    if (newFileNames.length === 0) {
      onProgress({ phase: "error", message: `Iteration ${iteration + 1}: LLM returned no parseable file blocks. Retrying...`, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });
      iteration++;
      continue;
    }

    const inputContent = Object.entries(currentFiles)
      .filter(([k]) => k !== "main.tf" && k !== "imports.tf")
      .map(([, v]) => v).join("\n");
    const inputResourceCount = (inputContent.match(/^resource\s+"/gm) || []).length;
    const outputContent = Object.values(newFiles).join("\n");
    const outputResourceCount = (outputContent.match(/^resource\s+"/gm) || []).length;
    if (inputResourceCount > 0 && outputResourceCount < inputResourceCount) {
      onProgress({ phase: "error", message: `Iteration ${iteration + 1}: LLM dropped resources (${outputResourceCount}/${inputResourceCount}). Output truncated — retrying.`, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });
      planOutput += "\n\nCRITICAL ERROR: Your previous output was TRUNCATED and only contained " + outputResourceCount + " resources instead of " + inputResourceCount + ". You MUST output ALL resources.";
      iteration++;
      continue;
    }

    onProgress({ phase: "llm", message: `Iteration ${iteration + 1}: LLM produced ${newFileNames.length} file(s) with ${outputResourceCount} resources. Writing to workspace...`, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });

    currentFiles = await applyLlmFiles(workspaceDir, newFiles, (event) => {
      onProgress({ ...event, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });
    });

    if (signal?.aborted) throw Object.assign(new Error("Cancelled"), { isAbort: true });
    try { await initWorkspace(workspaceDir, { signal, upgrade: true }); } catch {}

    onProgress({ phase: "validate", message: `Iteration ${iteration + 1}: Running terraform plan to validate changes...`, iteration: iteration + 1, tokensUsed: totalInputTokens + totalOutputTokens });

    const result = await plan(workspaceDir, { signal });
    planOutput = `${result.stdout}\n${result.stderr}`.trim();

    iteration++;

    if (result.clean) {
      onProgress({ phase: "done", message: `Clean plan achieved after ${iteration} iteration(s). Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}.`, iteration, tokensUsed: totalInputTokens + totalOutputTokens });
      const finalFiles = await readWorkspaceFiles(workspaceDir);
      return { files: finalFiles, iterations: iteration, totalInputTokens, totalOutputTokens, clean: true };
    }

    const planSummary = (result.stdout || "").match(/Plan: .*/)?.[0] || "changes still pending";
    onProgress({ phase: "validate", message: `Iteration ${iteration}: Plan not clean yet (${planSummary}). ${maxIterations - iteration} attempt(s) remaining.`, iteration, tokensUsed: totalInputTokens + totalOutputTokens });
  }

  onProgress({ phase: "done", message: `Reached max iterations (${maxIterations}). Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}. Manual review recommended.`, iteration, tokensUsed: totalInputTokens + totalOutputTokens });
  const finalFiles = await readWorkspaceFiles(workspaceDir);
  return { files: finalFiles, iterations: iteration, totalInputTokens, totalOutputTokens, clean: false, reason: "max_iterations" };
}

module.exports = { runAgentLoop, runSingleRefinement, preProcessWorkspace, parseFileBlocks };
