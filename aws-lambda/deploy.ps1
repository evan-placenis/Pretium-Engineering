# Deployment script for Pretium AWS Lambda functions (PowerShell)

Write-Host "🚀 Deploying Pretium Lambda functions..." -ForegroundColor Green

# Check if AWS CLI is configured
try {
    aws sts get-caller-identity | Out-Null
} catch {
    Write-Host "❌ AWS CLI is not configured. Please run 'aws configure' first." -ForegroundColor Red
    exit 1
}

# Check if Terraform is installed
try {
    terraform --version | Out-Null
} catch {
    Write-Host "❌ Terraform is not installed. Please install Terraform first." -ForegroundColor Red
    exit 1
}

# Build the functions
Write-Host "🏗️  Building functions..." -ForegroundColor Yellow
& "$PSScriptRoot\build.ps1"

# Deploy infrastructure with Terraform
Write-Host "🏗️  Deploying infrastructure with Terraform..." -ForegroundColor Yellow
Set-Location "terraform"

# Initialize Terraform if needed
if (!(Test-Path ".terraform")) {
    Write-Host "🔧 Initializing Terraform..." -ForegroundColor Yellow
    terraform init
}

# Plan the deployment
Write-Host "📋 Planning deployment..." -ForegroundColor Yellow
terraform plan

# Apply the deployment
Write-Host "🚀 Applying deployment..." -ForegroundColor Yellow
terraform apply -auto-approve

# Get the function URLs
Write-Host "📋 Function URLs:" -ForegroundColor Cyan
terraform output process_jobs_url
terraform output trigger_processor_url

Set-Location ".."

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Your Lambda functions are now available at:" -ForegroundColor Cyan
Write-Host "   Process Jobs: $(terraform -chdir=terraform output -raw process_jobs_url)" -ForegroundColor White
Write-Host "   Trigger Processor: $(terraform -chdir=terraform output -raw trigger_processor_url)" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitor your functions in the AWS Console:" -ForegroundColor Cyan
Write-Host "   https://console.aws.amazon.com/lambda/" -ForegroundColor White 