# TODO: AWS Lambda Migration

## ✅ COMPLETED

- [x] **Infrastructure Setup**

  - [x] Terraform configuration created
  - [x] VPC, subnets, security groups defined
  - [x] IAM roles and policies configured
  - [x] CloudWatch log groups set up
  - [x] EventBridge rules configured

- [x] **Code Migration**

  - [x] Supabase Edge Functions → AWS Lambda
  - [x] Deno runtime → Node.js 18.x
  - [x] Environment variables updated
  - [x] Import paths fixed for Node.js
  - [x] All LLM processing logic preserved

- [x] **Build System**

  - [x] esbuild configuration
  - [x] Package.json files created
  - [x] Dependencies installed
  - [x] Build scripts working
  - [x] Zip files created

- [x] **Configuration**

  - [x] AWS CLI configured with credentials
  - [x] Terraform installed and working
  - [x] terraform.tfvars configured with your API keys
  - [x] Region set to ca-central-1

- [x] **Testing**
  - [x] Terraform plan successful
  - [x] All resources ready to deploy

## 🚨 IMMEDIATE TODO

### 1. **Add AWS Permissions** (BLOCKING DEPLOYMENT)

Your AWS user `pretium` needs these permissions:

**Go to:** AWS Console → IAM → Users → pretium → Add permissions → Attach policies directly

**Required Policies:**

- [ ] **AmazonVPCFullAccess** - For VPC, subnets, security groups
- [ ] **AWSLambda_FullAccess** - For Lambda functions and function URLs
- [ ] **CloudWatchLogsFullAccess** - For log groups
- [ ] **IAMFullAccess** - For creating IAM roles
- [ ] **AmazonEventBridgeFullAccess** - For EventBridge rules

### 2. **Deploy to AWS**

```bash
cd terraform
terraform apply -auto-approve
```

## 🔄 NEXT STEPS

### 3. **Test Lambda Functions**

- [ ] Test process-jobs function
- [ ] Test trigger-processor function
- [ ] Verify LLM processing works
- [ ] Check CloudWatch logs

### 4. **Update Frontend**

- [ ] Get Lambda function URLs from Terraform output
- [ ] Update frontend to use Lambda URLs instead of Supabase functions
- [ ] Test end-to-end functionality

### 5. **Monitoring & Optimization**

- [ ] Set up CloudWatch dashboards
- [ ] Configure alerts
- [ ] Monitor performance
- [ ] Optimize memory/timeout settings

### 6. **Cleanup**

- [ ] Remove old Supabase functions (after testing)
- [ ] Update documentation
- [ ] Train team on new system

## 📊 Current Status

**Progress:** 85% Complete
**Blocked by:** AWS permissions
**Estimated time to completion:** 30 minutes (after permissions added)

## 🔗 Useful Commands

```bash
# Check current status
cd terraform
terraform plan

# Deploy (after adding permissions)
terraform apply -auto-approve

# View Lambda URLs
terraform output

# Test functions
aws lambda invoke --function-name pretium-process-jobs --payload '{"test": true}' response.json

# View logs
aws logs tail /aws/lambda/pretium-process-jobs --follow
```
