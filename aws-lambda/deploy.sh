#!/bin/bash

# Deployment script for Pretium AWS Lambda functions

set -e

echo "🚀 Deploying Pretium Lambda functions..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install Terraform first."
    exit 1
fi

# Build the functions
echo "🏗️  Building functions..."
./build.sh

# Deploy infrastructure with Terraform
echo "🏗️  Deploying infrastructure with Terraform..."
cd terraform

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    echo "🔧 Initializing Terraform..."
    terraform init
fi

# Plan the deployment
echo "📋 Planning deployment..."
terraform plan

# Apply the deployment
echo "🚀 Applying deployment..."
terraform apply -auto-approve

# Get the function URLs
echo "📋 Function URLs:"
terraform output process_jobs_url
terraform output trigger_processor_url

cd ..

echo "✅ Deployment completed successfully!"
echo ""
echo "🔗 Your Lambda functions are now available at:"
echo "   Process Jobs: $(cd terraform && terraform output -raw process_jobs_url)"
echo "   Trigger Processor: $(cd terraform && terraform output -raw trigger_processor_url)"
echo ""
echo "📊 Monitor your functions in the AWS Console:"
echo "   https://console.aws.amazon.com/lambda/" 