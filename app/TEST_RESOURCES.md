# terra-yank Test Account — ClickOps Resource Setup

Test resources to create manually in the AWS Console (ap-southeast-1) for
validating the terra-yank discovery-and-import workflow.

**Important:** The app uses AWS Resource Explorer for discovery. Resources are
discovered by type, not by tags — but tags are used to classify GCCI ownership.
Use the tags below to validate the classification workflow.
Do **not** add `gcci`, `gcc:team`, or `Team=gcci` tags — those mark resources
as GCCI-owned and the app will bucket them separately from the importable set.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  AWS Account (ap-southeast-1)                                       │
│                                                                     │
│  ┌────────────────────── VPC 10.0.0.0/16 ──────────────────────┐   │
│  │                                                              │   │
│  │   ┌──────────────────┐       ┌──────────────────┐           │   │
│  │   │  Public Subnet   │       │  Private Subnet  │           │   │
│  │   │  10.0.1.0/24     │       │  10.0.2.0/24     │           │   │
│  │   │                  │       │                  │           │   │
│  │   │  ┌────────────┐  │       │  ┌────────────┐  │           │   │
│  │   │  │  Lambda fn  │─┼───────┼─▶│ DynamoDB   │  │           │   │
│  │   │  │  (i2c-test) │  │       │  │ (i2c-test) │  │           │   │
│  │   │  └──────┬─────┘  │       │  └────────────┘  │           │   │
│  │   │         │         │       │                  │           │   │
│  │   └─────────┼─────────┘       └──────────────────┘           │   │
│  │             │                                                │   │
│  │   ┌─────────▼─────────┐                                     │   │
│  │   │  Internet Gateway  │                                     │   │
│  │   └───────────────────┘                                     │   │
│  │                                                              │   │
│  │   Route Table ──▶ 0.0.0.0/0 → IGW                           │   │
│  │   Security Group ──▶ ingress 443, egress all                 │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Integration ───┐  ┌─── Storage ────┐  ┌─── Security ───┐    │
│  │                    │  │                │  │                │    │
│  │  SNS Topic         │  │  S3 Bucket     │  │  KMS Key       │    │
│  │  (i2c-test-notify) │  │  (i2c-test-*)  │  │  (i2c-test)    │    │
│  │       │            │  │                │  │                │    │
│  │       ▼            │  │                │  │  Secrets Mgr   │    │
│  │  SQS Queue         │  │                │  │  (i2c-test)    │    │
│  │  (i2c-test-work)   │  │                │  │                │    │
│  │                    │  │                │  │                │    │
│  └────────────────────┘  └────────────────┘  └────────────────┘    │
│                                                                     │
│  ┌─── Management ────────────────────────────────────────────┐     │
│  │  SSM Parameter: /i2c-test/config                          │     │
│  │  CloudWatch Log Group: /i2c-test/app                      │     │
│  └───────────────────────────────────────────────────────────┘     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resource List

Tag every resource with:

| Key         | Value            |
|-------------|------------------|
| `Project`   | `i2c-test`       |
| `Environment` | `test`         |
| `ManagedBy` | `clickops`       |

---

### 1. Network (5 resources)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 1  | VPC                 | VPC → Your VPCs → Create            | CIDR `10.0.0.0/16`, name `i2c-test-vpc`                      |
| 2  | Public Subnet       | VPC → Subnets → Create              | VPC above, CIDR `10.0.1.0/24`, AZ `ap-southeast-1a`, name `i2c-test-public` |
| 3  | Private Subnet      | VPC → Subnets → Create              | VPC above, CIDR `10.0.2.0/24`, AZ `ap-southeast-1b`, name `i2c-test-private` |
| 4  | Internet Gateway    | VPC → Internet Gateways → Create    | Name `i2c-test-igw`, attach to VPC above                      |
| 5  | Security Group      | VPC → Security Groups → Create      | VPC above, name `i2c-test-sg`, inbound HTTPS (443), outbound all |

> A Route Table and Network ACL are created automatically with the VPC. Add the
> `Project=i2c-test` tag to both so the app discovers them.

---

### 2. Compute (1 resource)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 6  | Lambda Function     | Lambda → Create function            | Name `i2c-test-hello`, runtime Node.js 20.x, default code, add tags |

---

### 3. Storage (2 resources)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 7  | S3 Bucket           | S3 → Create bucket                  | Name `i2c-test-<account-id>` (must be globally unique), defaults, add tags |
| 8  | DynamoDB Table      | DynamoDB → Create table             | Name `i2c-test-data`, partition key `pk` (String), on-demand capacity |

---

### 4. Integration (2 resources)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 9  | SNS Topic           | SNS → Create topic                  | Standard type, name `i2c-test-notify`, add tags               |
| 10 | SQS Queue           | SQS → Create queue                  | Standard type, name `i2c-test-work`, subscribe to SNS topic above, add tags |

---

### 5. Security (2 resources)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 11 | KMS Key             | KMS → Create key                    | Symmetric, encrypt/decrypt, alias `i2c-test-key`, add tags    |
| 12 | Secrets Manager     | Secrets Manager → Store new secret  | Plaintext `{"demo":"true"}`, name `i2c-test/db-password`, add tags |

---

### 6. Management (2 resources)

| #  | Resource            | Console Path                        | Settings                                                      |
|----|---------------------|-------------------------------------|---------------------------------------------------------------|
| 13 | SSM Parameter       | Systems Manager → Parameter Store   | Name `/i2c-test/config`, type String, value `{"env":"test"}`, add tags |
| 14 | CloudWatch Log Group| CloudWatch → Log groups → Create    | Name `/i2c-test/app`, retention 1 day, add tags               |

---

## Expected terra-yank Discovery Results

After creating these resources, the app should discover **~16 resources**
(14 created + auto-created route table and network ACL) across these categories:

| Category                 | Count | Terraform Import |
|--------------------------|-------|------------------|
| VPCs                     | 1     | ✅               |
| Subnets                  | 2     | ✅               |
| Internet Gateways        | 1     | ✅               |
| Security Groups          | 1     | ✅               |
| Route Tables             | 1     | ✅               |
| Network ACLs             | 1     | ✅               |
| Lambda Functions         | 1     | ✅               |
| S3 Buckets               | 1     | ✅               |
| DynamoDB                 | 1     | ✅               |
| SNS                      | 1     | ✅               |
| SQS                      | 1     | ✅               |
| KMS Keys                 | 1     | ✅               |
| Secrets Manager          | 1     | ✅               |
| SSM                      | 1     | ✅               |
| CloudWatch Logs          | 1     | ✅               |

All 16 resources have Terraform import mappings in the app, so the full
discover → select → export → commit workflow can be tested end to end.

---

## Cost Estimate

Most resources are free or near-free:

| Resource        | Cost                                      |
|-----------------|-------------------------------------------|
| VPC + networking| Free                                      |
| Lambda          | Free (1M requests/month free tier)        |
| S3 Bucket       | Free (empty bucket)                       |
| DynamoDB        | Free (on-demand, 25 GB free tier)         |
| SNS + SQS       | Free (1M requests/month free tier)        |
| KMS Key         | **~$1/month** (customer-managed key)      |
| Secrets Manager | **~$0.40/month** (per secret)             |
| SSM Parameter   | Free (standard tier)                      |
| CloudWatch Logs | Free (empty log group)                    |
| **Total**       | **~$1.40/month**                          |

---

## Cleanup

Delete in reverse order (security → integration → storage → compute → network).
Delete the VPC last since subnets, IGW, route tables, and security groups must
be removed or detached first.
