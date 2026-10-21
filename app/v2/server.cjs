'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { GoogleProvider, GitHubProvider, ProviderError, pkcePair } = require('./providers.cjs');
const { validateXlsx } = require('./xlsx-guard.cjs');
const { createAccess } = require('./access.cjs');
const { createScope } = require('./scope.cjs');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8766;
const MAX_BODY = 10 * 1024 * 1024;
const SESSION_TTL = 30 * 60 * 1000;
const OAUTH_TTL = 10 * 60 * 1000;
const LOCAL_CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://server.arcgisonline.com https://*.tile.openstreetmap.org https://*.tile.opentopomap.org https://unpkg.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const EMPTY_FC = () => ({ type: 'FeatureCollection', features: [] });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function safeEqual(a, b) {
  const left = Buffer.from(String(a)); const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return [...new Set(values.map(String))].sort(); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function sanitizeSystem(system) { const result = clone(system); if (result.access) result.access = { type: 'server-session' }; return result; }
function sanitizeFallback(text) { return text.replace(/("accounts"\s*:\s*)\[[\s\S]*?\](\s*\n?\s*})/, '$1[]$2').replace(/"type"\s*:\s*"static-browser-gate"/, '"type": "server-session"'); }

async function readJson(file, fallback = undefined) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return clone(fallback); throw error; }
}
async function atomicJson(file, value) {
  await fsp.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  await fsp.rename(temp, file);
}
function json(res, status, body, headers = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(bytes);
}
function fail(res, status, code, message) { json(res, status, { error: { code, message } }); }
async function bodyJson(req, max = MAX_BODY) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > max) { const error = new Error('Request body is too large'); error.status = 413; throw error; } chunks.push(chunk); }
  if (!length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { const error = new Error('Request body must be valid JSON'); error.status = 400; throw error; }
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(v => v.trim()).filter(Boolean).map(v => { const at = v.indexOf('='); return at < 0 ? [v, ''] : [v.slice(0, at), decodeURIComponent(v.slice(at + 1))]; }));
}
function sessionCookie(id, ttlSeconds) { return `agri_v2_session=${encodeURIComponent(id)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttlSeconds}`; }
function publicSetup(setup) {
  return { completed: Boolean(setup.completed), provinceCodes: setup.provinceCodes || [], mode: setup.mode || '', syncIntervalMinutes: setup.syncIntervalMinutes || 0, driveFolderId: setup.driveFolderId || '', sheetId: setup.sheetId || '', sheetRange: setup.sheetRange || '', githubOwner: setup.githubOwner || '', githubRepo: setup.githubRepo || '', googleClientId: setup.googleClientId || '' };
}
function googleId(value, kind) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_-]+$/.test(text)) return text;
  let url; try { url = new URL(text); } catch { throw Object.assign(new Error(`Invalid ${kind} ID or URL`), { status: 400 }); }
  const match = kind === 'sheet' && url.hostname === 'docs.google.com' ? url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)
    : kind === 'folder' && url.hostname === 'drive.google.com' ? url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/) : null;
  if (!match || url.protocol !== 'https:') throw Object.assign(new Error(`Invalid ${kind} ID or URL`), { status: 400 });
  return match[1];
}
const {provinceCodeOf}=require('./area-codes.cjs');
function validPoint(feature) {
  const c = feature?.geometry?.coordinates;
  return feature?.type === 'Feature' && feature.geometry?.type === 'Point' && Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) && c[0] >= 90 && c[0] <= 110 && c[1] >= 0 && c[1] <= 25 && isObject(feature.properties || {});
}
function defaultStateDir() {
  return process.env.AGRI_STATE_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'AgriRiskMapBurning', 'state');
}

async function createRuntime(options = {}) {
  const appRoot = path.resolve(options.appRoot || path.join(__dirname, '..'));
  const stateDir = path.resolve(options.stateDir || defaultStateDir());
  const host = options.host || DEFAULT_HOST;
  const requestedPort = options.port ?? Number(process.env.PORT || DEFAULT_PORT);
  const now = options.now || (() => Date.now());
  const sessionTtl = options.sessionTtl || SESSION_TTL;
  const systemPath = path.join(appRoot, 'config', 'system.json');
  const provincesPath = path.join(appRoot, 'config', 'provinces.json');
  const [system, provinces] = await Promise.all([readJson(systemPath), readJson(provincesPath)]);
  const provinceSet = new Set(provinces.map(p => String(p.provinceCode)));
  await fsp.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const stateFiles = {
    setup: path.join(stateDir, 'setup.json'), accounts: path.join(stateDir, 'accounts.json'), secrets: path.join(stateDir, 'provider-secrets.json'),
    tokens: path.join(stateDir, 'google-tokens.json'), hotspots: path.join(stateDir, 'hotspots.json'), inbox: path.join(stateDir, 'inbox.json'), publish: path.join(stateDir, 'github-publish.json')
  };
  let accounts = await readJson(stateFiles.accounts, null);
  if (!accounts) { accounts = clone(system.access?.accounts || []); await atomicJson(stateFiles.accounts, accounts); }
  const access=await createAccess({appRoot,stateDir,seedAccounts:accounts,provinces,now});
  const scopes=await createScope({appRoot,stateFiles,access,provinces});
  let setup = await readJson(stateFiles.setup, { completed: false, provinceCodes: [], mode: '', syncIntervalMinutes: 0 });
  let secrets = await readJson(stateFiles.secrets, {});
  let googleTokens = await readJson(stateFiles.tokens, {});
  let publishState = await readJson(stateFiles.publish, {});
  let scopeRevision = setup.completed ? await boundaryRevision(setup.provinceCodes) : '';
  const sessions = new Map(); const attempts = new Map(); const oauthStates = new Map(); const previewStates = new Map(); const driveMembership = new Map();
  const google = options.googleProvider || new GoogleProvider({ fetchImpl: options.fetchImpl, redirectUri: options.redirectUri || `http://${host}:${requestedPort || DEFAULT_PORT}/api/v2/google/callback` });
  const github = options.githubProvider || new GitHubProvider({ fetchImpl: options.fetchImpl });
  let pollTimer = null; let server; let cloudBusy = false; let syncStatus = { state: 'idle', lastSuccessAt: null, lastError: '' };
  let hotspotWrites = Promise.resolve();

  function listeningPort() { return server?.address()?.port || requestedPort; }
  function expectedAuthority() { return `${host}:${listeningPort()}`; }
  function validateHost(req) { return [expectedAuthority().toLowerCase(),`localhost:${listeningPort()}`].includes(String(req.headers.host || '').toLowerCase()); }
  function validateOrigin(req) { return validateHost(req)&&String(req.headers.origin||'')===`http://${String(req.headers.host).toLowerCase()}`; }
  function getSession(req, touch = true) {
    const id = cookies(req).agri_v2_session; const item = id && sessions.get(id);
    if (!item) return null;
    const actor=access.get(item.accountId);
    if(!actor||actor.status!=='approved'||actor.revision!==item.revision){sessions.delete(id);return null;}
    if (item.expiresAt <= now()) { sessions.delete(id); return null; }
    if (touch) item.expiresAt = now() + sessionTtl;
    return { id, ...item, actor, role:actor.role, username:actor.username };
  }
  function requireSession(req, res, { csrf = false, superadmin = false, allowTemporary = false } = {}) {
    const session = getSession(req);
    if (!session) { fail(res, 401, 'authentication_required', 'Please sign in'); return null; }
    if(session.actor.mustChangePassword&&!allowTemporary){fail(res,428,'password_change_required','กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน');return null;}
    if (superadmin && session.role !== 'superadmin') { fail(res, 403, 'superadmin_required', 'Super Admin access is required'); return null; }
    if (csrf && (!validateOrigin(req) || !safeEqual(req.headers['x-csrf-token'] || '', session.csrf))) { fail(res, 403, 'csrf_rejected', 'Same-origin CSRF validation failed'); return null; }
    return session;
  }
  function status(req) {
    const session = getSession(req, false);
    return { version: 2, accessEdition:true, setup: { ...(session?.role==='superadmin'?publicSetup(setup):{completed:setup.completed,provinceCodes:session?.actor.provinceCode?[session.actor.provinceCode]:[],mode:'single'}), boundaryRevision: scopeRevision }, connections: { google: Boolean(googleTokens.refreshToken), github: Boolean(secrets.githubToken) }, session: session ? session.actor : null, ...(session ? { csrfToken: session.csrf, googleSync: session.role==='superadmin'?syncStatus:undefined } : {}) };
  }
  async function scopedRead(req,producer){
    const initial=getSession(req);if(cookies(req).agri_v2_session&&!initial)throw Object.assign(new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่'),{status:401});
    const result=await producer(await scopes.context(req,initial?.actor));
    if(options.beforeDataResponse)await options.beforeDataResponse();
    if(initial){const current=getSession(req,false);if(!current||current.id!==initial.id||current.actor.revision!==initial.actor.revision)throw Object.assign(new Error('สิทธิ์เปลี่ยนแล้ว ยกเลิกผลข้อมูลเก่า'),{status:401});}
    return result;
  }
  function googleSourceRevision(){return sha256(JSON.stringify([setup.googleClientId,setup.driveFolderId,setup.sheetId,setup.sheetRange,setup.provinceCodes,scopeRevision]));}
  function validateSelection(value, role) {
    const mode = String(value.mode || ''); const codes = unique(Array.isArray(value.provinceCodes) ? value.provinceCodes : []);
    if (!['single', 'subset', 'all'].includes(mode)) throw Object.assign(new Error('Mode must be single, subset, or all'), { status: 400 });
    if (!codes.length || codes.some(code => !provinceSet.has(code))) throw Object.assign(new Error('Select valid province codes'), { status: 400 });
    if (mode === 'single' && codes.length !== 1) throw Object.assign(new Error('Single mode requires exactly one province'), { status: 400 });
    if (mode === 'all' && codes.length !== provinceSet.size) throw Object.assign(new Error(`All mode requires all ${provinceSet.size} provinces`), { status: 400 });
    if (role === 'admin' && (mode !== 'single' || codes.length !== 1)) throw Object.assign(new Error('Admin accounts may configure one province only'), { status: 403 });
    const interval = Number(value.syncIntervalMinutes || 0);
    if (!Number.isInteger(interval) || (interval !== 0 && interval < 15)) throw Object.assign(new Error('Sync interval must be 0 or at least 15 minutes'), { status: 400 });
    return { mode, codes, interval };
  }
  async function activeGoogleToken() {
    if (!googleTokens.refreshToken) throw Object.assign(new Error('Google is not connected'), { status: 409 });
    if (googleTokens.accessToken && Number(googleTokens.expiresAt || 0) > now() + 60000) return googleTokens.accessToken;
    const refreshed = await google.refresh({ clientId: setup.googleClientId, clientSecret: secrets.googleClientSecret, refreshToken: googleTokens.refreshToken });
    googleTokens = { ...googleTokens, accessToken: refreshed.access_token, expiresAt: now() + Number(refreshed.expires_in || 3600) * 1000 };
    await atomicJson(stateFiles.tokens, googleTokens); return googleTokens.accessToken;
  }
  async function syncGoogle() {
    if (cloudBusy) throw Object.assign(new Error('Google operation is already running'), { status: 409 });
    if (!setup.driveFolderId && !setup.sheetId) throw Object.assign(new Error('Configure a Drive folder or Spreadsheet first'), { status: 409 });
    cloudBusy = true; syncStatus = { ...syncStatus, state: 'running', lastError: '' };
    try {
    const accessToken = await activeGoogleToken();
    const [sheets, driveFiles] = await Promise.all([
      google.sheetValues({ accessToken, sheetId: setup.sheetId, range: setup.sheetRange }),
      google.listFolder({ accessToken, folderId: setup.driveFolderId })
    ]);
    driveMembership.clear(); for (const file of driveFiles) driveMembership.set(file.id, file);
    const inbox = { sheets, driveFiles: driveFiles.map(({ id, name, mimeType }) => ({ id, name, mimeType })), syncedAt: new Date(now()).toISOString(), receipt: { id: crypto.randomBytes(24).toString('base64url'), sourceRevision: googleSourceRevision() } };
    await atomicJson(stateFiles.inbox, inbox); return inbox;
    } catch (error) {
      syncStatus = { ...syncStatus, state: 'error', lastError: error.status === 400 ? 'Google ปฏิเสธคำขอ กรุณาตรวจสิทธิ์บัญชีและแหล่งข้อมูล' : 'ตรวจข้อมูล Google ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและลองใหม่' };
      throw error;
    } finally {
      if (syncStatus.state === 'running') syncStatus = { state: 'ready', lastSuccessAt: new Date(now()).toISOString(), lastError: '' };
      cloudBusy = false;
    }
  }
  function schedulePoll() {
    if (pollTimer) clearInterval(pollTimer); pollTimer = null;
    if (setup.syncIntervalMinutes >= 15 && googleTokens.refreshToken) {
      pollTimer = setInterval(() => syncGoogle().catch(() => {}), setup.syncIntervalMinutes * 60000); pollTimer.unref?.();
    }
  }
  async function boundaryRevision(codes) {
    const stamps=[];
    for(const code of codes)for(const name of ['province','districts','subdistricts']){
      const file=path.join(appRoot,'data','boundary',code,name+'.geojson');
      try{const stat=await fsp.stat(file);stamps.push([code,name,stat.size,stat.mtimeMs]);}
      catch{stamps.push([code,name,'missing']);}
    }
    return sha256(JSON.stringify(stamps));
  }
  async function validateBoundaryScope(codes) {
    for(const code of codes)for(const name of ['province','districts','subdistricts']){
      const file=path.join(appRoot,'data','boundary',code,name+'.geojson');let fc;
      try{fc=await readJson(file);}catch{throw Object.assign(new Error(`จังหวัด ${code}: อ่าน ${name}.geojson ไม่ได้ กรุณาตรวจชุดแผนที่ก่อนตั้งค่า`),{status:400});}
      if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||!fc.features.length||
        (name==='province'&&fc.features.length!==1)||fc.features.some(f=>!['Polygon','MultiPolygon'].includes(f.geometry?.type)||provinceCodeOf(f.properties)!==code))
        throw Object.assign(new Error(`จังหวัด ${code}: ${name}.geojson ไม่สมบูรณ์หรือรหัสจังหวัดไม่ตรง`),{status:400});
    }
  }
  async function boundary(code) {
    if (!setup.completed || !setup.provinceCodes.includes(code)) throw Object.assign(new Error('Province is not in the configured scope'), { status: 404 });
    const folder = path.join(appRoot, 'data', 'boundary', code); const layers = {};
    for (const [key, file] of Object.entries({ province: 'province.geojson', district: 'districts.geojson', subdistrict: 'subdistricts.geojson', village: 'villages.geojson' })) layers[key] = await readJson(path.join(folder, file), EMPTY_FC());
    return { provinceCode: code, layers, sources: [] };
  }
  function persistedCodes(fc) {
    // Legacy imports: infer provinces with saved points, never the whole setup scope.
    return unique(Array.isArray(fc?.metadata?.persistedProvinceCodes)
      ? fc.metadata.persistedProvinceCodes : (fc?.features || []).map(f => provinceCodeOf(f.properties)).filter(Boolean));
  }
  function saveHotspots(body, actor) {
    // Serialize read/merge/atomic-write to preserve simultaneous province imports.
    const pending = hotspotWrites.then(async () => {
      const current=access.get(actor.id);if(!current||current.status!=='approved'||current.revision!==actor.revision||current.mustChangePassword)throw Object.assign(new Error('สิทธิ์เปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่'),{status:403});
      if(!body.cloudReceipt)return saveHotspotsNow(body,current);
      if(cloudBusy)throw Object.assign(new Error('Wait for the current Google operation'),{status:409});
      cloudBusy=true;
      try{
        const inbox=await readJson(stateFiles.inbox,{});
        if(!body.cloudReceipt.id||inbox.receipt?.id!==body.cloudReceipt.id||body.cloudReceipt.sourceRevision!==googleSourceRevision()||inbox.receipt.sourceRevision!==googleSourceRevision())throw Object.assign(new Error('Google source or inbox changed; prepare a new QA preview'),{status:409});
        return await saveHotspotsNow(body,current);
      }finally{cloudBusy=false;}
    });
    hotspotWrites = pending.catch(() => {});
    return pending;
  }
  async function saveHotspotsNow(body, actor) {
    const role=actor.role;
    const targets = unique(Array.isArray(body.provinceCodes) ? body.provinceCodes : []);
    if (!targets.length || targets.some(c => !provinceSet.has(c))) throw Object.assign(new Error('Invalid province codes'), { status: 400 });
    if(role!=='superadmin'&&(targets.length!==1||targets[0]!==actor.provinceCode))throw Object.assign(new Error('จังหวัดอยู่นอกสิทธิ์'),{status:403});
    if (!isObject(body.datasets)) throw Object.assign(new Error('datasets must be an object keyed by year'), { status: 400 });
    const incoming = {};
    for (const [year, fc] of Object.entries(body.datasets)) {
      if (!/^\d{4}$/.test(year) || Number(year) < 2400 || Number(year) > 2700 || !fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw Object.assign(new Error(`Invalid hotspot dataset year ${year}`), { status: 400 });
      const metadataYear = fc.metadata?.yearBE ?? fc.metadata?.dataset_year_be ?? fc.metadata?.season_be;
      if (metadataYear !== undefined && String(metadataYear) !== year) throw Object.assign(new Error(`Hotspot metadata year does not match dataset ${year}`), { status: 400 });
      incoming[year] = { ...clone(fc), features: fc.features.map(feature => {
        if (!validPoint(feature)) throw Object.assign(new Error(`Invalid hotspot coordinates in ${year}`), { status: 400 });
        const code = provinceCodeOf(feature.properties); if (!code || !targets.includes(code)) throw Object.assign(new Error(`Hotspot in ${year} is outside the requested provinces`), { status: 400 });
        if(actor.districtCodes?.length&&!actor.districtCodes.includes(scopes.districtOf(feature.properties)))throw Object.assign(new Error('อำเภออยู่นอกสิทธิ์หรือไม่มีรหัสอำเภอ'),{status:403});
        const datasetYear = feature.properties.dataset_year_be ?? feature.properties.season_be;
        if (datasetYear !== undefined && String(datasetYear) !== year) throw Object.assign(new Error(`Hotspot dataset year does not match ${year}`), { status: 400 });
        return {...clone(feature),properties:{...clone(feature.properties),provinceCode:code}};
      }) };
    }
    const saved = await readJson(stateFiles.hotspots, { datasets: {} });
    for (const [year, fc] of Object.entries(incoming)) {
      const previous = saved.datasets[year];
      const old = [...(previous?.features || [])];
      for(const code of targets)if(!persistedCodes(previous).includes(code))old.push(...(await scopes.baseline(code,year)).features);
      const codes = unique([...persistedCodes(previous), ...targets]);
      const updatedAt = new Date(now()).toISOString();
      const imports = { ...(previous?.metadata?.importsByProvince || {}) };
      for (const code of targets) {
        const points = fc.features.filter(f => provinceCodeOf(f.properties) === code);
        const counts = { byDistrict: {}, byTambon: {}, byMonth: {}, byYear: { [year]: points.length } };
        for (const { properties: p } of points) {
          const district = p.__districtCode || p.districtCode || p.__district || p.Amphoe || '(ว่าง)';
          const tambon = p.__tambonCode || p.subdistrictCode || district + '/' + (p.__subdistrict || p.Tambon || '(ว่าง)');
          const month = String(p.acq_date || '').slice(5,7) || '(ว่าง)';
          for (const [key, value] of [['byDistrict',district],['byTambon',tambon],['byMonth',year+'-'+month]]) counts[key][value] = (counts[key][value] || 0) + 1;
        }
        imports[code] = { updatedAt, acceptedPoints: points.length, counts,
          sourceBatchMetadata: clone(fc.metadata || {}) }; // Source batch QA, not this province alone.
      }
      const features = [...old.filter(f => !targets.includes(provinceCodeOf(f.properties))||(actor.districtCodes?.length&&!actor.districtCodes.includes(scopes.districtOf(f.properties)))), ...fc.features];
      saved.datasets[year] = { type: 'FeatureCollection', features, metadata: {
        dataset_year_be: Number(year), persistedProvinceCodes: codes, provinceCodes: codes,
        totalPoints: features.length, importsByProvince: imports, updatedAt
      } };
    }
    const authorized=access.get(actor.id);
    if(!authorized||authorized.status!=='approved'||authorized.revision!==actor.revision||authorized.mustChangePassword)throw Object.assign(new Error('สิทธิ์เปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่'),{status:403});
    await atomicJson(stateFiles.hotspots, saved); return { updatedYears: Object.keys(incoming), provinceCodes: targets };
  }
  function staticAllowed(relative) {
    if (relative.includes('\\') || relative.split('/').some(part => part === '..' || part === '.')) return false;
    const value = relative.replace(/\\/g, '/'); if (!value || value === 'index.html') return true;
    if (value === 'setup.html'||value==='access.html') return true;
    if (/^v2\/(?:setup\.html|setup\.css|setup\.js|client\.js|access\.js|context\.js|context\.css)$/.test(value)) return true;
    if (/^(?:css|js|assets|docs)\//.test(value)) return true;
    if (/^config\/(?:system\.json|provinces\.json|active-province\.json|import-rules\.default\.json|risk-model\.default\.json|fallback\.js)$/.test(value)) return true;
    if(value.startsWith('data/'))return false;
    let match = value.match(/^data\/(?:boundary|hotspot|crop|burnscar)\/(\d{2})\//);
    if (match) return Boolean(setup.completed && setup.provinceCodes.includes(match[1]));
    const legacy = String(system.legacyExampleProvinceCode || '');
    if (setup.completed && setup.provinceCodes.includes(legacy) && /^data\/(?:hotspot\/hotspot_\d{4}\.geojson|crop\/crop_kpt\.geojson|burnscar\/burnscar_kpt\.geojson|risk\/risk_(?:kpt\.geojson|top10_kpt\.csv)|boundary\/(?:operational-province|district_kpt|subdistrict_kpt)\.geojson)$/.test(value)) return true;
    return false;
  }
  async function readStatic(relative) {
    if (!staticAllowed(relative)) return null;
    const file = path.resolve(appRoot, relative || 'index.html');
    if (!(file === appRoot || file.startsWith(appRoot + path.sep))) return null;
    let stat; try { stat = await fsp.lstat(file); } catch { return null; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 50 * 1024 * 1024) return null;
    const real = await fsp.realpath(file); if (!(real === appRoot || real.startsWith(appRoot + path.sep))) return null;
    let bytes = await fsp.readFile(real);
    if(relative==='index.html')bytes=Buffer.from(bytes.toString('utf8').replace('<head>','<head><base href="/">'));
    if (relative === 'config/system.json') bytes = Buffer.from(JSON.stringify(sanitizeSystem(system), null, 2));
    if (relative === 'config/fallback.js') bytes = Buffer.from(sanitizeFallback(bytes.toString('utf8')));
    return { bytes, contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
  }
  async function collectDir(folder, prefix, output) {
    let entries = []; try { entries = await fsp.readdir(folder, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(folder, entry.name), relative = `${prefix}/${entry.name}`.replace(/^\//, '');
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await collectDir(absolute, relative, output);
      else if (entry.isFile()) { const item = await readStatic(relative); if (item) output.push({ path: relative, bytes: item.bytes }); }
    }
  }
  async function deploymentFiles() {
    const files = [];
    for (const single of ['index.html', 'v2/client.js', 'config/import-rules.default.json', 'config/risk-model.default.json']) {
      const item = await readStatic(single); if (item) files.push({ path: single, bytes: item.bytes });
    }
    for (const folder of ['css', 'js', 'assets']) await collectDir(path.join(appRoot, folder), folder, files);
    for (const document of ['docs/multi-province-guide.html', 'docs/risk-assessment-guide-kpp.html', 'docs/risk-assessment-guide-kpp.pdf', 'docs/risk-ranking-assessment-guide-kpp.html', 'docs/risk-ranking-assessment-guide-kpp.pdf']) {
      const item = await readStatic(document); if (item) files.push({ path: document, bytes: item.bytes });
    }
    for (const code of setup.provinceCodes) await collectDir(path.join(appRoot, 'data', 'boundary', code), `data/boundary/${code}`, files);
    const saved = await readJson(stateFiles.hotspots, { datasets: {} });
    const years = unique([...Object.keys(system.provinceDefaults?.hotspotPath || {}), ...Object.keys(saved.datasets || {})]).filter(year => /^\d{4}$/.test(year));
    const publicProvinces = provinces.filter(p => setup.provinceCodes.includes(String(p.provinceCode))).map(original => {
      const code = String(original.provinceCode), province = clone(original);
      province.boundaryPath = { province: `data/boundary/${code}/province.geojson`, district: `data/boundary/${code}/districts.geojson`, subdistrict: `data/boundary/${code}/subdistricts.geojson` };
      province.hotspotPath = Object.fromEntries(years.map(year => [year, `data/hotspot/${code}/hotspot_${year}.geojson`]));
      province.cropPath = `data/crop/${code}/crop.geojson`; province.burnscarPath = `data/burnscar/${code}/burnscar.geojson`;
      return province;
    });
    for (const province of publicProvinces) {
      const code = province.provinceCode;
      for (const year of years) {
        let features = (saved.datasets?.[year]?.features || []).filter(feature => provinceCodeOf(feature.properties) === code);
        if (!features.length && code === String(system.legacyExampleProvinceCode || '')) {
          const legacy = await readJson(path.join(appRoot, 'data', 'hotspot', `hotspot_${year}.geojson`), EMPTY_FC()); features = legacy.features || [];
        }
        files.push({ path: `data/hotspot/${code}/hotspot_${year}.geojson`, bytes: Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }, null, 2)) });
      }
      for (const [kind, source, destination] of [['crop', 'data/crop/crop_kpt.geojson', `data/crop/${code}/crop.geojson`], ['burnscar', 'data/burnscar/burnscar_kpt.geojson', `data/burnscar/${code}/burnscar.geojson`]]) {
        let fc = EMPTY_FC(); if (code === String(system.legacyExampleProvinceCode || '')) fc = await readJson(path.join(appRoot, ...source.split('/')), EMPTY_FC());
        files.push({ path: destination, bytes: Buffer.from(JSON.stringify(fc, null, 2)) });
      }
    }
    const publicSystem = sanitizeSystem(system); publicSystem.defaultProvinceCode = setup.provinceCodes[0] || '';
    const active = { activeProvinceCode: setup.provinceCodes[0] || '' };
    const risk = await readJson(path.join(appRoot, 'config', 'risk-model.default.json'), {}), importRules = await readJson(path.join(appRoot, 'config', 'import-rules.default.json'), {});
    const fallback = `// Generated public deployment config.\nwindow.AGRI_CONFIG_FALLBACK = ${JSON.stringify({ system: publicSystem, provinces: publicProvinces, active, risk, importRules }, null, 2)};\n`;
    files.push({ path: 'config/system.json', bytes: Buffer.from(JSON.stringify(publicSystem, null, 2)) });
    files.push({ path: 'config/provinces.json', bytes: Buffer.from(JSON.stringify(publicProvinces, null, 2)) });
    files.push({ path: 'config/active-province.json', bytes: Buffer.from(JSON.stringify(active, null, 2)) });
    files.push({ path: 'config/fallback.js', bytes: Buffer.from(fallback) });
    const deployment = { version: 2, mode: setup.mode, provinceCodes: setup.provinceCodes };
    files.push({ path: 'config/deployment.json', bytes: Buffer.from(JSON.stringify(deployment, null, 2)) });
    files.push({ path: 'config/v2-scope.json', bytes: Buffer.from(JSON.stringify(publicSetup(setup), null, 2)) });
    files.push({ path: '.agri-risk-map-burning-v2.json', bytes: Buffer.from(JSON.stringify({ version: 2, provinceCodes: setup.provinceCodes }, null, 2)) });
    files.sort((a, b) => a.path.localeCompare(b.path)); return files;
  }
  function describeFiles(files) {
    const manifest = files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: sha256(file.bytes) }));
    const previewHash = sha256(JSON.stringify(manifest)); return { manifest, previewHash, totalBytes: manifest.reduce((n, file) => n + file.bytes, 0) };
  }

  async function handle(req, res) {
    try {
      if (!validateHost(req)) return fail(res, 400, 'invalid_host', 'Invalid loopback Host header');
      const url = new URL(req.url, `http://${expectedAuthority()}`); const route = url.pathname;
      if (req.method === 'GET' && route === '/api/health') return json(res, 200, { service: 'agri-risk-map-burning-v2', version: 2 });
      if (req.method === 'GET' && route === '/api/v2/status') return json(res, 200, status(req));
      if(req.method==='GET'&&route==='/api/v2/areas')return json(res,200,{provinces:provinces.map(p=>({provinceCode:p.provinceCode,provinceNameTH:p.provinceNameTH,slug:String(p.provinceNameEN||p.provinceCode).toLowerCase().replace(/[^a-z0-9]/g,'')})),districts:url.searchParams.get('provinceCode')?await access.districts(url.searchParams.get('provinceCode')):[]});
      if(req.method==='GET'&&route==='/api/v2/notice')return json(res,200,await access.notice());
      if(req.method==='POST'&&['/api/v2/register','/api/v2/registration-status'].includes(route)){
        if(!validateOrigin(req))return fail(res,403,'origin_rejected','คำขอต้องส่งจากระบบนี้');
        const body=await bodyJson(req,16384),key=String(body.submissionKey||'');
        if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))return fail(res,400,'invalid_submission_key','รหัสอ้างอิงไม่ถูกต้อง');
        const limitKey='registration|'+req.socket.remoteAddress,limit=attempts.get(limitKey)||{count:0,since:now()};if(now()-limit.since>900000){limit.count=0;limit.since=now();}if(++limit.count>40)return fail(res,429,'rate_limited','ส่งคำขอบ่อยเกินไป กรุณารอสักครู่');attempts.set(limitKey,limit);
        if(route.endsWith('registration-status'))return json(res,200,access.receipt(key));
        delete body.submissionKey;return json(res,201,await access.register(body,key));
      }
      if(req.method==='POST'&&route==='/api/v2/password/change'){
        const session=requireSession(req,res,{csrf:true,allowTemporary:true});if(!session)return;const body=await bodyJson(req,4096);await access.changePassword(session.actor,body.oldPassword,body.newPassword);sessions.delete(session.id);return json(res,200,{ok:true},{'set-cookie':sessionCookie('',0)});
      }
      if(req.method==='GET'&&route==='/api/v2/users'){const session=requireSession(req,res);if(!session)return;return json(res,200,access.list(session.actor));}
      const userAction=route.match(/^\/api\/v2\/users\/([A-Za-z0-9-]+)\/(decision|reset-password|assignment)$/);
      if(req.method==='POST'&&userAction){const session=requireSession(req,res,{csrf:true});if(!session)return;const body=await bodyJson(req,8192);return json(res,200,await (userAction[2]==='decision'?access.decide(session.actor,userAction[1],body):userAction[2]==='assignment'?access.assign(session.actor,userAction[1],body):access.resetPassword(session.actor,userAction[1])));}
      if(req.method==='POST'&&route==='/api/v2/publication'){
        const session=requireSession(req,res,{csrf:true,superadmin:true});if(!session)return;const body=await bodyJson(req,8192);const codes=body.provinceCodes,years=body.years;
        if(!Array.isArray(codes)||codes.some(c=>!provinceSet.has(c))||!Array.isArray(years)||years.some(y=>!Number.isInteger(y)||y<2400||y>2700))return fail(res,400,'invalid_policy','จังหวัดหรือปีเผยแพร่ไม่ถูกต้อง');
        await atomicJson(path.join(stateDir,'publication.json'),{publicProvinceCodes:unique(codes),publishedYears:[...new Set(years)]});return json(res,200,{ok:true});
      }
      if(req.method==='GET'&&route==='/api/v2/context'){
        const ctx=await scopedRead(req,async ctx=>ctx);return json(res,200,{...ctx,cacheKey:scopes.cacheKey(ctx),provinceNameTH:provinces.find(p=>p.provinceCode===ctx.provinceCode)?.provinceNameTH||'ประเทศไทย'});
      }
      if(req.method==='GET'&&route==='/api/v2/data')return json(res,200,await scopedRead(req,ctx=>scopes.data(ctx,url.searchParams.get('path')||'')));
      if(req.method==='GET'&&route==='/api/v2/export'){
        const data=await scopedRead(req,ctx=>scopes.hotspots(ctx));return json(res,200,data,{'content-disposition':'attachment; filename="hotspots-scoped.json"'});
      }
      if((route.startsWith('/api/v2/google/')||route==='/api/v2/inbox')&&!route.endsWith('/callback')){const session=requireSession(req,res,{csrf:req.method==='POST',superadmin:true});if(!session)return;}
      if (req.method === 'POST' && route === '/api/v2/login') {
        if (!validateOrigin(req)) return fail(res, 403, 'origin_rejected', 'Login must originate from this application');
        const body = await bodyJson(req, 16 * 1024); const key = `${req.socket.remoteAddress}|${String(body.username || '').toLowerCase()}`; const record = attempts.get(key) || { count: 0, since: now() };
        if (now() - record.since > 15 * 60000) { record.count = 0; record.since = now(); }
        if (record.count >= 5) return fail(res, 429, 'rate_limited', 'Too many sign-in attempts');
        let account;try{account=await access.authenticate(String(body.username||''),String(body.password||''));}catch(error){record.count++;attempts.set(key,record);return fail(res,error.status||401,'login_rejected',error.message);}
        await access.record(account,'session.login',account.id);
        const previousSession=cookies(req).agri_v2_session;if(previousSession)sessions.delete(previousSession);
        attempts.delete(key); const id = crypto.randomBytes(32).toString('base64url'); const csrf = crypto.randomBytes(32).toString('base64url');
        sessions.set(id, { accountId:account.id,revision:account.revision, username: account.username, role: account.role, csrf, expiresAt: now() + sessionTtl });
        return json(res, 200, { session: account, csrfToken: csrf }, { 'set-cookie': sessionCookie(id, Math.floor(sessionTtl / 1000)) });
      }
      if (req.method === 'POST' && route === '/api/v2/logout') {
        const session = requireSession(req, res, { csrf: true,allowTemporary:true }); if (!session) return; sessions.delete(session.id);
        await access.record(session.actor,'session.logout',session.actor.id);
        return json(res, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0),'clear-site-data':'"cache", "storage"' });
      }
      if (req.method === 'POST' && route === '/api/v2/setup') {
        const session = requireSession(req, res, { csrf: true,superadmin:true }); if (!session) return; const body = await bodyJson(req); const selection = validateSelection(body, session.role);
        if (cloudBusy) return fail(res, 409, 'google_busy', 'Wait for the current Google operation before changing settings');
        cloudBusy=true;
        try {
        if (!options.enableGitHub && (body.githubOwner || body.githubRepo || body.githubToken)) return fail(res, 409, 'feature_disabled', 'GitHub settings are reserved for Round 5');
        body.driveFolderId = googleId(body.driveFolderId ?? setup.driveFolderId, 'folder');
        body.sheetId = googleId(body.sheetId ?? setup.sheetId, 'sheet');
        if (String(body.sheetRange ?? setup.sheetRange ?? '').length > 200) return fail(res, 400, 'invalid_range', 'Sheets range is too long');
        await validateBoundaryScope(selection.codes);
        const nextSetup = { completed: true, mode: selection.mode, provinceCodes: selection.codes, syncIntervalMinutes: body.syncIntervalMinutes===undefined?(setup.syncIntervalMinutes||0):selection.interval, driveFolderId: String(body.driveFolderId ?? setup.driveFolderId ?? '').trim(), sheetId: String(body.sheetId ?? setup.sheetId ?? '').trim(), sheetRange: String(body.sheetRange ?? setup.sheetRange ?? '').trim(), githubOwner: session.role === 'superadmin' ? String(body.githubOwner ?? setup.githubOwner ?? '').trim() : String(setup.githubOwner || ''), githubRepo: session.role === 'superadmin' ? String(body.githubRepo ?? setup.githubRepo ?? '').trim() : String(setup.githubRepo || ''), googleClientId: String(body.googleClientId ?? setup.googleClientId ?? '').trim() };
        const clientChanged = nextSetup.googleClientId !== (setup.googleClientId || '') || (body.googleClientSecret !== undefined && String(body.googleClientSecret) !== (secrets.googleClientSecret || ''));
        const sourceChanged = clientChanged || ['driveFolderId','sheetId','sheetRange'].some(key => nextSetup[key] !== (setup[key] || '')) || JSON.stringify(nextSetup.provinceCodes) !== JSON.stringify(setup.provinceCodes);
        if (sourceChanged) { driveMembership.clear(); oauthStates.clear(); await atomicJson(stateFiles.inbox, { sheets: null, driveFiles: [], syncedAt: null }); syncStatus = { state: 'idle', lastSuccessAt: null, lastError: '' }; }
        if (clientChanged) { googleTokens = {}; await atomicJson(stateFiles.tokens, googleTokens); }
        if (body.googleClientSecret !== undefined) secrets.googleClientSecret = String(body.googleClientSecret || '');
        if (body.githubToken !== undefined && session.role === 'superadmin') secrets.githubToken = String(body.githubToken || '');
        await Promise.all([atomicJson(stateFiles.setup, nextSetup), atomicJson(stateFiles.secrets, secrets)]); setup=nextSetup; scopeRevision=await boundaryRevision(setup.provinceCodes); schedulePoll(); return json(res, 200, { setup: publicSetup(setup) });
        } finally { cloudBusy=false; }
      }
      if (req.method === 'GET' && route === '/api/v2/boundaries') {
        const code = String(url.searchParams.get('provinceCode') || ''); return json(res, 200, await scopedRead(req,ctx=>scopes.boundaries(ctx,code)));
      }
      if (req.method === 'GET' && route === '/api/v2/hotspots') return json(res,200,await scopedRead(req,ctx=>scopes.hotspots(ctx)));
      if (req.method === 'POST' && route === '/api/v2/hotspots') {
        const session = requireSession(req, res, { csrf: true }); if (!session) return; const result=await saveHotspots(await bodyJson(req), session.actor);await access.record(session.actor,'hotspots.import',result.provinceCodes.join(',')+'/'+result.updatedYears.join(','));return json(res,200,result);
      }
      if (req.method === 'POST' && route === '/api/v2/google/source') {
        const session=requireSession(req,res,{csrf:true});if(!session)return;
        const body=await bodyJson(req,4096);
        if(!setup.completed)return fail(res,409,'setup_required','Configure the map province scope first');
        const sheetId=googleId(body.sheetUrl,'sheet'),sheetRange=String(body.sheetRange||'AllData!A:AZ').trim();
        if(!sheetId||!sheetRange||sheetRange.length>200)return fail(res,400,'invalid_source','Specify a Google Sheets URL and a range up to 200 characters');
        if(cloudBusy)return fail(res,409,'google_busy','Wait for the current Google operation');
        cloudBusy=true;
        try{
          const changed=sheetId!==setup.sheetId||sheetRange!==setup.sheetRange;
          const nextSetup={...setup,sheetId,sheetRange};
          await atomicJson(stateFiles.setup,nextSetup);setup=nextSetup;
          if(changed){
            driveMembership.clear();oauthStates.clear();
            await atomicJson(stateFiles.inbox,{sheets:null,driveFiles:[],syncedAt:null});
            syncStatus={state:'idle',lastSuccessAt:null,lastError:''};
          }
          return json(res,200,{setup:publicSetup(setup)});
        }finally{cloudBusy=false;}
      }
      if (req.method === 'POST' && route === '/api/v2/google/start') {
        const session = requireSession(req, res, { csrf: true }); if (!session) return; if (!setup.googleClientId || !secrets.googleClientSecret) return fail(res, 409, 'google_not_configured', 'Configure Desktop OAuth Client ID and Client Secret first');
        if (cloudBusy) return fail(res, 409, 'google_busy', 'Google operation is already running');
        google.redirectUri = `http://${host}:${listeningPort()}/api/v2/google/callback`;
        // Only one outstanding request per session; remove expired requests.
        for (const [key, item] of oauthStates) if (item.sessionId === session.id || item.expiresAt <= now()) oauthStates.delete(key);
        const state = crypto.randomBytes(32).toString('base64url'); const pair = pkcePair(); oauthStates.set(state, { sessionId: session.id, verifier: pair.verifier, expiresAt: now() + OAUTH_TTL });
        return json(res, 200, { url: google.buildAuthorizationUrl({ clientId: setup.googleClientId, state, codeChallenge: pair.challenge }) });
      }
      if (req.method === 'GET' && route === '/api/v2/google/callback') {
        const state = String(url.searchParams.get('state') || ''), code = String(url.searchParams.get('code') || ''), item = oauthStates.get(state);
        // SameSite=Strict cookie is absent on Google's cross-site return. Bind the
        // single-use state + PKCE to the still-live initiating session instead.
        const session = item && sessions.get(item.sessionId);
        const oauthActor=session&&access.get(session.accountId);
        if (!item || !session || !oauthActor || oauthActor.status!=="approved" || oauthActor.role!=="superadmin" || oauthActor.revision!==session.revision || oauthActor.mustChangePassword || session.expiresAt <= now() || item.expiresAt <= now()) { oauthStates.delete(state); return fail(res, 400, 'oauth_state_rejected', 'OAuth state is invalid or expired'); }
        if (cloudBusy) return fail(res, 409, 'google_busy', 'Google operation is already running; retry this callback after it finishes');
        oauthStates.delete(state);
        if (url.searchParams.has('error')) { res.writeHead(302, { location: '/setup.html?google=denied', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }); return res.end(); }
        if (!code) return fail(res, 400, 'oauth_code_missing', 'Google did not return an authorization code');
        cloudBusy = true;
        try {
        const token = await google.exchangeCode({ clientId: setup.googleClientId, clientSecret: secrets.googleClientSecret, code, codeVerifier: item.verifier });
        const nextTokens = { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: now() + Number(token.expires_in || 3600) * 1000 };
        if (!nextTokens.refreshToken) return fail(res, 400, 'refresh_token_missing', 'Google did not return offline access; reconnect and grant consent');
        const liveActor=access.get(session.accountId); if(!sessions.has(item.sessionId)||!liveActor||liveActor.status!=="approved"||liveActor.revision!==session.revision) return fail(res,401,"session_expired","Session changed during Google connection");
        await atomicJson(stateFiles.tokens, nextTokens); googleTokens = nextTokens; schedulePoll(); res.writeHead(302, { location: '/setup.html?google=connected', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }); return res.end();
        } finally { cloudBusy = false; }
      }
      if (req.method === 'POST' && route === '/api/v2/google/disconnect') {
        const session = requireSession(req, res, { csrf: true }); if (!session) return;
        if (cloudBusy) return fail(res, 409, 'google_busy', 'Wait for the current Google operation');
        cloudBusy=true;
        try {
        await atomicJson(stateFiles.tokens, {}); googleTokens = {}; oauthStates.clear(); driveMembership.clear(); schedulePoll();
        await atomicJson(stateFiles.inbox, { sheets: null, driveFiles: [], syncedAt: null }); syncStatus = { state: 'idle', lastSuccessAt: null, lastError: '' };
        return json(res, 200, { ok: true });
        } finally { cloudBusy=false; }
      }
      if (req.method === 'POST' && route === '/api/v2/google/sync') {
        const session = requireSession(req, res, { csrf: true }); if (!session) return; return json(res, 200, await syncGoogle());
      }
      if (req.method === 'GET' && route === '/api/v2/google/file') {
        const session = requireSession(req, res); if (!session) return; const id = String(url.searchParams.get('id') || ''), file = driveMembership.get(id);
        if (!file) return fail(res, 404, 'file_not_listed', 'File is not in the latest direct-folder listing');
        if (cloudBusy) return fail(res, 409, 'google_busy', 'Google operation is already running');
        cloudBusy = true; let download;
        try { const accessToken = await activeGoogleToken(); download = await google.downloadFile({ accessToken, id, maxBytes: 20 * 1024 * 1024 }); if (/\.xlsx$/i.test(file.name)) validateXlsx(download.bytes); } finally { cloudBusy = false; }
        res.writeHead(200, { 'content-type': download.contentType, 'content-length': download.bytes.length, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); return res.end(download.bytes);
      }
      if (req.method === 'GET' && route === '/api/v2/inbox') {
        const session = requireSession(req, res); if (!session) return; return json(res, 200, await readJson(stateFiles.inbox, { sheets: null, driveFiles: [], syncedAt: null }));
      }
      if (req.method === 'POST' && route === '/api/v2/github/preview') {
        if (!options.enableGitHub) return fail(res, 409, 'feature_disabled', 'GitHub/Pages is reserved for Round 5');
        const session = requireSession(req, res, { csrf: true }); if (!session) return; if (!setup.completed || !setup.githubOwner || !setup.githubRepo) return fail(res, 409, 'github_not_configured', 'GitHub destination is not configured');
        const files = await deploymentFiles(); const info = describeFiles(files); previewStates.set(session.id, { hash: info.previewHash, expiresAt: now() + 10 * 60000 });
        return json(res, 200, { files: info.manifest, totalBytes: info.totalBytes, previewHash: info.previewHash, repository: `${setup.githubOwner}/${setup.githubRepo}`, branch: 'agri-risk-pages', pages: { mode: 'branch', path: '/' } });
      }
      if (req.method === 'POST' && route === '/api/v2/github/publish') {
        if (!options.enableGitHub) return fail(res, 409, 'feature_disabled', 'GitHub/Pages is reserved for Round 5');
        const session = requireSession(req, res, { csrf: true, superadmin: true }); if (!session) return; const body = await bodyJson(req, 64 * 1024); const preview = previewStates.get(session.id);
        if (body.confirm !== true || !preview || preview.expiresAt <= now() || !safeEqual(body.previewHash || '', preview.hash)) return fail(res, 409, 'preview_required', 'Create and confirm a current deployment preview');
        if (!secrets.githubToken) return fail(res, 409, 'github_token_missing', 'GitHub token is not configured'); const files = await deploymentFiles(); const current = describeFiles(files);
        if (!safeEqual(current.previewHash, preview.hash)) return fail(res, 409, 'preview_changed', 'Deployment files changed after preview');
        const key = `${setup.githubOwner}/${setup.githubRepo}`.toLowerCase(); const result = await github.publish({ token: secrets.githubToken, owner: setup.githubOwner, repo: setup.githubRepo, files, previousCommit: publishState[key]?.commitSHA || null });
        publishState[key] = { commitSHA: result.commitSHA, publishedAt: new Date(now()).toISOString(), previewHash: current.previewHash }; await atomicJson(stateFiles.publish, publishState); previewStates.delete(session.id);
        return json(res, 200, { deployURL: result.deployURL, commitSHA: result.commitSHA, audit: { repository: result.repository, branch: 'agri-risk-pages', fileCount: files.length, totalBytes: current.totalBytes, publishedAt: publishState[key].publishedAt } });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method_not_allowed', 'Method not allowed');
      let relative; try { relative = decodeURIComponent(route).replace(/^\/+/, '') || 'index.html'; } catch { return fail(res, 400, 'bad_path', 'Invalid path encoding'); }
      if(/^\/[a-z0-9-]+\/$/.test(route)&&provinces.some(p=>('/'+String(p.provinceNameEN||p.provinceCode).toLowerCase().replace(/[^a-z0-9]/g,'')+'/')===route))relative='index.html';
      if (relative.includes('\0') || relative.includes('\\') || relative.split('/').some(part=>part==='..'||part==='.')) return fail(res, 400, 'bad_path', 'Invalid path'); const item = await readStatic(relative);
      if (!item) return fail(res, 404, 'not_found', 'Not found'); res.writeHead(200, { 'content-type': item.contentType, 'content-length': item.bytes.length, 'cache-control': relative === 'index.html' || relative.startsWith('v2/') ? 'no-store' : 'public, max-age=300', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'content-security-policy': LOCAL_CSP }); return req.method === 'HEAD' ? res.end() : res.end(item.bytes);
    } catch (error) {
      const status = Number(error.status || (error instanceof ProviderError ? error.status : 500)); const message = status >= 500 ? 'The local service could not complete the request' : error.message;
      if (!res.headersSent) fail(res, status, error.code || (status >= 500 ? 'internal_error' : 'invalid_request'), message); else res.destroy();
    }
  }

  server = http.createServer(handle);
  return {
    server, appRoot, stateDir,
    async listen() { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(requestedPort, host, () => { server.off('error', reject); resolve(); }); }); schedulePoll(); return server.address(); },
    async close() { if (pollTimer) clearInterval(pollTimer); sessions.clear(); await new Promise(resolve => server.listening ? server.close(resolve) : resolve()); },
    get url() { return `http://${host}:${listeningPort()}`; },
    _test: { sessions, oauthStates, driveMembership, syncGoogle, deploymentFiles, status }
  };
}

if (require.main === module) {
  createRuntime().then(async runtime => { const address = await runtime.listen(); console.log(`Agri-Risk Map Burning V2 listening on http://${address.address}:${address.port}`); }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { createRuntime, sanitizeSystem, sanitizeFallback, provinceCodeOf, validPoint, sha256 };
