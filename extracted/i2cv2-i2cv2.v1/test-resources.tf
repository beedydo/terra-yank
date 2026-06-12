locals {
  common_tags = {
    Project     = "i2c-test"
    Environment = "test"
    ManagedBy   = "clickops"
  }
}

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------

resource "aws_vpc" "test" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, { Name = "i2c-test-vpc" })
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.test.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "ap-southeast-1a"

  tags = merge(local.common_tags, { Name = "i2c-test-public" })
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.test.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "ap-southeast-1b"

  tags = merge(local.common_tags, { Name = "i2c-test-private" })
}

resource "aws_internet_gateway" "test" {
  vpc_id = aws_vpc.test.id

  tags = merge(local.common_tags, { Name = "i2c-test-igw" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.test.id

  tags = merge(local.common_tags, { Name = "i2c-test-public-rt" })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.test.id
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "test" {
  name        = "i2c-test-sg"
  description = "i2c-test: allow HTTPS inbound, all outbound"
  vpc_id      = aws_vpc.test.id

  tags = merge(local.common_tags, { Name = "i2c-test-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.test.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"

  tags = merge(local.common_tags, { Name = "i2c-test-sg-https" })
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.test.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"

  tags = merge(local.common_tags, { Name = "i2c-test-sg-egress" })
}

# ---------------------------------------------------------------------------
# Compute — Lambda
# ---------------------------------------------------------------------------

data "archive_file" "lambda" {
  type        = "zip"
  output_path = "${path.module}/.terraform/tmp/i2c-test-hello.zip"

  source {
    content  = <<-JS
      exports.handler = async (event) => {
        return { statusCode: 200, body: JSON.stringify({ message: "hello from i2c-test" }) };
      };
    JS
    filename = "index.js"
  }
}

resource "aws_iam_role" "lambda" {
  name = "i2c-test-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = merge(local.common_tags, { Name = "i2c-test-lambda-role" })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "test" {
  function_name    = "i2c-test-hello"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  tags = merge(local.common_tags, { Name = "i2c-test-hello" })
}

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "test" {
  bucket = "i2c-test-${data.aws_caller_identity.current.account_id}"

  tags = merge(local.common_tags, { Name = "i2c-test-bucket" })
}

resource "aws_dynamodb_table" "test" {
  name         = "i2c-test-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = merge(local.common_tags, { Name = "i2c-test-data" })
}

# ---------------------------------------------------------------------------
# Integration — SNS / SQS
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "test" {
  name = "i2c-test-notify"

  tags = merge(local.common_tags, { Name = "i2c-test-notify" })
}

resource "aws_sqs_queue" "test" {
  name = "i2c-test-work"

  tags = merge(local.common_tags, { Name = "i2c-test-work" })
}

resource "aws_sqs_queue_policy" "sns_to_sqs" {
  queue_url = aws_sqs_queue.test.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.test.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.test.arn } }
    }]
  })
}

resource "aws_sns_topic_subscription" "sqs" {
  topic_arn = aws_sns_topic.test.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.test.arn
}

# ---------------------------------------------------------------------------
# Security — KMS / Secrets Manager
# ---------------------------------------------------------------------------

resource "aws_kms_key" "test" {
  description = "i2c-test encryption key"

  tags = merge(local.common_tags, { Name = "i2c-test-key" })
}

resource "aws_kms_alias" "test" {
  name          = "alias/i2c-test-key"
  target_key_id = aws_kms_key.test.key_id
}

resource "aws_secretsmanager_secret" "test" {
  name = "i2c-test/db-password"

  tags = merge(local.common_tags, { Name = "i2c-test/db-password" })
}

resource "aws_secretsmanager_secret_version" "test" {
  secret_id     = aws_secretsmanager_secret.test.id
  secret_string = jsonencode({ demo = "true" })
}

# ---------------------------------------------------------------------------
# Management — SSM / CloudWatch
# ---------------------------------------------------------------------------

resource "aws_ssm_parameter" "test" {
  name  = "/i2c-test/config"
  type  = "String"
  value = jsonencode({ env = "test" })

  tags = merge(local.common_tags, { Name = "/i2c-test/config" })
}

resource "aws_cloudwatch_log_group" "test" {
  name              = "/i2c-test/app"
  retention_in_days = 1

  tags = merge(local.common_tags, { Name = "/i2c-test/app" })
}
