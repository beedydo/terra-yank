# terra-yank Technical Documentation

## Tool Workflow

```
User selects resources → Create Workspace → terraform plan -generate-config-out
→ Pre-processor (deterministic fixes) → terraform plan (baseline check)
→ LLM Refinement Loop (if errors remain) → Final workspace files
```

### Detailed Flow

1. **Discovery**: AWS Resource Explorer scans `ap-southeast-1` for unmanaged resources
2. **Selection**: User picks importable resources from discovery results
3. **Workspace Creation**: Generates `imports.tf` + `main.tf`, runs `terraform plan -generate-config-out` to produce `generated.tf`
4. **Pre-processor**: Deterministic regex-based fixes for known Terraform generation bugs (no LLM needed)
5. **Baseline Plan**: Runs `terraform plan` to check if errors remain after pre-processing
6. **LLM Refinement**: If plan not clean, sends config + plan errors to Claude for iterative fixing
7. **Validation**: After each LLM iteration, runs `terraform plan` again to verify
8. **Export**: Clean config committed to GitLab via MR

---

## Pre-processor: Deterministic Fixes

The pre-processor (`src/server/agent.js: preProcessGeneratedConfig()`) runs before any LLM call and removes known-bad patterns from Terraform's auto-generated config.

### Subnet Conflicts

| Pattern | Fix |
|---------|-----|
| `availability_zone_id = "..."` | Remove (conflicts with `availability_zone`) |
| `enable_lni_at_device_index = 0` | Remove |
| `map_customer_owned_ip_on_launch = false` | Remove |
| `customer_owned_ipv4_pool = ""` or `null` | Remove |
| `outpost_arn = ""` or `null` | Remove |

### Lambda Null Source Attributes

| Pattern | Fix |
|---------|-----|
| `filename = null` | Remove |
| `image_uri = null` or `""` | Remove |
| `s3_bucket = null` or `""` | Remove |
| `s3_key = null` or `""` | Remove |
| `s3_object_version = null` or `""` | Remove |

### IPv6 / VPC Zero/Empty Attributes

| Pattern | Fix |
|---------|-----|
| `ipv6_netmask_length = 0` | Remove |
| `ipv6_ipam_pool_id = ""` | Remove |
| `ipv6_cidr_block = ""` | Remove |
| `assign_generated_ipv6_cidr_block = false` | Remove |

### DynamoDB / SNS

| Pattern | Fix |
|---------|-----|
| `recovery_period_in_days = 0` | Remove |
| `signature_version = 0` | Remove |

### Route Table Empty-String Attributes

All removed when set to `""` inside route blocks:

- `carrier_gateway_id`, `core_network_arn`, `destination_prefix_list_id`
- `egress_only_gateway_id`, `local_gateway_id`, `nat_gateway_id`
- `network_interface_id`, `transit_gateway_id`, `vpc_endpoint_id`
- `vpc_peering_connection_id`, `ipv6_cidr_block`

### Computed-Only Attributes

| Pattern | Fix |
|---------|-----|
| `owner_id = "..."` | Remove |
| `tags_all = { ... }` | Remove entire block |

### Subnet DNS/IPv6 Defaults

| Pattern | Fix |
|---------|-----|
| `enable_dns64 = false` | Remove |
| `enable_resource_name_dns_aaaa_record_on_launch = false` | Remove |
| `enable_resource_name_dns_a_record_on_launch = false` | Remove |
| `private_dns_hostname_type_on_launch = ""` | Remove |

### Network Interface: Invalid interface_type

Terraform only accepts `efa`, `efa-only`, `branch`, `trunk`. Generated config often contains service-managed types:

| Pattern | Fix |
|---------|-----|
| `interface_type = "network_load_balancer"` | Remove |
| `interface_type = "transit_gateway"` | Remove |
| `interface_type = "lambda"` | Remove |
| `interface_type = "nat_gateway"` | Remove |
| `interface_type = "interface"` | Remove |

### Network Interface: Conflicting Count/List Pairs

When both a count and a list are specified, Terraform errors. Remove the zero-count and empty-list variants:

| Pattern | Fix |
|---------|-----|
| `ipv4_prefix_count = 0` | Remove |
| `ipv4_prefixes = []` | Remove |
| `ipv6_address_count = 0` | Remove |
| `ipv6_address_list = []` | Remove |
| `ipv6_addresses = []` | Remove |
| `ipv6_prefix_count = 0` | Remove |
| `ipv6_prefixes = []` | Remove |
| `private_ip_list = [...]` | Remove (keep `private_ips` instead) |
| `private_ip_list_enabled = false` | Remove |
| `private_ips_count = 0` | Remove |

### NAT Gateway: Conflicting Secondary IP

| Pattern | Fix |
|---------|-----|
| `secondary_private_ip_address_count = 0` | Remove |
| `secondary_private_ip_addresses = []` | Remove |

### RDS: domain_dns_ips Minimum

| Pattern | Fix |
|---------|-----|
| `domain_dns_ips = []` | Remove (requires minimum 2 items; empty = not using domain join) |

### Network ACL: Missing ipv6_cidr_block in Rules

Terraform requires `ipv6_cidr_block` in every egress/ingress rule object, even when only IPv4 is used.

**Fix**: Post-processing injects `ipv6_cidr_block = ""` into each rule object that lacks it.

### Route Table: Missing Required Attributes in Route Objects

Terraform requires all optional-but-typed attributes present in route objects:

```
carrier_gateway_id, core_network_arn, destination_prefix_list_id,
egress_only_gateway_id, ipv6_cidr_block, local_gateway_id,
nat_gateway_id, network_interface_id, vpc_endpoint_id, vpc_peering_connection_id
```

**Fix**: Post-processing injects missing attrs as `= ""` into each route object.

### Empty Block Cleanup

After line removals, empty blocks like `route {}` or `point_in_time_recovery { enabled = true }` with only default content are removed.

---

## LLM Refinement: Architecture

### Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Model | `bedrock.claude-sonnet-4-6` | User-configurable in Settings |
| Base URL | `https://api.ai.tech.gov.sg/platform/models` | GCC AI Gateway |
| Max output tokens | 32,768 per call | Hardcoded |
| Token budget | 100,000 default (max 10M) | User-configurable in Settings |
| Max iterations | 5 | Hardcoded |
| API key | User-provided (BYOK) | Stored encrypted per-user |
| Streaming | Required | GCC AI Gateway mandate |

### Chunked Processing (>200 resources)

When workspace has >200 resources, the agent splits into chunks of ~150 resources:

1. Split `generated.tf` by resource blocks
2. Extract relevant plan errors per chunk
3. Process each chunk sequentially with focused error-fix prompt
4. Reassemble fixed chunks
5. Run `terraform plan` on combined result
6. If still not clean, fall through to normal refinement loop

### Known Limitations

| Issue | Impact | Workaround |
|-------|--------|------------|
| GCC AI Gateway ~5min idle timeout | Long LLM responses killed mid-stream | Chunked processing for large workspaces |
| 32k output token limit | Can't output >~200 resources in one call | Chunked processing auto-triggers |
| Streaming required | Non-streaming `messages.create()` rejected | Uses `messages.stream().finalMessage()` |
| Resource truncation | Model may output fewer resources than input | Safety check retries with emphasis on completeness |

---

## AWS Credentials

### Flow

```
UI Form → POST /api/credentials/aws → encrypt(accessKeyId, secretAccessKey, sessionToken)
→ SQLite (JSON blob) → decrypt on use → pass to AWS SDK
```

### Credential Types

| Key Prefix | Type | Session Token Required |
|------------|------|----------------------|
| `AKIA...` | Permanent IAM user key | No |
| `ASIA...` | Temporary STS credential | **Yes** (mandatory) |

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Decrypt failed: unable to authenticate data` | `ENCRYPTION_KEY` changed between server restarts | Delete creds, re-enter with current key |
| `InvalidClientTokenId` | Wrong access key ID | Re-enter in Settings |
| `SignatureDoesNotMatch` | Wrong secret access key | Re-enter in Settings |
| `ExpiredTokenException` | STS session token expired | Get fresh credentials, re-enter all three |
| `AccessDeniedException` on Resource Explorer | IAM missing `resource-explorer-2:Search` | Attach policy to IAM user/role |

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity",
        "iam:ListAccountAliases",
        "resource-explorer-2:Search",
        "resource-explorer-2:GetView",
        "resource-explorer-2:ListViews"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Deployment

### Environment Variables

| Var | Purpose |
|-----|---------|
| `ENCRYPTION_KEY` | AES-256-GCM key for credential encryption. **Must be consistent across restarts.** |
| `NODE_ENV` | `development` bypasses TechPass auth |
| `PORT` | Server port (default 4000) |
| `BETTER_AUTH_SECRET` | Session secret (prod) |
| `BETTER_AUTH_URL` | App base URL (prod) |
| `TECHPASS_CLIENT_ID` | TechPass OAuth (prod) |
| `TECHPASS_CLIENT_SECRET` | TechPass OAuth (prod) |
| `NODE_EXTRA_CA_CERTS` | CA bundle for GitLab Dedicated TLS (prod) |

### Local Development

```bash
cd extracted/terra-yank-v1
ENCRYPTION_KEY=supersecret NODE_ENV=development node src/server.js
# → http://localhost:4000
```

### Known Deployment Issues

- **Ephemeral DB**: SQLite wiped on every Airbase deploy (no persistent volumes). Users must re-enter credentials after each deploy.
- **DB path is relative**: `file:./terra-yank-auth.db` — must start server from project root.
- **Resource Explorer index**: Must be enabled in `ap-southeast-1`. If results say "incomplete", the index may need to be an aggregator type to cover cross-region resources.

---

## Debugging

### Server Logs

All API calls logged as: `METHOD /path STATUS TIMEms`

Agent-specific logs prefixed with `[agent]` or `[preprocess]`.

### Test AWS Credentials Endpoint

```bash
curl -s -X POST http://localhost:4000/api/credentials/aws/test \
  -H "Content-Type: application/json" -d '{}' | python3 -m json.tool
```

Returns:
- `keyPreview`: first 4 + last 4 chars of decrypted access key
- `secretLength`: length of decrypted secret (should be 40)
- `hasSessionToken`: whether session token stored
- `ok`: true/false
- `error`: AWS error details if failed
