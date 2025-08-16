#!/bin/bash
set -e

echo "🏗️  Building Pretium Lambda functions..."

# Clean previous builds
rm -rf dist
rm -rf src/process-jobs/dist
rm -rf src/trigger-processor/dist

# Install all dependencies centrally
echo "📦 Installing dependencies..."
npm install

# Build both functions using scripts from the root package.json
echo "📦 Building functions..."
npm run build

# Package process-jobs
echo "📦 Creating process-jobs.zip..."
# 1. Go into the output directory and zip its contents
(cd src/process-jobs/dist && zip -r ../../../dist/process-jobs.zip .)
# 2. Add the shared node_modules to the zip file
(cd dist && zip -ur process-jobs.zip ../node_modules)

# Package trigger-processor
echo "📦 Creating trigger-processor.zip..."
# The esbuild output file needs to be named index.js for the handler
mv dist/trigger-processor.js dist/index.js
# 1. Zip the handler file
(cd dist && zip -r trigger-processor.zip index.js)
# 2. Add the shared node_modules to the zip file
(cd dist && zip -ur trigger-processor.zip ../node_modules)
# 3. Clean up the renamed file
rm dist/index.js

echo "✅ Build completed successfully!"
echo "📁 Distribution files created in dist/ directory:"
ls -la dist/ 