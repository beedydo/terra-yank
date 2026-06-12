# Backlog

## P0 - Discovery and Selection UI

- Create app skeleton.
- Create normalized resource model.
- Implement mock discovery data for UI development.
- Implement AWS discovery scanner.
- Implement resource table.
- Implement filters.
- Implement resource selection.
- Implement exclusion reason display.
- Export selected resources to JSON.

## P1 - IaC Detection (done)

- [x] Parse local Terraform state.
- [x] Match AWS resource ARNs and IDs to Terraform state entries.
- [x] Upload multiple state files via UI.
- [x] Filter managed resources from discovery results.
- [x] Classify unmatched state entries as stale (discoverable type not found) or sub-resource (type not discoverable by Resource Explorer).
- [x] Filter state entries by discovery region (exclude cross-region entries from stale analysis).

## P1 - LLM-Assisted Import Pipeline

### Terraform Workspace Manager
- Create temporary workspace directory per import run.
- Write provider config (`main.tf`) with user's AWS credentials and target region.
- Write import blocks (`imports.tf`) from selected resources via `mapToTerraformImport()`.
- Run `terraform init` to initialize the workspace.
- Run `terraform plan -generate-config-out=generated.tf` to produce initial resource config.
- Clean up workspace on completion or cancellation.

### LLM Agent Loop
- Accept user's BYOK API key via `X-Anthropic-Key` request header.
- Instantiate Anthropic SDK client per-request (never store the key).
- Feed generated config + plan output to the LLM with a system prompt defining the refinement task.
- LLM refines: remove default/computed values, group related resources into files, extract repeated values to variables.
- Run `terraform plan` after each LLM edit to verify zero infrastructure changes.
- Loop until plan is clean or max iterations reached.
- Track token usage (`input_tokens` + `output_tokens`) per API call; halt at user-defined budget.

### SSE Progress Streaming
- `POST /api/import/generate` returns `Content-Type: text/event-stream`.
- Emit events: `init`, `plan`, `llm`, `validate`, `done`, `error`, `cancelled`.
- Include iteration count, tokens used, and descriptive messages per event.
- Detect `req.on('close')` for cancellation — kill Terraform process and stop LLM loop.

### UI Integration
- Import generation panel with real-time status display.
- Phase indicator (stepper/progress bar).
- Live token/cost counter with budget bar.
- Iteration counter.
- Cancel button.
- File preview of generated Terraform code on completion.

## P1 - BYOK Model Configuration

- Integrations page: LLM provider section.
- API key input (stored in `sessionStorage`, never sent for server-side storage).
- Model selector (Claude Sonnet, Claude Haiku).
- Token budget input (default 100k tokens).
- Key validation: test API call on save.

## P2 - GitLab Integration

- Create service account.
- Create branch.
- Commit generated artifacts.
- Open merge request.
- Attach plan output.

## P3 - Stretch

- Additional LLM providers (OpenAI, Google).
- Architecture diagram generation.
- Drift detection.
- Historical discovery runs.
- Multi-account dashboard.
- Agency-specific tagging policy checks.

