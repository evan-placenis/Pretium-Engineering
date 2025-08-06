# Step-by-Step Migration Guide: Supabase → AWS Lambda

This guide will walk you through migrating your Supabase Edge Functions to AWS Lambda for better LLM hosting and processing capabilities.

## 🎯 **CURRENT STATUS: READY TO DEPLOY**

**✅ COMPLETED:**

- Infrastructure setup with Terraform
- Code migration from Supabase Edge Functions
- Build system configuration
- AWS CLI setup with your credentials
- All dependencies installed
- Zip files created and ready
- Terraform plan successful

**🚨 NEXT STEP:**

- Add AWS permissions to your user account (see Step 2 below)

## 🎯 Migration Goals

- **Better Performance**: AWS Lambda provides more CPU and memory options
- **Cost Optimization**: Pay only for actual compute time
- **Scalability**: Automatic scaling based on demand
- **Reliability**: Better uptime and error handling
- **Monitoring**: Enhanced CloudWatch integration

## 📋 Pre-Migration Checklist

### 1. Prerequisites Installation

#### Install Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs)"
sudo apt-get update && sudo apt-get install terraform

# Verify installations
aws --version
terraform --version
```

#### Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter your output format (json)
```

### 2. Environment Setup

#### Create AWS IAM User (if needed)

1. Go to AWS IAM Console
2. Create a new user with programmatic access
3. Attach the following policies:
   - `AWSLambda_FullAccess`
   - `IAMFullAccess`
   - `AmazonVPCFullAccess`
   - `CloudWatchFullAccess`
   - `AmazonEventBridgeFullAccess`

**🚨 IMPORTANT: Your current user `pretium` needs these permissions added:**

Go to AWS Console → IAM → Users → pretium → Add permissions → Attach policies directly:

1. **AmazonVPCFullAccess** - For VPC, subnets, security groups
2. **AWSLambda_FullAccess** - For Lambda functions and function URLs
3. **CloudWatchLogsFullAccess** - For log groups
4. **IAMFullAccess** - For creating IAM roles
5. **AmazonEventBridgeFullAccess** - For EventBridge rules

**After adding permissions, run:**

```bash
cd terraform
terraform apply -auto-approve
```

#### Gather Required Information

- Supabase project URL
- Supabase service role key
- OpenAI API key
- XAI (Grok) API key
- AWS region preference

## 🚀 Migration Steps

### Step 1: Set Up the Lambda Project Structure

```bash
# Navigate to your project root
cd pretium

# The aws-lambda directory has been created with all necessary files
ls -la aws-lambda/
```

### Step 2: Configure Environment Variables

```bash
# Copy the example configuration
cp aws-lambda/terraform/terraform.tfvars.example aws-lambda/terraform/terraform.tfvars

# Edit the configuration file with your actual values
nano aws-lambda/terraform/terraform.tfvars
```

Fill in your actual values:

```hcl
aws_region = "us-east-1"
project_name = "pretium"
environment = "dev"

# Supabase Configuration
supabase_url = "https://your-project.supabase.co"
supabase_service_role_key = "your-service-role-key"

# API Keys
openai_api_key = "your-openai-api-key"
xai_api_key = "your-xai-api-key"
```

### Step 3: Test the Build Process

```bash
# Navigate to the Lambda directory
cd aws-lambda

# Make scripts executable
chmod +x build.sh deploy.sh

# Test the build process
./build.sh
```

### Step 4: Deploy Infrastructure

```bash
# Deploy the infrastructure
./deploy.sh
```

This will:

1. Build the Lambda functions
2. Create the AWS infrastructure (VPC, IAM roles, etc.)
3. Deploy the functions
4. Output the function URLs

### Step 5: Test the Functions

#### Test Process Jobs Function

```bash
# Get the function URL from the deployment output
PROCESS_JOBS_URL="https://your-function-url.lambda-url.us-east-1.on.aws/"

# Test with a simple payload
curl -X POST $PROCESS_JOBS_URL \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

#### Test Trigger Processor Function

```bash
# Get the trigger function URL
TRIGGER_URL="https://your-trigger-url.lambda-url.us-east-1.on.aws/"

# Test the trigger
curl -X POST $TRIGGER_URL \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Step 6: Update Your Frontend Application

#### Update Environment Variables

Add these to your `.env.local` file:

```env
NEXT_PUBLIC_PROCESS_JOBS_URL=https://your-process-jobs-url.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_TRIGGER_PROCESSOR_URL=https://your-trigger-processor-url.lambda-url.us-east-1.on.aws/
```

#### Update API Calls

Replace your Supabase function calls in your frontend code:

**Before (Supabase):**

```typescript
// In your frontend code
const response = await fetch(
  `${supabaseUrl}/functions/v1/process-queued-jobs`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobData),
  }
);
```

**After (AWS Lambda):**

```typescript
// In your frontend code
const response = await fetch(process.env.NEXT_PUBLIC_PROCESS_JOBS_URL!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(jobData),
});
```

### Step 7: Update Your Database Triggers

If you have database triggers that call the Supabase functions, update them to call the Lambda functions instead.

#### Update Supabase Database Functions

```sql
-- Update your trigger function to call the Lambda URL instead
CREATE OR REPLACE FUNCTION trigger_job_processor()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Lambda function instead of Supabase function
  PERFORM net.http_post(
    url := 'https://your-trigger-processor-url.lambda-url.us-east-1.on.aws/',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Step 8: Monitor and Verify

#### Check CloudWatch Logs

```bash
# View logs for process-jobs function
aws logs tail /aws/lambda/pretium-process-jobs --follow

# View logs for trigger-processor function
aws logs tail /aws/lambda/pretium-trigger-processor --follow
```

#### Test End-to-End Workflow

1. Create a new report in your application
2. Verify the job is created in your Supabase database
3. Check that the Lambda function processes the job
4. Verify the report is generated successfully

### Step 9: Performance Optimization

#### Monitor Performance

```bash
# Check function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=pretium-process-jobs \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

#### Optimize Settings

Based on your usage patterns, adjust:

- **Memory**: More memory = more CPU = faster execution
- **Timeout**: Set appropriate timeouts for your workloads
- **Concurrency**: Use provisioned concurrency for consistent performance

## 🔄 Rollback Plan

If you need to rollback to Supabase functions:

### 1. Keep Supabase Functions Running

Don't delete your Supabase functions immediately. Keep them running in parallel during the migration.

### 2. Feature Flag

Add a feature flag to switch between Supabase and Lambda:

```typescript
const useLambda = process.env.NEXT_PUBLIC_USE_LAMBDA === "true";

const apiUrl = useLambda
  ? process.env.NEXT_PUBLIC_PROCESS_JOBS_URL!
  : `${supabaseUrl}/functions/v1/process-queued-jobs`;
```

### 3. Quick Rollback

If issues arise, simply:

1. Set `NEXT_PUBLIC_USE_LAMBDA=false`
2. Redeploy your frontend
3. Your app will use Supabase functions again

## 🧪 Testing Strategy

### Unit Tests

```bash
# Test individual functions
cd aws-lambda/src/process-jobs
npm test
```

### Integration Tests

```bash
# Test the complete workflow
# 1. Create a test job
# 2. Trigger processing
# 3. Verify results
```

### Load Tests

```bash
# Test with multiple concurrent requests
# Use tools like Artillery or k6
```

## 📊 Monitoring Setup

### CloudWatch Dashboards

Create a dashboard to monitor:

- Function invocations
- Error rates
- Duration
- Memory usage
- Cost

### Alerts

Set up CloudWatch alarms for:

- High error rates
- Function timeouts
- Memory usage
- Cost thresholds

## 🔒 Security Considerations

### IAM Roles

- Use least privilege principle
- Regularly review and update permissions
- Use AWS Organizations for multi-account management

### Network Security

- Functions run in VPC for network isolation
- Security groups control traffic
- Use private subnets for sensitive functions

### Secrets Management

- Store API keys in AWS Secrets Manager
- Use environment variables for non-sensitive config
- Rotate keys regularly

## 💰 Cost Optimization

### Monitor Costs

```bash
# Check Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Optimization Strategies

1. **Right-size memory**: More memory = more CPU = faster execution
2. **Optimize code**: Reduce cold start times
3. **Use provisioned concurrency**: For consistent performance
4. **Monitor idle time**: Remove unused functions

## 🎉 Migration Complete!

Once you've completed all steps:

1. ✅ **Verify all functionality works**
2. ✅ **Monitor performance and costs**
3. ✅ **Update documentation**
4. ✅ **Train your team**
5. ✅ **Remove old Supabase functions** (after confirming everything works)

## 📞 Support

If you encounter issues:

1. **Check CloudWatch logs first**
2. **Review this migration guide**
3. **Check AWS Lambda documentation**
4. **Open an issue in your repository**

## 🔄 Next Steps

After successful migration:

1. **Performance tuning**: Optimize based on usage patterns
2. **Advanced features**: Add SQS, EventBridge, etc.
3. **Monitoring**: Set up comprehensive monitoring
4. **Security**: Implement additional security measures
5. **Cost optimization**: Monitor and optimize costs
