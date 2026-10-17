#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const Path  = require('path');
const { execFile } = require('child_process');
const URL   = require('url').URL;

function parseArgs(args) {
    var o = {}, i = 0;
    while (i < args.length) {
        var a = args[i];
        if      (a === '-h' || a === '--help')             return { help:true };
        else if ((a==='-f'||a==='--fields') && i+1<args.length) o.fields=args[++i].split(',');
        else if ((a==='-t'||a==='--type')   && i+1<args.length) o.type  =args[++i];
        else if (a==='--scope'||a==='--revisions')         ; // skip next arg(s)
        else if ((a==="-w"||a==="--work-folder")&&i+1<args.length) {
            o.downloadDir=require('path').resolve(args[++i]);
        }
        else if (a==='--download-all'||a==="-e")           o.downloadAll=true;
        else if (a[0]!=='-'&&!a.startsWith('--')) {
            if (!o.org)          o.org=a;
            else if (!o.project) o.project=a;
            else                 o.id=parseInt(a,10);
        }
        i++;
    }
    return o;
}

/* Azure CLI Bearer token with PAT fallback */


var __ac = null, __ae = 0;

async function getBearer() {
  if(__ac && Date.now() < __ae) return {token:__ac, type:'bearer'};
  
  var azScope = ['https://app.vssps.visualstudio.com/.default', 'https://management.azure.com/'];
  for(var r=0;r<azScope.length;r++){
    try {
        var d = await new Promise(function(ok, no) {
            execFile('az', ['account','get-access-token','-o','json','--scope', azScope[r]], 
                {timeout:10000}, function(er, out, sd) {
                    if(er || out.trim().length<50) return no(sd||'Az not avail');
                    ok(JSON.parse(out));
                });
        });
        var tok = d.access_token||d.accessToken;
        if(tok && tok.startsWith('eyJ')){
            __ac=tok; __ae=Date.now()+480000;
            return {token:tok, type:'bearer'};
        }
    } catch(e) {}
  }
  
  var pat = process.env.AZURE_DEVOPS_EXT_PAT || process.env.ADO_TOKEN;
  if(!pat) throw new Error('No Azure CLI token + no AZURE_DEVOPS_EXT_PAT');
  return {token:pat, type:'pat'};
}

function aH(auth){return auth.type==='bearer'?'Bearer '+auth.token:'Basic '+Buffer.from(':'+auth.token).toString('base64');}


/* JSON fetch for _apis endpoints */
function jsonFetch(rp, au) {
    return new Promise(function(ok, no) {
        https.get({hostname:'dev.azure.com', path:rp,
            headers:{Accept:'application/json', Authorization:aH(au)}},
            function(res) { var b=''; res.on('data',function(x){b+=x}); 
                res.on('end',function(){if(res.statusCode>=200&&res.statusCode<300)ok(JSON.parse(b));else no(new Error('ADO '+res.statusCode))})}).on('error',no);
    });
}


/* download binary blob with redirect following */
function getBlob(url, au) { return new Promise(function(ok, no) {
    var h = {'Accept':'*/*','User-Agent':'pi-skill/1.0', Authorization:aH(au)};
    function fw(u, d) { return new Promise(function(ok2, rj2) {
        var nu = new URL(u); var cl = (nu.protocol==='https:' ? https : http);
        cl.get({hostname:nu.hostname, path:nu.pathname+nu.search, headers:h}, 
            function(r){if(r.statusCode===301&&d>0&&r.headers.location) return fw(r.headers.location,d-1).then(ok2,rj2);
                else if(r.statusCode>=200&&r.statusCode<300){var cs=[];r.on('data',function(x){cs.push(x)});
                    r.on('end',function(){ok2(Buffer.concat(cs))})}else rj2(new Error(r.statusCode+' '+u))}
            ).on('error',rj2);}); }
    fw(url, 8).then(function(buf){ok(buf)}, no);
}); }

/* save blob (a Buffer) to disk */
function saveBlob(u, d, p) { return getBlob(u,p).then(function(b){
    if(!b) return {ok:false,error:'empty response'};
    var dd=Path.dirname(d);if(!fs.existsSync(dd))fs.mkdirSync(dd,{recursive:true});
    fs.writeFileSync(d,b);return{ok:true,size:b.length,path:d};},
    function(e){return {ok:false,error:e.message}}

);
}

/* extract <img src='...' /> from rich-text Description */
var SQ = String.fromCharCode(39);  // single-quote char for image parsing
function extractEmbedImages(hc){
    var rs=[], sn=new Set();
    if(!hc||typeof hc!=='string') return [];
    var h = hc.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    h = h.replace(/\u003C/g,'<').replace(/\u003E/g,'>');
    var p = 0; while(true){
        var s=h.indexOf('<img',p); if(s<0)break;
        var q=h.indexOf('=',s+4); if(q<0){p=s+4;continue;}
        var c=h.charAt(q+1); q+=2; if(c!=='"'&&c!==SQ){p=q;continue;}
        var je=h.indexOf(c,q); if(je<0)break;
        var u=h.substring(q,je); p=je+1;
        if(u[0]==='/')u='https:'+u;
        if(u.indexOf('#')>=0||u.indexOf('data:')===0)continue;
        if(!sn.has(u)){sn.add(u);rs.push({url:u});}
    }
    return rs;
}

/* get file attachment links from workItem._links */
function getFileAttLinks(wi){
    if(!wi||!wi._links)return[];
    var l=wi._links;if(!Array.isArray(l))l=[l];
    var o=[]; for(var i in l) if(l[i].rel=== 'Microsoft.VSTS.Common.AttachedFile'&&l[i].href){
        var n=l[i].name||Path.basename(new URL(l[i].href).pathname);
        o.push({name:n,url:l[i].href});}
    return o;
}


/* ── main (async workflow) ─────────────────────────────── */
async function main() {
    var args = parseArgs(process.argv.slice(2));
    
    // Help text (read from self)
    if(args.help){
        var h = require('fs').readFileSync(__filename,'utf8').split('\n');
        for(var i=0;i<Math.min(14,h.length);i++) console.error(h[i]);
        process.exit(0);
    }
    
    // Validate args
    if(!args.org||!args.project||isNaN(Number(args.id))){
        process.stderr.write('Usage: node get-workitem.js <org> <project> <id> [-t json|markdown] [-w DIR --download-all]\n');
        process.exit(1);
    }
    
    // AUTH: get Bearer from Azure CLI, or PAT fallback
    console.warn('[INFO] Getting auth (Azure CLI bearer → PAT)...');
    var au = await getBearer();
    console.warn('[INFO] Auth type: ' + au.type);
    
    var id = args.id;
    
    // Fetch work item via REST API (v7.1)
    var apiPath = '/'+encodeURIComponent(args.org)+'/'+encodeURIComponent(args.project)
                    +'/_apis/wit/workitems/'+id+'?api-version=6.0';
    
    console.warn('[INFO] Fetching #'+id+' from '+args.org+'/'+args.project);
    var wi;
    try { wi = await jsonFetch(apiPath, au); }
    catch(e){ console.error('[ERROR] '+e.message); process.exit(1);}
    
    // Extract fields (flatten to simple key-value)  
    var flds={};
    if(wi.fields)for(var k in wi.fields){
        var v=wi.fields[k];
        flds[k]=typeof v==='string'?v:(typeof v.valueOf()=== 'string'?String(v.valueOf()):JSON.stringify(v));
    }
    
    // Extract relations/links from _links  
    var rels='';
    if(wi.relations&&wi.relations instanceof Array)for(var j in wi.relations){
        rels+='#'+wi.relations[j].id+(wi.relations[j].attributes? ' '+wi.relations[j].attributes.title+' ' : '')+'\n';}
    
    // Canonical title/state live in fields (System.Title/System.State), not wi.title/wi.state
    var title    = flds['System.Title'] || wi.title || ('#' + wi.id);
    var state    = flds['System.State'] || wi.state || '';
    var priority = flds['Microsoft.VSTS.Common.Priority'] || '';
    var assignedTo = flds['System.AssignedTo'] || '';

    // Download: file attachments (always) + embedded images (with --download-all)
    var downloadedFiles=[], extractedImages=[];
    var dlDir = args.downloadDir || Path.join('.attachments', args.org + '_' + args.project + '_' + id);
    var attLinks = getFileAttLinks(wi);
    var description = wi.fields && wi.fields['System.Description'] ? wi.fields['System.Description'] : '';
    var images = description ? extractEmbedImages(description) : [];
    var downloads=[];
    for(var fi in attLinks){
        (function(al){
            console.warn('[INFO] Downloading: '+al.name+' -> '+Path.join(dlDir, al.name));
            downloads.push(saveBlob(al.url, Path.join(dlDir, al.name), au).then(function(r){
                if(r.ok) downloadedFiles.push(r); else console.warn('[WARN] Failed: '+al.name+' ('+r.error+')');
            }));
        })(attLinks[fi]);
    }
    if(args.downloadAll){
        for(var ii in images){
            (function(idx, url){
                var name='img_'+(idx+1)+'.png';
                console.warn('[INFO] Downloading image: '+name);
                downloads.push(saveBlob(url, Path.join(dlDir, name), au).then(function(r){
                    if(r.ok) extractedImages.push(r); else console.warn('[WARN] Failed image: '+r.error);
                }));
            })(ii, images[ii].url);
        }
    }
    if(downloads.length) await Promise.all(downloads);

    // Output results based on requested format
    var outType = args.type || 'json';
    if(outType==='markdown'){
        var desc = description;
        var mdLines=['## Work Item #'+wi.id+': '+title,'',
            '- State: '+String(state),
            '- Priority: '+String(priority),
            '- Assigned to: '+String(assignedTo||'(unassigned)')];
        if(desc) mdLines.push('','### Description','',desc.replace(/<br>/g,'\n').replace(/<[^>]+>/g,'').trim());
        if(rels.trim()) mdLines.push('','### Relations','',rels.trim());
        if(downloadedFiles.length){
            mdLines.push('','### Downloaded Files');
            for(var dfi in downloadedFiles) mdLines.push('- '+downloadedFiles[dfi].path+' ('+downloadedFiles[dfi].size+' bytes)');
        }
        if(extractedImages.length){
            mdLines.push('','### Extracted Images');
            for(var eii in extractedImages) mdLines.push('- '+extractedImages[eii].path+' ('+extractedImages[eii].size+' bytes)');
        }
        console.log(mdLines.join('\n'));
    } else if(outType==='compact'){
        console.log('['+wi.id+'] '+title+' ['+state+']');
    } else {
        var out={id:wi.id,title:title,state:state,priority:priority,assignedTo:assignedTo,
            areaPath:flds['System.AreaPath'],iterationPath:flds['System.IterationPath'],
            createdAt:flds['System.CreatedDate'],changedAt:flds['System.ChangedDate'],
            description:flds['System.Description'],
            fieldValues:flds, relations:(wi.relations||[]).map(function(r){return{url:r.url,rel:r.rel,attributes:r.attributes}})};
        if(downloadedFiles.length) out.downloadedFiles=downloadedFiles;
        if(extractedImages.length) out.extractedImages=extractedImages;
        console.log(JSON.stringify(out,null,2));
    }

    // Done
    console.warn('[DONE] Retrieved work item #'+wi.id+' ('+title+')');
}

main().catch(function(err){console.error('Fatal: '+err);process.exit(1)});

