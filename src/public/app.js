const state = {
  page: "integrations",
  integrations: [],
  gitlabProjects: [],
  tfstateFiles: [],
  aws: {},
  llm: {},
  discovery: null,
  selected: new Map(),
  tab: "importable",
  artifact: null,
  importGen: null,
  workspace: null,
  user: null,
  expandedGroups: new Set(),
};

const regions = [
  ["ap-southeast-1", "ap-southeast-1 (Singapore)"],
  ["ap-southeast-2", "ap-southeast-2 (Sydney)"],
  ["us-east-1", "us-east-1 (N. Virginia)"],
  ["us-west-2", "us-west-2 (Oregon)"],
  ["eu-west-1", "eu-west-1 (Ireland)"],
];

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-visible");
  setTimeout(() => el.classList.remove("is-visible"), 4200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function streamSSE(url, body, { onEvent, onDone, onError }) {
  const ac = new AbortController();
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal })
    .then(async (response) => {
      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try { const j = await response.json(); msg = j.error || msg; } catch {}
        if (onError) onError(new Error(msg));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      function read() {
        reader.read().then(({ done, value }) => {
          if (done) { if (onDone) onDone(); return; }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try { onEvent(JSON.parse(line.slice(6))); } catch {}
          }
          read();
        }).catch((err) => { if (onError) onError(err); });
      }
      read();
    })
    .catch((err) => { if (err.name !== "AbortError" && onError) onError(err); });
  return ac;
}

function selectedResources() {
  return Array.from(state.selected.values());
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll(".nav__item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach((item) => {
    item.classList.toggle("is-active", item.id === `page-${page}`);
  });
  render();
}

function renderShell() {
  $("#heroSelected").textContent = state.selected.size;
  const status = $("#scanStatus");
  if (!state.discovery) {
    status.textContent = "Select a region and scan";
    return;
  }
  status.textContent = `${state.discovery.region} | ${state.discovery.totalDiscovered} resources`;
}

function gitlabIntegration() {
  return state.integrations.find((item) => item.type === "gitlab");
}

function renderIntegrations() {
  const gitlab = gitlabIntegration();
  const glConnected = gitlab?.connected && gitlab?.hasToken;
  const aws = state.aws;
  const llm = state.llm;
  $("#page-integrations").innerHTML = `
    <div class="integration-flow">
      <h2 class="section-heading">Credentials</h2>

      <section class="card aws-panel">
        <div class="step-heading">
          <span class="step-number" style="background:var(--blue)">AWS</span>
          <div>
            <h2>AWS Credentials</h2>
            <p>Provide ReadOnlyAccess credentials for resource discovery. Encrypted and stored on the server.</p>
          </div>
          <span class="status-pill ${aws.configured ? "" : "warn"}">${aws.configured ? "Key set" : "Key required"}</span>
        </div>
        <div class="form-grid compact">
          <div class="field">
            <label>Access Key ID</label>
            <input id="awsAccessKeyId" type="password" placeholder="${aws.configured ? "Key is set (leave blank to keep)" : "AKIA..."}" />
          </div>
          <div class="field">
            <label>Secret Access Key</label>
            <input id="awsSecretAccessKey" type="password" placeholder="${aws.configured ? "Key is set (leave blank to keep)" : "Secret access key"}" />
          </div>
          <div class="field">
            <label>Session Token <small style="font-weight:700;text-transform:none;letter-spacing:normal">(optional)</small></label>
            <input id="awsSessionToken" type="password" placeholder="Optional — for temporary credentials" />
          </div>
        </div>
        <div class="button-row">
          <button class="btn primary" id="saveAwsSettings">Save AWS Credentials</button>
        </div>
      </section>

      <section class="card llm-panel">
        <div class="step-heading">
          <span class="step-number" style="background:var(--blue)">AI</span>
          <div>
            <h2>LLM Configuration</h2>
            <p>Provide your own API key. Encrypted and stored on the server.</p>
          </div>
          <span class="status-pill ${llm.configured ? "" : "warn"}">${llm.configured ? "Key set" : "Key required"}</span>
        </div>
        <div class="form-grid compact">
          <div class="field">
            <label>Anthropic API Key</label>
            <input id="llmApiKey" type="password" placeholder="${llm.configured ? "Key is set (leave blank to keep)" : "sk-ant-..."}" />
          </div>
          <div class="field">
            <label>Model</label>
            <select id="llmModel">
              <option value="bedrock.claude-sonnet-4-6" ${llm.model === "bedrock.claude-sonnet-4-6" ? "selected" : ""}>Claude Sonnet (recommended)</option>
              <option value="bedrock.claude-haiku-4-5" ${llm.model === "bedrock.claude-haiku-4-5" ? "selected" : ""}>Claude Haiku (faster, cheaper)</option>
            </select>
          </div>
          <div class="field">
            <label>Token Budget</label>
            <input id="llmTokenBudget" type="number" value="${llm.tokenBudget || 100000}" min="10000" max="1000000" step="10000" />
            <small style="color:var(--muted);font-size:0.78rem">Max tokens per import run. 100k ~ $0.50-2.00 depending on model.</small>
          </div>
        </div>
        <div class="button-row">
          <button class="btn primary" id="saveLlmSettings">Save LLM Settings</button>
        </div>
      </section>

      <section class="card">
        <div class="step-heading">
          <span class="step-number" style="background:var(--orange)">GL</span>
          <div>
            <h2>GitLab</h2>
            <p>${glConnected ? `Connected as ${escapeHtml(gitlab.user?.username || "GitLab user")}.` : "Token with API access for exporting imports to a repository."}</p>
          </div>
          <span class="status-pill ${glConnected ? "" : "warn"}">${glConnected ? "Connected" : "Token required"}</span>
        </div>
        <div class="form-grid compact">
          <div class="field">
            <label>Base URL</label>
            <input id="gitlabBaseUrl" placeholder="https://gitlab.example.com" value="${escapeHtml(gitlab?.baseUrl || "")}" />
          </div>
          <div class="field">
            <label>Access token</label>
            <input id="gitlabToken" type="password" placeholder="${gitlab?.hasToken ? "Leave blank to keep current token" : "glpat-..."}" />
          </div>
          <label class="checkline">
            <input id="gitlabAllowSelfSigned" type="checkbox" ${gitlab?.allowSelfSignedCert !== false ? "checked" : ""} />
            <span>
              Disable SSL certificate verification for GitLab
              <small>Temporary setting for this internal GitLab Dedicated endpoint.</small>
            </span>
          </label>
        </div>
        <div class="button-row">
          <button class="btn gitlab" id="connectGitlab">${glConnected ? "Update Token" : "Connect GitLab"}</button>
        </div>
      </section>

      <h2 class="section-heading">Repositories</h2>

      <section class="card ${glConnected ? "" : "is-muted"}">
        <div class="step-heading">
          <span class="step-number" style="background:var(--orange)">GL</span>
          <div>
            <h2>GitLab Repositories</h2>
            <p>${glConnected ? "Fetched repositories are grouped by namespace." : "Connect GitLab first, then repositories will appear here."}</p>
          </div>
          <button class="btn secondary" id="loadGitlabProjects" ${glConnected ? "" : "disabled"}>Refresh</button>
        </div>
        <div id="gitlabRepoList">${renderRepoGroups(glConnected ? gitlab : null)}</div>
        ${glConnected ? `
          <div class="create-repo-panel" style="margin-top:16px">
            <details>
              <summary>
                <span>
                  <strong>Create new repository</strong>
                  <small>Use this only if none of the listed repositories should receive imports.</small>
                </span>
                <span>+</span>
              </summary>
              <div class="form-grid compact">
                <div class="field">
                  <label>Namespace / group</label>
                  <select id="newRepoNamespace">
                    ${renderNamespaceOptions()}
                  </select>
                </div>
                <div class="field">
                  <label>Repository name</label>
                  <input id="newRepoName" placeholder="terra-yank-imports" />
                </div>
                <div class="field action-field">
                  <label>&nbsp;</label>
                  <button class="btn primary" id="createGitlabRepo">Create in GitLab</button>
                </div>
              </div>
            </details>
          </div>
        ` : ""}
      </section>
    </div>
  `;

  $("#connectGitlab").onclick = connectGitlab;
  $("#loadGitlabProjects").onclick = loadGitlabRepos;
  const createButton = $("#createGitlabRepo");
  if (createButton) createButton.onclick = createGitlabRepo;
  $("#saveAwsSettings").onclick = saveAwsCredentials;
  $("#saveLlmSettings").onclick = saveLlmCredentials;
}

function renderNamespaceOptions() {
  const groups = state.gitlabProjects.filter((group) => group.namespaceId);
  if (!groups.length) return `<option value="">Load repositories to select a namespace</option>`;
  return groups.map((group) => `
    <option value="${escapeHtml(group.namespaceId)}">${escapeHtml(group.namespace)}</option>
  `).join("");
}

function renderRepoGroups(gitlab) {
  if (!gitlab?.connected) return `<div class="empty">GitLab is not connected yet.</div>`;
  if (!state.gitlabProjects.length) return `<div class="empty">No repositories loaded yet. Click Refresh, or reconnect the token.</div>`;
  return `<div class="repo-list">${state.gitlabProjects.map((group) => `
    <details class="group" open>
      <summary>
        <strong>${escapeHtml(group.namespace)}</strong>
        <span class="pill">${group.projects.length} repos</span>
        <span>+</span>
      </summary>
      ${group.projects.map((repo) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(repo.name)}</strong>
            <p>${escapeHtml(repo.pathWithNamespace)}</p>
          </div>
          <span class="pill">${escapeHtml(repo.defaultBranch || "main")}</span>
        </div>
      `).join("")}
    </details>
  `).join("")}</div>`;
}

function renderDiscovery() {
  const d = state.discovery;
  $("#page-discovery").innerHTML = `
    <section class="card tfstate-panel" style="max-width:none;margin-bottom:18px">
      <details ${state.tfstateFiles.length ? "open" : ""}>
        <summary class="step-heading" style="cursor:pointer;margin-bottom:0">
          <span class="step-number" style="background:var(--blue)">TF</span>
          <div>
            <h2 style="margin:0">Terraform State Files <small style="font-size:0.65rem;font-weight:700;color:var(--muted);letter-spacing:0.08em;text-transform:uppercase;vertical-align:middle">(optional)</small></h2>
            <p style="margin:0;margin-top:4px">Upload .tfstate files to filter out resources already managed by Terraform.</p>
          </div>
          ${state.tfstateFiles.length ? `<span class="status-pill">${state.tfstateFiles.length} file${state.tfstateFiles.length > 1 ? "s" : ""} loaded</span>` : ""}
        </summary>
        <div class="form-grid compact" style="max-width:600px;margin-top:16px">
          <div class="field">
            <label>Select .tfstate file(s)</label>
            <input id="tfstateFileInput" type="file" multiple accept=".tfstate,.json" />
          </div>
          <div class="field action-field">
            <label>&nbsp;</label>
            <button class="btn primary" id="uploadTfstate">Upload</button>
          </div>
        </div>
        ${state.tfstateFiles.length ? `
          <div class="tfstate-file-list">
            ${state.tfstateFiles.map((f, i) => `
              <div class="tfstate-file-item">
                <div class="file-info">
                  <strong>${escapeHtml(f.name)}</strong>
                  <span class="file-count">${f.resourceCount} managed resources</span>
                </div>
                <button class="btn small danger" data-remove-tfstate="${i}">Remove</button>
              </div>
            `).join("")}
          </div>
          <div class="button-row" style="margin-top:12px">
            <button class="btn small danger" id="clearAllTfstate">Clear All</button>
          </div>
        ` : ""}
      </details>
    </section>
    <div class="grid export">
      <section class="card">
        <h2>Discovery</h2>
        <div class="button-row">
          <select id="regionSelect">${regions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          <button class="btn primary" id="runDiscovery">Run Discovery</button>
          <button class="btn secondary" id="selectAll">Select All</button>
          <button class="btn secondary" id="clearSelection">Clear Selection</button>
        </div>
        ${d ? renderStats(d) : ""}
        ${d ? renderResourceTabs() : `<div class="empty">Run discovery to classify AWS resources.</div>`}
      </section>
      <aside class="card">
        <h2>Selection Basket: ${state.selected.size}</h2>
        ${selectedResources().length ? selectedResources().map((resource) => `
          <div class="list-item">
            <div>
              <strong>${escapeHtml(resource.service)}</strong>
              <p class="arn">${escapeHtml(resource.arn)}</p>
            </div>
          </div>
        `).join("") : `<div class="empty">Select importable resources.</div>`}
      </aside>
    </div>
  `;

  $("#uploadTfstate").onclick = () => {
    const files = $("#tfstateFileInput").files;
    if (files.length) uploadTfstateFiles(files);
    else toast("Select one or more .tfstate files first.");
  };
  document.querySelectorAll("[data-remove-tfstate]").forEach((btn) => {
    btn.onclick = () => removeTfstateFile(Number(btn.dataset.removeTfstate));
  });
  const clearBtn = $("#clearAllTfstate");
  if (clearBtn) clearBtn.onclick = clearAllTfstate;
  $("#runDiscovery").onclick = runDiscovery;
  $("#selectAll").onclick = () => {
    const groups = [...(state.discovery?.notTaggedCategoryGroups || [])];
    for (const group of groups) {
      const importable = group.resources.filter((r) => r.importSupported && !r.managedBy);
      for (const resource of importable) {
        state.selected.set(resource.arn, { ...resource });
      }
    }
    state.artifact = null;
    document.querySelectorAll(".select-all-group").forEach((cb) => { cb.checked = true; });
    document.querySelectorAll("[data-select-arn]").forEach((cb) => {
      const arn = cb.dataset.selectArn;
      if (state.selected.has(arn)) cb.checked = true;
    });
    updateBasket();
  };
  $("#clearSelection").onclick = () => {
    state.selected.clear();
    state.artifact = null;
    render();
  };
  document.querySelectorAll(".tab").forEach((button) => {
    button.onclick = () => {
      state.tab = button.dataset.tab;
      render();
    };
  });
  document.querySelectorAll("[data-select-arn]").forEach((checkbox) => {
    checkbox.onchange = (event) => toggleResource(event.target.dataset.selectArn, event.target.checked);
  });
  document.querySelectorAll(".show-all-btn").forEach((btn) => {
    btn.onclick = () => {
      state.expandedGroups.add(btn.dataset.groupId);
      render();
    };
  });
  document.querySelectorAll(".select-all-group").forEach((checkbox) => {
    checkbox.onchange = (event) => {
      const groupId = event.target.dataset.groupId;
      const checked = event.target.checked;
      const groups = [...(state.discovery.notTaggedCategoryGroups || [])];
      const group = groups.find((g) => (g.category || g.gcciValue || g.label || "unknown") === groupId);
      if (!group) return;
      const importable = group.resources.filter((r) => r.importSupported);
      for (const resource of importable) {
        if (checked) state.selected.set(resource.arn, { ...resource });
        else state.selected.delete(resource.arn);
      }
      state.artifact = null;
      $("#heroSelected").textContent = state.selected.size;
      document.querySelectorAll("[data-select-arn]").forEach((cb) => {
        if (importable.some((r) => r.arn === cb.dataset.selectArn)) {
          cb.checked = checked;
        }
      });
      updateBasket();
    };
  });
}

function renderStats(d) {
  const nonGcci = (d.notTaggedCategoryGroups || []).flatMap((g) => g.resources || []);
  const importable = nonGcci.filter((item) => item.importSupported && !item.managedBy).length;
  const skipped = nonGcci.filter((item) => !item.importSupported && !item.managedBy).length;
  return `
    <div class="stats">
      <div class="stat"><label>Total</label><span>${d.totalDiscovered}</span></div>
      <div class="stat"><label>GCCI Owned</label><span>${d.gcciTaggedCount}</span></div>
      <div class="stat"><label>Importable</label><span>${importable}</span></div>
      <div class="stat"><label>Skipped</label><span>${skipped}</span></div>
      <div class="stat"><label>Managed</label><span>${d.managedCount ?? 0}</span></div>
    </div>
  `;
}

function tabLabel(tab) {
  if (tab === "gcci") return "GCCI Owned";
  if (tab === "skipped") return "Skipped";
  return tab[0].toUpperCase() + tab.slice(1);
}

function renderResourceTabs() {
  const d = state.discovery;
  const tabs = ["importable", "skipped", "gcci", "managed"];
  return `
    <div class="tabs">
      ${tabs.map((tab) => `
        <button class="tab ${state.tab === tab ? "is-active" : ""}" data-tab="${tab}">${tabLabel(tab)}</button>
      `).join("")}
    </div>
    ${renderStaleWarning(d)}
    ${renderSubResources(d)}
    <div class="resource-groups">${renderActiveGroups()}</div>
  `;
}

function renderStaleWarning(d) {
  if (!d.staleStateResources?.length) return "";
  return `
    <div class="stale-warning">
      <strong>Stale State Warning</strong>
      <p>${d.staleStateResources.length} resource(s) found in tfstate but not discovered in the cloud. These may have been deleted outside of Terraform.</p>
      <details>
        <summary>View stale resources</summary>
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>ID</th><th>Source File</th></tr></thead>
          <tbody>
            ${d.staleStateResources.map((r) => `
              <tr>
                <td>${escapeHtml(r.tfType)}</td>
                <td>${escapeHtml(r.name)}</td>
                <td class="arn">${escapeHtml(r.id || "—")}</td>
                <td>${escapeHtml(r.sourceFile)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </details>
    </div>
  `;
}

function renderSubResources(d) {
  if (!d.subResources?.length) return "";
  return `
    <div class="sub-resources-info">
      <details>
        <summary>${d.subResources.length} sub-resource(s) in state — not independently discoverable</summary>
        <p>These are child resources (policy attachments, bucket settings, permissions, etc.) managed by their parent resource in Terraform.</p>
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Source File</th></tr></thead>
          <tbody>
            ${d.subResources.map((r) => `
              <tr>
                <td>${escapeHtml(r.tfType)}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${escapeHtml(r.sourceFile)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </details>
    </div>
  `;
}

function allResources(d) {
  return [...(d.notTaggedCategoryGroups || []), ...(d.gcciGroups || [])].flatMap((group) => group.resources || []);
}

function renderActiveGroups() {
  const d = state.discovery;
  if (state.tab === "gcci") return renderGroups(d.gcciGroups || [], { disabled: true, note: "GCCI-owned baseline resource" });

  if (state.tab === "managed") {
    if (!d.tfstateLoaded) return `<div class="empty">Upload .tfstate files above to compare.</div>`;
    if (!d.managedCategoryGroups?.length) return `<div class="empty">No managed resources found in the uploaded state files.</div>`;
    return renderManagedGroups(d.managedCategoryGroups);
  }

  const groups = (d.notTaggedCategoryGroups || [])
    .map((group) => ({
      ...group,
      resources: group.resources.filter((resource) => state.tab === "importable" ? resource.importSupported : state.tab === "skipped" ? !resource.importSupported : true),
    }))
    .filter((group) => group.resources.length);

  if (!groups.length) return `<div class="empty">No ${state.tab} resources found.</div>`;
  return renderGroups(groups, { disabled: state.tab !== "importable", note: state.tab === "skipped" ? "Skipped" : undefined });
}

function renderGroups(groups, options = {}) {
  const INITIAL_SHOW = 50;
  return groups.map((group) => {
    const groupId = escapeHtml(group.category || group.gcciValue || group.label || "unknown");
    const showAll = state.expandedGroups && state.expandedGroups.has(groupId);
    const visibleResources = (showAll || group.resources.length <= INITIAL_SHOW)
      ? group.resources
      : group.resources.slice(0, INITIAL_SHOW);
    const hiddenCount = group.resources.length - visibleResources.length;
    const importableInGroup = group.resources.filter((r) => r.importSupported);
    const allSelected = importableInGroup.length > 0 && importableInGroup.every((r) => state.selected.has(r.arn));
    const showSelectAll = !options.disabled && importableInGroup.length > 0;
    return `
    <details class="group" ${group.resources.length < 80 ? "open" : ""}>
      <summary>
        <strong>${escapeHtml(group.label || group.gcciValue || group.category)}</strong>
        <span class="pill">${group.resources.length} resources</span>
        <span>+</span>
      </summary>
      ${showSelectAll ? `<label class="select-all-label"><input type="checkbox" class="select-all-group" data-group-id="${groupId}" ${allSelected ? "checked" : ""} /> Select all ${importableInGroup.length} importable</label>` : ""}
      <table class="resource-table">
        <thead>
          <tr>
            <th></th>
            <th>Type</th>
            <th>Resource</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${visibleResources.map((resource) => renderResourceRow(resource, options)).join("")}
        </tbody>
      </table>
      ${hiddenCount > 0 ? `<p><button class="btn small secondary show-all-btn" data-group-id="${groupId}">Show all ${group.resources.length} resources (+${hiddenCount} more)</button></p>` : ""}
    </details>
  `;
  }).join("");
}

function renderManagedGroups(groups) {
  const INITIAL_SHOW = 50;
  return groups.map((group) => {
    const groupId = escapeHtml(group.category || group.label || "unknown");
    const showAll = state.expandedGroups && state.expandedGroups.has(groupId);
    const visibleResources = (showAll || group.resources.length <= INITIAL_SHOW)
      ? group.resources
      : group.resources.slice(0, INITIAL_SHOW);
    const hiddenCount = group.resources.length - visibleResources.length;
    return `
    <details class="group" ${group.resources.length < 80 ? "open" : ""}>
      <summary>
        <strong>${escapeHtml(group.label || group.category)}</strong>
        <span class="pill">${group.resources.length} resources</span>
        <span>+</span>
      </summary>
      <table class="resource-table managed-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Terraform Address</th>
            <th>Module</th>
            <th>Provider</th>
            <th>State File</th>
          </tr>
        </thead>
        <tbody>
          ${visibleResources.map((r) => {
            const by = r.managedBy || {};
            const addr = `${by.tfType || r.tfType || ""}.${by.name || ""}`;
            const provider = by.provider ? by.provider.replace(/^provider\["|"\]$/g, "") : "";
            return `
              <tr>
                <td class="arn">${escapeHtml(r.arn)}</td>
                <td><code>${escapeHtml(addr)}</code></td>
                <td>${by.module ? `<code>${escapeHtml(by.module)}</code>` : "—"}</td>
                <td>${provider ? escapeHtml(provider) : "—"}</td>
                <td>${escapeHtml(by.sourceFile || "—")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      ${hiddenCount > 0 ? `<p><button class="btn small secondary show-all-btn" data-group-id="${groupId}">Show all ${group.resources.length} resources (+${hiddenCount} more)</button></p>` : ""}
    </details>
  `;
  }).join("");
}

function renderResourceRow(resource, options) {
  const checked = state.selected.has(resource.arn);
  const disabled = options.disabled || !resource.importSupported;
  let statusHtml;
  if (resource.managedBy) {
    statusHtml = `<span class="status-pill managed">Managed</span>`;
  } else if (resource.importSupported) {
    statusHtml = `<span class="status-pill">Importable</span>`;
  } else {
    statusHtml = `<span class="status-pill warn">${escapeHtml(options.note || "Skipped")}</span>`;
  }
  return `
    <tr>
      <td>${disabled ? "" : `<input type="checkbox" data-select-arn="${escapeHtml(resource.arn)}" ${checked ? "checked" : ""} />`}</td>
      <td><span class="pill">${escapeHtml(resource.tfType || resource.resourceType || resource.service)}</span></td>
      <td class="arn">${escapeHtml(resource.arn)}</td>
      <td>${statusHtml}</td>
    </tr>
  `;
}

function wsLog(message, phase) {
  if (!state.workspace) return;
  state.workspace.log.push({ time: new Date(), phase: phase || "info", message });
}

function renderWorkspaceLog() {
  const ws = state.workspace;
  if (!ws || !ws.log.length) return "";
  return `
    <div class="ws-log">
      ${ws.log.map((entry) => {
        const ts = entry.time.toLocaleTimeString();
        const cls = entry.phase === "error" ? "color:var(--danger)" : entry.phase === "done" ? "color:var(--green-dark)" : "color:var(--muted)";
        return `<div style="margin-bottom:4px"><span style="${cls};font-weight:700">[${ts}]</span> ${escapeHtml(entry.message)}</div>`;
      }).join("")}
    </div>
  `;
}

function renderExport() {
  const ws = state.workspace;
  const gitlab = gitlabIntegration();

  if (!ws) {
    const canCreate = state.selected.size > 0 && state.discovery?.region;
    $("#page-export").innerHTML = `
      <section class="card">
        <h2>Workspace</h2>
        <p>${state.selected.size ? `${state.selected.size} resource(s) selected in ${state.discovery?.region || "—"}` : "Select resources in Discovery first."}</p>
        <div class="button-row">
          <button class="btn primary" id="wsCreate" ${canCreate ? "" : "disabled"}>Create Workspace</button>
        </div>
        ${renderWorkspaceLog()}
      </section>
    `;
    const createBtn = $("#wsCreate");
    if (createBtn) createBtn.onclick = createWs;
    return;
  }

  const fileNames = Object.keys(ws.files);
  const activeFile = ws.activeFile && ws.files[ws.activeFile] !== undefined ? ws.activeFile : fileNames[0] || "";
  const isProtected = activeFile === "main.tf" || activeFile === "imports.tf";
  const dirty = ws.dirty.size > 0;
  const model = state.llm.model || "bedrock.claude-sonnet-4-6";
  const cost = ws.totalInputTokens ? estimateCost(ws.totalInputTokens, ws.totalOutputTokens, model) : "0.00";

  const planStatusText = ws.lastPlanClean === true ? "Clean" : ws.lastPlanClean === false ? "Has changes" : "Not run yet";
  const planStatusCls = ws.lastPlanClean === true ? "color:var(--green-dark)" : ws.lastPlanClean === false ? "color:var(--amber)" : "color:var(--muted)";

  const repoOptions = state.gitlabProjects.flatMap((g) => g.projects).map((r) => `<option value="${escapeHtml(r.pathWithNamespace)}">${escapeHtml(r.pathWithNamespace)}</option>`).join("");

  $("#page-export").innerHTML = `
    <div class="ws-toolbar">
      <div class="ws-toolbar-left">
        <button class="btn primary" id="wsPlan" ${ws.busy ? "disabled" : ""}>Run Plan</button>
        <button class="btn" id="wsSave" ${dirty && !ws.busy ? "" : "disabled"}>Save Files</button>
        <button class="btn danger" id="wsClose">Close Workspace</button>
      </div>
      <div class="ws-toolbar-right">
        <span style="${planStatusCls};font-weight:600">Plan: ${planStatusText}</span>
        <span style="color:var(--muted)">Region: ${escapeHtml(ws.region)}</span>
        ${ws.busy ? '<span class="spinner" style="width:16px;height:16px"></span>' : ""}
      </div>
    </div>

    <div class="ws-layout">
      <div class="ws-editor">
        <div class="ws-file-tabs">
          ${fileNames.map((f) => {
            const isDirty = ws.dirty.has(f);
            const active = f === activeFile;
            return `<button class="tab ws-tab ${active ? "is-active" : ""}" data-ws-file="${escapeHtml(f)}">${escapeHtml(f)}${isDirty ? "*" : ""}</button>`;
          }).join("")}
        </div>
        <textarea class="ws-file-content" id="wsFileContent" ${isProtected ? "readonly" : ""}>${escapeHtml(ws.files[activeFile] || "")}</textarea>
      </div>

      <div class="ws-sidebar">
        <div class="ws-plan-output">
          <h3>Plan Output</h3>
          <pre class="ws-plan-pre">${ws.lastPlanOutput ? escapeHtml(ws.lastPlanOutput) : "Run a plan to see output here."}</pre>
        </div>

        <div class="ws-refine">
          <h3>AI Refinement</h3>
          <textarea class="ws-prompt" id="wsPrompt" placeholder="Optional: guide the AI (e.g. 'remove all computed attributes from aws_subnet')" rows="3"></textarea>
          <button class="btn primary" id="wsRefine" ${ws.busy || !state.llm.configured ? "disabled" : ""}>Refine with AI</button>
        </div>

        <div class="ws-stats">
          <span>Refinements: ${ws.refinementCount}</span>
          <span>Tokens: ${(ws.totalInputTokens + ws.totalOutputTokens).toLocaleString()}</span>
          <span>Cost: ~$${cost}</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Log</h3>
      ${renderWorkspaceLog()}
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Commit to GitLab</h3>
      <div class="form-grid">
        <div class="field full">
          <label>GitLab project</label>
          <select id="exportRepo">${repoOptions || `<option value="${escapeHtml(gitlab?.defaultProject || "")}">${escapeHtml(gitlab?.defaultProject || "—")}</option>`}</select>
        </div>
        <div class="field">
          <label>Branch</label>
          <input id="exportBranch" value="${escapeHtml(gitlab?.defaultBranch || "main")}" />
        </div>
        <div class="field">
          <label>Folder prefix</label>
          <input id="exportPrefix" value="${escapeHtml(gitlab?.filePrefix || "terra-yank")}" />
        </div>
      </div>
      <div class="button-row">
        <button class="btn gitlab" id="wsCommit" ${gitlab ? "" : "disabled"}>Commit to GitLab</button>
      </div>
    </div>
  `;

  // Wire event handlers
  $("#wsPlan").onclick = runWsPlan;
  $("#wsSave").onclick = saveWsFiles;
  $("#wsClose").onclick = closeWs;
  $("#wsRefine").onclick = runWsRefine;

  const commitBtn = $("#wsCommit");
  if (commitBtn) commitBtn.onclick = commitWsToGitlab;

  document.querySelectorAll(".ws-tab").forEach((tab) => {
    tab.onclick = () => {
      const name = tab.dataset.wsFile;
      stashActiveFileEdits();
      state.workspace.activeFile = name;
      render();
    };
  });

  const editor = $("#wsFileContent");
  if (editor && !isProtected) {
    editor.oninput = () => {
      if (!state.workspace) return;
      state.workspace.files[activeFile] = editor.value;
      state.workspace.dirty.add(activeFile);
      const tab = document.querySelector(`.ws-tab[data-ws-file="${CSS.escape(activeFile)}"]`);
      if (tab && !tab.textContent.endsWith("*")) tab.textContent += "*";
    };
  }

  const logEl = $(".ws-log");
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

function stashActiveFileEdits() {
  const editor = $("#wsFileContent");
  const ws = state.workspace;
  if (!editor || !ws || !ws.activeFile) return;
  const isProtected = ws.activeFile === "main.tf" || ws.activeFile === "imports.tf";
  if (!isProtected && editor.value !== ws.files[ws.activeFile]) {
    ws.files[ws.activeFile] = editor.value;
    ws.dirty.add(ws.activeFile);
  }
}

function handleWsEvent(event) {
  if (event.message) wsLog(event.message, event.phase);
  if (event.files && state.workspace) {
    state.workspace.files = event.files;
    state.workspace.dirty.clear();
  }
  if (event.clean !== undefined && state.workspace) state.workspace.lastPlanClean = event.clean;
  render();
}

function createWs() {
  if (state.workspace) return;
  state.workspace = {
    id: null, region: state.discovery?.region || "", files: {},
    activeFile: null, dirty: new Set(),
    lastPlanOutput: null, lastPlanClean: null,
    totalInputTokens: 0, totalOutputTokens: 0, refinementCount: 0,
    busy: true, busyAction: "creating", log: [],
  };
  render();

  streamSSE("/api/workspace", { selection: selectedResources(), region: state.discovery?.region }, {
    onEvent(event) {
      handleWsEvent(event);
      if (event.phase === "done" && event.files) {
        state.workspace.busy = false;
        state.workspace.busyAction = null;
        state.workspace.activeFile = Object.keys(event.files).find((f) => f !== "main.tf" && f !== "imports.tf") || Object.keys(event.files)[0];
      }
      if (event.phase === "error") {
        state.workspace.busy = false;
        state.workspace.busyAction = null;
      }
      render();
    },
    onDone() {
      if (state.workspace) { state.workspace.busy = false; state.workspace.busyAction = null; }
      render();
    },
    onError(err) {
      wsLog(err.message || "Connection error.", "error");
      if (state.workspace) { state.workspace.busy = false; state.workspace.busyAction = null; }
      render();
    },
  });
}

async function saveWsFiles() {
  if (!state.workspace || !state.workspace.dirty.size) return;
  stashActiveFileEdits();
  const filesToSave = {};
  for (const [name, content] of Object.entries(state.workspace.files)) {
    if (name !== "main.tf" && name !== "imports.tf") filesToSave[name] = content;
  }
  try {
    const result = await api("/api/workspace/files", { method: "PUT", body: JSON.stringify({ files: filesToSave }) });
    state.workspace.files = result.files;
    state.workspace.dirty.clear();
    toast("Files saved.");
    render();
  } catch (err) { toast(err.message); }
}

function runWsPlan() {
  const ws = state.workspace;
  if (!ws || ws.busy) return;
  ws.busy = true;
  ws.busyAction = "planning";
  render();

  streamSSE("/api/workspace/plan", {}, {
    onEvent(event) {
      handleWsEvent(event);
      if (event.stdout !== undefined) ws.lastPlanOutput = `${event.stdout}\n${event.stderr || ""}`.trim();
      if (event.phase === "done" || event.phase === "error") { ws.busy = false; ws.busyAction = null; }
      render();
    },
    onDone() { ws.busy = false; ws.busyAction = null; render(); },
    onError(err) { wsLog(err.message || "Plan failed.", "error"); ws.busy = false; ws.busyAction = null; render(); },
  });
}

function runWsRefine() {
  const ws = state.workspace;
  if (!ws || ws.busy) return;
  const prompt = ($("#wsPrompt")?.value || "").trim();
  ws.busy = true;
  ws.busyAction = "refining";
  render();

  streamSSE("/api/workspace/refine", { prompt: prompt || undefined }, {
    onEvent(event) {
      handleWsEvent(event);
      if (event.phase === "done") {
        if (event.inputTokens) { ws.totalInputTokens += event.inputTokens; ws.totalOutputTokens += (event.outputTokens || 0); }
        if (event.iteration) ws.refinementCount += event.iteration;
        else ws.refinementCount++;
        ws.busy = false; ws.busyAction = null;
        if (event.files) {
          ws.activeFile = Object.keys(event.files).find((f) => f !== "main.tf" && f !== "imports.tf") || ws.activeFile;
        }
      }
      if (event.phase === "error") { ws.busy = false; ws.busyAction = null; }
      render();
    },
    onDone() { ws.busy = false; ws.busyAction = null; render(); },
    onError(err) { wsLog(err.message || "Refinement failed.", "error"); ws.busy = false; ws.busyAction = null; render(); },
  });
}

async function closeWs() {
  if (!state.workspace) return;
  if (state.workspace.busy) { toast("Wait for the current operation to finish."); return; }
  if (!confirm("Close workspace? This will delete the temporary Terraform files.")) return;
  try {
    await api("/api/workspace", { method: "DELETE" });
  } catch {}
  state.workspace = null;
  render();
}

async function commitWsToGitlab() {
  if (!state.workspace?.files) return;
  try {
    const result = await api("/api/workspace/commit", {
      method: "POST",
      body: JSON.stringify({
        project: $("#exportRepo").value,
        branch: $("#exportBranch").value,
        filePrefix: $("#exportPrefix").value,
      }),
    });
    toast(`Committed ${result.files.length} file(s) to ${result.project}.`);
  } catch (err) { toast(err.message); }
}

function toggleResource(arn, checked) {
  const resource = allResources(state.discovery).find((item) => item.arn === arn);
  if (!resource) return;
  if (checked) state.selected.set(arn, { ...resource });
  else state.selected.delete(arn);
  state.artifact = null;
  updateBasket();
}

function updateBasket() {
  $("#heroSelected").textContent = state.selected.size;
  const basket = document.querySelector(".card aside, aside.card");
  if (!basket) return;
  const resources = selectedResources();
  if (resources.length) {
    basket.innerHTML = `<h2>Selection Basket: ${resources.length}</h2>` +
      resources.map((r) => `<div class="list-item"><div><strong>${escapeHtml(r.service)}</strong><p class="arn">${escapeHtml(r.arn)}</p></div></div>`).join("");
  } else {
    basket.innerHTML = `<h2>Selection Basket: 0</h2><div class="empty">Select importable resources.</div>`;
  }
}

async function loadIntegrations() {
  const data = await api("/api/integrations");
  state.integrations = data.integrations || [];
  state.aws = data.aws || {};
  state.llm = data.llm || {};
}

async function connectGitlab() {
  try {
    const token = $("#gitlabToken").value.trim();
    if (!token) {
      toast("Enter a GitLab access token.");
      return;
    }
    const integration = await api("/api/integrations/gitlab", {
      method: "POST",
      body: JSON.stringify({
        baseUrl: $("#gitlabBaseUrl").value,
        token,
        allowSelfSignedCert: $("#gitlabAllowSelfSigned").checked,
      }),
    });
    await loadIntegrations();
    toast(`GitLab connected as ${integration.user?.username || "user"}.`);
    try {
      await loadGitlabRepos({ silent: true });
    } catch (error) {
      toast(`GitLab connected, but repositories could not be loaded: ${error.message}`);
    }
  } catch (error) {
    toast(error.message);
  }
}

async function loadGitlabRepos(options = {}) {
  try {
    const data = await api("/api/integrations/gitlab/projects");
    state.gitlabProjects = data.groups || [];
    render();
    if (!options.silent) toast("GitLab repositories loaded.");
  } catch (error) {
    if (!options.silent) toast(error.message);
    throw error;
  }
}

async function createGitlabRepo() {
  try {
    const name = $("#newRepoName").value.trim();
    const namespaceId = $("#newRepoNamespace").value;
    if (!namespaceId) throw new Error("Load repositories and select a GitLab namespace before creating a repository.");
    await api("/api/integrations/gitlab/projects/create", {
      method: "POST",
      body: JSON.stringify({ name, namespaceId }),
    });
    $("#newRepoName").value = "";
    await loadGitlabRepos();
    toast("GitLab repository created.");
  } catch (error) {
    toast(error.message);
  }
}

async function loadTfstateFiles() {
  try {
    const data = await api("/api/tfstate");
    state.tfstateFiles = data.files || [];
  } catch (_) {
    state.tfstateFiles = [];
  }
}

async function uploadTfstateFiles(fileList) {
  for (const file of fileList) {
    try {
      const text = await file.text();
      const content = JSON.parse(text);
      const data = await api("/api/tfstate/upload", {
        method: "POST",
        body: JSON.stringify({ name: file.name, content }),
      });
      state.tfstateFiles = data.files || [];
      toast(`Uploaded ${file.name} (${data.files[data.files.length - 1]?.resourceCount ?? 0} resources).`);
    } catch (error) {
      toast(`${file.name}: ${error.message}`);
    }
  }
  render();
}

async function removeTfstateFile(index) {
  try {
    const data = await api(`/api/tfstate/${index}`, { method: "DELETE" });
    state.tfstateFiles = data.files || [];
    toast("State file removed.");
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function clearAllTfstate() {
  try {
    const data = await api("/api/tfstate", { method: "DELETE" });
    state.tfstateFiles = data.files || [];
    toast("All state files cleared.");
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function runDiscovery() {
  try {
    const region = $("#regionSelect").value;
    $("#runDiscovery").disabled = true;
    $("#runDiscovery").textContent = "Scanning...";
    state.discovery = await api("/api/discovery/runs", {
      method: "POST",
      body: JSON.stringify({ region }),
    });
    state.selected.clear();
    state.artifact = null;
    state.tab = "importable";
    render();
    toast("Discovery complete.");
  } catch (error) {
    toast(error.message);
    render();
  }
}

async function generateReport() {
  try {
    state.artifact = await api("/api/imports/generate", {
      method: "POST",
      body: JSON.stringify({
        selection: selectedResources(),
        region: state.discovery?.region,
        account: state.discovery?.account,
      }),
    });
    render();
    toast(`${state.artifact.terraformMappableCount} Terraform imports generated.`);
  } catch (error) {
    toast(error.message);
  }
}

async function commitReport() {
  try {
    const result = await api("/api/gitlab/commit-import", {
      method: "POST",
      body: JSON.stringify({
        integrationId: $("#exportIntegration").value,
        project: $("#exportRepo").value,
        branch: $("#exportBranch").value,
        filePrefix: $("#exportPrefix").value,
        artifact: state.artifact,
      }),
    });
    toast(`Committed ${result.files.length} files to ${result.project}.`);
  } catch (error) {
    toast(error.message);
  }
}

async function saveAwsCredentials() {
  try {
    const keyId = $("#awsAccessKeyId").value.trim();
    const secret = $("#awsSecretAccessKey").value.trim();
    const session = $("#awsSessionToken").value.trim();
    if (!keyId && !state.aws.configured) {
      toast("Enter an AWS access key ID.");
      return;
    }
    if (!secret && !state.aws.configured) {
      toast("Enter an AWS secret access key.");
      return;
    }
    if (!keyId && !secret) {
      toast("AWS credentials unchanged.");
      return;
    }
    await api("/api/credentials/aws", {
      method: "POST",
      body: JSON.stringify({ accessKeyId: keyId, secretAccessKey: secret, sessionToken: session || undefined }),
    });
    await loadIntegrations();
    toast("AWS credentials saved and encrypted.");
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function saveLlmCredentials() {
  try {
    const key = $("#llmApiKey").value.trim();
    const model = $("#llmModel").value;
    const budget = Number($("#llmTokenBudget").value) || 100000;
    if (!key && !state.llm.configured) {
      toast("Enter an Anthropic API key.");
      return;
    }
    await api("/api/credentials/llm", {
      method: "POST",
      body: JSON.stringify({ apiKey: key || undefined, model, tokenBudget: budget }),
    });
    await loadIntegrations();
    toast(key ? "LLM settings saved with new API key." : "LLM settings saved.");
    render();
  } catch (error) {
    toast(error.message);
  }
}

function estimateCost(inputTokens, outputTokens, model) {
  const rates = {
    "bedrock.claude-sonnet-4-6": { input: 3, output: 15 },
    "bedrock.claude-haiku-4-5": { input: 0.8, output: 4 },
  };
  const r = rates[model] || rates["bedrock.claude-sonnet-4-6"];
  return ((inputTokens * r.input + outputTokens * r.output) / 1_000_000).toFixed(4);
}

function startImportGeneration() {
  if (state.importGen?.active) return;
  if (!state.llm.configured) {
    toast("Configure your LLM API key on the Integrations page first.");
    return;
  }
  if (!state.selected.size) {
    toast("Select resources to import first.");
    return;
  }

  const abortController = new AbortController();
  state.importGen = {
    active: true,
    phase: "init",
    message: "Starting...",
    log: [],
    iteration: 0,
    tokensUsed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    files: null,
    clean: false,
    abortController,
  };

  const body = JSON.stringify({
    selection: selectedResources(),
    region: state.discovery?.region,
  });

  render();

  fetch("/api/import/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: abortController.signal,
  }).then((response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          if (state.importGen) state.importGen.active = false;
          render();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            handleImportEvent(event);
          } catch {}
        }
        read();
      }).catch(() => {
        if (state.importGen) state.importGen.active = false;
        render();
      });
    }
    read();
  }).catch((err) => {
    if (err.name !== "AbortError") toast(`Import generation failed: ${err.message}`);
    if (state.importGen) state.importGen.active = false;
    render();
  });
}

function handleImportEvent(event) {
  if (!state.importGen) return;
  state.importGen.phase = event.phase;
  state.importGen.message = event.message || state.importGen.message;
  if (event.message) state.importGen.log.push({ phase: event.phase, message: event.message, time: new Date() });
  if (event.iteration !== undefined) state.importGen.iteration = event.iteration;
  if (event.tokensUsed !== undefined) state.importGen.tokensUsed = event.tokensUsed;
  if (event.totalInputTokens !== undefined) state.importGen.totalInputTokens = event.totalInputTokens;
  if (event.totalOutputTokens !== undefined) state.importGen.totalOutputTokens = event.totalOutputTokens;
  if (event.files) state.importGen.files = event.files;
  if (event.clean !== undefined) state.importGen.clean = event.clean;

  if (event.phase === "done" || event.phase === "error" || event.phase === "cancelled") {
    state.importGen.active = false;
  }
  render();
}

function cancelImportGeneration() {
  if (state.importGen?.abortController) {
    state.importGen.abortController.abort();
    state.importGen.active = false;
    state.importGen.phase = "cancelled";
    state.importGen.message = "Cancelled by user.";
    render();
  }
}

function render() {
  renderShell();
  if (state.page === "integrations") renderIntegrations();
  if (state.page === "discovery") renderDiscovery();
  if (state.page === "export") renderExport();
}

async function init() {
  state.user = { name: "User", email: "user@localhost" };

  document.querySelectorAll(".nav__item").forEach((button) => {
    button.onclick = () => setPage(button.dataset.page);
  });
  await Promise.all([loadIntegrations(), loadTfstateFiles()]);
  try {
    const ws = await api("/api/workspace");
    state.workspace = {
      id: ws.id, region: ws.region, files: ws.files,
      activeFile: Object.keys(ws.files).find((f) => f !== "main.tf" && f !== "imports.tf") || Object.keys(ws.files)[0],
      dirty: new Set(), lastPlanOutput: ws.lastPlanOutput, lastPlanClean: ws.lastPlanClean,
      totalInputTokens: ws.totalInputTokens, totalOutputTokens: ws.totalOutputTokens,
      refinementCount: ws.refinementCount, busy: false, busyAction: null, log: [],
    };
  } catch {}
  render();
}

init().catch((error) => toast(error.message));
