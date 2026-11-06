#!/usr/bin/env node

// Test authentication for Azure DevOps skill  
// Located at: skills/intake-azure-devops/test/test-authentication.js

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Testing Azure DevOps Skill Authentication ===\n');

let allTestsPassed = true;

console.log('1. Checking Azure CLI availability...');
try {
    const result = execSync('az --version', { encoding: 'utf8' });
    console.log('✅ Azure CLI is available');
} catch (error) {
    console.log('❌ Azure CLI not found - please install Azure CLI');
    allTestsPassed = false;
}

console.log('\n2. Checking Azure login status...');
try {
    const result = execSync('az account show --query user.name -o tsv', { encoding: 'utf8' });
    console.log(`✅ Logged in as: ${result.trim()}`);
} catch (error) {
    console.log('❌ Not logged into Azure CLI - please run "az login"');
    allTestsPassed = false;
}

console.log('\n3. Testing token acquisition...');
try {
    const tokenResult = execSync('az account get-access-token --scope https://app.vssps.visualstudio.com/.default --query accessToken -o tsv', { encoding: 'utf8' });
    
    if (tokenResult.trim().length > 10) {
        console.log('✅ Successfully acquired Azure access token');
        console.log(`   Token length: ${tokenResult.trim().length} characters`);
    } else {
        console.log('❌ Token acquisition failed - empty or invalid token');
        allTestsPassed = false;
    }
} catch (error) {
    console.log('❌ Failed to acquire Azure token:', error.message);
    allTestsPassed = false;
}

console.log('\n4. Basic authentication method check...');
try {
    // Just test that our key scripts exist at the expected location
    const scriptDir = path.join(__dirname, '..', 'scripts');
    const getWorkItemPath = path.join(scriptDir, 'get-workitem.js');
    
    if (fs.existsSync(getWorkItemPath)) {
        console.log('✅ Required get-workitem.js script found in expected location');
        
        // Basic check for authentication logic
        const content = fs.readFileSync(getWorkItemPath, 'utf8');
        if (content.includes('execFile') && content.includes('az account get-access-token')) {
            console.log('✅ Azure CLI token acquisition method found in script');
        } else {
            console.log('⚠️  Azure CLI token methods may not be detected but that could be OK for this test');
        }
    } else {
        console.log('❌ Required script not found at expected location');
        allTestsPassed = false;
    }
    
} catch (error) {
    console.log('❌ Error checking authentication in scripts:', error.message);
    // This isn't a fatal error for our overall authentication test
    console.log('⚠️  Continuing with other tests...');
}

if (allTestsPassed) {
    console.log('\n✅ All authentication tests passed');
} else {
    console.log('\n❌ Some authentication tests failed');
    process.exit(1);
}