#!/usr/bin/env node
'use strict';

/*
 * ado-client.js — shared Azure DevOps (ADO) client helpers for the
 * azure-devops skill scripts.
 *
 * Centralizing auth + the work-items REST call here means every script uses
 * one API version and gets the same, more informative, error reporting.
 */

const https    = require('https');
const { execFile } = require('child_process');

/*
 * Single source of truth for the Work Items REST API version.
 *
 * 6.0 is a stable, broadly-deployed version. The 7.1-preview.x line is not
 * available on every tenant and can 404 on requests where 6.0 succeeds, so
 * we standardize on the stable version.
 */
const API_VERSION = '6.0';

/* Build the Authorization header value for a resolved auth object. */
function makeAuthHeader(auth) {
  return auth.type === 'bearer'
    ? 'Bearer ' + auth.token
    : 'Basic ' + Buffer.from(':' + auth.token).toString('base64');
}

/*
 * Resolve credentials, preferring a Personal Access Token from the
 * environment, then falling back to an Azure CLI bearer token.
 * Returns { token, type: 'pat' | 'bearer' }.
 */
function getAuth() {
  var pat = process.env.AZURE_DEVOPS_EXT_PAT || process.env.ADO_TOKEN;
  if (pat) return Promise.resolve({ token: pat, type: 'pat' });

  var scope = 'https://app.vssps.visualstudio.com/.default';
  return new Promise(function (ok, no) {
    execFile('az', ['account', 'get-access-token', '-o', 'json', '--scope', scope],
      { timeout: 10000 },
      function (er, out, sd) {
        if (er || !out || out.trim().length < 40) return no(sd || 'Azure CLI not available');
        try {
          var d = JSON.parse(out), t = d.access_token || d.accessToken;
          if (t && t.startsWith('eyJ')) return ok({ token: t, type: 'bearer' });
        } catch (e) { /* fall through to error */ }
        return no('No Azure token');
      });
  }).catch(function () {
    throw new Error('Authentication failed: no PAT env var set and Azure CLI bearer token unavailable');
  });
}

/*
 * GET a JSON API endpoint on dev.azure.com.
 *
 * On a non-2xx response the server's error body is folded into the thrown
 * message, so callers surface the *real* cause instead of a bare status code.
 */
function jsonFetch(path, auth, opts) {
  opts = opts || {};
  return new Promise(function (ok, no) {
    var req = https.get({
      hostname: opts.hostname || 'dev.azure.com',
      path: path,
      headers: {
        Accept: 'application/json',
        Authorization: makeAuthHeader(auth)
      }
    }, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { ok(JSON.parse(body)); }
          catch (e) { no(new Error('Invalid JSON in response: ' + e.message)); }
        } else {
          var detail = body ? body.slice(0, 500) : '(no response body)';
          no(new Error('HTTP ' + res.statusCode + ' for ' + path + ' — ' + detail));
        }
      });
    });
    req.on('error', function (e) { no(e); });
  });
}

module.exports = {
  API_VERSION: API_VERSION,
  makeAuthHeader: makeAuthHeader,
  getAuth: getAuth,
  jsonFetch: jsonFetch
};
