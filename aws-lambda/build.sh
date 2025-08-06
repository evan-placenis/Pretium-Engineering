#!/bin/bash

# Build script for Pretium AWS Lambda functions

set -e

echo "🏗️  Building Pretium Lambda functions..."

# Create dist directory
mkdir -p dist

# Build process-jobs function
echo "📦 Building process-jobs function..."
cd src/process-jobs
npm install
npm run build
cd ../..

# Create zip file for process-jobs
echo "📦 Creating process-jobs.zip..."
cd src/process-jobs/dist
zip -r ../../../dist/process-jobs.zip . ../node_modules/
cd ../../..

# Build trigger-processor function
echo "📦 Building trigger-processor function..."
cd src/trigger-processor
npm install
npm run build
cd ../..

# Create zip file for trigger-processor
echo "📦 Creating trigger-processor.zip..."
cd src/trigger-processor/dist
zip -r ../../../dist/trigger-processor.zip . ../node_modules/
cd ../../..

echo "✅ Build completed successfully!"
echo "📁 Distribution files created in dist/ directory:"
ls -la dist/ 