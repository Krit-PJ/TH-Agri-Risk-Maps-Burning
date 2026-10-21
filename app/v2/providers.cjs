'use strict';

const crypto = require('node:crypto');

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_SHEETS = 'https://sheets.googleapis.com/v4';
const GITHUB_API = 'https://api.github.com';

class ProviderError extends Error {
  constructor(message, status = 502, code = 'provider_error') {
    super(redact(message));
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
  }
}

function redact(value) {
  return String(value || 'Provider request failed')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:access_token|refresh_token|client_secret|code)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/("(?:access_token|refresh_token|client_secret|token)"\s*:\s*")[^"]+/gi, '$1[REDACTED]');
}

async function fetchWithTimeout(fetchImpl, url, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new ProviderError(error?.name === 'AbortError' ? 'Provider request timed out' : error?.message);
  } finally {
    clearTimeout(timer);
  }
}

async function limitedBytes(response, maxBytes = 10 * 1024 * 1024) {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = []; let size = 0; let timeout;
  const deadline = new Promise((_, reject) => { timeout = setTimeout(() => { reject(new ProviderError('Google response timed out')); reader.cancel().catch(() => {}); }, 15000); timeout.unref?.(); });
  try {
    if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new ProviderError('Google response exceeds size limit', 413, 'file_too_large');
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new ProviderError('Google response exceeds size limit', 413, 'file_too_large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { clearTimeout(timeout); reader.cancel().catch(() => {}); reader.releaseLock(); }
}

async function responseJson(response, context) {
  const text = (await limitedBytes(response)).toString('utf8');
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { throw new ProviderError(`${context}: invalid JSON response`); }
  if (!response.ok) {
    const detail = body?.error?.message || body?.error_description || body?.message || `${response.status}`;
    throw new ProviderError(`${context}: ${detail}`, response.status >= 400 && response.status < 500 ? 400 : 502);
  }
  return body;
}

class GoogleProvider {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 15000, redirectUri = 'http://127.0.0.1:8766/api/v2/google/callback' } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.redirectUri = redirectUri;
  }

  buildAuthorizationUrl({ clientId, state, codeChallenge }) {
    const url = new URL(GOOGLE_AUTH);
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly'
    }).toString();
    return url.toString();
  }

  async exchangeCode({ clientId, clientSecret, code, codeVerifier }) {
    const response = await fetchWithTimeout(this.fetch, GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, code_verifier: codeVerifier, redirect_uri: this.redirectUri, grant_type: 'authorization_code' })
    }, this.timeoutMs);
    const body = await responseJson(response, 'Google token exchange failed');
    if (!body.access_token) throw new ProviderError('Google token exchange returned no access token');
    return body;
  }

  async refresh({ clientId, clientSecret, refreshToken }) {
    const response = await fetchWithTimeout(this.fetch, GOOGLE_TOKEN, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
    }, this.timeoutMs);
    const body = await responseJson(response, 'Google token refresh failed');
    if (!body.access_token) throw new ProviderError('Google token refresh returned no access token');
    return body;
  }

  async sheetValues({ accessToken, sheetId, range }) {
    if (!sheetId) return null;
    const params = new URLSearchParams({ majorDimension: 'ROWS', valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' });
    const url = `${GOOGLE_SHEETS}/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range || 'A:Z')}?${params}`;
    const response = await fetchWithTimeout(this.fetch, url, { headers: { authorization: `Bearer ${accessToken}` } }, this.timeoutMs);
    const body = await responseJson(response, 'Google Sheets read failed');
    const values = Array.isArray(body.values) ? body.values : [];
    // Keep leading notes/blank rows: the existing AllData parser detects headers.
    return { headers: values[0] || [], rows: values.slice(1) };
  }

  async listFolder({ accessToken, folderId }) {
    if (!folderId) return [];
    const files = [];
    let pageToken = ''; const seen = new Set(); let pages = 0;
    do {
      if (++pages > 20 || seen.has(pageToken)) throw new ProviderError('Drive listing pagination exceeded limit');
      seen.add(pageToken);
      const params = new URLSearchParams({ q: `'${folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' in parents and trashed = false`, fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)', pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetchWithTimeout(this.fetch, `${GOOGLE_DRIVE}/files?${params}`, { headers: { authorization: `Bearer ${accessToken}` } }, this.timeoutMs);
      const body = await responseJson(response, 'Google Drive listing failed');
      for (const file of body.files || []) {
        const name = String(file.name || '');
        if (/\.(?:xlsx|geojson|json)$/i.test(name) && file.mimeType !== 'application/vnd.google-apps.folder') {
          files.push({ id: String(file.id), name, mimeType: String(file.mimeType || 'application/octet-stream'), size: Number(file.size || 0) });
        }
      }
      pageToken = body.nextPageToken || '';
    } while (pageToken);
    return files;
  }

  async downloadFile({ accessToken, id, maxBytes = 50 * 1024 * 1024 }) {
    const response = await fetchWithTimeout(this.fetch, `${GOOGLE_DRIVE}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${accessToken}` } }, this.timeoutMs);
    if (!response.ok) await responseJson(response, 'Google Drive download failed');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new ProviderError('Google Drive file exceeds the download size limit', 413, 'file_too_large');
    const bytes = await limitedBytes(response, maxBytes);
    if (bytes.length > maxBytes) throw new ProviderError('Google Drive file exceeds the download size limit', 413, 'file_too_large');
    return { bytes, contentType: response.headers.get('content-type') || 'application/octet-stream' };
  }
}

class GitHubProvider {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(token, method, path, body, { allow404 = false } = {}) {
    const response = await fetchWithTimeout(this.fetch, `${GITHUB_API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'AgriRiskMapBurning-V2', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body)
    }, this.timeoutMs);
    if (allow404 && response.status === 404) return null;
    return responseJson(response, `GitHub ${method} ${path} failed`);
  }

  async ensureRepository({ token, owner, repo }) {
    let repository = await this.request(token, 'GET', `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, undefined, { allow404: true });
    if (repository) return { repository, created: false };
    const user = await this.request(token, 'GET', '/user');
    if (String(user.login).toLowerCase() !== String(owner).toLowerCase()) throw new ProviderError('Repository creation is limited to the authenticated user account', 403, 'owner_mismatch');
    repository = await this.request(token, 'POST', '/user/repos', { name: repo, private: false, auto_init: false, has_issues: false, has_projects: false, has_wiki: false });
    return { repository, created: true };
  }

  async publish({ token, owner, repo, branch = 'agri-risk-pages', files, previousCommit = null }) {
    const { repository, created } = await this.ensureRepository({ token, owner, repo });
    if (!created && !previousCommit) {
      const defaultRef = await this.request(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(repository.default_branch || 'main')}`, undefined, { allow404: true });
      if (defaultRef) throw new ProviderError('Refusing to publish into an existing non-empty repository', 409, 'repository_not_empty');
    }
    let current = await this.request(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, undefined, { allow404: true });
    const currentSha = current?.object?.sha || null;
    if (currentSha && !previousCommit) throw new ProviderError('Refusing to overwrite an existing non-empty deployment branch', 409, 'repository_not_owned');
    if (currentSha && currentSha !== previousCommit) throw new ProviderError('Deployment branch changed since the previous publish', 409, 'branch_changed');
    const blobs = [];
    for (const file of files) {
      if (file.bytes.length > 50 * 1024 * 1024) throw new ProviderError(`File is too large for GitHub: ${file.path}`, 413, 'file_too_large');
      const blob = await this.request(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, { content: file.bytes.toString('base64'), encoding: 'base64' });
      blobs.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await this.request(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree: blobs });
    const commit = await this.request(token, 'POST', `/repos/${owner}/${repo}/git/commits`, { message: 'Publish Agri-Risk Map Burning', tree: tree.sha, ...(currentSha ? { parents: [currentSha] } : {}) });
    if (currentSha) await this.request(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha, force: false });
    else await this.request(token, 'POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
    const pages = await this.request(token, 'GET', `/repos/${owner}/${repo}/pages`, undefined, { allow404: true });
    if (pages) await this.request(token, 'PUT', `/repos/${owner}/${repo}/pages`, { build_type: 'legacy', source: { branch, path: '/' } });
    else await this.request(token, 'POST', `/repos/${owner}/${repo}/pages`, { build_type: 'legacy', source: { branch, path: '/' } });
    return { created, commitSHA: commit.sha, deployURL: `https://${owner}.github.io/${repo}/`, repository: repository.full_name };
  }
}

function pkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

module.exports = { GoogleProvider, GitHubProvider, ProviderError, fetchWithTimeout, redact, pkcePair };
