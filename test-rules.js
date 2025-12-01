#!/usr/bin/env node

/**
 * Test script for Rules System
 * Tests: store_rule, retrieve_rules, list_rules, update_rule, delete_rule
 */

const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'server', 'index-sqlite.js');

let requestId = 1;
let buffer = '';

function sendRequest(method, params) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const request = {
      jsonrpc: '2.0',
      id: requestId++,
      method,
      params
    };

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}\n${errorOutput}`));
        return;
      }

      try {
        // Parse JSON-RPC response (may have multiple lines)
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
        reject(new Error('No matching response found'));
      } catch (error) {
        reject(error);
      }
    });

    // Send request
    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();
  });
}

async function testRulesSystem() {
  console.log('🧪 Testing Copilot Memory Rules System\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Store a rule
    console.log('\n📝 Test 1: Store a rule');
    console.log('-'.repeat(60));
    const storeResult = await sendRequest('tools/call', {
      name: 'store_rule',
      arguments: {
        title: 'TypeScript Strict Mode',
        content: 'Always use TypeScript strict mode in tsconfig.json. Never use "any" type, prefer "unknown" instead.',
        category: 'code-style',
        priority: 8
      }
    });
    console.log(storeResult.content[0].text);

    // Test 2: Store another rule
    console.log('\n📝 Test 2: Store another rule (Architecture)');
    console.log('-'.repeat(60));
    const storeResult2 = await sendRequest('tools/call', {
      name: 'store_rule',
      arguments: {
        title: 'React Hooks Pattern',
        content: 'Always follow React Hooks rules: don\'t call Hooks inside loops, conditions, or nested functions. Use ESLint plugin.',
        category: 'architecture',
        priority: 9
      }
    });
    console.log(storeResult2.content[0].text);

    // Test 3: Store a testing rule
    console.log('\n📝 Test 3: Store a testing rule');
    console.log('-'.repeat(60));
    const storeResult3 = await sendRequest('tools/call', {
      name: 'store_rule',
      arguments: {
        title: 'Unit Test Coverage',
        content: 'Every component must have at least one unit test with minimum 80% code coverage.',
        category: 'testing',
        priority: 7
      }
    });
    console.log(storeResult3.content[0].text);

    // Test 4: Retrieve all rules
    console.log('\n🔍 Test 4: Retrieve all rules');
    console.log('-'.repeat(60));
    const retrieveResult = await sendRequest('tools/call', {
      name: 'retrieve_rules',
      arguments: {}
    });
    console.log(retrieveResult.content[0].text);

    // Test 5: List rules with details
    console.log('\n📋 Test 5: List all rules with IDs');
    console.log('-'.repeat(60));
    const listResult = await sendRequest('tools/call', {
      name: 'list_rules',
      arguments: {}
    });
    console.log(listResult.content[0].text);

    // Extract first rule ID for update/delete tests
    const listText = listResult.content[0].text;
    const idMatch = listText.match(/ID: `([^`]+)`/);
    
    if (idMatch) {
      const ruleId = idMatch[1];
      
      // Test 6: Update a rule
      console.log('\n✏️  Test 6: Update rule priority');
      console.log('-'.repeat(60));
      const updateResult = await sendRequest('tools/call', {
        name: 'update_rule',
        arguments: {
          id: ruleId,
          priority: 10
        }
      });
      console.log(updateResult.content[0].text);

      // Test 7: Retrieve rules by category
      console.log('\n🔍 Test 7: Retrieve rules by category (code-style)');
      console.log('-'.repeat(60));
      const retrieveCategoryResult = await sendRequest('tools/call', {
        name: 'retrieve_rules',
        arguments: {
          category: 'code-style'
        }
      });
      console.log(retrieveCategoryResult.content[0].text);

      // Test 8: Disable a rule
      console.log('\n⏸️  Test 8: Disable a rule');
      console.log('-'.repeat(60));
      const disableResult = await sendRequest('tools/call', {
        name: 'update_rule',
        arguments: {
          id: ruleId,
          enabled: false
        }
      });
      console.log(disableResult.content[0].text);

      // Test 9: List rules including disabled
      console.log('\n📋 Test 9: List all rules including disabled');
      console.log('-'.repeat(60));
      const listAllResult = await sendRequest('tools/call', {
        name: 'list_rules',
        arguments: {
          includeDisabled: true
        }
      });
      console.log(listAllResult.content[0].text);

      // Test 10: Delete a rule
      console.log('\n🗑️  Test 10: Delete the disabled rule');
      console.log('-'.repeat(60));
      const deleteResult = await sendRequest('tools/call', {
        name: 'delete_rule',
        arguments: {
          id: ruleId
        }
      });
      console.log(deleteResult.content[0].text);

      // Test 11: Final rule list
      console.log('\n📋 Test 11: Final rule list after deletion');
      console.log('-'.repeat(60));
      const finalListResult = await sendRequest('tools/call', {
        name: 'list_rules',
        arguments: {}
      });
      console.log(finalListResult.content[0].text);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testRulesSystem();
