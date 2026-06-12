# generate-resource-map

Generates a JSON mapping from AWS Resource Explorer supported types to Terraform resource types. The mapping is used at runtime to determine which discovered AWS resources can be imported into Terraform and what `terraform import` ID to use.

The generator starts from **Resource Explorer supported types** (the ground truth for what AWS resources can be discovered) and maps each to a Terraform resource type using overrides and convention, validated against the Terraform provider schema.

## Prerequisites

- **Terraform CLI** (>= 1.0) on your PATH
- **Node.js** (>= 18)
- **AWS CLI** (only for `--fetch-re-types` mode)
- Internet access (to download the AWS provider during `terraform init`)

## Usage

```bash
# Fetch Resource Explorer supported types from AWS API (one-time, requires AWS credentials)
node scripts/generate-resource-map/generate.js --fetch-re-types

# Generate resource map for a specific provider version
node scripts/generate-resource-map/generate.js 5.100.0

# Re-generate with whatever version is already initialized
node scripts/generate-resource-map/generate.js

# Fetch RE types and generate in one step
node scripts/generate-resource-map/generate.js --fetch-re-types 5.100.0
```

The script:

1. Loads cached Resource Explorer supported types from `re-supported-types.json`
2. Loads the previous `resource-map.json` for backward-compatibility diff
3. Runs `terraform init -upgrade` and `terraform providers schema -json` to get the provider schema
4. For each RE type, maps to a Terraform type via override table or convention
5. Validates each mapping against the provider schema
6. Writes the result to `src/server/resource-map.json`
7. Prints a diff report (added/removed/changed keys)
8. Validates against 30 known ARN patterns (exits non-zero on failure)

## Output

`src/server/resource-map.json` — committed to the repo so the app doesn't need Terraform at runtime.

```json
{
  "providerVersion": "5.100.0",
  "generatedAt": "2026-05-15T...",
  "totalReTypes": 657,
  "mappedTypes": 347,
  "resources": {
    "ec2:instance":    { "tfType": "aws_instance",        "importIdField": "resourceId", "reType": "ec2:instance",    "source": "override" },
    "ec2:vpc":         { "tfType": "aws_vpc",             "importIdField": "resourceId", "reType": "ec2:vpc",         "source": "override" },
    "s3":              { "tfType": "aws_s3_bucket",       "importIdField": "resourceRaw", "reType": "s3:bucket",      "source": "override" },
    "lambda:function": { "tfType": "aws_lambda_function", "importIdField": "resourceId", "reType": "lambda:function", "source": "convention" },
    "sns":             { "tfType": "aws_sns_topic",       "importIdField": "arn",         "reType": "sns:topic",      "source": "override" }
  }
}
```

**Key format:** `{arnService}:{arnResourceType}` — matches the service and resource type parsed from an AWS ARN at runtime via `parseArn()`. For services where the ARN has no resource type prefix (S3, SNS, SQS), the key is just `{arnService}`.

**`reType`** records the Resource Explorer type that produced this entry. Only types with `reType` are truly discoverable via Resource Explorer.

**`importIdField`** tells the runtime which part of the parsed ARN to use as the Terraform import ID:

| Value | Meaning | Example |
|-------|---------|---------|
| `resourceId` | The ID portion after the `/` or `:` in the ARN | `i-abc123`, `vpc-abc` |
| `resourceRaw` | The full resource section of the ARN | `my-bucket`, `loadbalancer/app/my-lb/abc` |
| `arn` | The complete ARN string | `arn:aws:sns:ap-southeast-1:123:my-topic` |

## How the mapping works

### Resource Explorer types as source of truth

The generator starts from the ~657 resource types that AWS Resource Explorer can discover (fetched via `ListSupportedResourceTypes` API). This ensures we only map types we can actually find during discovery.

### Override table (~360 types)

Explicit mappings in the `RE_OVERRIDES` object, keyed by RE type (e.g. `"ec2:instance"`, `"rds:db"`). Overrides are needed when:

- The Terraform type name differs from the RE type (e.g. `ec2:instance` -> `aws_instance`, `rds:db` -> `aws_db_instance`)
- The ARN key differs from the RE type (e.g. `s3:bucket` -> key `s3`, `elasticloadbalancing:loadbalancer/app` -> key `elasticloadbalancing:loadbalancer`)
- A non-default `importIdField` is needed (e.g. `arn` for SNS, `resourceRaw` for S3)
- The RE type should be skipped (set to `null`) — not useful for Terraform import

### Convention-based derivation

For RE types not in the override table, the convention is:
```
RE type: {service}:{resource-type}
  -> Terraform: aws_{tfPrefix}_{resource_type_underscored}
```

A small `RE_SERVICE_TO_TF_PREFIX` map handles services whose RE name differs from the Terraform prefix (e.g. `elasticfilesystem` -> `efs`, `elasticmapreduce` -> `emr`).

Convention-derived types are validated against the provider schema. If validation fails, the type goes into the "unmapped" report.

### Skipped types (~287)

RE types set to `null` in the override table — services not useful for Terraform import (e.g. Kubernetes objects in EKS, read-only resources, niche services without Terraform support).

## RE type to ARN key mapping

For most RE types, the RE type matches what `parseArn()` produces at runtime. Exceptions:

| RE type | ARN-parsed key | Reason |
|---------|---------------|--------|
| `s3:bucket` | `s3` | S3 ARNs have no resource type prefix |
| `sns:topic` | `sns` | SNS ARNs have no resource type prefix |
| `sqs:queue` | `sqs` | SQS ARNs have no resource type prefix |
| `elasticloadbalancing:loadbalancer/app` | `elasticloadbalancing:loadbalancer` | Nested path stripped by parseArn |
| `elasticloadbalancing:listener/app` | `elasticloadbalancing:listener` | Nested path stripped by parseArn |

## When to re-run

- **Bump AWS provider version**: new resource types may need new overrides
- **AWS adds new Resource Explorer types**: run `--fetch-re-types` to update the cache, then re-generate
- **Fix a mapping**: edit the `RE_OVERRIDES` table and re-run

## Verification

The script runs built-in validation against 30 known ARN patterns. You can also run the standalone end-to-end test:

```bash
node scripts/generate-resource-map/verify.js
```

## Files

```
scripts/generate-resource-map/
  generate.js               # the generator script
  re-supported-types.json   # cached RE supported types (committed)
  verify.js                 # standalone ARN mapping verification
  tf-workspace/
    main.tf                 # minimal TF config (auto-updated by the script)
    .gitignore              # ignores .terraform/ and lock file
src/server/
  resource-map.json         # generated output (committed)
  imports.js                # runtime consumer of the map
```
