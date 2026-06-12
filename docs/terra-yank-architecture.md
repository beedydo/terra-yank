# terra-yank — Architecture & Workflow Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              terra-yank Web Application                               │
│                                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────────┐   │
│  │   Frontend   │    │                   Backend (Express)                   │   │
│  │  Vanilla JS  │◄──►│                   Port 4000                          │   │
│  │    SPA       │    │                                                      │   │
│  │              │    │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐   │   │
│  │ • Integrations│   │  │  Auth   │ │Discovery │ │Workspace│ │  Agent   │   │   │
│  │ • Discovery  │    │  │ Module  │ │  Module  │ │ Module  │ │  (LLM)   │   │   │
│  │ • Export     │    │  └────┬────┘ └────┬─────┘ └────┬───┘ └────┬─────┘   │   │
│  └──────────────┘    │       │           │            │           │         │   │
│                      └───────┼───────────┼────────────┼───────────┼─────────┘   │
└──────────────────────────────┼───────────┼────────────┼───────────┼─────────────┘
                               │           │            │           │
              ┌────────────────┼───────────┼────────────┼───────────┼──────┐
              │                ▼           ▼            ▼           ▼      │
              │  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌───────────────┐  │
              │  │ LibSQL   │ │  AWS    │ │Terraform │ │ Claude AI     │  │
              │  │ (SQLite) │ │  APIs   │ │ CLI 1.12 │ │ (GCC Gateway) │  │
              │  └──────────┘ └─────────┘ └──────────┘ └───────────────┘  │
              │                                                            │
              │  ┌──────────┐ ┌─────────────┐                             │
              │  │ GitLab   │ │ /tmp/i2c-   │                             │
              │  │ API      │ │ workspace-* │                             │
              │  └──────────┘ └─────────────┘                             │
              │                External Services & Runtime                  │
              └────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
src/
├── server.js                  ← Entry point: init DB, create app, listen on PORT
│
├── server/
│   ├── app.js                 ← Express app: all API routes, middleware, error handling
│   ├── agent.js               ← LLM refinement loop (pre-process + multi-iteration)
│   ├── workspace.js           ← Terraform workspace lifecycle (init/plan/destroy)
│   ├── awsDiscovery.js        ← AWS Resource Explorer queries + classification
│   ├── awsClients.js          ← AWS SDK client factory (STS, IAM, EC2, Config, RE2)
│   ├── imports.js             ← ARN → Terraform import mapping + artifact generation
│   ├── tfstate.js             ← tfstate parsing, indexing, comparison
│   ├── gitlab.js              ← GitLab API: projects, commits, file operations
│   ├── db.js                  ← LibSQL/SQLite: user_settings CRUD
│   ├── auth.mjs               ← TechPass OIDC via better-auth (bypassed in dev)
│   ├── crypto.js              ← AES-256-GCM encrypt/decrypt for stored credentials
│   ├── utils.js               ← slugify(), parseArn()
│   └── resource-map.json      ← 657 AWS→Terraform type mappings
│
└── public/
    ├── index.html             ← SPA shell (3 pages)
    ├── app.js                 ← Frontend logic (~50KB vanilla JS)
    └── styles.css             ← Styling
```

---

## Module Dependency Graph

```
                        server.js
                           │
                    ┌──────┴──────┐
                    ▼              ▼
                 db.js          app.js
                                  │
          ┌───────┬───────┬───────┼───────┬──────────┐
          ▼       ▼       ▼       ▼       ▼          ▼
       auth.mjs  crypto  gitlab  imports  workspace  awsDiscovery
                   │       │       │         │          │
                   │       │       │         │          │
                   ▼       ▼       ▼         ▼          ▼
                 db.js   db.js  resource   agent.js   awsClients
                                -map.json     │
                                              │
                                      ┌───────┴───────┐
                                      ▼               ▼
                                  workspace.js    Claude AI
                                      │           (via API)
                                      ▼
                                 Terraform CLI
```

---

## End-to-End Workflow

```
 ╔══════════════════════════════════════════════════════════════════╗
 ║                     USER WORKFLOW                                ║
 ╚══════════════════════════════════════════════════════════════════╝

 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 1: CONFIGURE INTEGRATIONS                                 │
 │                                                                 │
 │  User enters:                                                   │
 │  • AWS Access Key ID + Secret (+ optional Session Token)        │
 │  • Claude API Key (BYOK — never stored on server permanently)   │
 │  • GitLab base URL + Personal Access Token                      │
 │                                                                 │
 │  All credentials encrypted with AES-256-GCM before DB storage.  │
 │  Decrypted per-request, used, discarded from memory.            │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 2: DISCOVER AWS RESOURCES                                 │
 │                                                                 │
 │  User selects target region (e.g., ap-southeast-1)              │
 │  System runs parallel AWS Resource Explorer 2 queries:          │
 │                                                                 │
 │    Query 1: region:<target>     → regional resources            │
 │    Query 2: region:global       → IAM, CloudFront, etc.         │
 │    Query 3+: supplemental (S3, EC2, VPC, Lambda, RDS)           │
 │                                                                 │
 │  Results: paginated (1000/page), deduplicated by ARN.           │
 │  Each resource gets tags extracted from properties.             │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 3: CLASSIFY RESOURCES                                     │
 │                                                                 │
 │  Layer 1 — Tag-based ownership:                                 │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │ Tags: gcci | gcc:team=gcci | gcc_team=gcci | team=gcci   │   │
 │  │ → Classified as GCCI-owned platform baseline             │   │
 │  └──────────────────────────────────────────────────────────┘   │
 │                                                                 │
 │  Layer 2 — State comparison (if .tfstate uploaded):             │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │ Match by ARN (normalized) or by tfType:importId          │   │
 │  │ • managed: found in state → already IaC-governed         │   │
 │  │ • unmanaged: not in state → import candidate             │   │
 │  │ • stale: in state but not discovered → possibly deleted  │   │
 │  │ • sub-resource: non-discoverable type → expected, skip   │   │
 │  └──────────────────────────────────────────────────────────┘   │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 4: SELECT RESOURCES FOR IMPORT                            │
 │                                                                 │
 │  UI presents resources in tabs:                                 │
 │  • Importable — supported types, not managed (checkbox select)  │
 │  • Unsupported — no Terraform mapping (read-only)               │
 │  • GCCI — platform-owned baseline (info-only)                   │
 │  • Managed — already in Terraform state (read-only)             │
 │                                                                 │
 │  User checks resources → selection basket fills on right side.  │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
    ┌────────────▼───────────┐    ┌────────────▼───────────┐
    │  PATH A: INTERACTIVE   │    │  PATH B: AUTO-GENERATE │
    │  "Create Workspace"    │    │  "Generate Import"     │
    │                        │    │                        │
    │  Manual control:       │    │  Full automation:      │
    │  edit files, run plan, │    │  workspace → config →  │
    │  single AI refine,     │    │  agent loop → done     │
    │  iterate manually      │    │                        │
    └────────────┬───────────┘    └────────────┬───────────┘
                 │                             │
                 └──────────────┬──────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 5: TERRAFORM WORKSPACE & CODE GENERATION                  │
 │                                                                 │
 │  Step 1: Map ARN → Terraform                                    │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │ parseArn(arn) → {service, resourceType, resourceId, ...} │   │
 │  │ Lookup resource-map.json: service:resourceType → tfType  │   │
 │  │ Template-expand importId with variables:                  │   │
 │  │   ${region}, ${accountId}, ${resourceId}, ${arn}          │   │
 │  │ Special: Security Group Rules → EC2 API for direction     │   │
 │  └──────────────────────────────────────────────────────────┘   │
 │                                                                 │
 │  Step 2: Create workspace in /tmp/i2c-workspace-<uuid>/         │
 │  ┌──────────────────────────────────────────────────────────┐   │
 │  │ main.tf     → provider "aws" { region = "..." }          │   │
 │  │ imports.tf  → import blocks for each mapped resource      │   │
 │  └──────────────────────────────────────────────────────────┘   │
 │                                                                 │
 │  Step 3: terraform init (downloads AWS provider)                │
 │  Step 4: terraform plan -generate-config-out=generated.tf       │
 │          (reads live AWS → outputs full resource config)        │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 6: LLM AGENT REFINEMENT                                   │
 │                                                                 │
 │  Pre-processor (deterministic):                                 │
 │  • Remove tags_all, computed attrs                              │
 │  • Remove invalid zero/empty values                             │
 │  • Inject missing provider defaults                             │
 │  • Fix multi-line blocks                                        │
 │                                                                 │
 │  ┌────────────────────────────────────────────────────────┐     │
 │  │              LLM AGENT LOOP                            │     │
 │  │                                                        │     │
 │  │  ┌──► Read workspace .tf files                         │     │
 │  │  │    ↓                                                │     │
 │  │  │    terraform plan -detailed-exitcode                │     │
 │  │  │    ↓                                                │     │
 │  │  │    Clean? ──YES──► Done ✓ (import-only plan)        │     │
 │  │  │    │NO                                              │     │
 │  │  │    ▼                                                │     │
 │  │  │    Send to Claude AI:                               │     │
 │  │  │    • System prompt (Terraform expert rules)         │     │
 │  │  │    • All .tf file contents                          │     │
 │  │  │    • Plan error output                              │     │
 │  │  │    ↓                                                │     │
 │  │  │    Parse response (### FILE: blocks)                │     │
 │  │  │    ↓                                                │     │
 │  │  │    Write updated files                              │     │
 │  │  │    ↓                                                │     │
 │  │  │    terraform init -upgrade + validate               │     │
 │  │  │    ↓                                                │     │
 │  │  └────Loop (max 25 iter / 500k token budget)           │     │
 │  │                                                        │     │
 │  │  Stop: clean plan OR budget exhausted OR max iter      │     │
 │  └────────────────────────────────────────────────────────┘     │
 │                                                                 │
 │  Large workspace (>200 resources): chunked (~150/chunk)         │
 │  Default model: bedrock.claude-sonnet-4-6                        │
 │  Default budget: 100,000 tokens (max 500,000)                   │
 │  Default iterations: 10 (max 25)                                │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────────┐
 │ PHASE 7: EXPORT TO GITLAB                                       │
 │                                                                 │
 │  User selects:                                                  │
 │  • Target GitLab project (from namespace browser)               │
 │  • Target branch (default: main)                                │
 │  • File prefix/folder (default: "terra-yank")                        │
 │                                                                 │
 │  Commits refined .tf files via GitLab Repository Files API.     │
 │  PUT first, fallback POST if file doesn't exist.                │
 │  Each file committed individually.                              │
 └─────────────────────────────────────────────────────────────────┘
```

---

## API Routes

### Authentication & User
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| GET | `/api/me` | Current user info |

### Credentials
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/credentials/aws` | Save encrypted AWS creds |
| POST | `/api/credentials/aws/test` | Test AWS creds (STS) |
| DELETE | `/api/credentials/aws` | Remove AWS creds |
| POST | `/api/credentials/llm` | Save encrypted LLM key |
| DELETE | `/api/credentials/llm` | Remove LLM key |

### Integrations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/integrations` | Fetch all integration config |
| POST | `/api/integrations/gitlab` | Save GitLab config |
| GET | `/api/integrations/gitlab/projects` | List GitLab projects |
| POST | `/api/integrations/gitlab/projects/create` | Create GitLab project |

### Discovery
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/account` | AWS account info |
| POST | `/api/discovery/runs` | Full discovery scan |

### Terraform State
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/tfstate/upload` | Upload + parse tfstate |
| GET | `/api/tfstate` | List uploaded states |
| DELETE | `/api/tfstate/:index` | Remove one state file |
| DELETE | `/api/tfstate` | Clear all state files |

### Import & Workspace
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/imports/generate` | One-shot import generation |
| POST | `/api/workspace` | Create interactive workspace (SSE) |
| GET | `/api/workspace` | Get workspace status |
| PUT | `/api/workspace/files` | Update workspace files |
| POST | `/api/workspace/plan` | Run terraform plan (SSE) |
| POST | `/api/workspace/refine` | LLM refinement loop (SSE) |
| POST | `/api/workspace/commit` | Commit to GitLab |
| DELETE | `/api/workspace` | Destroy workspace |
| POST | `/api/import/generate` | Full end-to-end pipeline (SSE) |

### Projects
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/projects` | List user projects |
| POST | `/api/projects` | Create/update project |

---

## Data Flows

### Flow 1: AWS Discovery Pipeline

```
┌────────┐         ┌──────────┐         ┌───────────────────────┐
│  User  │────────►│  app.js  │────────►│    awsDiscovery.js    │
│(Browser)│  POST   │          │         │                       │
└────────┘ /discovery│         │         │ 1. Parallel queries   │
           /runs    │          │         │    to Resource Explorer│
                    │          │         │ 2. Deduplicate by ARN │
                    │          │         │ 3. Extract tags       │
                    │          │         │ 4. Detect GCCI owner  │
                    │          │         │ 5. Categorize by svc  │
                    │          │         └───────────┬───────────┘
                    │          │                     │
                    │          │         ┌───────────▼───────────┐
                    │          │         │     tfstate.js        │
                    │          │         │                       │
                    │          │         │ Compare discovered    │
                    │          │         │ vs. uploaded state    │
                    │          │         │ → managed/unmanaged   │
                    │          │         └───────────┬───────────┘
                    │          │                     │
                    │◄─────────┼─────────────────────┘
                    │          │
                    │  Response:
                    │  • gcciGroups (tagged by team)
                    │  • notTaggedCategoryGroups (unmanaged)
                    │  • managedCategoryGroups (in tfstate)
                    │  • staleStateResources (in state, not found)
```

### Flow 2: Resource Classification Logic

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AWS Resource Explorer Results                         │
│                    (all resources in region + global)                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    ┌────────────────┬┴────────────────┐
                    ▼                ▼                  ▼
            ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐
            │ Has GCCI tag│  │ No GCCI tag │  │  In tfstate?     │
            │ (gcc:team,  │  │             │  │  (ARN or type:id │
            │  gcci, etc) │  │             │  │   match)         │
            └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘
                   │                │                   │
                   ▼                ▼                   ▼
         ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
         │ gcciGroups   │  │ notTagged    │  │ managedCategory  │
         │ (platform    │  │ CategoryGrps │  │ Groups           │
         │  baseline)   │  │ (unmanaged)  │  │ (already in IaC) │
         └──────────────┘  └──────────────┘  └──────────────────┘
                │                │
                └───────┬────────┘
                        ▼
              ┌──────────────────┐
              │  IMPORT TARGETS  │
              │  (user selects)  │
              └──────────────────┘
```

### Flow 3: Interactive Workspace Lifecycle

```
POST /api/workspace (SSE)
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. Create /tmp/i2c-workspace-{uuid}/                             │
│ 2. Write main.tf (provider block)                                │
│ 3. Write imports.tf (import blocks per ARN)                      │
│ 4. terraform init                                                │
│ 5. terraform plan -generate-config-out                           │
│ 6. Detect missing resource blocks → retry/stub                   │
│ 7. Pre-process generated.tf (remove conflicts/computed)          │
│ 8. Store workspace in memory Map                                 │
└──────────────────────────────┬───────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  GET /workspace        PUT /workspace/files   POST /workspace/plan
  (view status)         (edit .tf files)       (run plan, SSE)
                                                     │
                                                     ▼
                                            POST /workspace/refine
                                            (LLM loop, SSE)
                                                     │
                                                     ▼
                                            POST /workspace/commit
                                            (write to GitLab)
                                                     │
                                                     ▼
                                            DELETE /workspace
                                            (rm -rf temp dir)
```

### Flow 4: LLM Refinement Detail

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Claude AI Refinement Loop                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  System Prompt Rules:                                                    │
│  • Fix terraform plan errors ONLY                                       │
│  • No restructuring, no variable extraction                             │
│  • Remove computed-only attributes                                      │
│  • Handle conflicting args (keep human-readable)                        │
│  • Output EVERY resource (no truncation)                                │
│  • Keep main.tf + imports.tf unchanged                                  │
│                                                                         │
│  Input to LLM:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ System prompt + workspace .tf files + terraform plan output │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              │                                          │
│                              ▼                                          │
│  LLM Response Format:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │ ### FILE: generated.tf                                      │       │
│  │ ```hcl                                                      │       │
│  │ resource "aws_instance" "example" { ... }                   │       │
│  │ ```                                                         │       │
│  │ ### FILE: additional.tf                                     │       │
│  │ ```hcl                                                      │       │
│  │ resource "aws_s3_bucket" "data" { ... }                     │       │
│  │ ```                                                         │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  Validation: terraform plan -detailed-exitcode                          │
│  • Exit 2 + "0 to add, 0 to change, 0 to destroy" → CLEAN ✓           │
│  • Anything else → loop again with new error output                    │
│                                                                         │
│  Token Budget: 500,000 max per session                                  │
│  Iterations: max 25                                                     │
│  Large workspace (>200 resources): chunked (~150/chunk)                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 5: Credential Lifecycle

```
┌──────────┐   plaintext    ┌───────────┐   encrypted    ┌──────────────┐
│  User    │───────────────►│ crypto.js │──────────────►│   db.js      │
│ (Browser)│   POST /creds  │AES-256-GCM│  iv:tag:cipher │ user_settings│
└──────────┘                └───────────┘                └──────────────┘
                                                                │
     ┌──────────────────────────────────────────────────────────┘
     │  On API call needing credentials:
     ▼
┌──────────────┐   decrypt    ┌───────────┐   plaintext    ┌────────────┐
│   db.js      │─────────────►│ crypto.js │──────────────►│ AWS/GitLab │
│ user_settings│              │AES-256-GCM│               │ API calls  │
└──────────────┘              └───────────┘               └────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Airbase Platform (GCC)                         │
│                    Instance: f.small                              │
│                    Handle: terra-yank/terra-yank-demo                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Docker Container (multi-stage)                │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │  Node.js 20 │  │ Terraform    │  │ CA Certificates│  │  │
│  │  │  + Express  │  │ v1.12.1      │  │ (GitLab TLS)   │  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ /app/src/     Application code                      │  │  │
│  │  │ /tmp/         Ephemeral Terraform workspaces        │  │  │
│  │  │ terra-yank-auth.db SQLite (EPHEMERAL - wiped on deploy) │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│ AWS APIs        │  │ GitLab Dedicated │  │ GCC AI Gateway    │
│ • STS           │  │ (sgts.gitlab-    │  │ api.ai.tech.gov.sg│
│ • IAM           │  │  dedicated.com)  │  │                   │
│ • Resource      │  │ • Projects API   │  │ bedrock.claude-   │
│   Explorer 2    │  │ • Repository     │  │ sonnet-4-6        │
│ • EC2           │  │   Files API      │  │                   │
│ • Config        │  │                  │  │                   │
└─────────────────┘  └──────────────────┘  └───────────────────┘
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Security Layers                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Authentication                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TechPass OIDC → better-auth → session cookie             │  │
│  │ (Dev mode: bypassed, hardcoded default-user)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 2: Credential Protection                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ AES-256-GCM encryption at rest (ENCRYPTION_KEY env var)   │  │
│  │ Format: iv:authTag:ciphertext (hex)                       │  │
│  │ Decrypted per-request only, never cached in memory        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 3: Transport Security                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ HTTPS everywhere (Airbase terminates TLS)                 │  │
│  │ NODE_EXTRA_CA_CERTS for GitLab Dedicated self-signed      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 4: HTTP Security Headers                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ X-Content-Type-Options: nosniff                           │  │
│  │ X-Frame-Options: DENY                                     │  │
│  │ Referrer-Policy: strict-origin-when-cross-origin          │  │
│  │ CSP: default-src 'self'; script-src 'self'                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Layer 5: Input Validation                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Filename regex: ^[a-zA-Z0-9_.-]+\.tf$                     │  │
│  │ Protected files (main.tf, imports.tf) immutable via API   │  │
│  │ execFile (not exec) — no shell interpolation              │  │
│  │ Request body limit: 10MB                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Storage Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Storage Architecture                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Persistent (survives requests, NOT deploys):                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ SQLite: terra-yank-auth.db                                            │  │
│  │ ┌────────────────────────────────────────────────────────────┐   │  │
│  │ │ user_settings (user_id, key, value, updated_at)            │   │  │
│  │ │   Keys: aws | llm | gitlab | projects                     │   │  │
│  │ └────────────────────────────────────────────────────────────┘   │  │
│  │ ⚠️  EPHEMERAL on Airbase — wiped on every deploy!               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  In-Memory (survives requests, NOT restarts):                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ tfstateByUser: Map<userId, {states[], index}>                    │  │
│  │ workspaceByUser: Map<userId, {dir, region, files, runId, ...}>   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Ephemeral (per workspace session):                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ /tmp/i2c-workspace-{uuid}/                                       │  │
│  │   ├── main.tf         (provider config, read-only)               │  │
│  │   ├── imports.tf      (import blocks, read-only)                 │  │
│  │   ├── generated.tf    (auto-generated, mutable)                  │  │
│  │   ├── *.tf            (additional files from LLM)                │  │
│  │   └── .terraform/     (provider plugins)                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  External (persistent):                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ S3: gcci-managed-pipeline-states-826696545629 (tfstate backend)  │  │
│  │ GitLab: committed Terraform files (final output)                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## SSE Event Protocol

All long-running operations stream Server-Sent Events:

```
data: {"phase":"init","message":"Creating Terraform workspace..."}

data: {"phase":"plan","message":"Running terraform plan -generate-config-out..."}

data: {"phase":"llm","message":"Iteration 2/10: Claude responded","iteration":2,"tokensUsed":24000}

data: {"phase":"validate","message":"Plan not clean (2 to change, 0 to destroy)"}

data: {"phase":"done","message":"Clean plan achieved","files":{...},"clean":true,"totalInputTokens":45000,"totalOutputTokens":12000}

data: {"phase":"error","message":"terraform plan did not generate configuration."}

data: {"phase":"cancelled","message":"Generation cancelled — client disconnected."}
```

Cancellation: Client closes SSE → server detects via `res.on('close')` → AbortController fires → subprocess killed → LLM calls aborted.

---

## Resource Limits

| Limit | Value | Enforced In |
|-------|-------|-------------|
| Max tfstate files per user | 20 | app.js |
| Max LLM tokens per refinement | 500,000 | agent.js |
| Max refinement iterations | 25 | agent.js |
| Max request body size | 10 MB | Express |
| Terraform operation timeout | 120-300s | workspace.js |
| Chunk size (large imports) | ~150 resources | agent.js |
| Resource map coverage | 657 types | resource-map.json |

---

## Key Design Decisions

1. **Terraform plan as sole correctness oracle** — No custom validation. If plan says import-only, code is correct. Self-correcting via LLM feedback loop.

2. **BYOK (Bring Your Own Key)** — Users provide own Claude API key. No shared billing account needed.

3. **SSE over WebSockets** — Simpler for unidirectional streaming. Client abort = server cleanup.

4. **Ephemeral workspaces** — No persistent Terraform state on server. Each run isolated and destroyed.

5. **No framework frontend** — Vanilla JS SPA. No build step. Fast iteration.

6. **Single-user workspace model** — One active workspace per user. Simplifies state management.

7. **Resource-map.json** — 657-type mapping from AWS Resource Explorer types to Terraform types.

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Server port | 4000 |
| `ENCRYPTION_KEY` | AES-256 key for credential encryption | (required) |
| `BETTER_AUTH_SECRET` | Auth session secret | (required) |
| `BETTER_AUTH_URL` | App base URL | (required) |
| `TECHPASS_CLIENT_ID` | TechPass OAuth client ID | (required) |
| `TECHPASS_CLIENT_SECRET` | TechPass OAuth secret | (required) |
| `ANTHROPIC_BASE_URL` | LLM API endpoint | `https://api.ai.tech.gov.sg/platform/models` |
| `NODE_EXTRA_CA_CERTS` | CA bundle for GitLab TLS | (optional) |
