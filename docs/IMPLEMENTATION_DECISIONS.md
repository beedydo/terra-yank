# Implementation Decisions

## Stack

```text
Frontend: Vanilla JS (single-page, no build step)
Backend: Node.js + Express
AWS access: AWS SDK for JavaScript v3
LLM access: @anthropic-ai/sdk (BYOK keys)
Terraform: CLI bundled in container (v1.12.1)
Storage: In-memory (session-scoped) + browser sessionStorage
Deployment: Docker (containerized, gdssingapore/docker base images)
```

Reasoning:

- Fast to build and iterate on the UI without a build pipeline.
- Easy to call AWS SDK, GitLab APIs, and LLM SDKs from the same backend.
- Terraform CLI in the container enables `plan -generate-config-out` and validation.
- BYOK model keys avoid managing API key infrastructure.
- Docker provides compliant hosting for cloud platform.

## Build Order

1. ~~Build with mock data first.~~ (done)
2. ~~Add AWS discovery scanner (Resource Explorer).~~ (done)
3. ~~Add classification rules.~~ (done)
4. ~~Add selection export.~~ (done)
5. ~~Add Terraform state comparison (stale/sub-resource split, region filtering).~~ (done)
6. ~~Add import artifact generation (import blocks + placeholders).~~ (done)
7. ~~Bundle Terraform CLI in container.~~ (done)
8. Add BYOK LLM key configuration UI.
9. Add Terraform workspace manager (create, init, plan, cleanup).
10. Add LLM agent iteration loop.
11. Add SSE progress streaming.
12. Add import generation UI with real-time feedback.
13. Add GitLab commit for generated files.

## LLM Agent Design

### Why BYOK (Bring Your Own Key)

- No central API key management or billing infrastructure needed.
- Users control their own costs and rate limits.
- Keys stay in browser `sessionStorage` — never persisted server-side, never logged.
- Per-request: key arrives in `X-Anthropic-Key` header, SDK client created and discarded per import run.

### Why Claude First

- Anthropic SDK is lightweight (`@anthropic-ai/sdk`).
- Claude models handle Terraform/HCL well.
- Token usage is reported per response (`usage.input_tokens`, `usage.output_tokens`), enabling budget enforcement.
- Adding other providers later is an SDK swap inside the agent loop — the iteration logic and system prompt stay the same.

### Agent Loop Strategy

The LLM does not write Terraform from scratch. `terraform plan -generate-config-out` produces the initial config from live cloud state. The LLM's job is refinement:

1. Remove default and computed values that clutter the code.
2. Group related resources into logical files (e.g., `network.tf`, `compute.tf`).
3. Extract repeated values into `variables.tf`.
4. Fix any issues flagged by `terraform plan`.

Each iteration ends with `terraform plan`. The plan is the correctness oracle — if it shows zero infrastructure changes (only imports), the code is correct. If it shows drift, the plan output tells the LLM exactly what to fix.

**Max iterations**: configurable, default 10. Most imports should converge in 2-4 iterations.

**Token budget**: configurable, default 100k tokens (~$1-2 on Sonnet). Accumulated across all iterations. When exceeded, the agent stops and returns the best result so far.

### System Prompt Structure

```text
You are a Terraform expert refining auto-generated import configuration.

Input:
- The current Terraform files in the workspace.
- The output of `terraform plan`.

Your task:
- Remove arguments set to their default or computed values.
- Group resources into files by service/domain.
- Extract repeated values (AMI IDs, VPC IDs, subnet IDs) into variables.
- Do NOT change resource addresses or import IDs.
- Do NOT add resources that are not in the import blocks.

Output:
- Return the complete contents of each .tf file you want to write.
- Use the format: ### FILE: <filename>\n<content>

Correctness rule:
- After your changes, `terraform plan` must show ONLY import actions.
- If your previous changes caused drift, the plan output is included — fix the issue.
```

### Error Handling

- `terraform init` fails → abort, return error (likely provider/credential issue).
- `terraform plan -generate-config-out` fails → abort, return error (unsupported resource or credential issue).
- LLM produces unparseable output → retry once, then abort with partial result.
- Max iterations reached → return best result with warning.
- Token budget exceeded → return current state with budget-exceeded message.
- User cancels (SSE close) → kill Terraform process, clean up workspace.

## SSE vs WebSocket vs Polling

SSE chosen because:

- Unidirectional server→client fits the use case (server streams status, client just listens).
- Native browser `EventSource` API — no library needed on the frontend.
- Works through HTTP proxies and load balancers (important for Docker).
- Simpler than WebSocket for a single long-running operation.
- Cancellation via connection close is natural.

Tradeoff: the HTTP connection stays open for the full generation (2-5 minutes typical). Acceptable for a single-user tool; would need a job queue for multi-user concurrency.

## Terraform Workspace Lifecycle

Each import run gets a temporary directory under `/tmp/i2c-workspace-<runId>/`. The workspace is:

- Created on request start.
- Initialized with `terraform init` (downloads the AWS provider).
- Used for all `terraform plan` calls during the agent loop.
- Cleaned up on completion, error, or cancellation.

Provider initialization is the slowest step (~10-15s for first init, cached after). The workspace uses a local backend — no remote state.

AWS credentials for the Terraform workspace come from the same credentials the user provides for discovery (environment variables injected by Docker).

## Tagging Rules

```text
TerraYankStatus=excluded
TerraYankManaged=true
platformManaged=true
Environment=dev|staging|prod
Application=<app-name>
Owner=<team>
```

For now, do not mutate existing resources. Treat tag mutation as a post-import step.

## Demo Success Criteria

The demo should prove:

- The tool finds resources engineers did not know were unmanaged.
- The user can avoid importing platform/platform-owned resources.
- The selected resources can be converted into production-ready Terraform code automatically.
- The LLM agent produces a clean `terraform plan` with zero infrastructure changes.
- The workflow can fit a GitLab MR review process.

