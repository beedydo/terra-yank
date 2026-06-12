import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

data = json.load(open('/Users/wendytan/iac-i2c-v2-build-hackathon/extracted/i2cv2-i2cv2.v1/src/server/resource-map.json'))
resources = data.get('resources', {})

# Terraform file groupings - how resources should be organized into .tf files
# Based on common terraform project structure best practices
FILE_GROUPS = {
    "network.tf": {
        "description": "VPC, subnets, route tables, NAT gateways, internet gateways, VPC peering, transit gateway, network ACLs",
        "terraform_types": [
            "aws_vpc",
            "aws_subnet",
            "aws_route_table",
            "aws_route_table_association",
            "aws_route",
            "aws_internet_gateway",
            "aws_nat_gateway",
            "aws_eip",
            "aws_vpc_peering_connection",
            "aws_transit_gateway",
            "aws_transit_gateway_route_table",
            "aws_transit_gateway_vpc_attachment",
            "aws_network_acl",
            "aws_network_acl_rule",
            "aws_vpc_endpoint",
            "aws_vpc_endpoint_service",
            "aws_vpc_ipv4_cidr_block_association",
            "aws_customer_gateway",
            "aws_vpn_gateway",
            "aws_vpn_connection",
            "aws_dx_connection",
            "aws_dx_gateway",
            "aws_dx_gateway_association",
            "aws_dx_private_virtual_interface",
            "aws_dx_public_virtual_interface",
            "aws_dx_transit_virtual_interface",
            "aws_ec2_transit_gateway_route",
            "aws_ec2_managed_prefix_list",
            "aws_flow_log",
            "aws_network_interface",
            "aws_ec2_network_insights_path",
            "aws_ec2_network_insights_analysis",
        ]
    },
    "security_groups.tf": {
        "description": "Security groups and their rules",
        "terraform_types": [
            "aws_security_group",
            "aws_security_group_rule",
            "aws_vpc_security_group_ingress_rule",
            "aws_vpc_security_group_egress_rule",
        ]
    },
    "compute.tf": {
        "description": "EC2 instances, launch templates, AMIs, placement groups, dedicated hosts",
        "terraform_types": [
            "aws_instance",
            "aws_launch_template",
            "aws_ami",
            "aws_ami_copy",
            "aws_ami_launch_permission",
            "aws_placement_group",
            "aws_ec2_host",
            "aws_ec2_fleet",
            "aws_ec2_capacity_reservation",
            "aws_key_pair",
            "aws_ebs_volume",
            "aws_volume_attachment",
            "aws_ebs_snapshot",
            "aws_ebs_snapshot_copy",
            "aws_ebs_default_kms_key",
        ]
    },
    "autoscaling.tf": {
        "description": "Auto Scaling groups, policies, scheduled actions",
        "terraform_types": [
            "aws_autoscaling_group",
            "aws_autoscaling_policy",
            "aws_autoscaling_schedule",
            "aws_autoscaling_lifecycle_hook",
            "aws_autoscaling_attachment",
            "aws_autoscaling_notification",
            "aws_launch_configuration",
        ]
    },
    "load_balancer.tf": {
        "description": "ALB, NLB, target groups, listeners, listener rules",
        "terraform_types": [
            "aws_lb",
            "aws_alb",
            "aws_lb_target_group",
            "aws_alb_target_group",
            "aws_lb_listener",
            "aws_alb_listener",
            "aws_lb_listener_rule",
            "aws_alb_listener_rule",
            "aws_lb_target_group_attachment",
        ]
    },
    "dns.tf": {
        "description": "Route 53 zones, records, health checks",
        "terraform_types": [
            "aws_route53_zone",
            "aws_route53_record",
            "aws_route53_health_check",
            "aws_route53_resolver_endpoint",
            "aws_route53_resolver_rule",
            "aws_route53_resolver_rule_association",
        ]
    },
    "database.tf": {
        "description": "RDS instances, clusters, parameter groups, option groups, snapshots, proxies",
        "terraform_types": [
            "aws_db_instance",
            "aws_db_cluster",
            "aws_db_subnet_group",
            "aws_db_parameter_group",
            "aws_db_option_group",
            "aws_db_snapshot",
            "aws_db_cluster_snapshot",
            "aws_rds_cluster",
            "aws_rds_cluster_instance",
            "aws_db_proxy",
            "aws_db_proxy_default_target_group",
            "aws_db_proxy_target",
        ]
    },
    "dynamodb.tf": {
        "description": "DynamoDB tables, global tables, backups",
        "terraform_types": [
            "aws_dynamodb_table",
            "aws_dynamodb_global_table",
            "aws_dynamodb_contributor_insights",
            "aws_dynamodb_kinesis_streaming_destination",
            "aws_dynamodb_table_item",
        ]
    },
    "elasticache.tf": {
        "description": "ElastiCache clusters, replication groups, parameter groups, MemoryDB",
        "terraform_types": [
            "aws_elasticache_cluster",
            "aws_elasticache_replication_group",
            "aws_elasticache_subnet_group",
            "aws_elasticache_parameter_group",
            "aws_elasticache_user",
            "aws_elasticache_user_group",
            "aws_memorydb_cluster",
            "aws_memorydb_parameter_group",
            "aws_memorydb_subnet_group",
            "aws_memorydb_acl",
            "aws_memorydb_user",
        ]
    },
    "s3.tf": {
        "description": "S3 buckets, bucket policies, lifecycle rules, replication",
        "terraform_types": [
            "aws_s3_bucket",
            "aws_s3_bucket_policy",
            "aws_s3_bucket_acl",
            "aws_s3_bucket_cors_configuration",
            "aws_s3_bucket_lifecycle_configuration",
            "aws_s3_bucket_logging",
            "aws_s3_bucket_notification",
            "aws_s3_bucket_object_lock_configuration",
            "aws_s3_bucket_public_access_block",
            "aws_s3_bucket_replication_configuration",
            "aws_s3_bucket_server_side_encryption_configuration",
            "aws_s3_bucket_versioning",
            "aws_s3_bucket_website_configuration",
            "aws_s3_object",
            "aws_s3_access_point",
        ]
    },
    "lambda.tf": {
        "description": "Lambda functions, layers, event source mappings, permissions",
        "terraform_types": [
            "aws_lambda_function",
            "aws_lambda_layer_version",
            "aws_lambda_alias",
            "aws_lambda_event_source_mapping",
            "aws_lambda_permission",
            "aws_lambda_function_url",
            "aws_lambda_provisioned_concurrency_config",
        ]
    },
    "iam.tf": {
        "description": "IAM roles, policies, users, groups, instance profiles",
        "terraform_types": [
            "aws_iam_role",
            "aws_iam_role_policy",
            "aws_iam_role_policy_attachment",
            "aws_iam_policy",
            "aws_iam_user",
            "aws_iam_user_policy",
            "aws_iam_user_policy_attachment",
            "aws_iam_group",
            "aws_iam_group_policy",
            "aws_iam_group_policy_attachment",
            "aws_iam_group_membership",
            "aws_iam_instance_profile",
            "aws_iam_access_key",
            "aws_iam_service_linked_role",
            "aws_iam_openid_connect_provider",
            "aws_iam_saml_provider",
        ]
    },
    "kms.tf": {
        "description": "KMS keys, aliases, grants",
        "terraform_types": [
            "aws_kms_key",
            "aws_kms_alias",
            "aws_kms_grant",
            "aws_kms_ciphertext",
            "aws_kms_replica_key",
        ]
    },
    "secrets.tf": {
        "description": "Secrets Manager secrets and SSM parameters",
        "terraform_types": [
            "aws_secretsmanager_secret",
            "aws_secretsmanager_secret_version",
            "aws_secretsmanager_secret_rotation",
            "aws_secretsmanager_secret_policy",
            "aws_ssm_parameter",
        ]
    },
    "monitoring.tf": {
        "description": "CloudWatch alarms, dashboards, log groups, metric filters, EventBridge rules",
        "terraform_types": [
            "aws_cloudwatch_log_group",
            "aws_cloudwatch_log_metric_filter",
            "aws_cloudwatch_log_subscription_filter",
            "aws_cloudwatch_metric_alarm",
            "aws_cloudwatch_dashboard",
            "aws_cloudwatch_event_rule",
            "aws_cloudwatch_event_target",
            "aws_cloudwatch_composite_alarm",
            "aws_cloudwatch_log_destination",
            "aws_prometheus_workspace",
            "aws_prometheus_rule_group_namespace",
            "aws_grafana_workspace",
        ]
    },
    "sns_sqs.tf": {
        "description": "SNS topics, subscriptions, SQS queues",
        "terraform_types": [
            "aws_sns_topic",
            "aws_sns_topic_subscription",
            "aws_sns_topic_policy",
            "aws_sqs_queue",
            "aws_sqs_queue_policy",
            "aws_sqs_queue_redrive_policy",
            "aws_sqs_queue_redrive_allow_policy",
        ]
    },
    "ecs.tf": {
        "description": "ECS clusters, services, task definitions, capacity providers",
        "terraform_types": [
            "aws_ecs_cluster",
            "aws_ecs_service",
            "aws_ecs_task_definition",
            "aws_ecs_capacity_provider",
            "aws_ecs_cluster_capacity_providers",
            "aws_ecs_account_setting_default",
        ]
    },
    "eks.tf": {
        "description": "EKS clusters, node groups, Fargate profiles, add-ons",
        "terraform_types": [
            "aws_eks_cluster",
            "aws_eks_node_group",
            "aws_eks_fargate_profile",
            "aws_eks_addon",
            "aws_eks_identity_provider_config",
        ]
    },
    "ecr.tf": {
        "description": "ECR repositories, lifecycle policies, replication",
        "terraform_types": [
            "aws_ecr_repository",
            "aws_ecr_lifecycle_policy",
            "aws_ecr_repository_policy",
            "aws_ecr_replication_configuration",
            "aws_ecrpublic_repository",
        ]
    },
    "api_gateway.tf": {
        "description": "API Gateway REST APIs, HTTP APIs, stages, deployments",
        "terraform_types": [
            "aws_api_gateway_rest_api",
            "aws_api_gateway_resource",
            "aws_api_gateway_method",
            "aws_api_gateway_integration",
            "aws_api_gateway_deployment",
            "aws_api_gateway_stage",
            "aws_api_gateway_domain_name",
            "aws_api_gateway_base_path_mapping",
            "aws_api_gateway_vpc_link",
            "aws_apigatewayv2_api",
            "aws_apigatewayv2_stage",
            "aws_apigatewayv2_domain_name",
            "aws_apigatewayv2_vpc_link",
        ]
    },
    "cloudfront.tf": {
        "description": "CloudFront distributions, cache policies, functions, OAI/OAC",
        "terraform_types": [
            "aws_cloudfront_distribution",
            "aws_cloudfront_cache_policy",
            "aws_cloudfront_origin_request_policy",
            "aws_cloudfront_response_headers_policy",
            "aws_cloudfront_function",
            "aws_cloudfront_origin_access_identity",
            "aws_cloudfront_origin_access_control",
            "aws_cloudfront_realtime_log_config",
        ]
    },
    "waf.tf": {
        "description": "WAF web ACLs, rule groups, IP sets",
        "terraform_types": [
            "aws_wafv2_web_acl",
            "aws_wafv2_rule_group",
            "aws_wafv2_ip_set",
            "aws_wafv2_regex_pattern_set",
            "aws_wafv2_web_acl_association",
        ]
    },
    "acm.tf": {
        "description": "ACM certificates, private CA",
        "terraform_types": [
            "aws_acm_certificate",
            "aws_acm_certificate_validation",
            "aws_acmpca_certificate_authority",
        ]
    },
    "backup.tf": {
        "description": "AWS Backup plans, vaults, selections",
        "terraform_types": [
            "aws_backup_plan",
            "aws_backup_vault",
            "aws_backup_selection",
            "aws_backup_vault_policy",
            "aws_backup_report_plan",
        ]
    },
    "config.tf": {
        "description": "AWS Config rules, recorders, conformance packs",
        "terraform_types": [
            "aws_config_config_rule",
            "aws_config_configuration_recorder",
            "aws_config_delivery_channel",
            "aws_config_conformance_pack",
        ]
    },
    "ssm.tf": {
        "description": "SSM documents, associations, maintenance windows, patch baselines",
        "terraform_types": [
            "aws_ssm_document",
            "aws_ssm_association",
            "aws_ssm_maintenance_window",
            "aws_ssm_maintenance_window_target",
            "aws_ssm_maintenance_window_task",
            "aws_ssm_patch_baseline",
            "aws_ssm_patch_group",
            "aws_ssm_activation",
        ]
    },
    "ses.tf": {
        "description": "SES email identities, configuration sets, templates",
        "terraform_types": [
            "aws_ses_domain_identity",
            "aws_ses_email_identity",
            "aws_ses_configuration_set",
            "aws_ses_receipt_rule_set",
            "aws_ses_receipt_rule",
            "aws_ses_template",
            "aws_sesv2_configuration_set",
            "aws_sesv2_email_identity",
        ]
    },
    "stepfunctions.tf": {
        "description": "Step Functions state machines",
        "terraform_types": [
            "aws_sfn_state_machine",
            "aws_sfn_activity",
        ]
    },
    "codepipeline.tf": {
        "description": "CodePipeline, CodeBuild, CodeCommit, CodeDeploy",
        "terraform_types": [
            "aws_codepipeline",
            "aws_codebuild_project",
            "aws_codecommit_repository",
            "aws_codedeploy_app",
            "aws_codedeploy_deployment_group",
            "aws_codeartifact_domain",
            "aws_codeartifact_repository",
            "aws_codestarconnections_connection",
        ]
    },
    "guardduty.tf": {
        "description": "GuardDuty detectors, members, publishing destinations",
        "terraform_types": [
            "aws_guardduty_detector",
            "aws_guardduty_member",
            "aws_guardduty_publishing_destination",
            "aws_guardduty_filter",
        ]
    },
    "kinesis.tf": {
        "description": "Kinesis streams, Firehose delivery streams",
        "terraform_types": [
            "aws_kinesis_stream",
            "aws_kinesis_firehose_delivery_stream",
            "aws_kinesis_analytics_application",
            "aws_kinesis_video_stream",
            "aws_kinesisanalyticsv2_application",
        ]
    },
    "glue.tf": {
        "description": "Glue databases, crawlers, jobs, connections, catalogs",
        "terraform_types": [
            "aws_glue_catalog_database",
            "aws_glue_crawler",
            "aws_glue_job",
            "aws_glue_connection",
            "aws_glue_trigger",
            "aws_glue_workflow",
            "aws_glue_registry",
            "aws_glue_schema",
            "aws_glue_classifier",
        ]
    },
    "athena.tf": {
        "description": "Athena workgroups, data catalogs",
        "terraform_types": [
            "aws_athena_workgroup",
            "aws_athena_database",
            "aws_athena_data_catalog",
        ]
    },
    "transfer.tf": {
        "description": "AWS Transfer Family servers, users",
        "terraform_types": [
            "aws_transfer_server",
            "aws_transfer_user",
            "aws_transfer_ssh_key",
            "aws_transfer_workflow",
        ]
    },
    "miscellaneous.tf": {
        "description": "Resources that don't fit other categories or are rarely used",
        "terraform_types": [
            "aws_accessanalyzer_analyzer",
            "aws_mwaa_environment",
            "aws_amplify_app",
            "aws_opensearchserverless_collection",
            "aws_appconfig_application",
            "aws_appconfig_deployment_strategy",
            "aws_appflow_flow",
            "aws_appmesh_mesh",
            "aws_apprunner_service",
            "aws_apprunner_auto_scaling_configuration_version",
            "aws_apprunner_connection",
            "aws_apprunner_vpc_connector",
            "aws_appstream_fleet",
            "aws_appstream_image_builder",
            "aws_appstream_stack",
            "aws_appsync_graphql_api",
            "aws_batch_compute_environment",
            "aws_batch_job_definition",
            "aws_batch_job_queue",
            "aws_batch_scheduling_policy",
            "aws_budgets_budget",
            "aws_ce_anomaly_monitor",
            "aws_ce_anomaly_subscription",
            "aws_cleanrooms_collaboration",
            "aws_cloud9_environment_ec2",
            "aws_bedrock_guardrail",
        ]
    },
}

# Build a lookup: terraform_type -> file group
type_to_file = {}
for filename, group in FILE_GROUPS.items():
    for tf_type in group['terraform_types']:
        type_to_file[tf_type] = filename

# Build rows from resource map
rows = []
for key, val in sorted(resources.items()):
    tf_type = val.get('tfType', '')
    re_type = val.get('reType', key)
    service = key.split(':')[0] if ':' in key else key

    assigned_file = type_to_file.get(tf_type, 'miscellaneous.tf')

    rows.append({
        'terraform_type': tf_type,
        'resource_explorer_type': re_type,
        'service': service,
        'file': assigned_file,
    })

# Create workbook
wb = Workbook()

# Sheet 1: Grouping overview (one row per file)
ws1 = wb.active
ws1.title = "File Groups"

header_font = Font(bold=True, size=11, color="FFFFFF")
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
thin_border = Border(
    left=Side(style='thin'), right=Side(style='thin'),
    top=Side(style='thin'), bottom=Side(style='thin')
)

headers1 = ['Terraform File', 'Description', 'Resource Types', 'Count']
for col, h in enumerate(headers1, 1):
    cell = ws1.cell(row=1, column=col, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', wrap_text=True)
    cell.border = thin_border

colors = [
    "E2EFDA", "D9E2F3", "FCE4D6", "EDEDED", "FFF2CC",
    "D6DCE4", "E4D5F0", "D1ECF1", "F8D7DA", "C3E6CB",
]

for row_idx, (filename, group) in enumerate(sorted(FILE_GROUPS.items()), 2):
    fill = PatternFill(start_color=colors[row_idx % len(colors)], end_color=colors[row_idx % len(colors)], fill_type="solid")

    # Find actual resource-map entries that map to this file
    matching = [r for r in rows if r['file'] == filename]
    type_list = "\n".join(sorted(set(r['terraform_type'] for r in matching)))

    values = [filename, group['description'], type_list, len(matching)]
    for col_idx, val in enumerate(values, 1):
        cell = ws1.cell(row=row_idx, column=col_idx, value=val)
        cell.fill = fill
        cell.border = thin_border
        cell.alignment = Alignment(wrap_text=True, vertical='top')

ws1.column_dimensions['A'].width = 22
ws1.column_dimensions['B'].width = 55
ws1.column_dimensions['C'].width = 55
ws1.column_dimensions['D'].width = 8
ws1.freeze_panes = 'A2'

# Sheet 2: Full resource list with file assignment
ws2 = wb.create_sheet("Resource Assignments")

headers2 = ['Terraform File', 'Terraform Type', 'Resource Explorer Type', 'AWS Service']
for col, h in enumerate(headers2, 1):
    cell = ws2.cell(row=1, column=col, value=h)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', wrap_text=True)
    cell.border = thin_border

sorted_rows = sorted(rows, key=lambda r: (r['file'], r['terraform_type']))
for row_idx, row in enumerate(sorted_rows, 2):
    values = [row['file'], row['terraform_type'], row['resource_explorer_type'], row['service']]
    for col_idx, val in enumerate(values, 1):
        cell = ws2.cell(row=row_idx, column=col_idx, value=val)
        cell.border = thin_border
        cell.alignment = Alignment(wrap_text=True, vertical='top')

ws2.column_dimensions['A'].width = 22
ws2.column_dimensions['B'].width = 45
ws2.column_dimensions['C'].width = 35
ws2.column_dimensions['D'].width = 20
ws2.freeze_panes = 'A2'
ws2.auto_filter.ref = f"A1:D{len(sorted_rows)+1}"

# Merge column A in sheet 2
start_row = 2
current_val = ws2.cell(row=2, column=1).value
for row in range(3, len(sorted_rows) + 3):
    val = ws2.cell(row=row, column=1).value if row <= len(sorted_rows) + 1 else None
    if val != current_val:
        if row - 1 > start_row:
            ws2.merge_cells(start_row=start_row, start_column=1, end_row=row - 1, end_column=1)
            ws2.cell(row=start_row, column=1).alignment = Alignment(vertical='center', horizontal='center', wrap_text=True)
        start_row = row
        current_val = val

output_path = '/Users/wendytan/iac-i2c-v2-build-hackathon/i2cv2-terraform-file-grouping.xlsx'
wb.save(output_path)
print(f"Created: {output_path}")
print(f"Total file groups: {len(FILE_GROUPS)}")
print(f"Total resources mapped: {len(rows)}")
