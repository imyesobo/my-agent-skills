#!/bin/bash

# Main test runner for Azure DevOps skill
# This script runs all automated tests for the Azure DevOps skill

echo "=== Azure DevOps Skill Tests ==="
echo "Running automated tests for Azure DevOps skill..."
echo

# Change to the skill directory
cd "$(dirname "$0")/.."

# Test 1: Structure and syntax validation
echo "1. Testing script structure and syntax..."
node test/test-structure.js
if [ $? -eq 0 ]; then
    echo "✅ Structure and syntax tests passed"
else
    echo "❌ Structure and syntax tests failed"
    exit 1
fi

# Test 2: Authentication testing  
echo "2. Testing Azure CLI authentication..."
node test/test-authentication.js
if [ $? -eq 0 ]; then
    echo "✅ Authentication tests passed"
else
    echo "❌ Authentication tests failed" 
    exit 1
fi

echo
echo "=== ALL TESTS PASSED ==="
echo "The Azure DevOps skill is properly installed and functional."
echo "It will automatically use your logged-in Azure CLI user for authentication."