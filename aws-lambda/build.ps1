# Build script for Pretium AWS Lambda functions (PowerShell)

Write-Host "🏗️  Building Pretium Lambda functions..." -ForegroundColor Green

# Create dist directory
if (!(Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist"
}

# Build process-jobs function
Write-Host "📦 Building process-jobs function..." -ForegroundColor Yellow
Set-Location "src/process-jobs"
npm install
npm run build
Set-Location "../.."

# Create zip file for process-jobs
Write-Host "📦 Creating process-jobs.zip..." -ForegroundColor Yellow
Set-Location "src/process-jobs"
if (Test-Path "node_modules") {
    Compress-Archive -Path "dist", "node_modules" -DestinationPath "../../dist/process-jobs.zip" -Force
} else {
    # If no node_modules in this directory, use the parent node_modules
    Compress-Archive -Path "dist" -DestinationPath "../../dist/process-jobs.zip" -Force
    # Copy node_modules from parent if needed
    if (Test-Path "../../node_modules") {
        Copy-Item -Path "../../node_modules" -Destination "node_modules" -Recurse -Force
        Compress-Archive -Path "dist", "node_modules" -DestinationPath "../../dist/process-jobs.zip" -Force
        Remove-Item -Path "node_modules" -Recurse -Force
    }
}
Set-Location "../.."

# Build trigger-processor function
Write-Host "📦 Building trigger-processor function..." -ForegroundColor Yellow
Set-Location "src/trigger-processor"
npm install
npm run build
Set-Location "../.."

# Create zip file for trigger-processor
Write-Host "📦 Creating trigger-processor.zip..." -ForegroundColor Yellow
Set-Location "src/trigger-processor"
if (Test-Path "node_modules") {
    Compress-Archive -Path "dist", "node_modules" -DestinationPath "../../dist/trigger-processor.zip" -Force
} else {
    # If no node_modules in this directory, use the parent node_modules
    Compress-Archive -Path "dist" -DestinationPath "../../dist/trigger-processor.zip" -Force
    # Copy node_modules from parent if needed
    if (Test-Path "../../node_modules") {
        Copy-Item -Path "../../node_modules" -Destination "node_modules" -Recurse -Force
        Compress-Archive -Path "dist", "node_modules" -DestinationPath "../../dist/trigger-processor.zip" -Force
        Remove-Item -Path "node_modules" -Recurse -Force
    }
}
Set-Location "../.."

Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host "📁 Distribution files created in dist/ directory:" -ForegroundColor Cyan
Get-ChildItem "dist" 