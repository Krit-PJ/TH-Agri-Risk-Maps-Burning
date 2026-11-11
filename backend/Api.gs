/* ============================== PUBLIC DATA API v1 (อ่านอย่างเดียว) ==============================
 * GET <web app>/exec?action=api&fn=<fn>&...   เอกสาร: docs/API.md
 *   fn=meta                                       ข้อมูลระบบ เวอร์ชัน สูตรที่ใช้ ช่วงข้อมูล และรายการ endpoint
 *   fn=provinces                                  จังหวัดที่มีข้อมูล (จำนวนจุดพื้นที่เกษตร ช่วงวันที่)
 *   fn=risk&province=62[&level=subdistrict|district][&model=M5|M4|BRI2][&land=][&end=YYYY-MM-DD][&format=json|csv][&key=]
 *   fn=hotspots&province=62[&land=][&from=][&to=][&format=json|csv]
 * ไม่มี key: ระดับความเสี่ยง (4 ระดับ) + จำนวนจุดฤดูปัจจุบัน · มี key ที่ออกโดยผู้ดูแล: คะแนน 0–100 องค์ประกอบ และเหตุผล
 * key เก็บใน Script Properties (API_KEYS) — ออก/ดู/ยกเลิกจาก Editor: createApiKey('ชื่อหน่วยงาน'), listApiKeys(), revokeApiKey('key')
 * ผลลัพธ์เป็นข้อมูลล่าสุดในฐานข้อมูลเสมอ (แคชจะถูกล้างทันทีเมื่อมีการนำเข้า/เปิด-ปิดชุดข้อมูล/เปลี่ยนตั้งค่า) */
const API_VERSION = '1.1';   // 1.1 (v3.8): Model 5 เป็นค่าเริ่มต้น · meta มี model5, dataMonths, satellitePolicy
const API_DOCS = 'https://github.com/Krit-PJ/TH-Agri-Risk-Maps-Burning/blob/main/docs/API.md';

function apiKeys_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('API_KEYS') || '{}'); } catch (e) { return {}; } }
function apiKeyName_(k) { const s = String(k || ''); if (!/^[a-f0-9]{32}$/.test(s)) return ''; const m = apiKeys_()[s]; return m ? m.name : ''; }

function apiGet_(p) {
  const fn = String(p.fn || 'meta').toLowerCase(), fmt = String(p.format || 'json').toLowerCase() === 'csv' ? 'csv' : 'json';
  const keyName = apiKeyName_(p.key), detailed = !!keyName;
  const base = { ok: true, api: 'TH Agri-Risk Map Burning', apiVersion: API_VERSION, generatedAt: Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ssXXX"), docs: API_DOCS };
  if (p.key && !keyName) return apiOut_(Object.assign(base, { ok: false, error: 'invalid key' }), 'json');
  switch (fn) {
    case 'meta': {
      const range = dataRange_(), prov = publicProvinces_();
      return apiOut_(Object.assign(base, {
        activeModel: riskModel_(), models: RISK_MODEL_LABELS,
        model5: { version: M5_VERSION, cuts: M5_CUTS, weights: M5_W, minHotspots: M5_MIN_HS, gridM: M5_GRID_M, maxYears: M5_MAX_YEARS, defaultEnd: m5DefaultEnd_() },
        satellitePolicy: SAT_POLICY_TEXT, dataMonths: dataMonths_(), model4: { version: M4_BASE.version, baseSeasons: M4_BASE.baseSeasons, satellite: M4_BASE.satellite, gridM: M4_BASE.gridM, cuts: M4_CUTS },
        source: hsSource_(), data: { first: range.first, last: range.last, provinces: prov.length },
        landTypes: LAND_TYPES, defaultLand: DEFAULT_LAND, levels: RISK_LEVEL_LABELS, detailed: detailed,
        endpoints: ['fn=meta', 'fn=provinces', 'fn=risk&province=XX&level=subdistrict|district&model=M5|M4|BRI2&land=&end=&format=json|csv&key=', 'fn=hotspots&province=XX&land=&from=&to=&format=json|csv'] }), 'json');
    }
    case 'provinces': {
      const rows = publicProvinces_().map(r => ({ code: r.code, name: r.name, hsAgri: r.count, first: r.first, last: r.last, updatedAt: r.updatedAt }));
      return fmt === 'csv' ? apiCsv_(['code', 'name', 'hsAgri', 'first', 'last', 'updatedAt'], rows.map(r => [r.code, r.name, r.hsAgri, r.first, r.last, r.updatedAt]))
        : apiOut_(Object.assign(base, { rows: rows }), 'json');
    }
    case 'risk': {
      const prov = String(p.province || '').padStart(2, '0');
      if (!PROVINCES[prov]) return apiOut_(Object.assign(base, { ok: false, error: 'province required (2-digit code)' }), 'json');
      const level = String(p.level || 'subdistrict') === 'district' ? 'district' : 'subdistrict';
      const model = String(p.model || '').toUpperCase() === 'PROTO' ? '' : p.model;   // Model 1 คำนวณที่หน้าเว็บ ไม่ให้บริการผ่าน API
      const r = riskForProvince_(prov, p.end, detailed, p.land, model);
      if (!r.ok || r.empty) return apiOut_(Object.assign(base, { ok: !!r.ok, empty: true, province: prov }), 'json');
      if (r.model === 'PROTO') return apiOut_(Object.assign(base, { ok: false, error: 'active model is Model 1 (computed in the web page); request model=M4 or model=BRI2' }), 'json');
      const names = geoNames_(), units = r[level] || {}, cols = level === 'district' && r.distCols ? r.distCols : r.cols;
      const header = ['code', 'name', 'districtCode', 'district', 'levelIndex', 'level'].concat(cols.filter(c => c !== 'level'));
      const rows = Object.keys(units).sort().map(c => {
        const u = units[c], o = { code: c, name: (level === 'district' ? names.district[c] : names.subdistrict[c]) || '', districtCode: c.slice(0, 4), district: names.district[c.slice(0, 4)] || '',
          levelIndex: u[0], level: u[0] >= 0 ? RISK_LEVEL_LABELS[u[0]] : 'ไม่ประเมิน' };
        cols.forEach((k, i) => { if (k !== 'level') o[k] = u[i]; });
        return o;
      });
      if (fmt === 'csv') return apiCsv_(header, rows.map(o => header.map(h => o[h])));
      return apiOut_(Object.assign(base, {
        province: prov, provinceName: PROVINCES[prov], level: level, model: r.model, modelLabel: RISK_MODEL_LABELS[r.model] || r.model, modelVersion: r.modelVersion || '',
        fallback: r.fallback || '', land: r.land, months: r.months || null, monthsText: r.monthsText || '', source: r.source, season: r.season, history: r.history || [], end: r.end, latest: r.latest,
        currentWindow: r.window || null, detailed: detailed, columns: header, rows: rows,
        note: 'คะแนนเป็นลำดับเชิงเปรียบเทียบสำหรับจัดลำดับการเฝ้าระวัง ไม่ใช่ความน่าจะเป็นการเผา' }), 'json');
    }
    case 'hotspots': {
      const h = publicHotspots_(String(p.province || ''), p.land);
      if (!h.ok) return apiOut_(Object.assign(base, h), 'json');
      const from = String(p.from || ''), to = String(p.to || ''), names = geoNames_();
      const rows = h.rows.filter(r => (!from || r[0] >= from) && (!to || r[0] <= to));
      const header = ['date', 'time', 'districtCode', 'district', 'subdistrictCode', 'subdistrict', 'village', 'plantType', 'landType', 'lat', 'lng'];
      const out = rows.map(r => [r[0], r[1], r[2], r[4] || names.district[r[2]] || '', r[3], r[5] || names.subdistrict[r[3]] || '', r[6], r[7], r[11], r[8], r[9]]);
      if (fmt === 'csv') return apiCsv_(header, out);
      return apiOut_(Object.assign(base, { province: h.province, source: h.source, land: h.land, from: from, to: to, count: out.length, columns: header, rows: out }), 'json');
    }
    default: return apiOut_(Object.assign(base, { ok: false, error: 'unknown fn' }), 'json');
  }
}
function apiOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function apiCsv_(header, rows) {
  const esc = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const txt = '﻿' + [header].concat(rows).map(r => r.map(esc).join(',')).join('\r\n');
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.CSV);
}

/* ---------- จัดการ API key (เรียกจาก Apps Script Editor) ---------- */
function createApiKey(name) {
  const n = String(name || '').trim() || 'unnamed';
  const k = Utilities.getUuid().replace(/-/g, '') ;
  const all = apiKeys_(); all[k] = { name: n, created: now_() };
  PropertiesService.getScriptProperties().setProperty('API_KEYS', JSON.stringify(all));
  audit_({ sub: 'EDITOR', role: 'system', prov: '' }, 'api_key_create', n);
  Logger.log('API key for ' + n + ': ' + k); return k;
}
function listApiKeys() { const all = apiKeys_(); Object.keys(all).forEach(k => Logger.log(k.slice(0, 6) + '… ' + all[k].name + ' ' + all[k].created)); return Object.keys(all).length; }
function revokeApiKey(k) { const all = apiKeys_(); const n = all[k] ? all[k].name : ''; delete all[k]; PropertiesService.getScriptProperties().setProperty('API_KEYS', JSON.stringify(all)); audit_({ sub: 'EDITOR', role: 'system', prov: '' }, 'api_key_revoke', n); return !!n; }
