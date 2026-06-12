# TerraYank Docker Deployment

This guide explains how to push TerraYank to GitLab and run it as a Docker container.

## Prerequisites

- Docker installed locally or on the target host.
- Access to the target GitLab repository.
- AWS credentials available to the container at runtime.
- GitLab personal/project access token for the TerraYank integration screen.

TerraYank listens on port `4000` inside the container.

## Push This Repository To GitLab

If this folder is not already a Git repository:

```bash
git init
git add .
git commit -m "Initial terra-yank application"
git branch -M main
git remote add origin https://your-gitlab-instance.example.com/<group>/<project>.git
git push -u origin main
```

If the repository already has a Git remote:

```bash
git remote -v
git add .
git commit -m "Prepare terra-yank Docker deployment"
git push
```

## Build The Docker Image

From the repository root:

```bash
docker build -t terra-yank:local .
```

## Run Locally

Basic run:

```bash
docker run --rm \
  --name terra-yank \
  -p 4000:4000 \
  terra-yank:local
```

Open:

```text
http://localhost:4000
```

Health check:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"ok":true,"service":"terra-yank"}
```

## Run With AWS Credentials

TerraYank uses the AWS SDK default credential chain. For local Docker runs, mount your AWS credentials:

```bash
docker run --rm \
  --name terra-yank \
  -p 4000:4000 \
  -e AWS_PROFILE=default \
  -e AWS_REGION=ap-southeast-1 \
  -v "$HOME/.aws:/root/.aws:ro" \
  terra-yank:local
```

For cloud/container-platform deployment, prefer IAM roles or workload identity instead of mounting static credentials.

## GitLab Dedicated Certificate

For production, mount your internal CA bundle and set `NODE_EXTRA_CA_CERTS`:

```bash
docker run --rm \
  --name terra-yank \
  -p 4000:4000 \
  -e NODE_EXTRA_CA_CERTS=/etc/ssl/certs/company-ca.pem \
  -v /path/to/company-ca.pem:/etc/ssl/certs/company-ca.pem:ro \
  terra-yank:local
```

For temporary internal testing, the GitLab integration screen currently allows SSL verification to be disabled for the GitLab connection.

## Push Image To GitLab Container Registry

Set variables:

```bash
export GITLAB_REGISTRY=your-gitlab-instance.example.com:5050
export GITLAB_PROJECT=<group>/<project>
export IMAGE="$GITLAB_REGISTRY/$GITLAB_PROJECT/terra-yank:latest"
```

Login:

```bash
docker login "$GITLAB_REGISTRY"
```

Build and push:

```bash
docker build -t "$IMAGE" .
docker push "$IMAGE"
```

Run from registry:

```bash
docker run --rm \
  --name terra-yank \
  -p 4000:4000 \
  "$IMAGE"
```

## Runtime Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | HTTP server port inside the container. |
| `NODE_ENV` | No | `production` | Runtime mode. |
| `AWS_REGION` | Recommended | none | Default AWS region for SDK calls. |
| `AWS_PROFILE` | Local only | none | AWS profile when mounting `~/.aws`. |
| `NODE_EXTRA_CA_CERTS` | Internal GitLab | none | Additional CA bundle for GitLab Dedicated/internal TLS. |

GitLab token and base URL are configured from the web UI under `Integrations`.

## Docker Compose Example

```yaml
services:
  terra-yank:
    image: terra-yank:local
    container_name: terra-yank
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      PORT: 4000
      AWS_REGION: ap-southeast-1
    volumes:
      - ~/.aws:/root/.aws:ro
```

Start:

```bash
docker compose up -d
docker compose logs -f terra-yank
```

## Operational Checks

Container status:

```bash
docker ps
```

Logs:

```bash
docker logs --tail 200 terra-yank
```

Shell into the container:

```bash
docker exec -it terra-yank sh
```

Health from inside the container:

```bash
docker exec terra-yank node -e "fetch('http://127.0.0.1:4000/health').then(r=>r.text()).then(console.log)"
```

## Troubleshooting

### GitLab connection fails with certificate error

Use `NODE_EXTRA_CA_CERTS` with your internal CA bundle, or temporarily enable the SSL verification bypass in the GitLab integration screen.

### GitLab repository creation fails with namespace error

Load repositories first, then select a namespace/group in the create repository panel. The token must have permission to create projects in that namespace.

### AWS discovery fails

Confirm the container has AWS credentials and the caller has permissions for:

- `resource-explorer-2:Search` (discovery)
- `sts:GetCallerIdentity`
- `iam:ListAccountAliases`

The simplest approach is `ReadOnlyAccess` managed policy, which covers Resource Explorer and all read APIs.

### Global resources (IAM, CloudFront) not discovered

The Resource Explorer index in the discovery region must be an **aggregator index**. A local index only covers regional resources — global resources like IAM roles and policies will be missing.

Check the index type:

```bash
aws resource-explorer-2 get-index --region ap-southeast-1
```

If `Type` is `LOCAL`, promote it to `AGGREGATOR`:

```bash
aws resource-explorer-2 update-index-type \
  --arn <index-arn> \
  --type AGGREGATOR \
  --region ap-southeast-1
```

Allow a few minutes for the aggregator to replicate resources from other regions.

For local testing:

```bash
docker run --rm \
  -p 4000:4000 \
  -e AWS_PROFILE=default \
  -e AWS_REGION=ap-southeast-1 \
  -v "$HOME/.aws:/root/.aws:ro" \
  terra-yank:local
```

### Port already in use

Map a different host port:

```bash
docker run --rm -p 4010:4000 terra-yank:local
```

Open:

```text
http://localhost:4010
```
