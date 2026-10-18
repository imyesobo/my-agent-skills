#!/usr/bin/env node
'use strict';

// check-workitem-state.js: Check if a work item is in an expected state.
// Usage: node check-workitem-state.js <org> <project> <id> --state ExpectedState [--json]
//
// Exit code reflects the result (useful as a pre-condition gate):
//   0 = work item IS in the expected state
//   1 = work item is NOT in the expected state (or an error occurred)

const ado = require('./ado-client');

function getArg(name) {
  var args = process.argv.slice(2);
  for (var i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) return args[++i];
  }
  return null;
}

var org = process.argv[2], proj = process.argv[3], wid = parseInt(process.argv[4], 10);
if (!org || !proj || isNaN(wid)) {
  console.error('Usage: node check-workitem-state.js <org> <project> <id> --state ExpectedState [--json]');
  process.exit(1);
}

var expectedState = getArg('--state');
if (!expectedState) {
  console.error('Error: --state is required');
  process.exit(1);
}

var jsonOut = process.argv.includes('--json');

ado.getAuth().then(function(auth){
  var path = '/' + org + '/' + proj + '/_apis/wit/workitems/' + wid
          + '?api-version=' + ado.API_VERSION;
  return ado.jsonFetch(path, auth).then(function(wi) {
        var fields = wi.fields || {};
        var current = fields['System.State'];
        var passed = current === expectedState;

        if (jsonOut) {
          console.log(JSON.stringify({ passed: passed, current:current, expected:expectedState }));
        } else {
          if (passed) {
            console.error('PASS: Work item #' + wid + ' is in state "' + current + '"');
          } else {
            console.error('FAIL: Work item #' + wid + ' is "' + current + '" (expected "' + expectedState + '")');
          }
        }
        process.exit(passed ? 0 : 1);
  });
}).catch(function(e){console.error('[ERROR]',e.message);process.exit(1);});
