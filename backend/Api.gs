/* ============================== PUBLIC DATA API v1.3 (อ่านอย่างเดียว) ==============================
 * GET <web app>/exec?action=api&fn=<fn>&...   เอกสาร: docs/API.md
 *   fn=meta                                       ข้อมูลระบบ เวอร์ชัน สูตรที่ใช้ ช่วงข้อมูล และรายการ endpoint
 *   fn=provinces                                  จังหวัดที่มีข้อมูล (จำนวนจุดพื้นที่เกษตร ช่วงวันที่)
 *   fn=risk&province=62[&level=subdistrict|district][&model=ABRI|M5|M4][&land=][&end=YYYY-MM-DD][&format=json|csv][&key=]
 *   fn=hotspots&province=62[&land=][&from=][&to=][&district=][&subdistrict=][&crop=][&format=json|csv]
 *   fn=compare&province=62[&from=YYYY-MM-DD][&to=YYYY-MM-DD][&level=district|subdistrict][&district=][&subdistrict=][&crop=][&land=][&format=json|csv]
 *       ตาราง “เปรียบเทียบ HS” และการ์ดสรุปเดียวกับหน้าเว็บ (ช่วงเดียวกันปีก่อน · ช่วงที่เลือก · เพิ่ม/ลด · ระดับความเสี่ยง)
 * ทุก fn ใช้ข้อมูลชุดเดียวกับหน้าเว็บ: แหล่งข้อมูลหลัก · ชุดที่เปิดใช้งาน · นโยบายดาวเทียม (hsActive_) · สูตรที่ตั้งค่า · ช่วงเริ่มต้น = ปีงบล่าสุดที่ครบแล้ว
 * ไม่มี key: ระดับความเสี่ยง (4 ระดับ) + จำนวนจุดปีงบปัจจุบัน · มี key ที่ออกโดยผู้ดูแล: คะแนน 0–100 องค์ประกอบ และเหตุผล
 * key เก็บใน Script Properties (API_KEYS) — ออก/ดู/ยกเลิกจาก Editor: createApiKey('ชื่อหน่วยงาน'), listApiKeys(), revokeApiKey('key')
 * ผลลัพธ์เป็นข้อมูลล่าสุดในฐานข้อมูลเสมอ (แคชจะถูกล้างทันทีเมื่อมีการนำเข้า/เปิด-ปิดชุดข้อมูล/เปลี่ยนตั้งค่า) */
const API_VERSION = '1.3';   // 1.3 (v3.9.3): fn=compare (ตารางเปรียบเทียบเดียวกับหน้าเว็บ) · ตัวกรอง district/subdistrict/crop · 1.2: ABRI-2Y ค่าเริ่มต้น
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
        abri: { version: ABRI_VERSION, cuts: ABRI_CUTS, minHotspots: ABRI_MIN_HS, defaultEnd: defaultEnd_(), assessmentYear: defaultEnd_() ? abriYear_(defaultEnd_()) : null },
        model5: { version: M5_VERSION, cuts: M5_CUTS, weights: M5_W, minHotspots: M5_MIN_HS, gridM: M5_GRID_M, maxYears: M5_MAX_YEARS, defaultEnd: defaultEnd_() },
        satellitePolicy: SAT_POLICY_TEXT, dataMonths: dataMonths_(), model4: { version: M4_BASE.version, baseSeasons: M4_BASE.baseSeasons, satellite: M4_BASE.satellite, gridM: M4_BASE.gridM, cuts: M4_CUTS },
        source: hsSource_(), data: { first: range.first, last: range.last, provinces: prov.length },
        landTypes: LAND_TYPES, defaultLand: DEFAULT_LAND, levels: RISK_LEVEL_LABELS, detailed: detailed,
        defaultPeriod: apiDefaultPeriod_(), sameAsWebsite: 'ทุก endpoint ใช้ข้อมูลและกติกาเดียวกับหน้าเว็บ (ชุดข้อมูลที่เปิดใช้งาน นโยบายดาวเทียม สูตรที่ตั้งค่า การเทียบช่วงเดียวกันปีก่อน)',
        endpoints: ['fn=meta', 'fn=provinces', 'fn=risk&province=XX&level=subdistrict|district&model=ABRI|M5|M4&land=&end=&format=json|csv&key=',
          'fn=hotspots&province=XX&land=&from=&to=&district=&subdistrict=&crop=&format=json|csv',
          'fn=compare&province=XX&from=&to=&level=district|subdistrict&district=&subdistrict=&crop=&land=&format=json|csv'] }), 'json');
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
      const r = riskForProvince_(prov, p.end, detailed, p.land, p.model);
      if (!r.ok || r.empty) return apiOut_(Object.assign(base, { ok: !!r.ok, empty: true, province: prov }), 'json');
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
        fallback: r.fallback || '', land: r.land, assessmentYear: r.assessmentYear || null, baseYears: r.baseYears || null, months: r.months || null, monthsText: r.monthsText || '', source: r.source, season: r.season, history: r.history || [], end: r.end, latest: r.latest,
        currentWindow: r.window || null, detailed: detailed, columns: header, rows: rows,
        note: 'คะแนนเป็นลำดับเชิงเปรียบเทียบสำหรับจัดลำดับการเฝ้าระวัง ไม่ใช่ความน่าจะเป็นการเผา' }), 'json');
    }
    case 'hotspots': {
      const h = publicHotspots_(String(p.province || ''), p.land);
      if (!h.ok) return apiOut_(Object.assign(base, h), 'json');
      const from = String(p.from || ''), to = String(p.to || ''), names = geoNames_(), f = apiFilter_(p);
      const rows = h.rows.filter(r => (!from || r[0] >= from) && (!to || r[0] <= to) && f(r));
      const header = ['date', 'time', 'districtCode', 'district', 'subdistrictCode', 'subdistrict', 'village', 'plantType', 'landType', 'lat', 'lng'];
      const out = rows.map(r => [r[0], r[1], r[2], r[4] || names.district[r[2]] || '', r[3], r[5] || names.subdistrict[r[3]] || '', r[6], r[7], r[11], r[8], r[9]]);
      if (fmt === 'csv') return apiCsv_(header, out);
      return apiOut_(Object.assign(base, { province: h.province, source: h.source, land: h.land, from: from, to: to, district: f.district, subdistrict: f.subdistrict, crop: f.crop, satellitePolicy: SAT_POLICY_TEXT, count: out.length, columns: header, rows: out }), 'json');
    }
    case 'compare': {
      const c = apiCompare_(p);
      if (!c.ok) return apiOut_(Object.assign(base, c), 'json');
      const header = ['code', 'name', 'previous', 'selected', 'change', 'levelIndex', 'level'];
      if (fmt === 'csv') return apiCsv_(header, c.rows.concat(c.unassigned ? [c.unassigned] : []).map(o => header.map(h => o[h])).concat([['', 'รวม', c.total.previous, c.total.selected, c.total.change, '', '']]));
      return apiOut_(Object.assign(base, c, { columns: header }), 'json');
    }
    default: return apiOut_(Object.assign(base, { ok: false, error: 'unknown fn' }), 'json');
  }
}
/* ---------- ตัวกรองและตารางเปรียบเทียบ (กติกาเดียวกับหน้าเว็บ: js/dashboard.js summary() + js/geo.js compareWindow) ---------- */
/** ตัวกรองแถว publicHotspots_: [date,time,dCode,sCode,dName,sName,village,plant,lat,lng,tsrc,land] */
function apiFilter_(p) {
  const d = String(p.district || '').replace(/\D/g, ''), t = String(p.subdistrict || '').replace(/\D/g, ''), crop = PLANT_TYPES.indexOf(String(p.crop || '').trim()) >= 0 ? String(p.crop).trim() : '';
  const f = r => (!d || String(r[2]) === d) && (!t || String(r[3]) === t) && (!crop || r[7] === crop);
  f.district = d; f.subdistrict = t; f.crop = crop;
  return f;
}
/** ช่วงเริ่มต้นเดียวกับหน้าเว็บ: ปีงบประมาณล่าสุดที่ครบแล้ว (1 ต.ค. – 30 ก.ย.) */
function apiDefaultPeriod_() { const e = defaultEnd_(); if (!e) return { from: '', to: '' }; const y = +e.slice(0, 4); return { from: (y - 1) + '-10-01', to: e }; }
const API_MONTH_SHORT_ = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function apiMonthsLabel_(list) {
  const idx = ym => (+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7)), runs = [];
  list.slice().sort().forEach(ym => { const r = runs[runs.length - 1]; if (r && idx(ym) === idx(r[1]) + 1) r[1] = ym; else runs.push([ym, ym]); });
  const lab = ym => API_MONTH_SHORT_[+ym.slice(5, 7)], yy = ym => String(+ym.slice(0, 4) + 543).slice(2);
  return runs.map(x => x[0] === x[1] ? lab(x[0]) + ' ' + yy(x[0]) : yy(x[0]) === yy(x[1]) ? lab(x[0]) + '–' + lab(x[1]) + ' ' + yy(x[1]) : lab(x[0]) + ' ' + yy(x[0]) + ' – ' + lab(x[1]) + ' ' + yy(x[1])).join(', ');
}
/** Geo.compareWindow ฉบับ Backend: วันต่อวันเมื่อปีก่อนมีข้อมูลครบ · ไม่ครบ = เฉพาะเดือนที่มีข้อมูลทั้งสองปี · ไม่มีเลย = none */
function apiCompareWindow_(start, end, latest, dataFirst, dataMonths) {
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const minus1 = d => { const y = +d.slice(0, 4) - 1, m = +d.slice(5, 7); return y + '-' + pad2_(m) + '-' + pad2_(Math.min(+d.slice(8, 10), dim(y, m))); };
  const pym = ym => (+ym.slice(0, 4) - 1) + ym.slice(4);
  let e = end; if (latest && e > latest) e = latest; if (e < start) e = start;
  const months = []; for (let y = +start.slice(0, 4), m = +start.slice(5, 7); y + '-' + pad2_(m) <= e.slice(0, 7); m === 12 ? (y++, m = 1) : m++) months.push(y + '-' + pad2_(m));
  const has = {}; (dataMonths || []).forEach(m => { has[m] = 1; }); const hasAny = (dataMonths || []).length > 0;
  const prevStart = minus1(start), prevEnd = minus1(e);
  const allPrev = hasAny ? months.every(m => has[pym(m)]) : true;
  if (allPrev && (!dataFirst || prevStart >= dataFirst))
    return { mode: 'day', none: false, cur: [start, e], prev: [prevStart, prevEnd], months: months, inCur: d => d >= start && d <= e, inPrev: d => d >= prevStart && d <= prevEnd, note: '' };
  const okPrev = m => hasAny ? !!has[pym(m)] : (pym(m) + '-' + pad2_(dim(+pym(m).slice(0, 4), +m.slice(5, 7)))) >= (dataFirst || '');
  const matched = months.filter(m => (!hasAny || has[m]) && okPrev(m));
  if (!matched.length) return { mode: 'month', none: true, cur: [start, e], prev: [prevStart, prevEnd], months: [], inCur: () => false, inPrev: () => false,
    note: 'ไม่มีข้อมูลช่วงเดียวกันปีก่อน' + (dataFirst ? ' (ข้อมูลตั้งแต่ ' + dataFirst + ')' : '') };
  const set = {}, pset = {}; matched.forEach(m => { set[m] = 1; pset[pym(m)] = 1; });
  const z = matched[matched.length - 1], zEnd = z + '-' + pad2_(dim(+z.slice(0, 4), +z.slice(5, 7))), cEnd = zEnd < e ? zEnd : e, pEnd = minus1(cEnd);
  return { mode: 'month', none: false, cur: [matched[0] + '-01', cEnd], prev: [pym(matched[0]) + '-01', pEnd], months: matched,
    inCur: d => !!set[d.slice(0, 7)] && d <= cEnd, inPrev: d => !!pset[d.slice(0, 7)] && d <= pEnd,
    curLabel: apiMonthsLabel_(matched), prevLabel: apiMonthsLabel_(matched.map(pym)),
    note: 'ปีก่อนมีข้อมูลไม่ครบทุกเดือน: นับปีก่อนและคำนวณ % เฉพาะเดือนที่มีข้อมูลทั้งสองปี (' + apiMonthsLabel_(matched.map(pym)) + ') · selected = จำนวนจริงทั้งหมดของช่วงที่เลือก' };
}
function apiPct_(cur, prev) { if (prev === 0) return cur === 0 ? '0%' : 'ใหม่'; const v = Math.round((cur - prev) * 100 / prev); return (v > 0 ? '+' : '') + v + '%'; }
/** ตารางเปรียบเทียบ HS รายอำเภอ/ตำบล — ผลเหมือนการ์ด “เปรียบเทียบ HS” และการ์ดสรุปบนหน้าเว็บ */
function apiCompare_(p) {
  const prov = String(p.province || '').padStart(2, '0');
  if (!PROVINCES[prov]) return { ok: false, error: 'province required (2-digit code)' };
  const h = publicHotspots_(prov, p.land); if (!h.ok) return h;
  const def = apiDefaultPeriod_(), iso = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '';
  const from = iso(p.from) || def.from, to = iso(p.to) || def.to;
  if (!from || !to) return { ok: true, empty: true, province: prov };
  const f = apiFilter_(p), level = f.district || String(p.level || '') === 'subdistrict' ? 'subdistrict' : 'district';
  const latest = h.rows.reduce((a, r) => r[0] > a ? r[0] : a, '');
  const W = apiCompareWindow_(from, to, latest, dataRange_().first, dataMonths_());
  const rows = h.rows.filter(f), names = geoNames_(), key = level === 'district' ? 2 : 3;
  const units = Object.keys(level === 'district' ? unitArea_().district : unitArea_().subdistrict)
    .filter(c => c.slice(0, 2) === prov && (!f.district || c.slice(0, 4) === f.district) && (!f.subdistrict || level !== 'subdistrict' || c === f.subdistrict));
  const inUnit = {}; units.forEach(c => { inUnit[c] = 1; });
  const cnt = { sel: {}, cmp: {}, prev: {} }, add = (o, k) => { o[k] = (o[k] || 0) + 1; };
  rows.forEach(r => { const d = r[0], k = inUnit[String(r[key])] ? String(r[key]) : '-';
    if (d >= from && d <= to) add(cnt.sel, k); if (W.inCur(d)) add(cnt.cmp, k); if (W.inPrev(d)) add(cnt.prev, k); });
  const risk = riskForProvince_(prov, to, false, h.land), lvl = (risk && !risk.empty && risk[level]) || {};
  const lvIdx = c => lvl[c] ? lvl[c][0] : null;
  const out = units.map(c => ({ code: c, name: (level === 'district' ? names.district[c] : names.subdistrict[c]) || '',
    previous: W.none ? null : (cnt.prev[c] || 0), selected: cnt.sel[c] || 0, change: W.none ? '–' : apiPct_(cnt.cmp[c] || 0, cnt.prev[c] || 0),
    levelIndex: lvIdx(c), level: lvIdx(c) === null ? '' : lvIdx(c) >= 0 ? RISK_LEVEL_LABELS[lvIdx(c)] : 'ไม่ประเมิน' }))
    .sort((a, b) => b.selected - a.selected || a.name.localeCompare(b.name, 'th'));
  const sum = o => Object.keys(o).reduce((a, k) => a + o[k], 0);
  const un = (cnt.sel['-'] || 0) || (cnt.prev['-'] || 0) ? { code: '', name: 'ไม่ระบุพื้นที่', previous: W.none ? null : (cnt.prev['-'] || 0), selected: cnt.sel['-'] || 0, change: '–', levelIndex: null, level: '' } : null;
  return { ok: true, province: prov, provinceName: PROVINCES[prov], land: h.land, source: h.source, satellitePolicy: SAT_POLICY_TEXT, level: level,
    district: f.district, subdistrict: f.subdistrict, crop: f.crop, from: from, to: to, latest: latest,
    compare: { mode: W.mode, none: W.none, matchedMonths: W.months, previousLabel: W.prevLabel || '', previousWindow: W.prev, note: W.note },
    total: { selected: sum(cnt.sel), previous: W.none ? null : sum(cnt.prev), change: W.none ? '–' : apiPct_(sum(cnt.cmp), sum(cnt.prev)) },
    riskModel: risk && risk.model || '', assessmentYear: risk && risk.assessmentYear || null, rows: out, unassigned: un };
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
