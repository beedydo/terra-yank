# i2cv2 Hackathon Workspace

## What This Is

i2cv2 (Infrastructure to Code v2) — web app for Singapore Government GCC cloud engineers.
Discovers unmanaged AWS resources, classifies them against Terraform state, and uses Claude AI
to auto-generate production-ready Terraform code committed to GitLab.

Repo contains one zip: `i2cv2-i2cv2.v1.zip` — extracted to `extracted/i2cv2-i2cv2.v1/`.

## Repo Structure

```
extracted/i2cv2-i2cv2.v1/
  src/server.js                 # entrypoint (Express, port 4000)
  src/server/app.js             # all API routes
  src/server/agent.js           # Pre-processor + LLM agent loop (Terraform refinement)
  src/server/workspace.js       # temp Terraform workspace lifecycle
  src/server/awsDiscovery.js    # AWS Resource Explorer discovery
  src/server/awsClients.js      # AWS SDK client factory
  src/server/imports.js         # ARN → Terraform import mapping + importSupport() gating
  src/server/tfstate.js         # tfstate parsing + comparison
  src/server/gitlab.js          # GitLab API integration
  src/server/db.js              # LibSQL/SQLite (user_settings table)
  src/server/crypto.js          # AES-256-GCM for GitLab token encryption
  src/server/resource-map.json  # RE type → Terraform type mapping (~657 types)
  src/server/utils.js           # parseArn, slugify helpers
  src/public/                   # vanilla JS SPA (no framework)
  Dockerfile                    # multi-stage: deps + terraform + node-20
  airbase.json                  # Airbase deploy config
  backend.tf                    # S3 backend for Terraform state
  providers.tf                  # AWS + archive providers
```

## Key Technical Facts

- **Runtime**: Node.js 20, Express 5.2.1, CommonJS
- **Auth**: `auth.mjs` referenced in docs but NOT present in extracted zip. Dev mode bypasses auth (`NODE_ENV=development`). No TechPass code in source.
- **DB**: LibSQL SQLite (`i2cv2-auth.db`) — stores sessions + `user_settings` (GitLab token encrypted, per-user settings)
- **CRITICAL**: DB is ephemeral on Airbase (no persistent volumes). Wiped on every redeploy.
- **LLM**: Anthropic Claude via GCC AI Gateway (BYOK key via `X-Anthropic-Key` header). Default model: `bedrock.claude-sonnet-4-6`
- **Terraform**: Bundled in Docker container
- **Deployed at**: `https://i2cv2-demo.app.tc1.airbase.sg`
- **Airbase instance**: `f.small`, handle `i2cv2/i2cv2-demo`

## AWS Accounts

| Account | Purpose | Profile |
|---------|---------|---------|
| 970547349877 | User's dev account | default |
| 396913734272 | Target test account | `agency_developer-396913734272` |

## Pre-Processor (agent.js lines 8–305)

Deterministic regex-based fixes applied BEFORE LLM refinement. This is the core of the tool's reliability.

### What it does:
1. **Line removal** (REMOVE_LINE_PATTERNS): strips conflicting attrs, null values, computed-only fields, zero/empty values that Terraform rejects
2. **Block removal**: tags_all blocks, target_failover/target_health_state (null-only), stickiness blocks, advanced_backup_setting with resource_type="S3"
3. **Block patching**: Network ACL ipv6_cidr_block injection, route table attr injection
4. **Lifecycle injection**: EC2 instances (ignore user_data), Lambda functions (ignore filename)
5. **Source attr injection**: Lambda functions missing filename/image_uri/s3_bucket get `filename = "/tmp/placeholder.zip"`
6. **Provider defaults**: Secrets Manager recovery_window_in_days, force_overwrite_replica_secret

### Key gating logic (imports.js):
- `importSupport()` decides importable vs skipped
- `NOT_RECOMMENDED` set: cloudformation stacks, EC2 snapshots, SSM associations, etc.
- SSM parameters with reserved prefixes (ssm, aws, awsmp) → skipped
- MemoryDB default parameter groups (dots in name) → skipped

## Plan Results (Latest: 2026-06-11)

- **596 resources discovered** → 586 imported, 10 skipped (minimal stubs for missing config)
- **0 errors, 0 add, 0 destroy**
- **23 cosmetic in-place updates** (all resolve on first `terraform apply`):
  - 10 EC2: `+ user_data_replace_on_change = false` (provider default)
  - 4 Secrets Manager: `+ recovery_window_in_days = 30` (provider default)
  - 3 Backup plans: `- advanced_backup_setting { resource_type = "S3" }` (removed invalid)
  - 3 Config rules: whitespace-only JSON formatting
  - 3 LB listeners: stickiness duration nulling

## LLM Refinement — Current State & Issues

The SYSTEM_PROMPT in agent.js is **largely redundant**. Pre-processor handles everything the prompt instructs the LLM to do. Key problems:
1. LLM asked to regurgitate 17k+ lines verbatim → truncation/hallucination risk
2. All "error fixing rules" already handled deterministically
3. "Files you do not mention will be deleted" is dangerous at scale
4. After pre-processor, LLM has nothing useful left to fix

**Recommendation**: Redesign "Refine with AI" to only trigger on remaining errors (Option A: error-targeted per-resource calls), or eliminate from critical path entirely.

## IAM Permissions Added

`i2cv2-kms-policy.json` applied to i2cv2-readonly user in account 396913734272:
- `kms:DescribeKey`
- `kms:GetKeyRotationStatus`

## Known Issues

- **Ephemeral DB**: SQLite wiped on every Airbase deploy. Need external persistence.
- **No auth.mjs**: File referenced in docs but missing from zip. Auth bypassed in dev.
- **No tests**: `package.json` test script is a no-op.
- **LLM refinement**: SYSTEM_PROMPT needs redesign (see above).
- **10 resources get minimal stubs**: `generate-config-out` fails for some resources; retry recovers 0. These get empty resource blocks that will error if not manually filled.

## Required Env Vars

| Var | Purpose |
|-----|---------|
| `BETTER_AUTH_SECRET` | Auth session secret |
| `BETTER_AUTH_URL` | App base URL |
| `ENCRYPTION_KEY` | AES-256-GCM key for GitLab token encryption |
| `PORT` | Server port (default 4000) |
| `NODE_EXTRA_CA_CERTS` | CA bundle for GitLab Dedicated TLS (prod) |
