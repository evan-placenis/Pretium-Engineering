# Pretium AWS Lambda Migration

This directory contains the AWS Lambda implementation of your Supabase Edge Functions for better LLM hosting and processing capabilities.

## ✅ **CURRENT STATUS: DEPLOYMENT READY - PERMISSIONS NEEDED**

**What We've Accomplished:**

- ✅ Complete infrastructure setup with Terraform
- ✅ Code migration from Supabase Edge Functions to AWS Lambda
- ✅ Build system configured and working
- ✅ AWS CLI configured with your credentials
- ✅ All dependencies installed and zip files created
- ✅ Terraform plan successful - ready to deploy

**What's Next:**

- 🔄 **Add AWS permissions to your user account**
- 🚀 Deploy to AWS
- 🔗 Update your frontend to use Lambda URLs

## 🏗️ Architecture Overview

### What We're Migrating

- **Supabase Edge Functions** → **AWS Lambda Functions**
- **Deno Runtime** → **Node.js 18.x Runtime**
- **Supabase Hosting** → **AWS Lambda + API Gateway**

### Functions

1. **`process-jobs`** - Main job processor for LLM report generation
2. **`trigger-processor`** - Lightweight trigger function for job processing

## 📋 Prerequisites

### Required Tools

- [AWS CLI](https://aws.amazon.com/cli/) - Configured with appropriate permissions
- [Terraform](https://www.terraform.io/) - For infrastructure as code
- [Node.js 18+](https://nodejs.org/) - For building functions
- [Git](https://git-scm.com/) - For version control

### AWS Permissions

Your AWS user/role needs the following permissions:

- Lambda (create, update, delete functions)
- IAM (create roles and policies)
- VPC (create VPC, subnets, security groups)
- CloudWatch (create log groups)
- EventBridge (create rules and targets)
- API Gateway (create function URLs)

## 🚨 **IMMEDIATE TODO: ADD AWS PERMISSIONS**

**Your AWS user `pretium` needs these permissions to deploy:**

### Option 1: Attach Managed Policies (Recommended)

Go to AWS Console → IAM → Users → pretium → Add permissions → Attach policies directly:

1. **AmazonVPCFullAccess** - For VPC, subnets, security groups
2. **AWSLambda_FullAccess** - For Lambda functions and function URLs
3. **CloudWatchLogsFullAccess** - For log groups
4. **IAMFullAccess** - For creating IAM roles
5. **AmazonEventBridgeFullAccess** - For EventBridge rules

### Option 2: Create Custom Policy

Create a custom policy with this JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "lambda:*",
        "iam:*",
        "logs:*",
        "events:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### After Adding Permissions:

```bash
cd terraform
terraform apply -auto-approve
```

### Environment Variables

You'll need to set up these environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `OPENAI_API_KEY` - Your OpenAI API key
- `XAI_API_KEY` - Your XAI (Grok) API key

## 🚀 Quick Start

### 1. Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and default region
```

### 2. Set Up Environment Variables

```bash
# Copy the example terraform.tfvars file
cp terraform/terraform.tfvars.example terraform/terraform.tfvars

# Edit the file with your actual values
nano terraform/terraform.tfvars
```

**⚠️ SECURITY WARNING:**

- Never commit `terraform.tfvars` to git - it contains your API keys!
- The `terraform.tfvars` file is already in `.gitignore`
- Only commit `terraform.tfvars.example` as a template

### 3. Deploy Everything

```bash
# Make scripts executable
chmod +x build.sh deploy.sh

# Deploy infrastructure and functions
./deploy.sh
```

## 📁 Project Structure

```
aws-lambda/
├── terraform/                 # Infrastructure as Code
│   ├── main.tf               # Main Terraform configuration
│   ├── variables.tf          # Variable definitions
│   └── terraform.tfvars.example # Example configuration
├── src/
│   ├── process-jobs/         # Main job processor function
│   │   ├── index.ts          # Lambda handler
│   │   ├── report-job-handler.ts # Job processing logic
│   │   ├── report-generation/ # Report generation system
│   │   └── package.json      # Dependencies
│   └── trigger-processor/    # Trigger function
│       ├── index.ts          # Lambda handler
│       └── package.json      # Dependencies
├── build.sh                  # Build script
├── deploy.sh                 # Deployment script
└── README.md                 # This file
```

## 🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Build functions
npm run build

# Test locally (requires AWS SAM or similar)
npm run dev
```

### Making Changes

1. Edit the TypeScript files in `src/`
2. Run `npm run build` to compile
3. Run `./deploy.sh` to deploy changes

### Environment-Specific Deployments

```bash
# Development
terraform -chdir=terraform apply -var="environment=dev"

# Production
terraform -chdir=terraform apply -var="environment=prod"
```

## 🔍 Monitoring & Logs

### CloudWatch Logs

- **Process Jobs**: `/aws/lambda/pretium-process-jobs`
- **Trigger Processor**: `/aws/lambda/pretium-trigger-processor`

### View Logs

```bash
# View recent logs for process-jobs
aws logs tail /aws/lambda/pretium-process-jobs --follow

# View recent logs for trigger-processor
aws logs tail /aws/lambda/pretium-trigger-processor --follow
```

### AWS Console

- [Lambda Console](https://console.aws.amazon.com/lambda/)
- [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)

## 🔄 Integration with Your App

### Update Your Frontend

Replace your Supabase function calls with the new Lambda URLs:

```typescript
// Old Supabase function call
const response = await fetch(
  `${supabaseUrl}/functions/v1/process-queued-jobs`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }
);

// New Lambda function call
const response = await fetch(
  "https://your-lambda-url.lambda-url.us-east-1.on.aws/",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  }
);
```

### Environment Variables

Add the Lambda URLs to your frontend environment:

```env
NEXT_PUBLIC_PROCESS_JOBS_URL=https://your-process-jobs-url.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_TRIGGER_PROCESSOR_URL=https://your-trigger-processor-url.lambda-url.us-east-1.on.aws/
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Clean and rebuild
npm run clean
npm run build
```

#### 2. Deployment Failures

```bash
# Check AWS credentials
aws sts get-caller-identity

# Check Terraform state
cd terraform
terraform plan
```

#### 3. Function Timeouts

- Increase timeout in `terraform/main.tf`
- Check CloudWatch logs for bottlenecks
- Consider breaking large jobs into smaller chunks

#### 4. Memory Issues

- Increase memory allocation in `terraform/main.tf`
- Monitor memory usage in CloudWatch

### Debugging

```bash
# Test function locally
aws lambda invoke --function-name pretium-process-jobs --payload '{"test": true}' response.json

# View function configuration
aws lambda get-function --function-name pretium-process-jobs
```

## 🔒 Security

### Best Practices

- Use IAM roles with minimal required permissions
- Store sensitive data in AWS Secrets Manager
- Enable VPC for network isolation
- Use HTTPS endpoints only
- Monitor function invocations and costs

### Cost Optimization

- Set appropriate timeouts
- Use provisioned concurrency for consistent performance
- Monitor and optimize memory allocation
- Use EventBridge for scheduled triggers instead of continuous polling

## 📈 Scaling

### Auto-scaling

Lambda functions automatically scale based on demand. For high-traffic scenarios:

1. **Increase Memory**: More memory = more CPU = faster execution
2. **Provisioned Concurrency**: For consistent response times
3. **EventBridge Rules**: For scheduled processing
4. **SQS Integration**: For high-volume job processing

### Performance Tuning

```bash
# Monitor performance
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=pretium-process-jobs \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

## 🗑️ Cleanup

### Remove All Resources

```bash
cd terraform
terraform destroy -auto-approve
```

### Remove Local Files

```bash
npm run clean
rm -rf dist/
```

## 📞 Support

For issues or questions:

1. Check CloudWatch logs first
2. Review this README
3. Check AWS Lambda documentation
4. Open an issue in your repository

## 🔄 Migration Checklist

- [x] AWS CLI configured
- [x] Terraform installed and configured
- [x] Environment variables set in terraform.tfvars
- [x] Code migrated from Supabase Edge Functions
- [x] Build system configured and working
- [x] Zip files created for deployment
- [x] Terraform plan successful
- [ ] **AWS permissions added to user account**
- [ ] Infrastructure deployed to AWS
- [ ] Lambda functions tested
- [ ] Frontend updated to use Lambda URLs
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained on new system
