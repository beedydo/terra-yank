"""Generate reference .tf files for all three granularity levels + xlsx + file-groups.json."""
import json
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

BASE = os.path.dirname(os.path.abspath(__file__))
RESOURCE_MAP = json.load(open(os.path.join(BASE, '..', 'extracted', 'i2cv2-i2cv2.v1', 'src', 'server', 'resource-map.json')))
ALL_TF_TYPES = sorted(set(v['tfType'] for v in RESOURCE_MAP['resources'].values()))

# ============================================================
# GROUPING DEFINITIONS
# ============================================================

BROAD = {
    "network.tf": {
        "desc": "VPC, subnets, route tables, NAT/Internet gateways, transit gateway, VPC peering, NACLs, VPC endpoints, network interfaces, Direct Connect",
        "prefixes": ["aws_vpc", "aws_subnet", "aws_route_table", "aws_route", "aws_internet_gateway",
                     "aws_nat_gateway", "aws_eip", "aws_vpc_peering", "aws_transit_gateway",
                     "aws_network_acl", "aws_vpc_endpoint", "aws_customer_gateway", "aws_vpn",
                     "aws_dx_", "aws_network_interface", "aws_flow_log", "aws_ec2_managed_prefix_list",
                     "aws_ec2_network_insights", "aws_ec2_transit_gateway"],
    },
    "compute.tf": {
        "desc": "EC2 instances, AMIs, EBS volumes/snapshots, key pairs, launch templates, Auto Scaling, placement groups",
        "prefixes": ["aws_instance", "aws_launch_template", "aws_ami", "aws_ebs_", "aws_key_pair",
                     "aws_placement_group", "aws_ec2_host", "aws_ec2_fleet", "aws_ec2_capacity",
                     "aws_autoscaling_", "aws_launch_configuration", "aws_volume_attachment"],
    },
    "security.tf": {
        "desc": "Security groups, WAF, GuardDuty, IAM Access Analyzer, ACM certificates, Shield",
        "prefixes": ["aws_security_group", "aws_vpc_security_group", "aws_wafv2_",
                     "aws_guardduty_", "aws_accessanalyzer_", "aws_acm_", "aws_acmpca_",
                     "aws_shield_"],
    },
    "database.tf": {
        "desc": "RDS, Aurora, DynamoDB, ElastiCache, MemoryDB, DocumentDB, Neptune, Redshift",
        "prefixes": ["aws_db_", "aws_rds_", "aws_dynamodb_", "aws_elasticache_", "aws_memorydb_",
                     "aws_docdb_", "aws_neptune_", "aws_redshift_"],
    },
    "storage.tf": {
        "desc": "S3 buckets, EFS, FSx, Backup, Storage Gateway",
        "prefixes": ["aws_s3_", "aws_efs_", "aws_fsx_", "aws_backup_", "aws_storagegateway_"],
    },
    "serverless.tf": {
        "desc": "Lambda, Step Functions, API Gateway, EventBridge Scheduler",
        "prefixes": ["aws_lambda_", "aws_sfn_", "aws_api_gateway_", "aws_apigatewayv2_",
                     "aws_scheduler_"],
    },
    "containers.tf": {
        "desc": "ECS, EKS, ECR, App Runner",
        "prefixes": ["aws_ecs_", "aws_eks_", "aws_ecr", "aws_apprunner_"],
    },
    "networking_services.tf": {
        "desc": "Load balancers (ALB/NLB), CloudFront, Route 53, Global Accelerator",
        "prefixes": ["aws_lb", "aws_alb", "aws_cloudfront_", "aws_route53_",
                     "aws_globalaccelerator_"],
    },
    "iam.tf": {
        "desc": "IAM roles, policies, users, groups, instance profiles, KMS, Secrets Manager, SSM parameters",
        "prefixes": ["aws_iam_", "aws_kms_", "aws_secretsmanager_", "aws_ssm_parameter"],
    },
    "monitoring.tf": {
        "desc": "CloudWatch (logs, alarms, dashboards), SNS, SQS, AWS Config, SES, Prometheus, Grafana",
        "prefixes": ["aws_cloudwatch_", "aws_sns_", "aws_sqs_", "aws_config_", "aws_ses",
                     "aws_prometheus_", "aws_grafana_"],
    },
    "cicd.tf": {
        "desc": "CodePipeline, CodeBuild, CodeCommit, CodeDeploy, CodeArtifact",
        "prefixes": ["aws_codepipeline", "aws_codebuild_", "aws_codecommit_", "aws_codedeploy_",
                     "aws_codeartifact_", "aws_codestarconnections_"],
    },
    "misc.tf": {
        "desc": "All other resources not covered above",
        "prefixes": [],
    },
}

MEDIUM = {
    "network.tf": {
        "desc": "VPC, subnets, route tables, NAT/Internet gateways, transit gateway, VPC peering, NACLs, VPC endpoints, network interfaces",
        "prefixes": ["aws_vpc", "aws_subnet", "aws_route_table", "aws_route", "aws_internet_gateway",
                     "aws_nat_gateway", "aws_eip", "aws_vpc_peering", "aws_transit_gateway",
                     "aws_network_acl", "aws_vpc_endpoint", "aws_customer_gateway", "aws_vpn",
                     "aws_dx_", "aws_network_interface", "aws_flow_log", "aws_ec2_managed_prefix_list",
                     "aws_ec2_network_insights", "aws_ec2_transit_gateway"],
    },
    "security_groups.tf": {
        "desc": "Security groups and their ingress/egress rules",
        "prefixes": ["aws_security_group", "aws_vpc_security_group"],
    },
    "compute.tf": {
        "desc": "EC2 instances, AMIs, EBS volumes/snapshots, key pairs, launch templates, Auto Scaling",
        "prefixes": ["aws_instance", "aws_launch_template", "aws_ami", "aws_ebs_", "aws_key_pair",
                     "aws_placement_group", "aws_ec2_host", "aws_ec2_fleet", "aws_ec2_capacity",
                     "aws_autoscaling_", "aws_launch_configuration", "aws_volume_attachment"],
    },
    "load_balancer.tf": {
        "desc": "Application/Network Load Balancers, target groups, listeners, listener rules",
        "prefixes": ["aws_lb", "aws_alb"],
    },
    "dns.tf": {
        "desc": "Route 53 hosted zones, records, resolver endpoints",
        "prefixes": ["aws_route53_"],
    },
    "database.tf": {
        "desc": "RDS instances/clusters, parameter groups, option groups, subnet groups, proxies",
        "prefixes": ["aws_db_", "aws_rds_"],
    },
    "dynamodb.tf": {
        "desc": "DynamoDB tables and related resources",
        "prefixes": ["aws_dynamodb_"],
    },
    "elasticache.tf": {
        "desc": "ElastiCache clusters, replication groups, MemoryDB",
        "prefixes": ["aws_elasticache_", "aws_memorydb_"],
    },
    "s3.tf": {
        "desc": "S3 buckets, bucket configurations, objects",
        "prefixes": ["aws_s3_"],
    },
    "lambda.tf": {
        "desc": "Lambda functions, layers, event source mappings, permissions",
        "prefixes": ["aws_lambda_"],
    },
    "iam.tf": {
        "desc": "IAM roles, policies, users, groups, instance profiles",
        "prefixes": ["aws_iam_"],
    },
    "kms.tf": {
        "desc": "KMS keys and aliases",
        "prefixes": ["aws_kms_"],
    },
    "secrets.tf": {
        "desc": "Secrets Manager secrets, SSM parameters",
        "prefixes": ["aws_secretsmanager_", "aws_ssm_parameter"],
    },
    "monitoring.tf": {
        "desc": "CloudWatch logs/alarms/dashboards, SNS topics, SQS queues, EventBridge",
        "prefixes": ["aws_cloudwatch_", "aws_sns_", "aws_sqs_"],
    },
    "containers.tf": {
        "desc": "ECS clusters/services/tasks, EKS clusters/node groups, ECR repositories",
        "prefixes": ["aws_ecs_", "aws_eks_", "aws_ecr"],
    },
    "cdn.tf": {
        "desc": "CloudFront distributions, cache policies, functions, OAC",
        "prefixes": ["aws_cloudfront_"],
    },
    "waf.tf": {
        "desc": "WAFv2 web ACLs, rule groups, IP sets",
        "prefixes": ["aws_wafv2_"],
    },
    "backup.tf": {
        "desc": "AWS Backup plans, vaults, selections",
        "prefixes": ["aws_backup_"],
    },
    "misc.tf": {
        "desc": "All other resources (Config rules, SES, GuardDuty, SSM docs, Step Functions, API Gateway, CI/CD, etc.)",
        "prefixes": [],
    },
}

FINE_GRAINED = {
    "vpc.tf": {"desc": "VPCs and CIDR associations", "prefixes": ["aws_vpc"]},
    "subnets.tf": {"desc": "Subnets", "prefixes": ["aws_subnet"]},
    "route_tables.tf": {"desc": "Route tables and routes", "prefixes": ["aws_route_table", "aws_route"]},
    "internet_gateways.tf": {"desc": "Internet gateways", "prefixes": ["aws_internet_gateway"]},
    "nat_gateways.tf": {"desc": "NAT gateways and Elastic IPs", "prefixes": ["aws_nat_gateway", "aws_eip"]},
    "transit_gateway.tf": {"desc": "Transit Gateway and attachments", "prefixes": ["aws_transit_gateway", "aws_ec2_transit_gateway"]},
    "vpc_peering.tf": {"desc": "VPC peering connections", "prefixes": ["aws_vpc_peering"]},
    "network_acls.tf": {"desc": "Network ACLs and rules", "prefixes": ["aws_network_acl"]},
    "vpc_endpoints.tf": {"desc": "VPC endpoints", "prefixes": ["aws_vpc_endpoint"]},
    "network_interfaces.tf": {"desc": "ENIs and flow logs", "prefixes": ["aws_network_interface", "aws_flow_log"]},
    "direct_connect.tf": {"desc": "Direct Connect connections and interfaces", "prefixes": ["aws_dx_"]},
    "vpn.tf": {"desc": "VPN gateways and connections", "prefixes": ["aws_vpn", "aws_customer_gateway"]},
    "security_groups.tf": {"desc": "Security groups and rules", "prefixes": ["aws_security_group", "aws_vpc_security_group"]},
    "ec2_instances.tf": {"desc": "EC2 instances and launch templates", "prefixes": ["aws_instance", "aws_launch_template", "aws_launch_configuration"]},
    "ebs.tf": {"desc": "EBS volumes and snapshots", "prefixes": ["aws_ebs_", "aws_volume_attachment"]},
    "ami.tf": {"desc": "AMIs", "prefixes": ["aws_ami"]},
    "key_pairs.tf": {"desc": "Key pairs", "prefixes": ["aws_key_pair"]},
    "autoscaling.tf": {"desc": "Auto Scaling groups and policies", "prefixes": ["aws_autoscaling_"]},
    "alb.tf": {"desc": "Application Load Balancers, listeners, rules", "prefixes": ["aws_lb", "aws_alb"]},
    "route53.tf": {"desc": "Route 53 zones, records, resolvers", "prefixes": ["aws_route53_"]},
    "rds.tf": {"desc": "RDS instances, clusters, parameter/option groups", "prefixes": ["aws_db_", "aws_rds_"]},
    "dynamodb.tf": {"desc": "DynamoDB tables", "prefixes": ["aws_dynamodb_"]},
    "elasticache.tf": {"desc": "ElastiCache clusters and replication groups", "prefixes": ["aws_elasticache_"]},
    "memorydb.tf": {"desc": "MemoryDB clusters and parameter groups", "prefixes": ["aws_memorydb_"]},
    "s3.tf": {"desc": "S3 buckets and configurations", "prefixes": ["aws_s3_"]},
    "lambda.tf": {"desc": "Lambda functions and layers", "prefixes": ["aws_lambda_"]},
    "iam_roles.tf": {"desc": "IAM roles and instance profiles", "prefixes": ["aws_iam_role", "aws_iam_instance_profile"]},
    "iam_policies.tf": {"desc": "IAM policies and attachments", "prefixes": ["aws_iam_policy", "aws_iam_user_policy", "aws_iam_group_policy", "aws_iam_role_policy"]},
    "iam_users.tf": {"desc": "IAM users and groups", "prefixes": ["aws_iam_user", "aws_iam_group", "aws_iam_access_key"]},
    "kms.tf": {"desc": "KMS keys and aliases", "prefixes": ["aws_kms_"]},
    "secrets_manager.tf": {"desc": "Secrets Manager secrets", "prefixes": ["aws_secretsmanager_"]},
    "ssm.tf": {"desc": "SSM parameters, documents, associations", "prefixes": ["aws_ssm_"]},
    "cloudwatch.tf": {"desc": "CloudWatch log groups, alarms, dashboards", "prefixes": ["aws_cloudwatch_"]},
    "sns.tf": {"desc": "SNS topics and subscriptions", "prefixes": ["aws_sns_"]},
    "sqs.tf": {"desc": "SQS queues", "prefixes": ["aws_sqs_"]},
    "ecs.tf": {"desc": "ECS clusters, services, task definitions", "prefixes": ["aws_ecs_"]},
    "eks.tf": {"desc": "EKS clusters and node groups", "prefixes": ["aws_eks_"]},
    "ecr.tf": {"desc": "ECR repositories", "prefixes": ["aws_ecr"]},
    "cloudfront.tf": {"desc": "CloudFront distributions and policies", "prefixes": ["aws_cloudfront_"]},
    "waf.tf": {"desc": "WAFv2 web ACLs and rule groups", "prefixes": ["aws_wafv2_"]},
    "api_gateway.tf": {"desc": "API Gateway REST/HTTP APIs", "prefixes": ["aws_api_gateway_", "aws_apigatewayv2_"]},
    "acm.tf": {"desc": "ACM certificates", "prefixes": ["aws_acm_", "aws_acmpca_"]},
    "backup.tf": {"desc": "AWS Backup plans and vaults", "prefixes": ["aws_backup_"]},
    "config.tf": {"desc": "AWS Config rules and recorders", "prefixes": ["aws_config_"]},
    "guardduty.tf": {"desc": "GuardDuty detectors", "prefixes": ["aws_guardduty_"]},
    "ses.tf": {"desc": "SES email identities and configuration", "prefixes": ["aws_ses", "aws_sesv2_"]},
    "step_functions.tf": {"desc": "Step Functions state machines", "prefixes": ["aws_sfn_"]},
    "kinesis.tf": {"desc": "Kinesis streams and Firehose", "prefixes": ["aws_kinesis_"]},
    "glue.tf": {"desc": "Glue databases, crawlers, jobs", "prefixes": ["aws_glue_"]},
    "codepipeline.tf": {"desc": "CodePipeline, CodeBuild, CodeCommit, CodeDeploy", "prefixes": ["aws_codepipeline", "aws_codebuild_", "aws_codecommit_", "aws_codedeploy_", "aws_codeartifact_"]},
    "misc.tf": {"desc": "All other resources", "prefixes": []},
}

def assign_type(tf_type, grouping):
    for filename, group in grouping.items():
        if filename == "misc.tf":
            continue
        for prefix in group['prefixes']:
            if tf_type.startswith(prefix):
                return filename
    return "misc.tf"

def build_assignments(grouping):
    return [(t, assign_type(t, grouping)) for t in ALL_TF_TYPES]

# ============================================================
# 1. Create reference .tf files
# ============================================================

for level_name, grouping in [("broad", BROAD), ("medium", MEDIUM), ("fine-grained", FINE_GRAINED)]:
    level_dir = os.path.join(BASE, level_name)
    assignments = build_assignments(grouping)

    file_types = {}
    for tf_type, filename in assignments:
        file_types.setdefault(filename, []).append(tf_type)

    for filename, types in sorted(file_types.items()):
        desc = grouping.get(filename, {}).get('desc', 'Miscellaneous resources')
        content = f"# {filename}\n# {desc}\n#\n# Resource types in this file:\n"
        for t in sorted(types):
            content += f"#   - {t}\n"
        content += f"#\n# Total: {len(types)} resource type(s)\n"

        filepath = os.path.join(level_dir, filename)
        with open(filepath, 'w') as f:
            f.write(content)

    print(f"[{level_name}] Created {len(file_types)} files with {len(assignments)} resource types")

# ============================================================
# 2. Generate xlsx
# ============================================================

wb = Workbook()
header_font = Font(bold=True, size=11, color="FFFFFF")
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)

for idx, (level_name, grouping) in enumerate([("Broad", BROAD), ("Medium", MEDIUM), ("Fine-grained", FINE_GRAINED)]):
    if idx == 0:
        ws = wb.active
        ws.title = level_name
    else:
        ws = wb.create_sheet(level_name)

    headers = ['Terraform File', 'Terraform Resource Type', 'Description']
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', wrap_text=True)
        cell.border = thin_border

    assignments = build_assignments(grouping)
    assignments.sort(key=lambda x: (x[1], x[0]))

    colors = ["E2EFDA", "D9E2F3", "FCE4D6", "EDEDED", "FFF2CC", "D6DCE4", "E4D5F0", "D1ECF1"]
    file_color = {}
    color_idx = 0

    for row_idx, (tf_type, filename) in enumerate(assignments, 2):
        if filename not in file_color:
            file_color[filename] = colors[color_idx % len(colors)]
            color_idx += 1
        fill = PatternFill(start_color=file_color[filename], end_color=file_color[filename], fill_type="solid")
        desc = grouping.get(filename, {}).get('desc', '')

        for col_idx, val in enumerate([filename, tf_type, desc], 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.fill = fill
            cell.border = thin_border
            cell.alignment = Alignment(wrap_text=True, vertical='top')

    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 45
    ws.column_dimensions['C'].width = 60
    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = f"A1:C{len(assignments)+1}"

    # Merge column A
    start_row = 2
    current_val = ws.cell(row=2, column=1).value
    for row in range(3, len(assignments) + 3):
        val = ws.cell(row=row, column=1).value if row <= len(assignments) + 1 else None
        if val != current_val:
            if row - 1 > start_row:
                ws.merge_cells(start_row=start_row, start_column=1, end_row=row - 1, end_column=1)
                ws.cell(row=start_row, column=1).alignment = Alignment(vertical='center', horizontal='center', wrap_text=True)
            start_row = row
            current_val = val

# Summary sheet
ws_sum = wb.create_sheet("Summary")
ws_sum['A1'] = 'Granularity'
ws_sum['B1'] = 'Number of Files'
ws_sum['C1'] = 'Avg Resources/File'
ws_sum['A1'].font = Font(bold=True)
ws_sum['B1'].font = Font(bold=True)
ws_sum['C1'].font = Font(bold=True)

for row_idx, (name, grouping) in enumerate([("Broad", BROAD), ("Medium", MEDIUM), ("Fine-grained", FINE_GRAINED)], 2):
    assignments = build_assignments(grouping)
    files = set(f for _, f in assignments)
    ws_sum.cell(row=row_idx, column=1, value=name)
    ws_sum.cell(row=row_idx, column=2, value=len(files))
    ws_sum.cell(row=row_idx, column=3, value=round(len(assignments) / len(files), 1))

ws_sum.column_dimensions['A'].width = 15
ws_sum.column_dimensions['B'].width = 18
ws_sum.column_dimensions['C'].width = 20

xlsx_path = os.path.join(BASE, '..', 'i2cv2-terraform-file-grouping.xlsx')
wb.save(xlsx_path)
print(f"\nCreated xlsx: {xlsx_path}")

# ============================================================
# 3. Generate file-groups.json (medium as default for i2cv2)
# ============================================================

file_groups = {}
for tf_type in ALL_TF_TYPES:
    file_groups[tf_type] = assign_type(tf_type, MEDIUM)

fg_path = os.path.join(BASE, '..', 'extracted', 'i2cv2-i2cv2.v1', 'src', 'server', 'file-groups.json')
with open(fg_path, 'w') as f:
    json.dump(file_groups, f, indent=2)
print(f"Created file-groups.json: {fg_path} ({len(file_groups)} types)")

print("\nDone!")
