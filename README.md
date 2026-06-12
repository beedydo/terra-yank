# TerraYank - TerraYank

TerraYank helps cloud engineers discover AWS resources that are not managed by Terraform, select resources to bring under IaC, generate/import Terraform, and iteratively refactor the result into a governed GitLab workflow.

## Problem

Engineers often have manually provisioned AWS resources outside Infrastructure-as-Code workflows. There is no reliable, standardised way to discover, import, and convert those resources into Terraform across multiple environments and AWS accounts.

## Primary Users

Cloud and DevOps engineers in Singapore teams who manage AWS infrastructure and already understand Terraform.

## Product Goal

TerraYank is a full import-to-code workflow that uses LLM agents to produce production-ready Terraform from unmanaged cloud resources. The application flow is:

1. Configure integrations: GitLab (personal access token) and LLM provider (BYOK API key).
2. Load accessible GitLab repositories or create a new repository.
3. Discover AWS resources in an account and region.
4. Separate platform-owned baseline resources from candidate resources.
5. Optionally upload Terraform state files to filter already-managed resources.
6. Select resources to import.
7. Generate Terraform code via an LLM-assisted pipeline:
   a. Create a temporary Terraform workspace with import blocks.
   b. Run `terraform plan -generate-config-out` to produce initial resource configuration.
   c. LLM agent iterates: refine code (remove defaults, group by service, extract variables), validate with `terraform plan`, repeat until the plan shows zero infrastructure changes.
   d. Stream real-time progress to the UI via SSE.
8. Review the generated Terraform files in the UI.
9. Commit the generated files into the selected GitLab repository.

## User Journey

1. Discover unmanaged resources in an AWS account and region.
2. Upload Terraform state files to filter out already-managed resources.
3. Exclude platform-owned baseline and other resources that should not be managed.
4. Select resources to import.
5. Configure LLM settings: provide API key, set token budget.
6. Generate Terraform code — the LLM agent creates, refines, and validates the config automatically.
7. Review the generated files in the UI while watching real-time progress.
8. Commit the result to a GitLab repository.
9. Repeat until the account is fully governed.

## Current Scope

- AWS account and region scan via AWS Resource Explorer (regional + global resources). Requires an **aggregator index** in the discovery region.
- Resource classification by service and infrastructure domain.
- platform-owned baseline segregation using `platform`, `platform:team`, or custom ownership tags.
- Terraform state file upload and comparison to filter managed resources.
- Stale state detection (resources in state but not discovered in the target region).
- Sub-resource classification (state entries for types not discoverable by Resource Explorer).
- Unsupported resource grouping with disabled selection.
- Importable resource selection basket.
- GitLab token integration.
- GitLab repository listing grouped by namespace.
- GitLab repository creation.
- Terraform import artifact generation (import blocks + placeholder resource blocks).
- GitLab file commit for generated `imports.tf` and `selection.json`.

### In Progress

- LLM-assisted import pipeline:
  - Terraform CLI bundled in container.
  - `terraform plan -generate-config-out` for full resource config generation.
  - LLM agent iteration loop with `terraform plan` as correctness oracle.
  - BYOK model API keys (starting with Anthropic Claude).
  - Token budget and usage tracking.
  - Real-time progress streaming via SSE.

### GitLab Dedicated Certificates

For production, mount your internal CA bundle into the container and set:

```bash
NODE_EXTRA_CA_CERTS=/path/to/company-ca.pem
```

For local trusted internal environments, the GitLab integration screen also supports an `Allow internal/self-signed certificate` option. Prefer the CA bundle approach for production.

## Future Scope

- GitLab merge request creation.
- Additional LLM providers (OpenAI, Google).
- Drift detection.
- Multi-account dashboard.
- Architecture diagram generation.

## Suggested Architecture

```text
Browser UI
  │
  ├─► TerraYank API
  │     ├─► AWS Resource Explorer (regional + global discovery)
  │     ├─► resource-map.json (RE type → Terraform type mapping)
  │     ├─► IaC/state detector (tfstate upload + comparison)
  │     ├─► resource classification (managed / unmanaged / stale / sub-resource)
  │     └─► selection/export API
  │
  ├─► LLM Import Pipeline (SSE)
  │     ├─► Terraform workspace manager (temp dirs, provider config)
  │     ├─► terraform plan -generate-config-out
  │     ├─► LLM agent (Anthropic SDK, BYOK key)
  │     │     └─► iterate: refine code → terraform plan → check → repeat
  │     └─► token budget tracker
  │
  └─► GitLab integration
        ├─► repository listing + creation
        └─► file commit
```

## Key Design Principle

Do not decide IaC ownership purely by resource existence. Treat ownership as a classification problem using multiple signals:

- Terraform state contains the resource.
- Resource has known IaC management tags.
- Resource has exclusion tags.
- Resource belongs to platform-managed baseline infrastructure.
- Resource appears orphaned or manually created.

## Application Structure

```text
src/server.js              # runtime entrypoint
src/server/app.js          # Express API and static app wiring
src/server/awsDiscovery.js # AWS Resource Explorer discovery (regional + global)
src/server/awsClients.js   # AWS SDK client factory (shared credentials/config)
src/server/imports.js      # Terraform import mapping and artifact generation
src/server/tfstate.js      # Terraform state parsing, comparison, stale/sub-resource split
src/server/utils.js        # ARN parsing, resource-map lookup utilities
src/server/resource-map.json # RE type → Terraform type mapping (generated)
src/server/agent.js        # LLM agent iteration loop and Terraform execution
src/server/workspace.js    # Terraform workspace lifecycle (create, init, plan, destroy)
src/server/gitlab.js       # GitLab integration, repo listing, repo creation, commit export
src/server/store.js        # local persisted integration/config store
src/public/                # browser UI
```

## Docker and Docker Readiness

This repository now includes deployment scaffolding for a containerized app:

- `Dockerfile` for a Node.js multi-stage build.
- `.dockerignore` to keep images smaller and avoid local artifacts.
- `docker.json` as a starter Docker app config.
- `src/server.js` as the runnable API service entrypoint.
- `package.json` scripts for build and start.

Before deploying, align the Docker commands with your actual app entrypoint and build output.  
Current defaults assume a production server at `dist/server.js` and application port `4000`.

For full Docker deployment steps, including GitLab push, image build, registry push, AWS credentials, and GitLab Dedicated certificates, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### Run locally in Docker

```bash
docker build -t terra-yank:local .
docker run --rm -p 4000:4000 terra-yank:local
```

Verify:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/
```

Discovery API (queries AWS Resource Explorer for regional and global resources):

```bash
curl -X POST http://localhost:4000/api/discovery/runs \
  -H "Content-Type: application/json" \
  -d '{"region":"ap-southeast-1"}'
```

Response shape:

- `totalDiscovered`: total resources found via Resource Explorer (regional + global).
- `groups[]`: resources grouped by platform ownership tag value.
- `groups[].services`: service-level count per group.
- `groups[].resources`: discovered resource ARNs and tags.

### Deploy to Docker

Prerequisites: Docker CLI installed (`docker -v`), logged in (`docker login`), and a project created in the [Docker Console](https://hub.docker.com). The `docker.json` handle must match your project.

```bash
docker container build
docker container deploy --yes
```

The app will be available at `https://your-domain.example.com`.

### Iterative Testing on Docker

Use on-demand environments to test changes without affecting the default deployment.

**1. Make changes locally and build:**

```bash
docker container build
```

**2. Deploy to a staging environment:**

```bash
docker container deploy --yes staging
```

This creates an isolated deployment at a separate URL for testing.

**3. Test the deployment:**

Open the staging URL in a browser and verify:
- Health endpoint responds: `curl https://<staging-url>/health`
- Discovery scan returns results for the target region.
- Tfstate upload correctly filters managed resources.
- Export generates valid Terraform import blocks.

**4. Fix issues and redeploy to staging:**

```bash
# edit code...
docker container build
docker container deploy --yes staging
```

Repeat until the feature works as expected.

**5. Promote to default:**

```bash
docker container deploy --yes
```

**6. Clean up the staging environment:**

```bash
docker container destroy --yes staging
```

**Environment-specific configuration:**

Place environment variables in `.env` (default) and `.env.staging` (staging). Docker injects the correct file at runtime based on the deployment target.

```
# .env.staging
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Do not commit `.env` files to git. Do not use production credentials in test environments. Do not leave on-demand environments running indefinitely.

# terra-yank
