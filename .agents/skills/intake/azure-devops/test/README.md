# Azure DevOps Skill Tests

This directory contains automated tests for the Azure DevOps skill scripts.

## Test Structure

The tests verify that:
1. Scripts are properly installed and executable
2. Authentication works with current Azure CLI session  
3. Script syntax is valid
4. Core functionality (work item retrieval, state checking, linked items) works

## Running Tests

```bash
# Run all tests
cd .agents/skills/intake/azure-devops/test
chmod +x run-tests.sh && ./run-tests.sh

# Or run individual tests
node test-structure.js
node test-authentication.js
```

## Test Files

- `run-tests.sh` - Main test runner script
- `test-structure.js` - Tests file structure and syntax validation  
- `test-authentication.js` - Tests Azure CLI authentication
- `test-image-download.js` - Tests image download functionality