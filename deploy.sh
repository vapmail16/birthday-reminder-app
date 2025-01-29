#!/bin/bash

# Load environment variables
source .env

# Replace placeholders in the config file
envsubst < config.template.js > config.js

echo "Copying files to public directory..."
cp index.html public/
cp styles.css public/
cp app.js public/
cp config.js public/

echo "Copying necessary files to dist directory..."
mkdir -p dist
mkdir -p dist/assets
cp index.html dist/
cp styles.css dist/
cp app.js dist/
cp config.js dist/
cp assets/favicon.png dist/assets/

echo "Deploying to Firebase..."
firebase deploy

echo "Deployment complete!" 