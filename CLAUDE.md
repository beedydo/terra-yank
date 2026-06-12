# terra-yank Hackathon Workspace

## What This Is

terra-yank (TerraYank) — web app for Singapore Government GCC cloud engineers.
Discovers unmanaged AWS resources, classifies them against Terraform state, and uses Claude AI
to auto-generate production-ready Terraform code committed to GitLab.

Repo contains one zip: `terra-yank-v1.zip` — extracted to `extracted/terra-yank-v1/`.

## Repo Structure

```
terra-yank-v1.zip              # source archive
extracted/terra-yank-v1/       # extracted contents
  src/server.js                 # entrypoint (Express, port 4000)
  src/server/app.js             # all API routes
  src/server/agent.js           # Claude LLM agent loop (Terraform refinement)
  src/server/workspace.js       # temp Terraform workspace lifecycle
  src/server/awsDiscovery.js    # AWS Resource Explorer discovery
  src/server/awsClients.js      # AWS SDK client factory
  src/server/imports.js         # ARN → Terraform import mapping
  src/server/tfstate.js         # tfstate parsing + comparison
  src/server/gitlab.js          # GitLab API integration
  src/server/db.js              # LibSQL/SQLite (user_settings table)
  src/server/auth.mjs           # better-auth + TechPass OIDC
  src/server/crypto.js          # AES-256-GCM for GitLab token encryption
  src/server/resource-map.json  # RE type → Terraform type mapping (~657 types)
  src/public/                   # vanilla JS SPA (no framework)
  Dockerfile                    # multi-stage: deps + terraform + node-20
  airbase.json                  # Airbase deploy config
  backend.tf                    # S3 backend for Terraform state
  providers.tf                  # AWS + archive providers, TF 1.12.1
  test-resources.tf             # sample AWS resources for testing
terra-yank-sticker-prompt.txt        # sticker image generation prompt (3560 chars)
```

## Key Technical Facts

- **Runtime**: Node.js 20, Express 5.2.1, CommonJS
- **Auth**: TechPass OIDC via `better-auth` + `genericOAuth`. Dev mode bypasses auth (`NODE_ENV=development`)
- **DB**: LibSQL SQLite (`terra-yank-auth.db`) — stores sessions + `user_settings` (GitLab token encrypted, per-user settings)
- **CRITICAL**: DB is ephemeral on Airbase (no persistent volumes). Wiped on every redeploy. Users must re-enter GitLab token after each deploy.
- **LLM**: Anthropic Claude (BYOK key via `X-Anthropic-Key` header, never stored server-side). Default model: `bedrock.claude-sonnet-4-6`
- **Terraform**: v1.12.1 bundled in Docker container
- **Deployed at**: `https://terra-yank-demo.app.tc1.airbase.sg`
- **Airbase instance**: `f.small`, handle `terra-yank/terra-yank-demo`
- **Terraform state**: S3 bucket `gcci-managed-pipeline-states-826696545629`

## Required Env Vars

| Var | Purpose |
|-----|---------|
| `BETTER_AUTH_SECRET` | Auth session secret |
| `BETTER_AUTH_URL` | App base URL |
| `TECHPASS_CLIENT_ID` | TechPass OAuth client ID |
| `TECHPASS_CLIENT_SECRET` | TechPass OAuth client secret |
| `ENCRYPTION_KEY` | AES-256-GCM key for GitLab token encryption |
| `PORT` | Server port (default 4000) |
| `NODE_EXTRA_CA_CERTS` | CA bundle for GitLab Dedicated TLS (prod) |

## What Was Done This Session

1. Extracted and fully analysed the zip — all source files read
2. Identified ephemeral DB issue (Airbase has no persistent volumes yet — confirmed in docs)
3. Created `terra-yank-sticker-prompt.txt` — comprehensive sticker image generation prompt
4. Drafted problem statement copy with quantified evidence:
   - Ministry of Law + 1 neighbouring department (~20 engineers) confirmed facing this problem
   - "Two agencies surfaced this in a single hackathon — the problem is not isolated"

## Problem Statement (Final Draft)

```
Government engineers managing cloud infrastructure on GCC often provision resources manually
outside of Infrastructure-as-Code (IaC) workflows. There is no reliable, standardised way to
discover, import, and convert these unmanaged resources into Terraform — especially across
multiple environments and AWS accounts — leaving infrastructure ungoverned, inconsistent, and
difficult to audit.

During the hackathon we spoke directly with engineers from Ministry of Law and a neighbouring
department — a combined team of ~20 engineers — all actively facing this exact problem with no
current solution. Without a machine-readable representation of our cloud, we have no baseline
to detect drift, no source of truth to enforce policy against, and no starting point for incident
response — a gap that compounds silently with every manually provisioned resource added across
every account. If two agencies surfaced this in a single hackathon, the problem is not isolated.
```

## Known Issues / Things To Revisit

- **Ephemeral DB**: SQLite on Airbase wiped on every deploy. Need external persistence (AWS RDS, external LibSQL server, or move config to browser localStorage).
- **TechPass auth**: Currently points to `govauth.sandbox.gov.sg` — needs prod URL for real deployment.
- **No tests**: `package.json` test script is a no-op (`echo "No tests configured"`).
- **store.js referenced in README** but not present in extracted zip — may be missing file.
