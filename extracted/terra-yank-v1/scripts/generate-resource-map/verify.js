const { mapToTerraformImport } = require("../../src/server/imports");

const tests = [
  ["arn:aws:ec2:ap-southeast-1:123:instance/i-abc123",      "aws_instance",           "i-abc123"],
  ["arn:aws:ec2:ap-southeast-1:123:vpc/vpc-abc",            "aws_vpc",                "vpc-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:subnet/subnet-abc",      "aws_subnet",             "subnet-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:security-group/sg-abc",  "aws_security_group",     "sg-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:internet-gateway/igw-a", "aws_internet_gateway",   "igw-a"],
  ["arn:aws:ec2:ap-southeast-1:123:natgateway/nat-abc",     "aws_nat_gateway",        "nat-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:route-table/rtb-abc",    "aws_route_table",        "rtb-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:network-acl/acl-abc",    "aws_network_acl",        "acl-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:network-interface/eni-a","aws_network_interface",  "eni-a"],
  ["arn:aws:ec2:ap-southeast-1:123:volume/vol-abc",         "aws_ebs_volume",         "vol-abc"],
  ["arn:aws:ec2:ap-southeast-1:123:vpc-endpoint/vpce-abc",  "aws_vpc_endpoint",       "vpce-abc"],
  ["arn:aws:lambda:ap-southeast-1:123:function:my-fn",      "aws_lambda_function",    "my-fn"],
  ["arn:aws:s3:::my-bucket",                                 "aws_s3_bucket",          "my-bucket"],
  ["arn:aws:dynamodb:ap-southeast-1:123:table/my-table",    "aws_dynamodb_table",     "my-table"],
  ["arn:aws:rds:ap-southeast-1:123:db:my-db",               "aws_db_instance",        "my-db"],
  ["arn:aws:sns:ap-southeast-1:123:my-topic",               "aws_sns_topic",          "arn:aws:sns:ap-southeast-1:123:my-topic"],
  ["arn:aws:sqs:ap-southeast-1:123:my-queue",               "aws_sqs_queue",          "arn:aws:sqs:ap-southeast-1:123:my-queue"],
  ["arn:aws:kms:ap-southeast-1:123:key/abc-123",            "aws_kms_key",            "abc-123"],
  ["arn:aws:secretsmanager:ap-southeast-1:123:secret:test", "aws_secretsmanager_secret", "arn:aws:secretsmanager:ap-southeast-1:123:secret:test"],
  ["arn:aws:ssm:ap-southeast-1:123:parameter/config",       "aws_ssm_parameter",      "config"],
  ["arn:aws:logs:ap-southeast-1:123:log-group:/app/log",    "aws_cloudwatch_log_group","/app/log"],
  ["arn:aws:events:ap-southeast-1:123:rule/my-rule",        "aws_cloudwatch_event_rule","my-rule"],
  ["arn:aws:config:ap-southeast-1:123:config-rule/my-rule", "aws_config_config_rule",  "my-rule"],
  ["arn:aws:eks:ap-southeast-1:123:cluster/my-cluster",     "aws_eks_cluster",        "my-cluster"],
  ["arn:aws:ecs:ap-southeast-1:123:cluster/my-cluster",     "aws_ecs_cluster",        "arn:aws:ecs:ap-southeast-1:123:cluster/my-cluster"],
  ["arn:aws:ecr:ap-southeast-1:123:repository/my-repo",     "aws_ecr_repository",     "my-repo"],
  ["arn:aws:iam::123:role/my-role",                          "aws_iam_role",           "my-role"],
];

let passed = 0;
let failed = 0;
for (const [arn, expectedType, expectedId] of tests) {
  const result = mapToTerraformImport({ arn });
  if (!result) {
    console.log("FAIL (null):", arn, "→ expected", expectedType);
    failed++;
  } else if (result.tfType !== expectedType || result.importId !== expectedId) {
    console.log("FAIL:", arn, "→ got", result.tfType, JSON.stringify(result.importId), "| expected", expectedType, JSON.stringify(expectedId));
    failed++;
  } else {
    passed++;
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
if (failed) process.exit(1);
