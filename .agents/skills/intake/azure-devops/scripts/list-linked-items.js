#!/usr/bin/env node
'use strict';

const ado = require('./ado-client');

/* ── arg parser ───────────────────────────── */
function getArg(name) {
  var args = process.argv.slice(2);
  for (var i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) return args[++i];
  }
  return null;
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

ado.getAuth().then(function(auth) {
  var path = '/' + org + '/' + proj + '/_apis/wit/workitems/' + wid
          + '?api-version=' + ado.API_VERSION + '&$expand=all';
  return ado.jsonFetch(path, auth).then(function(wi) {
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
  if(rels.length===0){
    console.log('No linked work items found for #'+wid+'.');
  } else {
for(var i=0;i<rels.length;i++){var r2=rels[i];
  var ttype=(r2.rel||'Unknown').split('/').pop();
  console.log(ttype+' #'+r2.id+(r2.url?' '+r2.url:''));}
  }
} else {
  var out={ workItem: wid, linkedCount: rels.length, relations: {} };
  if(rels.length===0) out.note='No linked work items found.';
  for(var k in groups)out.relations[k]=groups[k].map(function(r){return{id:r.id,url:r.url}});
  console.log(JSON.stringify(out, null, 2));
}

  }); /* end jsonFetch().then(function(wi)) */
}).catch(function(e){console.error('[ERROR] '+e.message); process.exit(1);});
