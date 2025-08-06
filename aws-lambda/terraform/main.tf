terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "private" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-private-subnet"
  }
}

resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# NAT Gateway for Lambda internet access
resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "${var.project_name}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public.id

  tags = {
    Name = "${var.project_name}-nat-gateway"
  }

  depends_on = [aws_internet_gateway.main]
}

# Private route table for Lambda functions
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  subnet_id      = aws_subnet.private.id
  route_table_id = aws_route_table.private.id
}

# Security Groups
resource "aws_security_group" "lambda" {
  name_prefix = "${var.project_name}-lambda-"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-lambda-sg"
  }
}

# IAM Roles and Policies
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "process_jobs" {
  name              = "/aws/lambda/${var.project_name}-process-jobs"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "trigger_processor" {
  name              = "/aws/lambda/${var.project_name}-trigger-processor"
  retention_in_days = 14
}

# Lambda Functions
resource "aws_lambda_function" "process_jobs" {
  filename         = "../dist/process-jobs.zip"
  function_name    = "${var.project_name}-process-jobs"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 900  # 15 minutes
  memory_size     = 2048
  source_code_hash = filebase64sha256("../dist/process-jobs.zip")

  environment {
    variables = {
      NEXT_PUBLIC_SUPABASE_URL        = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY       = var.supabase_service_role_key
      NEXT_PUBLIC_SUPABASE_ANON_KEY   = var.next_public_supabase_anon_key
      OPENAI_API_KEY                 = var.openai_api_key
      GROK_API_KEY                   = var.xai_api_key
      NODE_ENV                       = var.environment
    }
  }

  vpc_config {
    subnet_ids         = [aws_subnet.private.id]
    security_group_ids = [aws_security_group.lambda.id]
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_cloudwatch_log_group.process_jobs
  ]

  tags = {
    Name = "${var.project_name}-process-jobs"
  }
}

resource "aws_lambda_function" "trigger_processor" {
  filename         = "../dist/trigger-processor.zip"
  function_name    = "${var.project_name}-trigger-processor"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 128
  source_code_hash = filebase64sha256("../dist/trigger-processor.zip")

  environment {
    variables = {
      SUPABASE_URL              = var.supabase_url
      SUPABASE_SERVICE_ROLE_KEY = var.supabase_service_role_key
      PROCESS_JOBS_FUNCTION_URL = aws_lambda_function_url.process_jobs.function_url
      NODE_ENV                 = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_cloudwatch_log_group.trigger_processor
  ]

  tags = {
    Name = "${var.project_name}-trigger-processor"
  }
}

# Lambda Function URLs
resource "aws_lambda_function_url" "process_jobs" {
  function_name      = aws_lambda_function.process_jobs.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }
}

resource "aws_lambda_function_url" "trigger_processor" {
  function_name      = aws_lambda_function.trigger_processor.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 86400
  }
}

# EventBridge Rule for periodic job processing (optional)
resource "aws_cloudwatch_event_rule" "job_processor_schedule" {
  name                = "${var.project_name}-job-processor-schedule"
  description         = "Trigger job processor every 5 minutes"
  schedule_expression = "rate(5 minutes)"
}

resource "aws_cloudwatch_event_target" "job_processor_target" {
  rule      = aws_cloudwatch_event_rule.job_processor_schedule.name
  target_id = "JobProcessorTarget"
  arn       = aws_lambda_function.trigger_processor.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.trigger_processor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.job_processor_schedule.arn
}

# Outputs
output "process_jobs_url" {
  value = aws_lambda_function_url.process_jobs.function_url
}

output "trigger_processor_url" {
  value = aws_lambda_function_url.trigger_processor.function_url
}

output "lambda_functions" {
  value = {
    process_jobs     = aws_lambda_function.process_jobs.function_name
    trigger_processor = aws_lambda_function.trigger_processor.function_name
  }
} 