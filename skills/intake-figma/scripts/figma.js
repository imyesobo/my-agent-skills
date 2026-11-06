#!/usr/bin/env node
'use strict';

/*
 * figma.js — dependency-free Figma REST API client for agents (no MCP).
 * Usage: node figma.js <command> <figma-url-or-file-key> [options]   (see --help)
 * Output is JSON on stdout; errors go to stderr with a non-zero exit code.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = process.env.FIGMA_API_HOST || 'api.figma.com';

function fail(msg, code) {
  process.stderr.write('figma.js: ' + msg + '\n');
  process.exit(code || 1);
}

function authHeaders() {
  if (process.env.FIGMA_TOKEN) return { 'X-Figma-Token': process.env.FIGMA_TOKEN };
  if (process.env.FIGMA_OAUTH_TOKEN) return { Authorization: 'Bearer ' + process.env.FIGMA_OAUTH_TOKEN };
  fail('no credentials. Set FIGMA_TOKEN (personal access token) or FIGMA_OAUTH_TOKEN. See SKILL.md "Credentials".');
}

/* Accepts a Figma URL (file/design/proto/board/make) or a bare file key. */
function parseRef(ref) {
  if (!ref) fail('missing Figma URL or file key');
  const m = /figma\.com\/(?:file|design|proto|board|make)\/([A-Za-z0-9]+)/.exec(ref);
  if (!m) {
    if (/^[A-Za-z0-9]{10,}$/.test(ref)) return { key: ref, node: null };
    fail('cannot parse file key from: ' + ref);
  }
  let node = null;
  const n = /[?&]node-id=([^&#]+)/.exec(ref);
  if (n) node = decodeURIComponent(n[1]).replace(/-/g, ':');
  // /branch/<key>/ URLs: the branch key is the one to query
  const b = /\/branch\/([A-Za-z0-9]+)/.exec(ref);
  return { key: b ? b[1] : m[1], node };
}

function request(method, apiPath) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ Accept: 'application/json' }, authHeaders());
    const req = https.request({ host: HOST, path: apiPath, method, headers }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode === 429) {
          return reject(new Error('429 rate limited; Retry-After=' + res.headers['retry-after'] +
            's. Reduce depth/ids per call and wait.'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const hint = { 401: 'bad/expired token', 403: 'token lacks scope or no access to this file',
            404: 'wrong file key/node id, or no access' }[res.statusCode] || '';
          return reject(new Error(res.statusCode + ' ' + hint + ' ' + data.slice(0, 500)));
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('non-JSON response: ' + data.slice(0, 200))); }
      });
    });
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const get = p => request('GET', p);
const q = obj => {
  const s = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  return s ? '?' + s : '';
};

function parseFlags(argv) {
  const f = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      f[a.slice(2)] = v;
    } else f._.push(a);
  }
  return f;
}

/* Compact outline (type, id, name) to save tokens. */
function outline(node, depth, max, lines) {
  lines = lines || [];
  lines.push('  '.repeat(depth) + node.type + ' ' + node.id + ' "' + node.name + '"');
  if (node.children && depth < max) node.children.forEach(c => outline(c, depth + 1, max, lines));
  return lines;
}

/* Recursively collect local source files that contain Code Connect mappings. */
function scanCodeConnect(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { scanCodeConnect(p, out); continue; }
    if (!/\.(tsx|ts|jsx|js|swift|kt|json)$/.test(e.name)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    if (/figma\.connect\(|@figma\/code-connect|\bFigmaConnect\b|figma\.com\/(?:design|file)\//.test(txt) &&
        /figma\.connect|code-connect|FigmaConnect|@FigmaConnect|"figma"/.test(txt)) {
      const urls = [...txt.matchAll(/https:\/\/[^\s'"`)]*figma\.com\/[^\s'"`)]+/g)].map(m => m[0]);
      if (urls.length) out.push({ file: p, figmaUrls: urls });
    }
  }
  return out;
}

const HELP = `figma.js — Figma REST API client (needs FIGMA_TOKEN or FIGMA_OAUTH_TOKEN)

Commands (<ref> = Figma URL or file key; node-id in the URL is used automatically):
  me                                   Validate credentials (GET /v1/me)
  outline <ref> [--depth N]            Compact tree: type, id, name (default depth 3)
  file <ref> [--depth N] [--geometry]  Full file JSON (use --depth to limit size)
  nodes <ref> [--ids 1:2,3:4] [--depth N] [--geometry]
                                       Full detail of nodes (layout, fills, text, styles...)
  images <ref> --ids 1:2 [--format png|jpg|svg|pdf] [--scale 2]
                                       Render nodes; returns temporary image URLs
  image-fills <ref>                    URLs of all images used as fills in the file
  components <ref>                     Components, component sets, styles in the file
  variables <ref> [--published]        Local (or published) variables/tokens (Enterprise plan)
  comments <ref>                       Comments on the file
  dev-resources <ref> [--ids 1:2]      Dev Resources (links to code) on nodes
  versions <ref>                       File version history
  team-components <team_id>            Published components of a team library
  code-connect [dir]                   Scan LOCAL repo for Code Connect files and their Figma URLs
  raw <GET-path>                       Raw GET, e.g. /v1/files/KEY/nodes?ids=1:2
`;

async function main() {
  const f = parseFlags(process.argv.slice(2));
  const cmd = f._[0];
  if (!cmd || f.help || cmd === 'help') return process.stdout.write(HELP);

  if (cmd === 'code-connect') {
    return console.log(JSON.stringify(scanCodeConnect(path.resolve(f._[1] || '.'), []), null, 2));
  }
  if (cmd === 'me') return console.log(JSON.stringify(await get('/v1/me'), null, 2));
  if (cmd === 'raw') return console.log(JSON.stringify(await get(f._[1]), null, 2));
  if (cmd === 'team-components') {
    return console.log(JSON.stringify(await get('/v1/teams/' + f._[1] + '/components?page_size=100'), null, 2));
  }

  const { key, node } = parseRef(f._[1]);
  const ids = f.ids && f.ids !== true ? f.ids : node;
  const geometry = f.geometry ? 'paths' : undefined;
  let out;

  switch (cmd) {
    case 'outline': {
      const depth = Number(f.depth || 3);
      const r = ids
        ? await get('/v1/files/' + key + '/nodes' + q({ ids, depth }))
        : await get('/v1/files/' + key + q({ depth }));
      const roots = ids ? Object.values(r.nodes).map(n => n && n.document).filter(Boolean) : [r.document];
      return console.log(roots.map(n => outline(n, 0, depth).join('\n')).join('\n'));
    }
    case 'file':
      out = await get('/v1/files/' + key + q({ depth: f.depth, geometry }));
      break;
    case 'nodes':
      if (!ids) fail('nodes needs --ids or a URL with node-id');
      out = await get('/v1/files/' + key + '/nodes' + q({ ids, depth: f.depth, geometry }));
      break;
    case 'images':
      if (!ids) fail('images needs --ids or a URL with node-id');
      out = await get('/v1/images/' + key + q({ ids, format: f.format || 'png', scale: f.scale }));
      break;
    case 'image-fills': out = await get('/v1/files/' + key + '/images'); break;
    case 'components':
      out = {
        components: (await get('/v1/files/' + key + '/components')).meta,
        componentSets: (await get('/v1/files/' + key + '/component_sets')).meta,
        styles: (await get('/v1/files/' + key + '/styles')).meta
      };
      break;
    case 'variables':
      out = await get('/v1/files/' + key + '/variables/' + (f.published ? 'published' : 'local'));
      break;
    case 'comments': out = await get('/v1/files/' + key + '/comments'); break;
    case 'dev-resources': out = await get('/v1/files/' + key + '/dev_resources' + q({ node_ids: ids })); break;
    case 'versions': out = await get('/v1/files/' + key + '/versions'); break;
    default: fail('unknown command: ' + cmd + '\n' + HELP);
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch(e => fail(e.message));
