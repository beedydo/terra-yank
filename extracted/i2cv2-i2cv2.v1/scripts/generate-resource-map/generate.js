#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const WORKSPACE = path.join(__dirname, "tf-workspace");
const OUTPUT = path.join(__dirname, "..", "..", "src", "server", "resource-map.json");
const RE_TYPES_CACHE = path.join(__dirname, "re-supported-types.json");

// ---------------------------------------------------------------------------
// Override table: RE type → { tfType, arnKey?, importIdField? }
//
// arnKey: the resource-map.json key (what parseArn produces). If absent,
//         derived automatically from the RE type.
// importIdField: "resourceId" (default), "resourceRaw", or "arn"
// null: skip this RE type (not useful for terraform import)
// ---------------------------------------------------------------------------
const RE_OVERRIDES = {
  // EC2 — name mismatches between ARN resource type and Terraform type
  "ec2:instance":                              { tfType: "aws_instance" },
  "ec2:elastic-ip":                            { tfType: "aws_eip" },
  "ec2:image":                                 { tfType: "aws_ami" },
  "ec2:volume":                                { tfType: "aws_ebs_volume" },
  "ec2:snapshot":                              { tfType: "aws_ebs_snapshot" },
  "ec2:vpc-flow-log":                          { tfType: "aws_flow_log" },
  "ec2:dedicated-host":                        { tfType: "aws_ec2_host" },
  "ec2:fleet":                                 { tfType: "aws_ec2_fleet" },
  "ec2:transit-gateway":                       { tfType: "aws_ec2_transit_gateway" },
  "ec2:transit-gateway-route-table":           { tfType: "aws_ec2_transit_gateway_route_table" },
  "ec2:transit-gateway-attachment":            { tfType: "aws_ec2_transit_gateway_vpc_attachment" },
  "ec2:transit-gateway-multicast-domain":      { tfType: "aws_ec2_transit_gateway_multicast_domain" },
  "ec2:transit-gateway-connect-peer":          { tfType: "aws_ec2_transit_gateway_connect_peer" },
  "ec2:transit-gateway-policy-table":          { tfType: "aws_ec2_transit_gateway_policy_table" },
  "ec2:transit-gateway-route-table-announcement": { tfType: "aws_ec2_transit_gateway_route_table_propagation" },
  "ec2:natgateway":                            { tfType: "aws_nat_gateway" },
  "ec2:spot-fleet-request":                    { tfType: "aws_spot_fleet_request" },
  "ec2:spot-instances-request":                { tfType: "aws_spot_instance_request" },
  "ec2:ipv4pool-ec2":                          { tfType: "aws_ec2_public_ipv4_pool" },
  "ec2:host-reservation":                      { tfType: "aws_ec2_host" },
  "ec2:fpga-image":                            { tfType: "aws_ec2_fleet" },
  "ec2:verified-access-instance":              { tfType: "aws_verifiedaccess_instance" },
  "ec2:verified-access-group":                 { tfType: "aws_verifiedaccess_group" },
  "ec2:verified-access-endpoint":              { tfType: "aws_verifiedaccess_endpoint" },
  "ec2:verified-access-trust-provider":        { tfType: "aws_verifiedaccess_trust_provider" },
  "ec2:security-group-rule":                   { tfType: "aws_vpc_security_group_ingress_rule" },
  "ec2:vpc":                                   { tfType: "aws_vpc" },
  "ec2:subnet":                                { tfType: "aws_subnet" },
  "ec2:security-group":                        { tfType: "aws_security_group" },
  "ec2:internet-gateway":                      { tfType: "aws_internet_gateway" },
  "ec2:route-table":                           { tfType: "aws_route_table" },
  "ec2:network-acl":                           { tfType: "aws_network_acl" },
  "ec2:network-interface":                     { tfType: "aws_network_interface" },
  "ec2:vpc-endpoint":                          { tfType: "aws_vpc_endpoint" },
  "ec2:key-pair":                              { tfType: "aws_key_pair" },
  "ec2:customer-gateway":                      { tfType: "aws_customer_gateway" },
  "ec2:vpn-gateway":                           { tfType: "aws_vpn_gateway" },
  "ec2:vpn-connection":                        { tfType: "aws_vpn_connection" },
  "ec2:dhcp-options":                          { tfType: "aws_vpc_dhcp_options" },
  "ec2:egress-only-internet-gateway":          { tfType: "aws_egress_only_internet_gateway" },
  "ec2:capacity-reservation":                  { tfType: "aws_ec2_capacity_reservation" },
  "ec2:carrier-gateway":                       { tfType: "aws_ec2_carrier_gateway" },
  "ec2:client-vpn-endpoint":                   { tfType: "aws_ec2_client_vpn_endpoint" },
  "ec2:prefix-list":                           { tfType: "aws_ec2_managed_prefix_list" },
  "ec2:placement-group":                       { tfType: "aws_placement_group" },
  "ec2:reserved-instances":                    null,
  "ec2:subnet-cidr-reservation":               null,
  "ec2:spot-instances-request":                { tfType: "aws_spot_instance_request" },
  "ec2:capacity-reservation-fleet":            null,
  "ec2:ipv4pool-ec2":                          null,
  "ec2:host-reservation":                      null,
  "ec2:fpga-image":                            null,
  "ec2:instance-event-window":                 null,
  "ec2:ipam":                                  { tfType: "aws_vpc_ipam" },
  "ec2:ipam-pool":                             { tfType: "aws_vpc_ipam_pool" },
  "ec2:ipam-scope":                            { tfType: "aws_vpc_ipam_scope" },
  "ec2:ipam-resource-discovery":               { tfType: "aws_vpc_ipam_resource_discovery" },
  "ec2:ipam-resource-discovery-association":    null,
  "ec2:network-insights-path":                 { tfType: "aws_ec2_network_insights_path" },
  "ec2:network-insights-analysis":             { tfType: "aws_ec2_network_insights_analysis" },
  "ec2:network-insights-access-scope":         null,
  "ec2:network-insights-access-scope-analysis": null,
  "ec2:traffic-mirror-filter":                 { tfType: "aws_ec2_traffic_mirror_filter" },
  "ec2:traffic-mirror-filter-rule":            null,
  "ec2:traffic-mirror-session":                { tfType: "aws_ec2_traffic_mirror_session" },
  "ec2:traffic-mirror-target":                 { tfType: "aws_ec2_traffic_mirror_target" },
  "ec2:vpc-peering-connection":                { tfType: "aws_vpc_peering_connection" },
  "ec2:launch-template":                       { tfType: "aws_launch_template" },

  // S3 — ARN has no resource type prefix (arn:aws:s3:::bucket-name)
  "s3:bucket":            { tfType: "aws_s3_bucket", arnKey: "s3", importIdField: "resourceRaw" },
  "s3:accesspoint":       { tfType: "aws_s3_access_point" },
  "s3:storage-lens":      { tfType: "aws_s3control_storage_lens_configuration" },
  "s3:storage-lens-group": null,
  "s3:multiregionaccesspoint": null,
  "s3express:bucket":     null,

  // SNS — ARN has no resource type prefix (arn:aws:sns:region:account:topic-name)
  "sns:topic":            { tfType: "aws_sns_topic", arnKey: "sns", importIdField: "arn" },

  // SQS — ARN has no resource type prefix
  "sqs:queue":            { tfType: "aws_sqs_queue", arnKey: "sqs", importIdTemplate: "https://sqs.${region}.amazonaws.com/${accountId}/${resourceId}" },

  // RDS — ARN resource types don't follow convention
  "rds:db":               { tfType: "aws_db_instance" },
  "rds:cluster":          { tfType: "aws_rds_cluster" },
  "rds:pg":               { tfType: "aws_db_parameter_group" },
  "rds:cluster-pg":       { tfType: "aws_rds_cluster_parameter_group" },
  "rds:subgrp":           { tfType: "aws_db_subnet_group" },
  "rds:og":               { tfType: "aws_db_option_group" },
  "rds:es":               { tfType: "aws_db_event_subscription" },
  "rds:cluster-endpoint": { tfType: "aws_rds_cluster_endpoint" },
  "rds:db-proxy":         { tfType: "aws_db_proxy" },
  "rds:db-proxy-endpoint": { tfType: "aws_db_proxy_endpoint" },
  "rds:secgrp":           { tfType: "aws_db_security_group" },
  "rds:ri":               { tfType: "aws_db_instance" },
  "rds:snapshot":         { tfType: "aws_db_snapshot" },
  "rds:cluster-snapshot": { tfType: "aws_db_cluster_snapshot" },
  "rds:global-cluster":   { tfType: "aws_rds_global_cluster" },
  "rds:auto-backup":      null,
  "rds:cev":              null,
  "rds:deployment":       null,

  // CloudWatch / Events / Logs — service names differ
  "logs:log-group":       { tfType: "aws_cloudwatch_log_group" },
  "logs:destination":     { tfType: "aws_cloudwatch_log_destination" },
  "events:rule":          { tfType: "aws_cloudwatch_event_rule" },
  "events:event-bus":     { tfType: "aws_cloudwatch_event_bus" },
  "events:api-destination": { tfType: "aws_cloudwatch_event_api_destination" },
  "events:archive":       { tfType: "aws_cloudwatch_event_archive" },
  "events:connection":    { tfType: "aws_cloudwatch_event_connection" },
  "events:endpoint":      { tfType: "aws_cloudwatch_event_endpoint" },
  "cloudwatch:alarm":     { tfType: "aws_cloudwatch_metric_alarm" },
  "cloudwatch:dashboard": { tfType: "aws_cloudwatch_dashboard" },
  "cloudwatch:insight-rule": null,
  "cloudwatch:metric-stream": { tfType: "aws_cloudwatch_metric_stream" },

  // ELB — nested paths in RE types, import by resourceRaw or ARN
  "elasticloadbalancing:loadbalancer":       { tfType: "aws_lb", importIdField: "resourceRaw" },
  "elasticloadbalancing:loadbalancer/app":   { tfType: "aws_lb", arnKey: "elasticloadbalancing:loadbalancer", importIdField: "resourceRaw" },
  "elasticloadbalancing:loadbalancer/net":   { tfType: "aws_lb", arnKey: "elasticloadbalancing:loadbalancer", importIdField: "resourceRaw" },
  "elasticloadbalancing:loadbalancer/gwy":   { tfType: "aws_lb", arnKey: "elasticloadbalancing:loadbalancer", importIdField: "resourceRaw" },
  "elasticloadbalancing:targetgroup":        { tfType: "aws_lb_target_group", importIdField: "resourceRaw" },
  "elasticloadbalancing:listener/app":       { tfType: "aws_lb_listener", arnKey: "elasticloadbalancing:listener", importIdField: "arn" },
  "elasticloadbalancing:listener/net":       { tfType: "aws_lb_listener", arnKey: "elasticloadbalancing:listener", importIdField: "arn" },
  "elasticloadbalancing:listener/gwy":       { tfType: "aws_lb_listener", arnKey: "elasticloadbalancing:listener", importIdField: "arn" },
  "elasticloadbalancing:listener-rule/app":  { tfType: "aws_lb_listener_rule", arnKey: "elasticloadbalancing:listener-rule", importIdField: "arn" },

  // ECS — import by full ARN
  "ecs:cluster":          { tfType: "aws_ecs_cluster", importIdField: "arn" },
  "ecs:service":          { tfType: "aws_ecs_service", importIdField: "arn" },
  "ecs:task-definition":  { tfType: "aws_ecs_task_definition", importIdField: "arn" },
  "ecs:task-set":         { tfType: "aws_ecs_task_set" },
  "ecs:capacity-provider": { tfType: "aws_ecs_capacity_provider" },
  "ecs:container-instance": null,

  // IAM — special import fields
  "iam:role":             { tfType: "aws_iam_role" },
  "iam:user":             { tfType: "aws_iam_user" },
  "iam:group":            { tfType: "aws_iam_group" },
  "iam:policy":           { tfType: "aws_iam_policy", importIdField: "arn" },
  "iam:instance-profile": { tfType: "aws_iam_instance_profile" },
  "iam:oidc-provider":    { tfType: "aws_iam_openid_connect_provider", importIdField: "arn" },
  "iam:saml-provider":    { tfType: "aws_iam_saml_provider", importIdField: "arn" },
  "iam:server-certificate": { tfType: "aws_iam_server_certificate" },
  "iam:mfa":              null,

  // Lambda
  "lambda:function":             { tfType: "aws_lambda_function" },
  "lambda:function/version":     null,
  "lambda:layer/version":        { tfType: "aws_lambda_layer_version", importIdField: "arn" },
  "lambda:event-source-mapping": { tfType: "aws_lambda_event_source_mapping" },
  "lambda:code-signing-config":  { tfType: "aws_lambda_code_signing_config" },

  // Step Functions
  "states:stateMachine":  { tfType: "aws_sfn_state_machine", importIdField: "arn" },
  "states:activity":      { tfType: "aws_sfn_activity", importIdField: "arn" },

  // ACM
  "acm:certificate":      { tfType: "aws_acm_certificate", importIdField: "arn" },
  "acm-pca:certificate-authority": { tfType: "aws_acmpca_certificate_authority", importIdField: "arn" },

  // Secrets Manager
  "secretsmanager:secret": { tfType: "aws_secretsmanager_secret", importIdField: "arn" },

  // KMS
  "kms:key":              { tfType: "aws_kms_key" },

  // DynamoDB
  "dynamodb:table":       { tfType: "aws_dynamodb_table" },

  // SSM
  "ssm:parameter":        { tfType: "aws_ssm_parameter" },
  "ssm:document":         { tfType: "aws_ssm_document" },
  "ssm:maintenancewindow": { tfType: "aws_ssm_maintenance_window" },
  "ssm:managed-instance": null,
  "ssm:session":          null,

  // Cognito
  "cognito-idp:userpool":           { tfType: "aws_cognito_user_pool" },
  "cognito-identity:identitypool":  { tfType: "aws_cognito_identity_pool" },

  // ElastiCache
  "elasticache:cluster":            { tfType: "aws_elasticache_cluster" },
  "elasticache:replicationgroup":   { tfType: "aws_elasticache_replication_group" },
  "elasticache:globalreplicationgroup": { tfType: "aws_elasticache_global_replication_group" },
  "elasticache:parametergroup":     { tfType: "aws_elasticache_parameter_group" },
  "elasticache:subnetgroup":        { tfType: "aws_elasticache_subnet_group" },
  "elasticache:user":               { tfType: "aws_elasticache_user" },
  "elasticache:usergroup":          { tfType: "aws_elasticache_user_group" },
  "elasticache:snapshot":           { tfType: "aws_elasticache_cluster" },
  "elasticache:reserved-instance":  null,

  // OpenSearch / Elasticsearch
  "es:domain":            { tfType: "aws_opensearch_domain" },

  // EFS
  "elasticfilesystem:file-system":  { tfType: "aws_efs_file_system" },
  "elasticfilesystem:access-point": { tfType: "aws_efs_access_point" },

  // API Gateway
  "apigateway:restapis":            { tfType: "aws_api_gateway_rest_api" },
  "apigateway:restapis/stages":     { tfType: "aws_api_gateway_stage", arnKey: "apigateway:restapis" },
  "apigateway:restapis/deployments": null,
  "apigateway:restapis/resources":  null,
  "apigateway:restapis/resources/methods": null,
  "apigateway:apis":                { tfType: "aws_apigatewayv2_api" },
  "apigateway:apis/stages":         { tfType: "aws_apigatewayv2_stage", arnKey: "apigateway:apis" },
  "apigateway:apis/integrations":   null,
  "apigateway:apis/routes":         null,
  "apigateway:vpclinks":            { tfType: "aws_api_gateway_vpc_link" },

  // MSK
  "kafka:cluster":        { tfType: "aws_msk_cluster" },
  "kafka:configuration":  { tfType: "aws_msk_configuration" },

  // EMR
  "elasticmapreduce:cluster": { tfType: "aws_emr_cluster" },

  // Glue
  "glue:database":        { tfType: "aws_glue_catalog_database" },

  // Config
  "config:config-rule":   { tfType: "aws_config_config_rule" },

  // Kinesis / Firehose
  "kinesis:stream":              { tfType: "aws_kinesis_stream" },
  "firehose:deliverystream":     { tfType: "aws_kinesis_firehose_delivery_stream" },
  "kinesisanalytics:application": { tfType: "aws_kinesis_analytics_application" },

  // Cloud Map
  "servicediscovery:service": { tfType: "aws_service_discovery_service" },

  // CloudFront
  "cloudfront:distribution": { tfType: "aws_cloudfront_distribution" },
  "cloudfront:function":     { tfType: "aws_cloudfront_function" },
  "cloudfront:origin-access-control": { tfType: "aws_cloudfront_origin_access_control" },
  "cloudfront:origin-access-identity": { tfType: "aws_cloudfront_origin_access_identity" },
  "cloudfront:cache-policy": { tfType: "aws_cloudfront_cache_policy" },
  "cloudfront:origin-request-policy": { tfType: "aws_cloudfront_origin_request_policy" },
  "cloudfront:response-headers-policy": { tfType: "aws_cloudfront_response_headers_policy" },
  "cloudfront:realtime-log-config": { tfType: "aws_cloudfront_realtime_log_config" },
  "cloudfront:continuous-deployment-policy": null,
  "cloudfront:field-level-encryption-config": null,
  "cloudfront:field-level-encryption-profile": null,

  // CloudTrail
  "cloudtrail:trail":     { tfType: "aws_cloudtrail" },
  "cloudtrail:channel":   null,
  "cloudtrail:eventdatastore": null,
  "cloudtrail:dashboard": null,

  // CloudFormation
  "cloudformation:stack":    { tfType: "aws_cloudformation_stack" },
  "cloudformation:stackset": { tfType: "aws_cloudformation_stack_set" },

  // ECR
  "ecr:repository":       { tfType: "aws_ecr_repository" },
  "ecr-public:repository": { tfType: "aws_ecrpublic_repository" },

  // EKS
  "eks:cluster":           { tfType: "aws_eks_cluster" },
  "eks:podidentityassociation": { tfType: "aws_eks_pod_identity_association" },
  "eks:eks-anywhere-subscription": null,
  "eks:daemonset":         null,
  "eks:deployment":        null,
  "eks:endpointslice":     null,
  "eks:ingress":           null,
  "eks:namespace":         null,
  "eks:persistentvolume":  null,
  "eks:replicaset":        null,
  "eks:service":           null,
  "eks:statefulset":       null,

  // Backup
  "backup:backup-vault":  { tfType: "aws_backup_vault" },
  "backup:backup-plan":   { tfType: "aws_backup_plan" },
  "backup:report-plan":   { tfType: "aws_backup_report_plan" },

  // FSx
  "fsx:file-system":      { tfType: "aws_fsx_lustre_file_system" },
  "fsx:backup":           null,

  // DMS
  "dms:cert":             null,
  "dms:endpoint":         { tfType: "aws_dms_endpoint" },
  "dms:es":               { tfType: "aws_dms_event_subscription" },
  "dms:rep":              { tfType: "aws_dms_replication_instance" },
  "dms:subgrp":           { tfType: "aws_dms_replication_subnet_group" },
  "dms:task":             { tfType: "aws_dms_replication_task" },

  // Route 53
  "route53:hostedzone":   { tfType: "aws_route53_zone" },
  "route53:healthcheck":  { tfType: "aws_route53_health_check" },
  "route53:domain":       null,

  // Route 53 Resolver
  "route53resolver:resolver-endpoint":         { tfType: "aws_route53_resolver_endpoint" },
  "route53resolver:resolver-rule":             { tfType: "aws_route53_resolver_rule" },
  "route53resolver:firewall-domain-list":      { tfType: "aws_route53_resolver_firewall_domain_list" },
  "route53resolver:firewall-rule-group":       { tfType: "aws_route53_resolver_firewall_rule_group" },
  "route53resolver:firewall-rule-group-association": { tfType: "aws_route53_resolver_firewall_rule_group_association" },
  "route53resolver:resolver-query-log-config": { tfType: "aws_route53_resolver_query_log_config" },

  // WAFv2
  "wafv2:webacl":          { tfType: "aws_wafv2_web_acl" },
  "wafv2:ipset":           { tfType: "aws_wafv2_ip_set" },
  "wafv2:rulegroup":       { tfType: "aws_wafv2_rule_group" },
  "wafv2:regexpatternset": { tfType: "aws_wafv2_regex_pattern_set" },

  // GuardDuty
  "guardduty:detector":                      { tfType: "aws_guardduty_detector" },
  "guardduty:detector/filter":               { tfType: "aws_guardduty_filter", arnKey: "guardduty:detector" },
  "guardduty:detector/ipset":                { tfType: "aws_guardduty_ipset", arnKey: "guardduty:detector" },
  "guardduty:detector/publishingDestination": { tfType: "aws_guardduty_publishing_destination", arnKey: "guardduty:detector" },
  "guardduty:detector/threatintelset":       { tfType: "aws_guardduty_threatintelset", arnKey: "guardduty:detector" },
  "guardduty:malware-protection-plan":       null,

  // Redshift
  "redshift:cluster":            { tfType: "aws_redshift_cluster" },
  "redshift:parametergroup":     { tfType: "aws_redshift_parameter_group" },
  "redshift:subnetgroup":        { tfType: "aws_redshift_subnet_group" },
  "redshift:eventsubscription":  { tfType: "aws_redshift_event_subscription" },
  "redshift:snapshotschedule":   { tfType: "aws_redshift_snapshot_schedule" },
  "redshift:snapshotcopygrant":  { tfType: "aws_redshift_snapshot_copy_grant" },
  "redshift:usagelimit":         { tfType: "aws_redshift_usage_limit" },
  "redshift:snapshot":           null,
  "redshift:hsmclientcertificate": null,

  // SES
  "ses:identity":          { tfType: "aws_ses_domain_identity" },
  "ses:configuration-set": { tfType: "aws_ses_configuration_set" },
  "ses:contact-list":      null,
  "ses:dedicated-ip-pool": null,

  // Scheduler
  "scheduler:schedule-group": { tfType: "aws_scheduler_schedule_group" },

  // EventBridge Pipes/Schemas
  "pipes:pipe":            { tfType: "aws_pipes_pipe" },
  "schemas:discoverer":    { tfType: "aws_schemas_discoverer" },

  // Autoscaling
  "autoscaling:autoScalingGroup": { tfType: "aws_autoscaling_group" },

  // Direct Connect
  "directconnect:dx-gateway": { tfType: "aws_dx_gateway" },

  // Resource Explorer (skip)
  "resource-explorer-2:index": null,
  "resource-explorer-2:view":  null,

  // Resource Groups
  "resource-groups:group": { tfType: "aws_resourcegroups_group" },

  // Shield
  "shield:protection":       { tfType: "aws_shield_protection" },
  "shield:protection-group": { tfType: "aws_shield_protection_group" },

  // Network Firewall
  "network-firewall:firewall":             { tfType: "aws_networkfirewall_firewall" },
  "network-firewall:firewall-policy":      { tfType: "aws_networkfirewall_firewall_policy" },
  "network-firewall:stateful-rulegroup":   { tfType: "aws_networkfirewall_rule_group" },
  "network-firewall:stateless-rulegroup":  { tfType: "aws_networkfirewall_rule_group" },

  // SSM Incidents
  "ssm-incidents:response-plan": { tfType: "aws_ssmincidents_response_plan" },

  // Amazon MQ
  "mq:broker":         { tfType: "aws_mq_broker" },
  "mq:configuration":  { tfType: "aws_mq_configuration" },

  // DAX
  "dax:cache":         { tfType: "aws_dax_cluster" },

  // SageMaker
  "sagemaker:endpoint":       { tfType: "aws_sagemaker_endpoint" },
  "sagemaker:endpoint-config": { tfType: "aws_sagemaker_endpoint_configuration" },
  "sagemaker:notebook-instance": { tfType: "aws_sagemaker_notebook_instance" },
  "sagemaker:domain":         { tfType: "aws_sagemaker_domain" },
  "sagemaker:model":          { tfType: "aws_sagemaker_model" },
  "sagemaker:feature-group":  { tfType: "aws_sagemaker_feature_group" },
  "sagemaker:code-repository": { tfType: "aws_sagemaker_code_repository" },
  "sagemaker:app-image-config": { tfType: "aws_sagemaker_app_image_config" },
  "sagemaker:image":          { tfType: "aws_sagemaker_image" },
  "sagemaker:pipeline":       { tfType: "aws_sagemaker_pipeline" },
  "sagemaker:project":        { tfType: "aws_sagemaker_project" },
  "sagemaker:flow-definition": { tfType: "aws_sagemaker_flow_definition" },
  "sagemaker:human-task-ui":  { tfType: "aws_sagemaker_human_task_ui" },
  "sagemaker:model-package-group": { tfType: "aws_sagemaker_model_package_group" },
  "sagemaker:workteam":       { tfType: "aws_sagemaker_workteam" },
  "sagemaker:workforce":      { tfType: "aws_sagemaker_workforce" },

  // VPC Lattice
  "vpc-lattice:service":                          { tfType: "aws_vpclattice_service" },
  "vpc-lattice:servicenetwork":                   { tfType: "aws_vpclattice_service_network" },
  "vpc-lattice:targetgroup":                      { tfType: "aws_vpclattice_target_group" },
  "vpc-lattice:service/listener":                 null,
  "vpc-lattice:servicenetworkserviceassociation": null,

  // Verified Permissions
  "verifiedpermissions:policy-store": { tfType: "aws_verifiedpermissions_policy_store" },

  // IoT
  "iot:thing":            { tfType: "aws_iot_thing" },
  "iot:thinggroup":       { tfType: "aws_iot_thing_group" },
  "iot:thingtype":        { tfType: "aws_iot_thing_type" },
  "iot:policy":           { tfType: "aws_iot_policy" },
  "iot:cert":             { tfType: "aws_iot_certificate" },
  "iot:rule":             { tfType: "aws_iot_topic_rule" },
  "iot:authorizer":       { tfType: "aws_iot_authorizer" },
  "iot:provisioningtemplate": { tfType: "aws_iot_provisioning_template" },
  "iot:rolealias":        { tfType: "aws_iot_role_alias" },
  "iot:securityprofile":  null,
  "iot:billinggroup":     { tfType: "aws_iot_billing_group" },
  "iot:cacert":           { tfType: "aws_iot_ca_certificate" },

  // Partner Network (skip)
  "partnercentral:catalog/engagement":            null,
  "partnercentral:catalog/engagement-invitation": null,
  "partnercentral:catalog/opportunity":           null,
  "partnercentral:catalog/resource-snapshot-job": null,
  "partnercentral:resourcesnapshot":              null,

  // Cost Explorer
  "ce:anomalymonitor":      { tfType: "aws_ce_anomaly_monitor" },
  "ce:anomalysubscription": { tfType: "aws_ce_anomaly_subscription" },

  // MemoryDB
  "memorydb:cluster":       { tfType: "aws_memorydb_cluster" },
  "memorydb:acl":           { tfType: "aws_memorydb_acl" },
  "memorydb:parametergroup": { tfType: "aws_memorydb_parameter_group" },
  "memorydb:subnetgroup":   { tfType: "aws_memorydb_subnet_group" },
  "memorydb:user":          { tfType: "aws_memorydb_user" },
  "memorydb:snapshot":      { tfType: "aws_memorydb_snapshot" },

  // Batch
  "batch:compute-environment": { tfType: "aws_batch_compute_environment" },
  "batch:job-definition":      { tfType: "aws_batch_job_definition" },
  "batch:job-queue":           { tfType: "aws_batch_job_queue" },
  "batch:scheduling-policy":   { tfType: "aws_batch_scheduling_policy" },

  // Image Builder
  "imagebuilder:component":                  { tfType: "aws_imagebuilder_component" },
  "imagebuilder:image":                      { tfType: "aws_imagebuilder_image" },
  "imagebuilder:image-pipeline":             { tfType: "aws_imagebuilder_image_pipeline" },
  "imagebuilder:image-recipe":               { tfType: "aws_imagebuilder_image_recipe" },
  "imagebuilder:container-recipe":           { tfType: "aws_imagebuilder_container_recipe" },
  "imagebuilder:distribution-configuration": { tfType: "aws_imagebuilder_distribution_configuration" },
  "imagebuilder:infrastructure-configuration": { tfType: "aws_imagebuilder_infrastructure_configuration" },

  // Transfer
  "transfer:server":      { tfType: "aws_transfer_server" },
  "transfer:user":        { tfType: "aws_transfer_user" },
  "transfer:workflow":    { tfType: "aws_transfer_workflow" },
  "transfer:connector":   { tfType: "aws_transfer_connector" },
  "transfer:certificate": null,
  "transfer:agreement":   null,
  "transfer:profile":     null,

  // Storage Gateway
  "storagegateway:gateway": { tfType: "aws_storagegateway_gateway" },
  "storagegateway:share":   null,

  // Glacier
  "glacier:vaults":       { tfType: "aws_glacier_vault" },

  // AppRunner
  "apprunner:service":             { tfType: "aws_apprunner_service" },
  "apprunner:autoscalingconfiguration": { tfType: "aws_apprunner_auto_scaling_configuration_version" },
  "apprunner:connection":          { tfType: "aws_apprunner_connection" },
  "apprunner:vpcconnector":        { tfType: "aws_apprunner_vpc_connector" },

  // Macie
  "macie2:allow-list":              null,
  "macie2:custom-data-identifier":  null,
  "macie2:findings-filter":         null,
  "macie2:member":                  null,

  // Bedrock
  "bedrock:agent":                       null,
  "bedrock:agent-alias":                 null,
  "bedrock:application-inference-profile": null,
  "bedrock:data-automation-project":     null,
  "bedrock:flow":                        null,
  "bedrock:flow/alias":                  null,
  "bedrock:guardrail":                   { tfType: "aws_bedrock_guardrail" },
  "bedrock:knowledge-base":              null,
  "bedrock:prompt":                      null,
  "bedrock:prompt-router":               null,
  "bedrock-agentcore:runtime":           null,

  // AOSS
  "aoss:collection":      { tfType: "aws_opensearchserverless_collection" },

  // Amplify
  "amplify:apps":         { tfType: "aws_amplify_app" },
  "amplify:apps/branches": { tfType: "aws_amplify_branch", arnKey: "amplify:apps" },
  "amplify:apps/domains":  { tfType: "aws_amplify_domain_association", arnKey: "amplify:apps" },

  // App Mesh
  "appmesh:mesh":                         { tfType: "aws_appmesh_mesh" },
  "appmesh:mesh/virtualNode":             { tfType: "aws_appmesh_virtual_node", arnKey: "appmesh:mesh" },
  "appmesh:mesh/virtualRouter":           { tfType: "aws_appmesh_virtual_router", arnKey: "appmesh:mesh" },
  "appmesh:mesh/virtualRouter/route":     null,
  "appmesh:mesh/virtualService":          { tfType: "aws_appmesh_virtual_service", arnKey: "appmesh:mesh" },
  "appmesh:mesh/virtualGateway":          { tfType: "aws_appmesh_virtual_gateway", arnKey: "appmesh:mesh" },
  "appmesh:mesh/virtualGateway/gatewayRoute": null,

  // RAM
  "ram:resource-share":   { tfType: "aws_ram_resource_share" },
  "ram:permission":       null,

  // Inspector
  "inspector:target/template": null,
  "inspector2:filter":         null,

  // Workspaces
  "workspaces:workspace":       { tfType: "aws_workspaces_workspace" },
  "workspaces:connectionalias": null,
  "workspaces-web:portal":      null,

  // MWAA (Airflow)
  "airflow:environment":  { tfType: "aws_mwaa_environment" },

  // AppConfig
  "appconfig:application":              { tfType: "aws_appconfig_application" },
  "appconfig:application/environment":  { tfType: "aws_appconfig_environment", arnKey: "appconfig:application" },
  "appconfig:deploymentstrategy":       { tfType: "aws_appconfig_deployment_strategy" },
  "appconfig:extensionassociation":     null,

  // AppFlow
  "appflow:flow":         { tfType: "aws_appflow_flow" },

  // AppSync
  "appsync:apis":         { tfType: "aws_appsync_graphql_api" },

  // Athena
  "athena:datacatalog":   { tfType: "aws_athena_data_catalog" },
  "athena:workgroup":     { tfType: "aws_athena_workgroup" },

  // Budgets
  "budgets:budget":         { tfType: "aws_budgets_budget" },
  "budgets:budget/action":  { tfType: "aws_budgets_budget_action", arnKey: "budgets:budget" },

  // Cloud9
  "cloud9:environment":   { tfType: "aws_cloud9_environment_ec2" },

  // CodeBuild
  "codebuild:project":    { tfType: "aws_codebuild_project" },

  // CodeCommit
  "codecommit:repository": { tfType: "aws_codecommit_repository" },

  // CodeConnections
  "codeconnections:connection": { tfType: "aws_codeconnections_connection" },

  // CodeDeploy
  "codedeploy:application":      { tfType: "aws_codedeploy_app" },
  "codedeploy:deploymentconfig": { tfType: "aws_codedeploy_deployment_config" },

  // CodePipeline
  "codepipeline:pipeline":  { tfType: "aws_codepipeline" },
  "codepipeline:webhook":   { tfType: "aws_codepipeline_webhook" },

  // CodeStar Connections
  "codestar-connections:connection": { tfType: "aws_codestarconnections_connection" },
  "codestar-connections:host":       { tfType: "aws_codestarconnections_host" },

  // Connect
  "connect:instance":                     { tfType: "aws_connect_instance" },
  "connect:phone-number":                 { tfType: "aws_connect_phone_number" },
  "connect:instance/agent":               null,
  "connect:instance/operating-hours":     null,
  "connect:instance/queue":               null,
  "connect:instance/rule":                null,
  "connect:instance/task-template":       null,
  "connect:instance/transfer-destination": null,

  // DataSync
  "datasync:location":    null,
  "datasync:task":        { tfType: "aws_datasync_task" },

  // Directory Service
  "ds:directory":         { tfType: "aws_directory_service_directory" },

  // Prometheus
  "aps:workspace":        { tfType: "aws_prometheus_workspace" },
  "aps:rulegroupsnamespace": { tfType: "aws_prometheus_rule_group_namespace" },

  // Grafana
  "grafana:workspaces":   { tfType: "aws_grafana_workspace" },

  // Global Accelerator
  "globalaccelerator:accelerator":                         { tfType: "aws_globalaccelerator_accelerator" },
  "globalaccelerator:accelerator/listener":                null,
  "globalaccelerator:accelerator/listener/endpoint-group": null,

  // Kinesis Video
  "kinesisvideo:stream":  { tfType: "aws_kinesis_video_stream" },
  "kinesisvideo:channel": null,

  // Lex
  "lex:bot":              { tfType: "aws_lexv2models_bot" },
  "lex:bot-alias":        null,

  // Device Farm
  "devicefarm:project":         { tfType: "aws_devicefarm_project" },
  "devicefarm:instanceprofile": { tfType: "aws_devicefarm_instance_profile" },
  "devicefarm:testgrid-project": { tfType: "aws_devicefarm_test_grid_project" },

  // OAM
  "oam:sink":             { tfType: "aws_oam_sink" },

  // RUM
  "rum:appmonitor":       { tfType: "aws_rum_app_monitor" },

  // Synthetics
  "synthetics:canary":    { tfType: "aws_synthetics_canary" },
  "synthetics:group":     { tfType: "aws_synthetics_group" },

  // CodeArtifact
  "codeartifact:domain":     { tfType: "aws_codeartifact_domain" },
  "codeartifact:repository": { tfType: "aws_codeartifact_repository" },

  // Resilience Hub
  "resiliencehub:app":              null,
  "resiliencehub:resiliency-policy": null,

  // Data Pipeline
  "datapipeline:pipeline": { tfType: "aws_datapipeline_pipeline" },

  // SSM extras
  "ssm:association":       { tfType: "aws_ssm_association" },
  "ssm:resource-data-sync": { tfType: "aws_ssm_resource_data_sync" },
  "ssm:windowtarget":      { tfType: "aws_ssm_maintenance_window_target" },
  "ssm:windowtask":        { tfType: "aws_ssm_maintenance_window_task" },

  // Signer
  "signer:signing-profiles": { tfType: "aws_signer_signing_profile" },

  // App Integrations
  "app-integrations:event-integration": { tfType: "aws_appintegrations_event_integration" },
  "app-integrations:application":       null,

  // Clean Rooms
  "cleanrooms:collaboration": { tfType: "aws_cleanrooms_collaboration" },

  // MediaConnect
  "mediaconnect:flow":    { tfType: "aws_mediaconnect_flow" },
  "mediaconnect:gateway": null,

  // Elastic Beanstalk
  "elasticbeanstalk:application":             { tfType: "aws_elastic_beanstalk_application" },
  "elasticbeanstalk:applicationversion":      null,
  "elasticbeanstalk:configurationtemplate":   null,
  "elasticbeanstalk:environment":             { tfType: "aws_elastic_beanstalk_environment" },

  // EMR Serverless / Containers
  "emr-serverless:applications":              { tfType: "aws_emrserverless_application" },
  "emr-containers:virtualclusters":           { tfType: "aws_emrcontainers_virtual_cluster" },
  "emr-containers:jobtemplates":              null,
  "emr-containers:securityconfigurations":    null,
  "emr-containers:virtualclusters/endpoints": null,

  // FIS
  "fis:experiment-template":  { tfType: "aws_fis_experiment_template" },
  "fis:experiment":           null,

  // Glue extras
  "glue:crawler":         { tfType: "aws_glue_crawler" },
  "glue:job":             { tfType: "aws_glue_job" },
  "glue:trigger":         { tfType: "aws_glue_trigger" },
  "glue:table":           { tfType: "aws_glue_catalog_table" },
  "glue:registry":        { tfType: "aws_glue_registry" },
  "glue:mlTransform":     { tfType: "aws_glue_ml_transform" },
  "glue:dataQualityRuleset": null,

  // SageMaker extras
  "sagemaker:hub":                       null,
  "sagemaker:hub-content":               null,
  "sagemaker:user-profile":              { tfType: "aws_sagemaker_user_profile" },
  "sagemaker:space":                     { tfType: "aws_sagemaker_space" },
  "sagemaker:monitoring-schedule":       null,
  "sagemaker:mlflow-tracking-server":    null,
  "sagemaker:image-version":             { tfType: "aws_sagemaker_image_version" },
  "sagemaker:studio-lifecycle-config":   null,
  "sagemaker:notebook-instance-lifecycle-config": { tfType: "aws_sagemaker_notebook_instance_lifecycle_configuration" },
  "sagemaker:app":                       { tfType: "aws_sagemaker_app" },
  "sagemaker:model-card":                null,
  "sagemaker:model-package":             null,
  "sagemaker:experiment":                null,
  "sagemaker:experiment-trial":          null,
  "sagemaker:experiment-trial-component": null,
  "sagemaker:inference-component":       null,
  "sagemaker:inference-experiment":      null,
  "sagemaker:action":                    null,
  "sagemaker:algorithm":                 null,
  "sagemaker:artifact":                  null,
  "sagemaker:cluster":                   null,
  "sagemaker:context":                   null,
  "sagemaker:partner-app":               null,
  "sagemaker:human-loop":                null,

  // IoT extras
  "iot:fleetmetric":       null,
  "iot:job":               null,
  "iot:jobtemplate":       null,
  "iot:mitigationaction":  null,
  "iot:ruledestination":   null,
  "iot:scheduledaudit":    null,

  // IoT sub-services (skip most)
  "iotdeviceadvisor:suitedefinition":    null,
  "iotevents:alarmModel":               null,
  "iotevents:detectorModel":            null,
  "iotevents:input":                    null,
  "iotfleetwise:decoder-manifest":      null,
  "iotfleetwise:model-manifest":        null,
  "iotfleetwise:signal-catalog":        null,
  "iotfleetwise:vehicle":               null,
  "greengrass:components:versions":     null,
  "greengrass:connectorsDefinition":    null,
  "greengrass:coresDefinition":         null,
  "greengrass:devicesDefinition":       null,
  "greengrass:functionsDefinition":     null,
  "greengrass:groups":                  null,
  "greengrass:loggersDefinition":       null,
  "greengrass:resourcesDefinition":     null,
  "greengrass:subscriptionsDefinition": null,
  "iotsitewise:access-policy":          null,
  "iotsitewise:asset":                  null,
  "iotsitewise:asset-model":            null,
  "iotsitewise:dashboard":              null,
  "iotsitewise:gateway":                null,
  "iotsitewise:portal":                 null,
  "iotsitewise:project":                null,
  "iottwinmaker:workspace":             null,
  "iottwinmaker:workspace/component-type": null,
  "iottwinmaker:workspace/entity":      null,
  "iottwinmaker:workspace/sync-job":    null,
  "iotwireless:Destination":            null,
  "iotwireless:DeviceProfile":          null,
  "iotwireless:FuotaTask":             null,
  "iotwireless:MulticastGroup":         null,
  "iotwireless:ServiceProfile":         null,
  "iotwireless:SidewalkAccount":        null,
  "iotwireless:WirelessDevice":         null,
  "iotwireless:WirelessGateway":        null,
  "iotwireless:WirelessGatewayTaskDefinition": null,

  // Kendra
  "kendra:index":                        null,
  "kendra:index/access-control-configuration": null,
  "kendra:index/data-source":            null,
  "kendra:index/experience":             null,
  "kendra:index/faq":                    null,
  "kendra:index/featured-results-set":   null,
  "kendra:index/query-suggestions-block-list": null,
  "kendra:index/thesaurus":              null,
  "kendra-ranking:rescore-execution-plan": null,

  // Misc remaining services
  "appstream:fleet":             { tfType: "aws_appstream_fleet" },
  "appstream:stack":             { tfType: "aws_appstream_stack" },
  "appstream:image-builder":     { tfType: "aws_appstream_image_builder" },
  "appstream:app-block":         null,
  "appstream:application":       null,
  "auditmanager:assessment":     null,
  "chime:app-instance":          null,
  "chime:app-instance/bot":      null,
  "chime:app-instance/user":     null,
  "chime:media-insights-pipeline-configuration": null,
  "chime:media-pipeline-kinesis-video-stream-pool": null,
  "chime:sma":                   null,
  "chime:vc":                    null,
  "codeguru-profiler:profilingGroup": null,
  "codeguru-reviewer:association": null,
  "comprehend:document-classifier": { tfType: "aws_comprehend_document_classifier" },
  "comprehend:entity-recognizer": { tfType: "aws_comprehend_entity_recognizer" },
  "comprehend:flywheel":         null,
  "databrew:dataset":            null,
  "databrew:job":                null,
  "databrew:project":            null,
  "databrew:recipe":             null,
  "databrew:ruleset":            null,
  "databrew:schedule":           null,
  "dataexchange:data-sets":      { tfType: "aws_dataexchange_data_set" },
  "dataexchange:data-sets/revisions": null,
  "detective:graph":             { tfType: "aws_detective_graph" },
  "finspace:environment":        null,
  "forecast:dataset":            null,
  "forecast:dataset-group":      null,
  "forecast:dataset-import-job": null,
  "forecast:forecast":           null,
  "forecast:forecast-export-job": null,
  "forecast:predictor":          null,
  "forecast:predictor-backtest-export-job": null,
  "frauddetector:detector":      null,
  "frauddetector:entity-type":   null,
  "frauddetector:event-type":    null,
  "frauddetector:external-model": null,
  "frauddetector:label":         null,
  "frauddetector:model":         null,
  "frauddetector:outcome":       null,
  "frauddetector:variable":      null,
  "gamelift:alias":              null,
  "gamelift:build":              null,
  "gamelift:gamesessionqueue":   null,
  "gamelift:location":           null,
  "gamelift:matchmakingconfiguration": null,
  "gamelift:matchmakingruleset": null,
  "gamelift:script":             null,
  "healthlake:datastore/fhir":   null,
  "ivs:channel":                 { tfType: "aws_ivs_channel" },
  "ivs:encoder-configuration":   null,
  "ivs:ingest-configuration":    null,
  "ivs:playback-key":            null,
  "ivs:playback-restriction-policy": null,
  "ivs:recording-configuration": { tfType: "aws_ivs_recording_configuration" },
  "ivs:storage-configuration":   null,
  "ivs:stream-key":              null,
  "ivschat:logging-configuration": null,
  "ivschat:room":                null,
  "license-manager:grant":       null,
  "m2:env":                      null,
  "managedblockchain:accessors": null,
  "mediapackage:channels":       null,
  "mediapackage:origin_endpoints": null,
  "mediapackage-vod:assets":     null,
  "mediapackage-vod:packaging-configurations": null,
  "mediapackage-vod:packaging-groups": null,
  "mediastore:container":        null,
  "mediatailor:channel":         null,
  "mediatailor:liveSource":      null,
  "mediatailor:playbackConfiguration": null,
  "mediatailor:vodSource":       null,
  "mobiletargeting:apps/campaigns": null,
  "mobiletargeting:apps/segments":  null,
  "mobiletargeting:templates/EMAIL": null,
  "mobiletargeting:templates/PUSH":  null,
  "mobiletargeting:templates/SMS":   null,
  "networkmanager:global-network":   { tfType: "aws_networkmanager_global_network" },
  "networkmanager:core-network":     { tfType: "aws_networkmanager_core_network" },
  "networkmanager:device":           { tfType: "aws_networkmanager_device" },
  "networkmanager:link":             { tfType: "aws_networkmanager_link" },
  "networkmanager:attachment":       null,
  "omics:referenceStore":            null,
  "omics:runGroup":                  null,
  "omics:workflow":                  null,
  "outposts:site":                   null,
  "panorama:device":                 null,
  "panorama:package":                null,
  "personalize:dataset":             null,
  "personalize:dataset-group":       null,
  "personalize:schema":              null,
  "personalize:solution":            null,
  "profile:domains":                 null,
  "profile:domains/integrations":    null,
  "profile:domains/object-types":    null,
  "proton:environment-account-connection": null,
  "proton:environment-template":     null,
  "proton:service-template":         null,
  "quicksight:dataset":              null,
  "quicksight:datasource":           null,
  "quicksight:template":             null,
  "quicksight:theme":                null,
  "rekognition:project":             null,
  "refactor-spaces:environment":     null,
  "refactor-spaces:environment/application": null,
  "refactor-spaces:environment/application/route": null,
  "refactor-spaces:environment/application/service": null,
  "route53-recovery-control:cluster": { tfType: "aws_route53recoverycontrolconfig_cluster" },
  "route53-recovery-control:controlpanel/routingcontrol": null,
  "route53-recovery-control:controlpanel/safetyrule": null,
  "route53-recovery-readiness:cell":            null,
  "route53-recovery-readiness:readiness-check": null,
  "route53-recovery-readiness:recovery-group":  null,
  "route53-recovery-readiness:resource-set":    null,
  "servicecatalog:applications":     null,
  "servicecatalog:attribute-groups": null,
  "wellarchitected:workload":        null,
  "wisdom:assistant":                null,
  "wisdom:association":              null,
  "wisdom:content":                  null,
  "wisdom:knowledge-base":           null,
  "dlm:policy":                      { tfType: "aws_dlm_lifecycle_policy" },
};

// ---------------------------------------------------------------------------
// RE service name → Terraform type prefix (for convention-based derivation)
// Only needed for services whose name differs from the Terraform prefix.
// ---------------------------------------------------------------------------
const RE_SERVICE_TO_TF_PREFIX = {
  "access-analyzer": "accessanalyzer",
  "acm-pca": "acmpca",
  "app-integrations": "appintegrations",
  "backup-gateway": "backup_gateway",
  "codeguru-profiler": "codeguruprofiler",
  "codeguru-reviewer": "codeguru_reviewer",
  "codestar-connections": "codestarconnections",
  "cognito-idp": "cognito",
  "cognito-identity": "cognito_identity",
  "ecr-public": "ecrpublic",
  "elasticfilesystem": "efs",
  "elasticmapreduce": "emr",
  "emr-serverless": "emrserverless",
  "emr-containers": "emrcontainers",
  "kendra-ranking": "kendra_ranking",
  "mediapackage-vod": "media_packagev2",
  "network-firewall": "networkfirewall",
  "refactor-spaces": "refactorspaces",
  "resource-explorer-2": "resourceexplorer2",
  "resource-groups": "resourcegroups",
  "route53-recovery-control": "route53recoverycontrolconfig",
  "route53-recovery-readiness": "route53recoveryreadiness",
  "ssm-incidents": "ssmincidents",
  "vpc-lattice": "vpclattice",
  "workspaces-web": "workspacesweb",
};

// ---------------------------------------------------------------------------
// Convention-based derivation: RE type → candidate Terraform type
// ---------------------------------------------------------------------------
function conventionTfType(reService, reResourceType) {
  const tfPrefix = RE_SERVICE_TO_TF_PREFIX[reService] || reService.replace(/-/g, "");
  // Strip nested paths: "application/environment" → "application"
  const basePart = reResourceType.split("/")[0];
  const tfSuffix = basePart.replace(/-/g, "_");
  return "aws_" + tfPrefix + "_" + tfSuffix;
}

// ---------------------------------------------------------------------------
// Derive the resource-map.json key from an RE type.
// Strips nested path suffixes (e.g. "loadbalancer/app" → "loadbalancer")
// unless the service part is before the first colon.
// ---------------------------------------------------------------------------
function deriveArnKey(reType) {
  const colonIdx = reType.indexOf(":");
  if (colonIdx === -1) return reType;
  const service = reType.substring(0, colonIdx);
  const resourcePart = reType.substring(colonIdx + 1);
  const slashIdx = resourcePart.indexOf("/");
  if (slashIdx > -1) {
    return service + ":" + resourcePart.substring(0, slashIdx);
  }
  return reType;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = process.argv.slice(2);
  const fetchMode = args.includes("--fetch-re-types");
  const requestedVersion = args.find((a) => !a.startsWith("--")) || null;

  if (fetchMode) {
    console.log("Fetching RE supported types from AWS API...");
    const raw = execSync("aws resource-explorer-2 list-supported-resource-types --output json", {
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(raw.toString());
    const sorted = data.ResourceTypes.sort((a, b) => a.ResourceType.localeCompare(b.ResourceType));
    fs.writeFileSync(RE_TYPES_CACHE, JSON.stringify(sorted, null, 2) + "\n");
    console.log(`Written ${sorted.length} RE types to ${RE_TYPES_CACHE}`);
    if (!requestedVersion) return;
  }

  console.log("=== Terraform Resource Map Generator (RE-first) ===\n");

  // Step 1: Load RE supported types
  if (!fs.existsSync(RE_TYPES_CACHE)) {
    console.error("RE types cache not found. Run with --fetch-re-types first.");
    process.exit(1);
  }
  const reTypes = JSON.parse(fs.readFileSync(RE_TYPES_CACHE, "utf8"));
  console.log(`Loaded ${reTypes.length} RE supported types from cache\n`);

  // Step 2: Load old resource-map.json for diff
  let oldResources = {};
  if (fs.existsSync(OUTPUT)) {
    oldResources = JSON.parse(fs.readFileSync(OUTPUT, "utf8")).resources || {};
  }

  // Step 3: Get provider schema for validation
  if (requestedVersion) {
    const mainTf = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= ${requestedVersion}"
    }
  }
}

provider "aws" {
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  region                      = "us-east-1"
}
`;
    fs.writeFileSync(path.join(WORKSPACE, "main.tf"), mainTf);
    console.log(`Pinned AWS provider to ${requestedVersion}`);
  }

  console.log("Running terraform init...");
  execSync("terraform init -upgrade -input=false", { cwd: WORKSPACE, stdio: "pipe" });

  console.log("Extracting provider schema...");
  const schemaRaw = execSync("terraform providers schema -json", { cwd: WORKSPACE, maxBuffer: 100 * 1024 * 1024 });
  const schema = JSON.parse(schemaRaw.toString());
  const awsSchema = schema.provider_schemas["registry.terraform.io/hashicorp/aws"];
  if (!awsSchema) {
    console.error("AWS provider schema not found.");
    process.exit(1);
  }
  const providerVersion = requestedVersion || detectVersion(WORKSPACE);
  const validTfTypes = new Set(Object.keys(awsSchema.resource_schemas));
  console.log(`Provider version: ${providerVersion} (${validTfTypes.size} resource types)\n`);

  // Step 4: Build mappings
  const resources = {};
  const stats = { override: 0, convention: 0, skipped: 0, unmapped: 0 };
  const unmapped = [];

  for (const { Service: reService, ResourceType: reType } of reTypes) {
    // Check override table
    if (reType in RE_OVERRIDES) {
      const ov = RE_OVERRIDES[reType];
      if (ov === null) {
        stats.skipped++;
        continue;
      }
      const arnKey = ov.arnKey || deriveArnKey(reType);
      if (!(arnKey in resources)) {
        const entry = {
          tfType: ov.tfType,
          importIdField: ov.importIdField || "resourceId",
          reType,
          source: "override",
        };
        if (ov.importIdTemplate) {
          entry.importIdTemplate = ov.importIdTemplate;
          delete entry.importIdField;
        }
        resources[arnKey] = entry;
      }
      if (!validTfTypes.has(ov.tfType)) {
        console.warn(`  WARN: override ${reType} → ${ov.tfType} not in provider schema`);
      }
      stats.override++;
      continue;
    }

    // Convention-based derivation
    const reResourceType = reType.substring(reType.indexOf(":") + 1);
    const candidate = conventionTfType(reService, reResourceType);

    if (validTfTypes.has(candidate)) {
      const arnKey = deriveArnKey(reType);
      if (!(arnKey in resources)) {
        resources[arnKey] = {
          tfType: candidate,
          importIdField: "resourceId",
          reType,
          source: "convention",
        };
      }
      stats.convention++;
    } else {
      unmapped.push({ reType, candidate });
      stats.unmapped++;
    }
  }

  // Step 5: Write output
  const output = {
    providerVersion,
    generatedAt: new Date().toISOString(),
    totalReTypes: reTypes.length,
    mappedTypes: Object.keys(resources).length,
    resources,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + "\n");

  console.log("Mappings generated:");
  console.log(`  Override:    ${stats.override}`);
  console.log(`  Convention:  ${stats.convention}`);
  console.log(`  Skipped:     ${stats.skipped} (not useful for terraform import)`);
  console.log(`  Unmapped:    ${stats.unmapped} (convention failed validation)`);
  console.log(`  Total mapped: ${Object.keys(resources).length}`);
  console.log(`\nWritten to ${OUTPUT}`);

  // Step 6: Unmapped report
  if (unmapped.length) {
    console.log(`\n=== Unmapped RE types (${unmapped.length}) ===\n`);
    for (const { reType, candidate } of unmapped) {
      console.log(`  ${reType} → tried ${candidate} (not in schema)`);
    }
  }

  // Step 7: Backward-compatibility diff
  diffMaps(oldResources, resources);

  // Step 8: Validation
  validateKnownMappings(resources);
}

function detectVersion(workspace) {
  try {
    const lockContent = fs.readFileSync(path.join(workspace, ".terraform.lock.hcl"), "utf8");
    const match = lockContent.match(/version\s*=\s*"([^"]+)"/);
    return match ? match[1] : "unknown";
  } catch {
    return "unknown";
  }
}

function diffMaps(oldResources, newResources) {
  const oldKeys = new Set(Object.keys(oldResources));
  const newKeys = new Set(Object.keys(newResources));

  const added = [...newKeys].filter((k) => !oldKeys.has(k));
  const removed = [...oldKeys].filter((k) => !newKeys.has(k));
  const changed = [...newKeys].filter((k) => {
    if (!oldKeys.has(k)) return false;
    return oldResources[k].tfType !== newResources[k].tfType ||
           oldResources[k].importIdField !== newResources[k].importIdField;
  });

  console.log(`\n=== Diff vs previous resource-map.json ===\n`);
  console.log(`  Added:   ${added.length} keys`);
  console.log(`  Removed: ${removed.length} keys`);
  console.log(`  Changed: ${changed.length} keys`);

  if (added.length && added.length <= 20) {
    console.log("\n  New keys:");
    for (const k of added) console.log(`    + ${k} → ${newResources[k].tfType}`);
  }
  if (removed.length && removed.length <= 50) {
    console.log("\n  Removed keys (no longer RE-discoverable):");
    for (const k of removed) console.log(`    - ${k} (was ${oldResources[k].tfType})`);
  }
  if (changed.length) {
    console.log("\n  Changed mappings:");
    for (const k of changed) {
      console.log(`    ~ ${k}: ${oldResources[k].tfType} → ${newResources[k].tfType}`);
    }
  }
}

function validateKnownMappings(resources) {
  console.log("\n=== Validation against known ARN patterns ===\n");

  const tests = [
    { key: "ec2:instance", expected: "aws_instance" },
    { key: "ec2:vpc", expected: "aws_vpc" },
    { key: "ec2:subnet", expected: "aws_subnet" },
    { key: "ec2:security-group", expected: "aws_security_group" },
    { key: "ec2:internet-gateway", expected: "aws_internet_gateway" },
    { key: "ec2:natgateway", expected: "aws_nat_gateway" },
    { key: "ec2:route-table", expected: "aws_route_table" },
    { key: "ec2:network-acl", expected: "aws_network_acl" },
    { key: "ec2:network-interface", expected: "aws_network_interface" },
    { key: "ec2:volume", expected: "aws_ebs_volume" },
    { key: "ec2:vpc-endpoint", expected: "aws_vpc_endpoint" },
    { key: "lambda:function", expected: "aws_lambda_function" },
    { key: "s3", expected: "aws_s3_bucket" },
    { key: "dynamodb:table", expected: "aws_dynamodb_table" },
    { key: "rds:db", expected: "aws_db_instance" },
    { key: "sns", expected: "aws_sns_topic" },
    { key: "sqs", expected: "aws_sqs_queue" },
    { key: "kms:key", expected: "aws_kms_key" },
    { key: "secretsmanager:secret", expected: "aws_secretsmanager_secret" },
    { key: "ssm:parameter", expected: "aws_ssm_parameter" },
    { key: "logs:log-group", expected: "aws_cloudwatch_log_group" },
    { key: "events:rule", expected: "aws_cloudwatch_event_rule" },
    { key: "config:config-rule", expected: "aws_config_config_rule" },
    { key: "eks:cluster", expected: "aws_eks_cluster" },
    { key: "ecs:cluster", expected: "aws_ecs_cluster" },
    { key: "ecr:repository", expected: "aws_ecr_repository" },
    { key: "elasticloadbalancing:loadbalancer", expected: "aws_lb" },
    { key: "iam:role", expected: "aws_iam_role" },
    { key: "iam:policy", expected: "aws_iam_policy" },
    { key: "iam:group", expected: "aws_iam_group" },
  ];

  let passed = 0;
  let failed = 0;
  for (const { key, expected } of tests) {
    const entry = resources[key];
    if (!entry) {
      console.log(`  MISS  ${key} → expected ${expected}, got nothing`);
      failed++;
    } else if (entry.tfType !== expected) {
      console.log(`  WRONG ${key} → expected ${expected}, got ${entry.tfType}`);
      failed++;
    } else {
      passed++;
    }
  }

  console.log(`\n  ${passed} passed, ${failed} failed out of ${tests.length} known mappings`);
  if (failed > 0) process.exit(1);
}

main();
