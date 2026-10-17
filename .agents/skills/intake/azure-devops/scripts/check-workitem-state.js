#!/usr/bin/env node
'use strict';

// check-workitem-state.js: Check if a work item is in an expected state.
// Usage: node check-workitem-state.js <org> <project> <id> --state ExpectedState [--json]

const https = require('https');
const { execFile } = require('child_process');

function getArg(name) {
  var args = process.argv.slice(2);
  for (var i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) return args[++i];
  }
  return null;
}

function getAuth() {
  var vs = ['AZURE_DEVOPS_EXT_PAT', 'ADO_TOKEN'];
  for (var i in vs) { var v = process.env[vs[i]]; if (v) return {token:v,type:'pat'};}

  // Try Azure CLI bearer token
  return new Promise(function(ok, no) {
    execFile('az',['account','get-access-token','-o','json','--scope','https://app.vssps.visualstudio.com/.default'], {timeout:10000}, 
      function(er,out,sd){if(er||out.trim().length<40)return no(sd||'Azure CLI not avail');
        try{var d=JSON.parse(out),t=d.access_token||d.accessToken;if(t&&t.startsWith('eyJ'))return ok({token:t,type:'bearer'});}catch(e){}
        return no('No Azure token');});
  }).then(function(auth){return auth;}).catch(function(){
    throw new Error('Azure CLI failed and no AZURE_DEVOPS_EXT_PAT set');
  });
}

function makeAuthHeader(auth){ return auth.type==='bearer'?'Bearer '+auth.token:'Basic '+Buffer.from(':'+auth.token).toString('base64'); }

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

getAuth().then(function(auth){
  var options = {
    hostname: 'dev.azure.com',
    path: '/' + org + '/' + proj + '/_apis/wit/workitems/' + wid + '?api-version=7.1-preview.1',
    headers: { Accept: 'application/json', Authorization: makeAuthHeader(auth) }
  };

  https.get(options, function(res) {
    var data = '';
    res.on('data', function(d) { data += d; });
    res.on('end', function() {
      try {
        var wi = JSON.parse(data);
        var fields = wi.fields || {};
        var current = fields['System.State'];

        if (jsonOut) {
          console.log(JSON.stringify({ passed: current===expectedState, current:current, expected:expectedState }));
          process.exit(0);
        } else {
          if (current === expectedState) {
            console.error('PASS: Work item #' + wid + ' is in state "' + current + '"');
          } else {
            console.error('FAIL: Work item #' + wid + ' is "' + current + '" (expected "' + expectedState + '")');
          }
        }
      } catch (e) {
        console.error('Parse error:', e.message);
        process.exit(2);
      }
    });
  }).on('error', function(e) {
    console.error('API error:', e.message);
    process.exit(3);
  });
}).catch(function(e){console.error('[ERROR]',e.message);process.exit(1);});
