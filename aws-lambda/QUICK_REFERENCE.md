# AWS Lambda Quick Reference

## 🚀 Quick Commands

### Build & Deploy

```bash
# Build functions
./build.sh

# Deploy everything
./deploy.sh

# Deploy only infrastructure
terraform -chdir=terraform apply

# Deploy only functions
npm run deploy:functions
```

### Monitoring

```bash
# View logs
aws logs tail /aws/lambda/pretium-process-jobs --follow
aws logs tail /aws/lambda/pretium-trigger-processor --follow

# Test functions
aws lambda invoke --function-name pretium-process-jobs --payload '{"test": true}' response.json
aws lambda invoke --function-name pretium-trigger-processor --payload '{}' response.json
```

### Management

```bash
# Get function URLs
terraform -chdir=terraform output process_jobs_url
terraform -chdir=terraform output trigger_processor_url

# Update function code
aws lambda update-function-code --function-name pretium-process-jobs --zip-file fileb://dist/process-jobs.zip

# Get function configuration
aws lambda get-function --function-name pretium-process-jobs
```

## 🔧 Common Issues & Solutions

### Build Issues

```bash
# Clean and rebuild
npm run clean
./build.sh

# Check Node.js version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Deployment Issues

```bash
# Check AWS credentials
aws sts get-caller-identity

# Check Terraform state
cd terraform
terraform plan
terraform state list

# Force recreate resources
terraform taint aws_lambda_function.process_jobs
terraform apply
```

### Runtime Issues

```bash
# Check function logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/pretium"

# Check function metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=pretium-process-jobs \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum
```

## 📊 Performance Tuning

### Memory & Timeout

```hcl
# In terraform/main.tf
resource "aws_lambda_function" "process_jobs" {
  timeout     = 900  # 15 minutes
  memory_size = 2048 # 2GB RAM
}
```

### Cold Start Optimization

```bash
# Enable provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name pretium-process-jobs \
  --qualifier $LATEST \
  --provisioned-concurrent-executions 1
```

## 🔒 Security

### IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Environment Variables

```bash
# Set sensitive environment variables
aws lambda update-function-configuration \
  --function-name pretium-process-jobs \
  --environment Variables='{SUPABASE_URL="https://your-project.supabase.co"}'
```

## 💰 Cost Monitoring

### Check Costs

```bash
# Monthly Lambda costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Function-specific costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["AWS Lambda"]}}'
```

## 🔄 Integration

### Frontend Environment Variables

```env
NEXT_PUBLIC_PROCESS_JOBS_URL=https://your-function-url.lambda-url.us-east-1.on.aws/
NEXT_PUBLIC_TRIGGER_PROCESSOR_URL=https://your-trigger-url.lambda-url.us-east-1.on.aws/
```

### API Call Example

```typescript
const response = await fetch(process.env.NEXT_PUBLIC_PROCESS_JOBS_URL!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(jobData),
});
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

## 📞 Useful URLs

- **AWS Lambda Console**: https://console.aws.amazon.com/lambda/
- **CloudWatch Logs**: https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups
- **IAM Console**: https://console.aws.amazon.com/iam/
- **Cost Explorer**: https://console.aws.amazon.com/cost-management/home#/costexplorer

## 🔍 Debugging Checklist

- [ ] AWS CLI configured and working
- [ ] Terraform state is clean
- [ ] Environment variables set correctly
- [ ] Function logs show no errors
- [ ] IAM permissions are correct
- [ ] VPC configuration is valid
- [ ] Function URLs are accessible
- [ ] Frontend can reach the functions
- [ ] Database connections work
- [ ] API keys are valid
