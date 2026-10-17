#!/usr/bin/env node
'use strict';

const https = require('https');
const { execFile } = require('child_process');
var URL = require('url').URL;

/* ── arg parser ───────────────────────────── */
function getArg(name) {
  var args = process.argv.slice(2);
  for (var i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) return args[++i];
  }
  return null;
}

/* ── dual auth: Azure CLI -> PAT fallback ─── */
function getAuth() {
  var pat = process.env.AZURE_DEVOPS_EXT_PAT || process.env.ADO_TOKEN;
  if (pat) return Promise.resolve({token: pat, type: 'pat'});

  return new Promise(function(ok, no) {
    execFile('az', ['account','get-access-token','-o','json','--scope',
      'https://app.vssps.visualstudio.com/.default'], {timeout:10000},
      function(er, out, sd) {
        if (er || !out || out.trim().length < 40) return no(sd || 'Az not avail');
        try { var d = JSON.parse(out), t = d.access_token||d.accessToken;
          if (t && t.startsWith('eyJ')) return ok({token: t, type: 'bearer'}); } catch(e){}
        return no('No Azure token');
      });
  }).then(function(a){return a;}).catch(function(){throw new Error('Azure CLI + PAT both failed');});
}

function makeAuthHdr(auth) {
  if (auth.type === 'bearer') return 'Bearer ' + auth.token;
  return 'Basic ' + Buffer.from(':'+auth.token).toString('base64');
}

/* ── main ─────────────────────────────────── */
var org = process.argv[2], proj = process.argv[3], wid = parseInt(process.argv[4], 10);
if (!org || !proj || isNaN(wid)) {
  console.error('Usage: node list-linked-items.js <org> <project> <id> [-t json|markdown|compact]');
  process.exit(1);
}

var fmt = (getArg('-t') || getArg('--type') || 'json').toLowerCase();
fmt = (fmt==='compact'||fmt==='markdown') ? fmt : 'json';
var filterRel = getArg('-r') || getArg('--relation');

getAuth().then(function(auth) {
  var opts = {
    hostname: 'dev.azure.com',
    path: '/' + org + '/' + proj + '/_apis/wit/workitems/' + wid + '?api-version=7.1-preview.1&$expand=all',
    headers: { Accept: 'application/json', Authorization: makeAuthHdr(auth) }
  };

  https.get(opts, function(res) {
    var data = '';
    res.on('data', function(d){data+=d;});
    res.on('end', function(){
      if (res.statusCode !== 200){console.error('[ERROR] '+res.statusCode); process.exit(1);}
      var wi = JSON.parse(data);
var rels = wi.relations || [];
if (filterRel) rels = rels.filter(function(r){return r.rel&&r.rel.indexOf(filterRel)>=0;});

/* Group by relation type */
var groups = {};
for(var i=0; i<rels.length; i++){
  var k=rels[i]; if(!groups[k.rel])groups[k.rel]=[];
  groups[k.rel].push(k);
}

/* Output */
if(fmt==='markdown'){
  if(rels.length===0){
    console.log('## Linked Work Items for #'+wid+'\nNo linked work items found.');
  } else {
    var keys = Object.keys(groups), k;
    for(var g=0; g<keys.length; g++){k=keys[g];
      console.log('\n**'+k+'**:');
for(var j in groups[k]){var r=groups[k][j];
  var ttl=r.fields&&r.fields['System.Title']?' - '+r.fields['System.Title']:'';
  console.log('- #'+r.id+': ['+(r.url||'')+']'+ttl);}}
  }
} else if(fmt==='compact'){
for(var i=0;i<rels.length;i++){var r2=rels[i];
  var ttype=(r2.rel||'Unknown').split('/').pop();
  console.log(ttype+' #'+r2.id+(r2.url?' '+r2.url:''));}
} else {
  var out={};
  for(var k in groups)out[k]=groups[k].map(function(r){return{id:r.id,url:r.url}});
  console.log(JSON.stringify(out, null, 2));
}

    }); /* end res.on('end') */
  }).on('error', function(e){console.error('API error: '+e.message); process.exit(3)});
}).catch(function(e){console.error('[ERROR] Auth failed: '+e.message); process.exit(1);});
