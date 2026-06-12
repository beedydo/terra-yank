# Terraform File Grouping — Comparison of Granularity Levels

This directory contains three approaches to organizing Terraform resources into logical files. Each subfolder shows which resource types belong in which `.tf` file.

## Summary

| Granularity | Files | Avg Resources/File | Best For |
|-------------|------:|-------------------:|----------|
| **Broad** | 12 | ~29 | Small teams, few accounts, < 200 resources |
| **Medium** | 18 | ~19 | Most teams, moderate complexity, 200–1000 resources |
| **Fine-grained** | 48 | ~7 | Large teams, strict ownership boundaries, 1000+ resources |

---

## Broad (8–12 files)

**Philosophy:** Group by infrastructure domain. One file per major category.

### Pros
- Fast to navigate — few files to scan through
- Easy to understand for engineers new to Terraform
- Minimal merge conflicts when one person owns infrastructure
- Low overhead for small environments

### Cons
- Files grow large in accounts with many resources (500+ lines per file)
- Multiple engineers editing `network.tf` simultaneously → merge conflicts
- Harder to do targeted code reviews ("what changed in security groups?")
- Noisy diffs when making small changes in a big file

### When to use
- You have a small team (1–3 engineers) managing infrastructure
- The AWS account has fewer than 200 managed resources
- You want to get IaC started quickly without overthinking structure

---

## Medium (15–20 files) ← Recommended

**Philosophy:** Split high-churn resources into their own files. Keep related-but-low-churn resources together.

### Pros
- Balanced file sizes (~20 resources per file)
- Security groups, load balancers, DNS — the things that change most — get their own file
- Easy to find resources without needing to know exact service names
- Works well with GitLab/GitHub code ownership rules (one team owns `database.tf`, another owns `containers.tf`)
- Reasonable merge conflict surface

### Cons
- Some judgement calls on boundaries (is memorydb with elasticache or separate?)
- May still have occasional large files in heavily-used categories
- Not granular enough for strict per-service ownership models

### When to use
- Standard GCC team size (5–20 engineers)
- Moderate resource count (200–1000 managed resources)
- You want structure without excessive file proliferation
- **This is the default in i2cv2**

---

## Fine-grained (25+ files)

**Philosophy:** Near 1:1 mapping of AWS service to Terraform file.

### Pros
- Very precise code ownership (team A owns `rds.tf`, team B owns `eks.tf`)
- Minimal merge conflicts — changes are always isolated to one file
- Easy to find any resource — if you know the service, you know the file
- Clean diffs for code review
- Easier to delete entire services (remove one file)

### Cons
- 48 files to navigate — can feel overwhelming
- Related resources split across files (VPC in `vpc.tf`, subnets in `subnets.tf`, routes in `route_tables.tf`)
- Must `grep` across many files to understand network topology
- More cross-file `depends_on` and data source references
- Overkill for small environments

### When to use
- Large team with strict ownership model
- 1000+ managed resources across the account
- Multiple squads independently managing different services
- You need surgical PRs that touch exactly one concern

---

## How i2cv2 Uses This

i2cv2 uses the **medium** grouping as the default. After auto-generating Terraform from discovered resources, the tool splits the monolithic output into grouped files using `src/server/file-groups.json`.

The mapping is deterministic: each `aws_*` resource type maps to exactly one target file. Resources not in the map go to `misc.tf`.

To switch granularity in the future, replace `file-groups.json` with a different mapping (all three are available in this directory's generation script).
