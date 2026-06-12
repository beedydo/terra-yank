# Architecture

## Components

### 1. Discovery Scanner

Responsible for querying AWS and producing normalized resource records.

Uses **AWS Resource Explorer 2** (`Search` API) for broad, cross-service discovery. Resource Explorer indexes ~657 resource types and supports query-based filtering by region, resource type, and tags.

**Prerequisite:** The Resource Explorer index in the discovery region must be an **aggregator index** (not local). A local index only covers regional resources — global resources like IAM roles and policies will not be discovered. See the troubleshooting section in [DEPLOYMENT.md](./DEPLOYMENT.md) for setup instructions.

Discovery runs two queries in parallel:

- `region:<target-region>` — regional resources (EC2, RDS, Lambda, etc.).
- `region:global` — global resources (IAM roles, IAM policies, CloudFront distributions, etc.). Requires aggregator index.

Results are combined, deduplicated, and each resource is mapped to a Terraform type using the generated `resource-map.json` (see Resource Mapping below).

Resources with platform ownership tags (`gcci`, `gcc:team=gcci`, `gcc_team=gcci`, `team=gcci`) are classified as GCCI-owned baseline and segregated in the UI.

### 2. IaC Ownership Detector

Classifies each discovered resource.

Suggested statuses:

- `managed`: resource is known to be in Terraform state.
- `excluded`: resource has an exclusion tag or is GCCI-owned.
- `candidate`: resource appears unmanaged and can be imported.
- `unknown`: insufficient evidence.

### 3. Discovery API

Exposes normalized data to the UI.

Suggested endpoints:

```text
POST /api/discovery/runs
GET  /api/discovery/runs/:runId
GET  /api/discovery/runs/:runId/resources
POST /api/selections
GET  /api/selections/:selectionId/export
```

### 4. Selection UI

Lets engineers inspect and choose resources.

Minimum UI controls:

- Account selector
- Environment selector: `dev`, `staging`, `prod`
- Region selector
- Resource type filter
- Tag filter
- IaC status filter
- Free-text search
- Resource detail drawer
- Select checkbox
- Exclude action
- Export selected resources

### 4a. Terracognita Selection and Grouping

Selection is not only "which resources," but also "how to group generated files."

Recommended grouping strategy for Terracognita output:

- Group by environment, then region, then service.
- Keep shared network primitives in a dedicated folder.
- Keep import metadata separate from generated resource blocks.

Suggested file layout:

```text
infra/
  dev/
    ap-southeast-1/
      network/
        vpc.tf
        subnets.tf
        security_groups.tf
      compute/
        ec2.tf
      data/
        rds.tf
  prod/
    ap-southeast-1/
      ...
imports/
  selection.json
  terracognita-manifest.json
```

Grouping rules:

- One resource type per file when output is small and reviewable.
- Split large outputs by bounded domain (`network`, `compute`, `data`).
- Preserve stable filenames so repeated imports produce predictable diffs.
- Store original AWS IDs and ARNs in the manifest for traceability.

### 5. LLM-Assisted Import Pipeline

Consumes selected resources and produces production-ready Terraform code through an automated, iterative refinement loop.

#### 5a. Import Workspace Setup

For each import run, the backend creates a temporary Terraform workspace:

```text
/tmp/i2c-workspace-<runId>/
  main.tf          # provider config (region, credentials from user session)
  imports.tf       # generated import blocks from selected resources
  backend.tf       # local backend (no remote state)
```

The import blocks are generated from the existing `mapToTerraformImport()` mapping, which translates discovered ARNs into Terraform resource types and import IDs. This mapping is still required — `terraform plan -generate-config-out` needs import blocks as input.

#### 5b. Config Generation via Terraform

```bash
terraform init
terraform plan -generate-config-out=generated.tf
```

`-generate-config-out` reads the import blocks and produces a `generated.tf` file containing the full resource configuration matching the live cloud state. This replaces the old approach of generating empty placeholder resource blocks.

#### 5c. LLM Agent Iteration Loop

An LLM agent (Claude, using the user's own API key) refines the generated Terraform code through an iterative loop:

```text
┌─────────────────────────────────────┐
│  terraform plan -generate-config-out │
│  produces initial generated.tf       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  LLM reads generated.tf + plan      │
│  output and refines the code:        │
│  - removes default/computed values   │
│  - groups related resources by file  │
│  - extracts repeated values to vars  │
│  - adds module structure if needed   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  terraform plan                      │
│  checks: no infrastructure changes   │
│  planned? (only import actions)      │
│                                      │
│  YES ──► done, return files to user  │
│  NO  ──► feed errors back to LLM    │
└──────────────┬──────────────────────┘
               │ (errors/diffs)
               ▼
         loop back to LLM
         (max N iterations)
```

The correctness oracle is `terraform plan` itself. Each iteration must produce a plan with zero infrastructure changes — only import actions. If the LLM's edits introduce drift (e.g., removing a required argument), the plan output tells the LLM exactly what went wrong.

#### 5d. BYOK Model Keys

Users bring their own LLM API keys. Keys are:

- Entered in the UI (Integrations page).
- Stored in browser `sessionStorage` (not persisted across tab closes).
- Sent per-request via `X-Anthropic-Key` header (or equivalent for other providers).
- Never stored server-side.

The backend instantiates an SDK client per-request, runs the agent loop, and discards the client.

**Token budget**: The user sets a max token budget (default: 100k tokens). The backend accumulates `usage.input_tokens` + `usage.output_tokens` from each API response and halts when the budget is reached. The budget and live usage are streamed to the UI.

**Supported models** (starting set):

| Provider   | SDK Package           | Models                     |
|------------|-----------------------|----------------------------|
| Anthropic  | `@anthropic-ai/sdk`   | Claude Sonnet, Claude Haiku |

Additional providers (OpenAI, Google) can be added later by implementing the same agent interface with a different SDK call.

#### 5e. Real-Time Progress via SSE

The import generation endpoint uses Server-Sent Events to stream progress to the UI:

```
POST /api/import/generate
Content-Type: text/event-stream

Events:
  phase:init       "Creating Terraform workspace..."
  phase:plan       "Running terraform plan -generate-config-out..."
  phase:llm        "Claude is reviewing generated config..." (iteration N, tokens used)
  phase:validate   "Running terraform plan to verify..." (issues remaining)
  phase:done       Final files, total tokens, iteration count
  phase:error      Error message, partial results if available
  phase:cancelled  User cancelled the generation
```

The UI maintains an open SSE connection for the duration. Cancellation is handled by closing the connection — the backend detects `req.on('close')` and terminates the Terraform process and LLM loop.

#### 5f. Output

The pipeline produces:

```text
main.tf              # provider configuration
imports.tf           # import blocks
<service>.tf         # resource definitions grouped by service/domain
variables.tf         # extracted variables (if the LLM created any)
terraform.tfvars     # variable values
```

These files are returned to the UI for review. The user can then commit them to GitLab via the existing integration.

## Resource Model

Use one normalized shape internally:

```json
{
  "id": "i-0123456789abcdef0",
  "arn": "arn:aws:ec2:ap-southeast-1:123456789012:instance/i-0123456789abcdef0",
  "accountId": "123456789012",
  "region": "ap-southeast-1",
  "service": "ec2",
  "resourceType": "aws_instance",
  "name": "web-prod-01",
  "tags": {
    "Name": "web-prod-01",
    "Environment": "prod"
  },
  "iacStatus": "candidate",
  "classificationReasons": [
    "not_found_in_terraform_state",
    "no_exclusion_tag"
  ],
  "lastSeenAt": "2026-04-22T02:00:00.000Z"
}
```

## Discovery Strategy

### Phase 1: Resource Explorer Discovery

Uses AWS Resource Explorer 2 `Search` API with two parallel queries:

```text
resource-explorer-2:Search  QueryString="region:ap-southeast-1"
resource-explorer-2:Search  QueryString="region:global"
```

Resource Explorer requires a one-time index setup in the target account/region. The application uses the `Search` API with `ReadOnlyAccess` credentials — no write permissions needed.

Results are paginated (`MaxResults: 1000`, `NextToken` for continuation). Each result includes the resource ARN, resource type, region, and properties.

### Resource Mapping

Each discovered resource ARN is parsed via `parseArn()` to extract `{service, resourceType, resourceId, resourceRaw}`. The `service:resourceType` key (e.g. `ec2:instance`, `iam:role`) is looked up in `resource-map.json` to determine the Terraform resource type and import ID.

`resource-map.json` is generated from Resource Explorer supported types (~657 types) mapped to Terraform AWS provider types via an override table and convention-based derivation. See `scripts/generate-resource-map/README.md` for the full generator documentation.

### State Comparison and Classification

When the user uploads Terraform state files, `compareTfstate()` matches discovered resources against state entries by ARN and import ID. The result classifies each resource:

- **managed**: discovered resource matches a state entry.
- **unmanaged**: discovered resource has no matching state entry — candidate for import.
- **stale state**: state entry for a discoverable type not found in discovery results for the target region (may indicate deleted or drifted resources).
- **sub-resource**: state entry for a type not discoverable by Resource Explorer (e.g. `aws_route_table_association`, `aws_security_group_rule`). These are expected — they exist in state as children of discoverable parent resources.

State entries are filtered by the user's selected discovery region. Entries for other regions are excluded from the stale/sub-resource analysis. Global resources (IAM, CloudFront) are always included.

### Discovery Exclusion Policy

- Exclude resources with tag key `TerraYank` (any value).
- Exclude resources with GCCI ownership tags (`gcci`, `gcc:team=gcci`, `gcc_team=gcci`, `team=gcci`).
- Keep an audit log entry for every excluded resource with exclusion reason.

### Phase 2

Compare discovered resources against Terraform state.

State sources:

- Local `terraform.tfstate`, for PoC.
- GitLab-managed state, if GCC-IaC uses GitLab Terraform state.
- S3/DynamoDB backend, if agencies use AWS-native Terraform backends.

Edge case handling: orphaned but tagged resources

Problem:

- A resource can be tagged as IaC-managed but not actually tracked in Terraform state.

Detection and resolution policy:

1. Enforce provider-level default tags in all Terraform code so managed resources are consistently tagged.
2. Run a controlled tag update through Terraform (for example, change an audit tag value).
3. Resources updated by Terraform are considered actively IaC-managed.
4. Resources that keep stale tags but do not change through Terraform are flagged as `orphaned_tagged`.
5. `orphaned_tagged` resources are shown as import candidates, with a warning in UI.

This avoids trusting tags alone as proof of IaC ownership.

### Phase 3

LLM-assisted import generation.

- Create temporary Terraform workspace per import run.
- Generate import blocks from `mapToTerraformImport()` mapping.
- Run `terraform plan -generate-config-out` for full resource config.
- LLM agent iterates: refine code, validate with `terraform plan`, repeat until clean.
- Stream progress to UI via SSE.
- Commit results to GitLab via existing integration.

## Important Edge Cases

- Resources tagged as IaC-managed but absent from Terraform state.
- Resources carrying `TerraYank` or `gcci` tags should be excluded from discovery candidates.
- Resources with stale IaC tags but no Terraform ownership (`orphaned_tagged`).
- Resources in Terraform state but deleted from AWS.
- Untagged baseline infrastructure.
- Shared VPC/network resources owned by platform teams.
- Multi-account resources.
- Global AWS resources like IAM and CloudFront (discovered via `region:global` query).
- Provider aliases for different accounts and regions.

