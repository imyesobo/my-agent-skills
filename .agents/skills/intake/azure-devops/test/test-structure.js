#!/usr/bin/env node

// Test script structure and syntax for Azure DevOps skill
// Located at: .agents/skills/intake/azure-devops/test/test-structure.js

'use strict';

const fs = require('fs');
const path = require('path');

console.log('=== Testing Azure DevOps Skill Structure ===\n');

// Get absolute path to scripts directory regardless of current working directory
const scriptDir = path.join(__dirname, '..', 'scripts');

console.log(`Testing scripts in: ${scriptDir}`);

// Define the expected scripts in the skill
const expectedScripts = ['get-workitem.js', 'check-workitem-state.js', 'list-linked-items.js'];

let allTestsPassed = true;

console.log('1. Checking script files exist...');
for (const script of expectedScripts) {
    const fullPath = path.join(scriptDir, script);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ ${script} found`);
    } else {
        console.log(`❌ ${script} not found at ${fullPath}`);
        allTestsPassed = false;
    }
}

if (!allTestsPassed) {
    process.exit(1);
}

console.log('\n2. Syntax validation...');
for (const script of expectedScripts) {
    try {
        const fullPath = path.join(scriptDir, script);
        const result = require('child_process').execSync(`node -c "${fullPath}"`, { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✅ ${script} syntax is valid`);
    } catch (error) {
        console.log(`❌ ${script} has syntax errors:`);
        console.error(error.stdout || error.message);
        allTestsPassed = false;
    }
}

console.log('\n3. Checking script metadata...');
for (const script of expectedScripts) {
    try {
        const fullPath = path.join(scriptDir, script);
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Check for key elements
        if (content.includes('#!/usr/bin/env node')) {
            console.log(`✅ ${script} has proper shebang`);
        } else {
            console.log(`⚠️  ${script} missing shebang`);
        }
        
        // Check that it's using dev.azure.com endpoints
        if (content.includes('dev.azure.com')) {
            console.log(`✅ ${script} references Azure DevOps API`);
        } else {
            console.log(`⚠️  ${script} may not reference Azure DevOps API`);
        }
        
    } catch (error) {
        console.log(`❌ Error checking ${script}:`, error.message);
        allTestsPassed = false;
    }
}

console.log('\n4. Checking script sizes...');
for (const script of expectedScripts) {
    try {
        const fullPath = path.join(scriptDir, script);
        const stats = fs.statSync(fullPath);
        console.log(`📄 ${script}: ${stats.size} bytes`);
    } catch (error) {
        console.log(`❌ Error getting size for ${script}:`, error.message);
        allTestsPassed = false;
    }
}

if (allTestsPassed) {
    console.log('\n✅ All structure tests passed');
} else {
    console.log('\n❌ Some structure tests failed');
    process.exit(1);
}