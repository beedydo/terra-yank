# Milestone Plan

## Week 1 - Kickoff

Outcome:

- Shared understanding of problem, users, and demo path.

Deliverables:

- Problem statement.
- Target user journey.
- Definition of MVP and non-goals.
- Initial service list for AWS discovery.

## Week 2 - Setup and Discovery/Selection MVP

This is the milestone 2c focus.

Outcome:

- First usable Discovery and Selection UI.

Deliverables:

- AWS account and GitLab access confirmed.
- Local app skeleton.
- Discovery scanner for one AWS account and region.
- Normalized resource model.
- Resource table UI.
- Filters by resource type, tag, region, and IaC status.
- Selection basket.
- Export selected resources as JSON.

Acceptance criteria:

- User can run a discovery scan.
- User can see candidate unmanaged resources.
- User can exclude GCCI or TerraYank-tagged resources.
- User can select a subset of resources.
- User can export a machine-readable import selection.

## Week 3 - LLM Import Pipeline Backend

Outcome:

- Backend can generate production-ready Terraform from selected resources using the LLM agent loop.

Deliverables:

- Terraform workspace manager (`workspace.js`): create, init, plan, cleanup.
- `terraform plan -generate-config-out` integration.
- LLM agent iteration loop (`agent.js`) with Anthropic SDK.
- BYOK key handling (per-request, never stored).
- Token budget tracking and enforcement.
- SSE endpoint for progress streaming.
- Error handling for all failure modes.

Acceptance criteria:

- Selected resources produce a `terraform plan` with only import actions and zero infrastructure changes.
- Agent converges within the token budget.
- Cancellation cleans up the workspace and stops the LLM loop.

## Week 4 - Import UI and End-to-End Integration

Outcome:

- Full end-to-end demo: discover → select → generate → review → commit.

Deliverables:

- BYOK model configuration in Integrations page.
- Import generation UI with real-time SSE progress display.
- Phase stepper, token/cost counter, iteration counter, cancel button.
- Generated file preview and review UI.
- GitLab commit of generated Terraform files.

Acceptance criteria:

- User can configure their Anthropic API key and token budget in the UI.
- User can trigger import generation and see real-time progress.
- User can cancel a running generation.
- User can review generated files and commit them to GitLab.

## Week 5 - Buffer

Outcome:

- Stabilize demo.

Deliverables:

- Error handling and user-facing error messages.
- Edge case handling (large resource sets, provider errors, LLM failures).
- Permission failure messages.
- Demo seed data.
- Security review checklist.

## Week 6 - Final Demo

Outcome:

- Show whole-of-government value.

Demo script:

1. Scan an AWS account.
2. Show unmanaged resources.
3. Upload Terraform state to filter managed resources.
4. Filter out excluded/GCCI resources.
5. Select resources for import.
6. Configure LLM (API key, token budget).
7. Generate Terraform code — show real-time progress.
8. Review generated files — show clean `terraform plan`.
9. Commit to GitLab.
10. Explain future MR flow and drift detection.

