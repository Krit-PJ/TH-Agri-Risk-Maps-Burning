/* ============================== v3.19 ดึงข้อมูล HS จาก Google Sheet อัตโนมัติ ==============================
 * ต้นทาง: Google Sheet ที่มีชีตแยกรายปี (ชื่อชีตมีปี 4 หลัก ค.ศ. หรือ พ.ศ. เช่น NOAA20_2026) คอลัมน์เดียวกับไฟล์ Excel ที่นำเข้า
 * - ตรวจอัตโนมัติทุกวัน 00:00 · 08:00 · 09:00 · 10:00 · 11:00 น. (ตัวตั้งเวลา installGsSyncTriggers) — 00:00 อ่านทั้งชีตทุกปีเสมอ
 *   รอบอื่นอ่านเฉพาะชีตที่ "ลายนิ้วมือ" (จำนวนแถว + แถวท้าย) เปลี่ยน หรือชีตปีใหม่ที่เริ่มมีข้อมูล
 * - นำเข้าเฉพาะจุดใหม่ (กติกาเดียวกับ hsImport_ / hsMatcher_) · จุดที่ค่าต้นทางเปลี่ยน = แจ้งจำนวน ให้ผู้ดูแลกด "ปรับตามต้นทาง" เอง
 * - แถวที่ถูกลบในต้นทางไม่ลบจากระบบ · ชุดข้อมูล GS-<จังหวัด>-<วันที่> ปิด/ลบได้ในแท็บชุดข้อมูลเหมือนเดิม
 * - ใช้ได้เฉพาะ Super Admin / Mini Super Admin · ค่าตั้ง/สถานะเก็บใน Script Properties */
const GS_DEFAULT_URL = 'https://docs.google.com/spreadsheets/d/1bGbydIwHNE9iHQoy1dE2xU3_bGOtj5ZYA4zhkpl_gUE/edit?gid=0#gid=0';
const GS_HOURS = [0, 8, 9, 10, 11];
const GS_TIME_BUDGET_MS = 270000;   // เผื่อจากขีดจำกัด 6 นาทีของ Apps Script — เกินแล้วทำต่อในรอบต่อเนื่อง (gsSyncContinue)
const GS_P = { url: 'gs_sync_url', enabled: 'gs_sync_enabled', state: 'gs_sync_state', job: 'gs_sync_job' };
const GS_SYSTEM_USER = { name: 'ระบบ (Google Sheet อัตโนมัติ)', role: 'system', prov: '*' };

function gsProps_() { return PropertiesService.getScriptProperties(); }
function gsConfig_() {
  const p = gsProps_();
  return { url: p.getProperty(GS_P.url) || GS_DEFAULT_URL, enabled: p.getProperty(GS_P.enabled) !== '0' };
}
function gsIdFromUrl_(url) {
  const s = String(url || '').trim(), m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/) || s.match(/^([a-zA-Z0-9_-]{25,})$/);
  return m ? m[1] : '';
}
function gsJson_(key, def) { try { return JSON.parse(gsProps_().getProperty(key) || '') || def; } catch (_) { return def; } }
function gsSaveJson_(key, obj) { gsProps_().setProperty(key, JSON.stringify(obj)); }

/* ---------- อ่านต้นทาง ---------- */
/** ชีตรายปี: ชื่อมีปี 4 หลัก (ค.ศ. 2000–2100 หรือ พ.ศ. > 2400) ไม่นับชีตสรุป · เรียงจากปีเก่าไปใหม่ */
function gsYearSheets_(ss) {
  return ss.getSheets().map(sh => {
    const name = sh.getName();
    if (/sum|สรุป|summary/i.test(name)) return null;
    const m = name.match(/(\d{4})/); if (!m) return null;
    let y = Number(m[1]); if (y > 2400) y -= 543;
    if (y < 2000 || y > 2100) return null;
    return { sh: sh, name: name, year: y };
  }).filter(Boolean).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
}
/** ลายนิ้วมือของชีต: จำนวนแถวข้อมูล + แถวท้าย (ตรวจเร็ว ไม่อ่านทั้งชีต) */
function gsFingerprint_(sh) {
  const last = sh.getLastRow(), cols = Math.max(1, Math.min(sh.getLastColumn ? sh.getLastColumn() : 20, 25));
  const tail = last > 1 ? sh.getRange(last, 1, 1, cols).getDisplayValues()[0].join('|') : '';
  return { rows: Math.max(0, last - 1), fp: (last - 1) + ':' + sha256_(tail).slice(0, 16) };
}
const GS_COLS = { id: ['hsid', 'hotspotid', 'id'], date: ['date', 'yyyy-mm-dd', 'วันที่'], time: ['time', 'เวลา'], tambon: ['tambon', 'ตำบล'], amphoe: ['amphoe', 'อำเภอ'],
  province: ['province', 'จังหวัด'], land: ['landtype'], plant: ['planttype'], village: ['baann', 'village'], tambonN: ['tambonn'], amphoeN: ['amphoen'],
  maps: ['maps'], latlng: ['lat,lng', 'latlng'], lat: ['latitude', 'lat'], lng: ['longitude', 'lng', 'lon', 'long'], x: ['x'], y: ['y'], zone: ['q', 'zone'], sat: ['satellite'] };
function gsHeaderIndex_(header) {
  const norm = header.map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, ''));
  const ix = {};
  Object.keys(GS_COLS).forEach(k => { const i = norm.findIndex(h => GS_COLS[k].indexOf(h) >= 0); if (i >= 0) ix[k] = i; });
  return ix;
}
function gsHeaderProblem_(ix) {
  const miss = [];
  if (ix.date === undefined) miss.push('Date');
  if (ix.province === undefined) miss.push('Province');
  if (ix.maps === undefined && ix.latlng === undefined && (ix.lat === undefined || ix.lng === undefined) && (ix.x === undefined || ix.y === undefined)) miss.push('พิกัด (Maps / lat,lng / X,Y)');
  return miss.length ? 'ไม่พบคอลัมน์ ' + miss.join(', ') : '';
}

/* ---------- แปลงแถว (กติกาเดียวกับหน้า “นำเข้า HS” ใน js/admin.js) ---------- */
const gsClean_ = v => String(v === undefined || v === null ? '' : v).replace(/^(อ\.|อำเภอ|เขต|ต\.|ตำบล|แขวง|จ\.|จังหวัด)\s*/, '').replace(/\s+/g, '').trim();
const gsCompact_ = v => String(v || '').replace(/\s+/g, '');
let GS_INDEX_ = null;
/** ดัชนีชื่อ → รหัส: จังหวัด, อำเภอในจังหวัด, ตำบลในอำเภอ (จาก Geo.gs) — ชื่อซ้ำในจังหวัดเดียวกันถือว่าไม่ชัด (ไม่ใส่รหัส ให้หน้าเว็บหาจากพิกัด) */
function gsIndex_() {
  if (GS_INDEX_) return GS_INDEX_;
  const g = geoNames_(), prov = {}, dist = {}, sub = {};
  Object.keys(PROVINCES).forEach(c => { prov[gsClean_(PROVINCES[c])] = c; });
  const put = (m, k, v) => { m[k] = (m[k] === undefined) ? v : (m[k] === v ? v : ''); };
  Object.keys(g.district).forEach(c => put(dist, c.slice(0, 2) + '|' + gsClean_(g.district[c]), c));
  Object.keys(g.subdistrict).forEach(c => put(sub, c.slice(0, 4) + '|' + gsClean_(g.subdistrict[c]), c));
  // ชื่อตำบลในทะเบียนบางชื่อถูกตัดท้าย (เช่น "นิคมทุ่งโพธิ์ทะเ") → ใช้จับคู่แบบขึ้นต้นด้วย (ต้องไม่ซ้ำในอำเภอ)
  const subList = {};
  Object.keys(g.subdistrict).forEach(c => { (subList[c.slice(0, 4)] = subList[c.slice(0, 4)] || []).push([gsClean_(g.subdistrict[c]), c]); });
  GS_INDEX_ = { prov: prov, dist: dist, sub: sub, subList: subList };
  return GS_INDEX_;
}
function gsSubCode_(idx, dCode, name) {
  const n = gsClean_(name); if (!dCode || !n) return '';
  const exact = idx.sub[dCode + '|' + n]; if (exact) return exact;
  const hits = (idx.subList[dCode] || []).filter(x => x[0].length >= 5 && (n.indexOf(x[0]) === 0 || x[0].indexOf(n) === 0));
  return hits.length === 1 ? hits[0][1] : '';
}
function gsPlant_(v) {
  const s = String(v || '').trim();
  if (!s) return 'อื่น ๆ';
  if (s === 'นาข้าว' || s === 'ข้าว') return 'นาข้าว';
  if (s.indexOf('ข้าวโพด') >= 0 || s.indexOf('ไร่หมุนเวียน') >= 0) return 'ข้าวโพดและไร่หมุนเวียน';
  if (s.indexOf('อ้อย') >= 0) return 'อ้อย';
  if (gsCompact_(s) === 'เกษตรอื่นๆ') return 'เกษตรอื่น ๆ';
  if (s === 'อื่น ๆ' || s === 'อื่นๆ' || s === 'อื่น') return 'อื่น ๆ';
  if (gsCompact_(s) === 'พื้นที่ป่า' || s === 'ป่า') return 'พื้นที่ป่า';
  return s;
}
function gsLand_(v) {
  const s = String(v || '').trim(); if (!s) return DEFAULT_LAND;
  const hit = LAND_TYPES.filter(l => gsCompact_(l) === gsCompact_(s))[0];
  return hit || 'ชุมชนและอื่น ๆ';
}
function gsDate_(v) {
  const s = String(v || '').trim(); let m;
  const fix = (y, mo, d) => { y = Number(y); if (y > 2400) y -= 543; return (y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) ? y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2) : ''; };
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return fix(m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) return fix(m[3], +m[2], +m[1]);
  return '';
}
/** UTM (WGS84) → [lat, lng] สำรองกรณีไม่มีคอลัมน์ Maps / lat,lng */
function gsUtmToLatLng_(e, n, zone) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const x = e - 500000, y = n, lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const M = y / k0, mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) * Math.sin(p1)), T1 = Math.tan(p1) * Math.tan(p1), C1 = ep2 * Math.cos(p1) * Math.cos(p1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(p1) * Math.sin(p1), 1.5), D = x / (N1 * k0);
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * Math.pow(D, 6) / 720);
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * Math.pow(D, 5) / 120) / Math.cos(p1);
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}
function gsCoords_(r, ix) {
  const inTh = (lat, lng) => isFinite(lat) && isFinite(lng) && lat > 4 && lat < 22 && lng > 96 && lng < 107;
  let m;
  if (ix.maps !== undefined && (m = String(r[ix.maps] || '').match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i))) { const la = +m[1], ln = +m[2]; if (inTh(la, ln)) return [la, ln]; }
  if (ix.latlng !== undefined && (m = String(r[ix.latlng] || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/))) { const la = +m[1], ln = +m[2]; if (inTh(la, ln)) return [la, ln]; }
  if (ix.lat !== undefined && ix.lng !== undefined) { const la = Number(r[ix.lat]), ln = Number(r[ix.lng]); if (inTh(la, ln)) return [la, ln]; }
  if (ix.x !== undefined && ix.y !== undefined) {
    const e = Number(String(r[ix.x]).replace(/,/g, '')), n = Number(String(r[ix.y]).replace(/,/g, '')), z = Number(ix.zone !== undefined ? r[ix.zone] : 47);
    if (isFinite(e) && isFinite(n) && e > 1000) { const c = gsUtmToLatLng_(e, n, z === 48 ? 48 : 47); if (inTh(c[0], c[1])) return c; }
  }
  return null;
}
/** แถวต้นทาง → { prov, rec } (rec = รูปแบบเดียวกับที่หน้าเว็บส่งให้ hs_import) หรือ { skip: เหตุผล } */
function gsParseRow_(r, ix, idx, seenIds) {
  const pName = gsClean_(r[ix.province]), prov = idx.prov[pName];
  if (!prov) return { skip: 'province', name: String(r[ix.province] || '') };
  const date = gsDate_(r[ix.date]); if (!date) return { skip: 'date' };
  const plant = gsPlant_(ix.plant !== undefined ? r[ix.plant] : '');
  if (PLANT_TYPES.indexOf(plant) < 0) return { skip: 'plant' };
  const c = gsCoords_(r, ix); if (!c) return { skip: 'coord' };
  let id = String(ix.id !== undefined ? r[ix.id] : '').trim();
  if (id) {   // hsID ซ้ำ: พิกัดเดียวกัน = แถวซ้ำ · พิกัดต่างกัน = คนละจุด → เติม -2, -3 (เหมือนหน้า “นำเข้า HS”)
    const pk = c[1].toFixed(5) + ',' + c[0].toFixed(5), prev = seenIds[id];
    if (prev) { if (prev.indexOf(pk) >= 0) return { skip: 'dup' }; prev.push(pk); id = id + '-' + prev.length; } else seenIds[id] = [pk];
  }
  const time = normalizeTime_(ix.time !== undefined ? r[ix.time] : '');
  const dName = String(ix.amphoe !== undefined ? r[ix.amphoe] : '').trim(), sName = String(ix.tambon !== undefined ? r[ix.tambon] : '').trim();
  let dCode = idx.dist[prov + '|' + gsClean_(dName)] || (ix.amphoeN !== undefined ? idx.dist[prov + '|' + gsClean_(r[ix.amphoeN])] : '') || '';
  let sCode = gsSubCode_(idx, dCode, sName) || (ix.tambonN !== undefined ? gsSubCode_(idx, dCode, r[ix.tambonN]) : '');
  return { prov: prov, rec: { id: id || [date, time, c[0].toFixed(5), c[1].toFixed(5)].join('_'), date: date, time: time, dCode: dCode, sCode: sCode, dName: dName, sName: sName,
    village: String(ix.village !== undefined ? r[ix.village] : '').trim(), plant: plant, land: gsLand_(ix.land !== undefined ? r[ix.land] : ''),
    lat: Number(c[0].toFixed(6)), lng: Number(c[1].toFixed(6)), sat: String(ix.sat !== undefined ? r[ix.sat] : '').trim() } };
}

/* ---------- นำเข้ารายจังหวัด (เหมือน hsImport_ mode skip · apply = ปรับจุดที่ค่าเปลี่ยนตามต้นทาง คง hsID เดิม) ---------- */
/** ค่าที่ถือว่า "ต้นทางแก้ไข": เวลา ชนิดพืช ประเภทพื้นที่ พิกัด (> ~11 ม.) — ไม่นับรหัส/ชื่อพื้นที่ที่ระบบหาเอง */
function gsChanged_(oldRow, row) {
  const t0 = normalizeTime_(oldRow[2]), t1 = String(row[2] || '');
  return (t0 && t1 && t0 !== t1) || String(oldRow[8] || '') !== String(row[8]) || rowLand_(oldRow[15]) !== rowLand_(row[15])
    || Math.abs(Number(oldRow[9]) - Number(row[9])) > 1e-4 || Math.abs(Number(oldRow[10]) - Number(row[10])) > 1e-4;
}
function gsImportProvince_(prov, recs, opts) {
  const sh = hsSheet_(prov, true), W = HS_HEADERS.length, last = sh.getLastRow();
  const data = last > 1 ? sh.getRange(2, 1, last - 1, W).getValues() : [];
  const match = hsMatcher_(data), at = now_(), batchId = opts.batchId;
  // ตำบลที่หาจากชื่อไม่ได้ (ชื่อในต้นทางต่างจากทะเบียนกรมการปกครอง) → เรียนจากจุดเดิมของจังหวัดที่หน้าเว็บผูกรหัสจากพิกัดไว้แล้ว (ชื่อเดียวกัน ในอำเภอเดียวกัน)
  const learn = {};
  data.forEach(r => { if (r[3] && r[4] && r[6]) { const k = String(r[3]) + '|' + gsClean_(r[6]), c = String(r[4]); (learn[k] = learn[k] || {})[c] = (learn[k][c] || 0) + 1; } });
  const learned = k => { const m = learn[k]; if (!m) return ''; const ks = Object.keys(m); return ks.length === 1 ? ks[0] : ks.sort((x, y) => m[y] - m[x])[0]; };
  recs.forEach(rec => { if (rec.dCode && !rec.sCode) rec.sCode = learned(rec.dCode + '|' + gsClean_(rec.sName)) || ''; });
  // ยังไม่ได้ (ตำบลตั้งใหม่/ไม่มีในทะเบียนขอบเขต) → ใช้ตำบลของจุดเดิมที่ใกล้ที่สุดในอำเภอเดียวกัน ระยะไม่เกิน ~3 กม. (หน้าเว็บผูกจากพิกัดไว้แล้ว)
  if (recs.some(rec => rec.dCode && !rec.sCode)) {
    const G = 0.05, grid = {}, key = (la, ln) => Math.floor(la / G) + ':' + Math.floor(ln / G);
    data.forEach(r => { if (r[3] && r[4]) (grid[key(Number(r[9]), Number(r[10]))] = grid[key(Number(r[9]), Number(r[10]))] || []).push(r); });
    recs.forEach(rec => {
      if (!rec.dCode || rec.sCode) return;
      let best = null, bd = 0.03 * 0.03;
      const gy = Math.floor(rec.lat / G), gx = Math.floor(rec.lng / G);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) (grid[(gy + dy) + ':' + (gx + dx)] || []).forEach(r => {
        if (String(r[3]) !== rec.dCode) return;
        const d = Math.pow(Number(r[9]) - rec.lat, 2) + Math.pow(Number(r[10]) - rec.lng, 2);
        if (d < bd) { bd = d; best = r; }
      });
      if (best) rec.sCode = String(best[4]);
    });
  }
  const out = [], changedIdx = [], seen = {};
  let dup = 0, unresolved = 0;
  recs.forEach(rec => {
    const row = hsRowFrom_(rec, batchId, at, 'AGENCY'), id = row[0];
    if (seen[id]) { dup++; return; }
    seen[id] = 1;
    const m = match.find(row);
    if (m) {
      dup++;
      // นับว่า "ต้นทางแก้ไข" เฉพาะจุดที่ hsID ตรงกันจริง (จับคู่ด้วยวันที่+เวลา+พิกัดใกล้กันอาจเป็นจุดข้างเคียง ≤ 55 ม.)
      if (m.idx >= 0 && String(data[m.idx][0]) === String(row[0]) && gsChanged_(data[m.idx], row)) {
        if (opts.apply) { row[0] = String(data[m.idx][0]); data[m.idx] = row; }
        changedIdx.push(m.idx);
      }
      return;
    }
    if (!row[3] || !row[4]) unresolved++;
    out.push(row); match.add(row);
  });
  const applied = opts.apply ? changedIdx.length : 0;
  if (!out.length && !applied) return { province: prov, added: 0, changed: changedIdx.length, applied: 0, duplicates: dup, unresolved: 0 };
  if (applied) {
    const lo = Math.min.apply(null, changedIdx), hi = Math.max.apply(null, changedIdx);
    hsTextFormat_(sh, lo + 2, hi - lo + 1);
    sh.getRange(lo + 2, 1, hi - lo + 1, W).setValues(data.slice(lo, hi + 1));
  }
  if (out.length) {
    const start = sh.getLastRow() + 1;
    hsTextFormat_(sh, start, out.length);
    sh.getRange(start, 1, out.length, W).setValues(out);
  }
  const dates = out.map(r => String(r[1])).sort();
  const bt = findRow_('Batches', r => r.batchId === batchId);
  if (bt) {
    updateRow_('Batches', bt._row, { accepted: Number(bt.accepted || 0) + out.length + applied, duplicates: Number(bt.duplicates || 0) + dup,
      firstDate: [bt.firstDate, dates[0]].filter(Boolean).sort()[0] || '', lastDate: [bt.lastDate, dates[dates.length - 1]].filter(Boolean).sort().pop() || '', active: true });
  } else {
    appendObj_('Batches', { batchId: batchId, provinceCode: prov, fileName: clean_(opts.fileName), accepted: out.length + applied, duplicates: dup,
      firstDate: dates[0] || '', lastDate: dates[dates.length - 1] || '', importedBy: GS_SYSTEM_USER.name, importedAt: at, note: opts.apply ? 'Google Sheet (ปรับตามต้นทาง)' : 'Google Sheet อัตโนมัติ', source: 'AGENCY', active: true });
  }
  INACTIVE_MEMO_ = null;
  refreshSummary_(prov); bumpCache_(prov);
  return { province: prov, added: out.length, changed: opts.apply ? 0 : changedIdx.length, applied: applied, duplicates: dup, unresolved: unresolved };
}

/* ---------- รอบการตรวจ/ดึง ---------- */
/** opts: { force: อ่านทุกชีต, apply: ปรับจุดที่ค่าเปลี่ยน, actor: ผู้สั่ง (ไม่ระบุ = อัตโนมัติ), resume: ทำต่อจากรอบที่ค้าง } */
function gsSyncRun_(opts) {
  opts = opts || {};
  const t0 = Date.now(), cfg = gsConfig_(), state = gsJson_(GS_P.state, {});
  const actor = opts.actor || GS_SYSTEM_USER, mode = opts.apply ? 'apply' : opts.force ? 'full' : 'quick';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return gsFinish_(state, { status: 'busy', message: 'ระบบกำลังนำเข้าข้อมูลอื่นอยู่ จะตรวจอีกครั้งในรอบถัดไป', mode: mode, actor: actor }, actor, false);
  try {
    const id = gsIdFromUrl_(cfg.url);
    if (!id) return gsFinish_(state, { status: 'error', message: 'ลิงก์ Google Sheet ไม่ถูกต้อง', mode: mode }, actor, true);
    let ss;
    try { ss = SpreadsheetApp.openById(id); }
    catch (err) { return gsFinish_(state, { status: 'error', message: 'เปิด Google Sheet ไม่ได้ — ตรวจสอบลิงก์และสิทธิ์การแชร์ (' + String(err.message || err).slice(0, 120) + ')', mode: mode }, actor, true); }
    const years = gsYearSheets_(ss);
    if (!years.length) return gsFinish_(state, { status: 'error', message: 'ไม่พบชีตรายปี (ชื่อชีตต้องมีปี 4 หลัก เช่น NOAA20_2026)', mode: mode }, actor, true);
    const prevSheets = state.sheets || {}, sheets = {};
    const job = opts.resume ? gsJson_(GS_P.job, null) : null;
    const todo = [];
    years.forEach(y => {
      const f = gsFingerprint_(y.sh), prev = prevSheets[y.name] || {};
      sheets[y.name] = Object.assign({}, prev, { year: y.year, rows: f.rows, fp: f.fp });
      const changed = job ? job.sheets.indexOf(y.name) >= 0 : (opts.force || opts.apply || prev.fp !== f.fp);
      if (changed && f.rows > 0) todo.push(y);
      if (f.rows > 0 && !prev.fp) sheets[y.name].isNew = true;
    });
    if (!todo.length) {
      state.sheets = sheets;
      return gsFinish_(state, { status: 'nochange', message: 'ไม่มีข้อมูลใหม่ในต้นทาง', mode: mode, added: 0, sheetsRead: [] }, actor, false);
    }
    // อ่านและแปลงทุกชีตที่เปลี่ยน แล้วรวมรายจังหวัด
    const idx = gsIndex_(), byProv = {}, seenIds = {}, skip = {}, unknownProv = {};
    let maxDate = '', parsed = 0;
    todo.forEach(y => {
      const sh = y.sh, last = sh.getLastRow(), lastCol = sh.getLastColumn ? sh.getLastColumn() : 25;
      const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0], ix = gsHeaderIndex_(header), prob = gsHeaderProblem_(ix);
      if (prob) { sheets[y.name].error = prob; skip.header = (skip.header || 0) + 1; return; }
      delete sheets[y.name].error;
      const values = sh.getRange(2, 1, last - 1, lastCol).getDisplayValues();
      let sMax = '';
      values.forEach(r => {
        if (!r.some(v => v !== '')) return;
        const p = gsParseRow_(r, ix, idx, seenIds);
        if (p.skip) { skip[p.skip] = (skip[p.skip] || 0) + 1; if (p.skip === 'province' && p.name) unknownProv[p.name] = (unknownProv[p.name] || 0) + 1; return; }
        parsed++; (byProv[p.prov] = byProv[p.prov] || []).push(p.rec);
        if (p.rec.date > sMax) sMax = p.rec.date;
      });
      sheets[y.name].maxDate = sMax; sheets[y.name].readAt = now_();
      if (sMax > maxDate) maxDate = sMax;
    });
    const day = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd');
    const fileName = 'Google Sheet: ' + ss.getName() + ' (' + todo.map(y => y.name).join(', ') + ')';
    const done = job ? job.done : {}, results = job ? job.results : [];
    const provs = Object.keys(byProv).sort();
    const existed = {}; provs.forEach(p => { existed[p] = !!hsSheet_(p, false); });
    let partial = false;
    for (let i = 0; i < provs.length; i++) {
      const p = provs[i];
      if (done[p]) continue;
      if (Date.now() - t0 > GS_TIME_BUDGET_MS) { partial = true; break; }
      const r = gsImportProvince_(p, byProv[p], { batchId: 'GS-' + p + '-' + day, fileName: fileName, apply: !!opts.apply });
      r.newProvince = !(job && job.existed ? job.existed[p] : existed[p]);
      results.push(r); done[p] = 1;
    }
    if (partial) {   // ทำต่อในรอบต่อเนื่อง 1 นาทีถัดไป
      gsSaveJson_(GS_P.job, { sheets: todo.map(y => y.name), done: done, results: results, existed: job && job.existed ? job.existed : existed, apply: !!opts.apply, at: now_() });
      gsScheduleContinue_();
      state.sheets = Object.assign({}, prevSheets);   // ยังไม่บันทึกลายนิ้วมือใหม่จนกว่าจะครบทุกจังหวัด
      return gsFinish_(state, { status: 'partial', message: 'ข้อมูลมาก ระบบกำลังนำเข้าต่อในรอบถัดไป (' + Object.keys(done).length + '/' + provs.length + ' จังหวัด)', mode: mode }, actor, false);
    }
    gsProps_().deleteProperty(GS_P.job);
    state.sheets = sheets;
    const sum = k => results.reduce((a, r) => a + (r[k] || 0), 0);
    const added = sum('added'), changed = sum('changed'), applied = sum('applied');
    const byProvOut = results.filter(r => r.added || r.changed || r.applied).map(r => ({ p: r.province, a: r.added, c: r.changed, u: r.applied, n: r.newProvince ? 1 : 0 }));
    const newProvs = results.filter(r => r.newProvince && r.added).map(r => r.province);
    if (opts.apply) state.pending = { total: 0, byProv: {} };
    else if (mode === 'full' || todo.length === years.filter(y => sheets[y.name].rows > 0).length) state.pending = { total: changed, byProv: results.reduce((m, r) => { if (r.changed) m[r.province] = r.changed; return m; }, {}), at: now_() };
    else if (changed) { const pd = state.pending || { total: 0, byProv: {} }; results.forEach(r => { if (r.changed) pd.byProv[r.province] = r.changed; }); pd.total = Object.keys(pd.byProv).reduce((a, k) => a + pd.byProv[k], 0); pd.at = now_(); state.pending = pd; }
    const unresolved = sum('unresolved');
    const msg = opts.apply ? ('ปรับตามต้นทาง ' + applied + ' จุด' + (added ? ' · นำเข้าใหม่ ' + added + ' จุด' : ''))
      : added ? ('นำเข้าข้อมูลใหม่ ' + added.toLocaleString() + ' จุด (' + byProvOut.filter(x => x.a).length + ' จังหวัด)' + (newProvs.length ? ' · จังหวัดใหม่ ' + newProvs.map(p => PROVINCES[p]).join(', ') : ''))
      : 'ต้นทางมีการแก้ไข แต่ไม่มีจุดใหม่';
    return gsFinish_(state, { status: 'ok', message: msg, mode: mode, added: added, changed: changed, applied: applied, byProv: byProvOut, newProvinces: newProvs,
      unresolved: unresolved, parsed: parsed, skipped: skip, unknownProvinces: Object.keys(unknownProv).slice(0, 10), sheetsRead: todo.map(y => y.name), maxDate: maxDate, ms: Date.now() - t0 }, actor, !!(added || applied));
  } finally { lock.releaseLock(); }
}
/** บันทึกผลรอบล่าสุด + ประวัติ 15 รอบ + ข้อมูลล่าสุด (ปี/ชีต/วันที่) · audit เมื่อมีการนำเข้าหรือผิดพลาด */
function gsFinish_(state, run, actor, log) {
  run.at = now_(); run.by = actor && actor.name ? actor.name : GS_SYSTEM_USER.name;
  state.checkedAt = run.at; state.last = run;
  if (run.status === 'ok') state.lastImportAt = run.added || run.applied ? run.at : (state.lastImportAt || '');
  if (run.status === 'ok' || run.status === 'nochange') state.lastOkAt = run.at;
  const sh = state.sheets || {}, withData = Object.keys(sh).filter(n => sh[n].rows > 0).sort((a, b) => sh[a].year - sh[b].year || a.localeCompare(b));
  if (withData.length) {
    const n = withData[withData.length - 1], latest = withData.map(k => sh[k].maxDate || '').sort().pop();
    state.latest = { sheet: n, year: sh[n].year, maxDate: latest || sh[n].maxDate || '' };
  }
  const h = { at: run.at, status: run.status, mode: run.mode, added: run.added || 0, changed: run.changed || 0, applied: run.applied || 0, message: String(run.message || '').slice(0, 160), by: run.by };
  state.history = [h].concat(state.history || []).slice(0, 15);
  try { gsSaveJson_(GS_P.state, state); }
  catch (err) { state.history = state.history.slice(0, 5); delete (state.last || {}).byProv; gsSaveJson_(GS_P.state, state); }
  if (log) audit_(actor && actor.role ? actor : GS_SYSTEM_USER, run.status === 'error' ? 'hs_sync_error' : 'hs_sync', '[' + run.mode + '] ' + run.message);
  return { ok: run.status !== 'error', run: run, status: gsStatus_(state) };
}
function gsScheduleContinue_() {
  try {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'gsSyncContinue').forEach(t => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('gsSyncContinue').timeBased().after(60 * 1000).create();
  } catch (_) { }
}

/* ---------- ฟังก์ชันที่ตัวตั้งเวลาเรียก (รันใน Editor ได้) ---------- */
/** ตัวตั้งเวลารายวัน 00:00 · 08:00 · 09:00 · 10:00 · 11:00 น. — 00:00 ตรวจทั้งชีตทุกปี (จับการแก้ไขกลางชีต) รอบอื่นตรวจเฉพาะชีตที่เปลี่ยน */
function gsSyncScheduled() {
  INACTIVE_MEMO_ = null; HS_MEMO_ = {};
  if (!gsConfig_().enabled) return 'disabled';
  const h = Number(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'H'));
  return JSON.stringify(gsSyncRun_({ force: h === 0 }).run);
}
function gsSyncContinue() {
  INACTIVE_MEMO_ = null; HS_MEMO_ = {};
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'gsSyncContinue').forEach(t => ScriptApp.deleteTrigger(t));
  const job = gsJson_(GS_P.job, null); if (!job) return 'no job';
  return JSON.stringify(gsSyncRun_({ resume: true, apply: !!job.apply }).run);
}
/** รันครั้งเดียวจาก Apps Script Editor (Super Admin): ติดตั้งตัวตั้งเวลา 5 รอบต่อวัน — ครั้งแรก Google จะขอสิทธิ์ "จัดการตัวตั้งเวลา" ให้กดอนุญาต */
function installGsSyncTriggers() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'gsSyncScheduled').forEach(t => ScriptApp.deleteTrigger(t));
  GS_HOURS.forEach(h => ScriptApp.newTrigger('gsSyncScheduled').timeBased().atHour(h).nearMinute(0).everyDays(1).inTimezone('Asia/Bangkok').create());
  audit_({ name: 'Apps Script Editor', role: 'superadmin', prov: '*' }, 'hs_sync_setup', 'ติดตั้งตัวตั้งเวลาดึง Google Sheet ' + GS_HOURS.map(h => ('0' + h).slice(-2) + ':00').join(', '));
  Logger.log('ติดตั้งตัวตั้งเวลา %s รอบ/วัน: %s', GS_HOURS.length, GS_HOURS.join(', '));
  return GS_HOURS.length;
}
function removeGsSyncTriggers() {
  let n = 0;
  ScriptApp.getProjectTriggers().filter(t => /^gsSync(Scheduled|Continue)$/.test(t.getHandlerFunction())).forEach(t => { ScriptApp.deleteTrigger(t); n++; });
  return n;
}

/* ---------- API สำหรับแผงผู้ดูแล (Super Admin / Mini Super Admin) ---------- */
function gsStatus_(state) {
  state = state || gsJson_(GS_P.state, {});
  const cfg = gsConfig_();
  let triggers = null;
  try { triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'gsSyncScheduled').length; } catch (_) { triggers = null; }
  const sh = state.sheets || {};
  return { url: cfg.url, defaultUrl: GS_DEFAULT_URL, enabled: cfg.enabled, hours: GS_HOURS, triggers: triggers,
    checkedAt: state.checkedAt || '', lastOkAt: state.lastOkAt || '', lastImportAt: state.lastImportAt || '', latest: state.latest || null, last: state.last || null,
    pending: state.pending || { total: 0, byProv: {} }, history: state.history || [], running: !!gsProps_().getProperty(GS_P.job),
    sheets: Object.keys(sh).map(n => ({ name: n, year: sh[n].year, rows: sh[n].rows, maxDate: sh[n].maxDate || '', readAt: sh[n].readAt || '', error: sh[n].error || '' })).sort((a, b) => a.year - b.year) };
}
function gsSyncStatusApi_(user) { requireNational_(user); return { ok: true, status: gsStatus_() }; }
/** ทดสอบลิงก์: เปิดได้ไหม · ชีตรายปี · หัวคอลัมน์ · จำนวนแถว (ไม่นำเข้า) */
function gsSyncTestApi_(user, b) {
  requireNational_(user);
  const url = String(b.url || '').trim(), id = gsIdFromUrl_(url);
  if (!id) throw new Error('ลิงก์ไม่ถูกต้อง — ต้องเป็นลิงก์ Google Sheet เช่น https://docs.google.com/spreadsheets/d/…');
  let ss;
  try { ss = SpreadsheetApp.openById(id); } catch (err) { throw new Error('เปิด Google Sheet ไม่ได้ — ตรวจสอบว่าแชร์ให้ "ทุกคนที่มีลิงก์ดูได้" หรือแชร์ให้บัญชีเจ้าของระบบ'); }
  const years = gsYearSheets_(ss).map(y => {
    const lastCol = y.sh.getLastColumn ? y.sh.getLastColumn() : 25, rows = Math.max(0, y.sh.getLastRow() - 1);
    const header = lastCol ? y.sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
    return { name: y.name, year: y.year, rows: rows, problem: rows ? gsHeaderProblem_(gsHeaderIndex_(header)) : '' };
  });
  if (!years.length) throw new Error('ไม่พบชีตรายปี (ชื่อชีตต้องมีปี 4 หลัก เช่น NOAA20_2026)');
  return { ok: true, title: ss.getName(), sheets: years, valid: years.some(y => y.rows && !y.problem) };
}
function gsSyncSaveApi_(user, b) {
  requireNational_(user);
  const p = gsProps_(), changed = [];
  if (b.url !== undefined) {
    const url = String(b.url || '').trim();
    const test = gsSyncTestApi_(user, { url: url });
    if (!test.valid) throw new Error('ลิงก์นี้ไม่มีชีตรายปีที่ใช้ได้ (ตรวจหัวคอลัมน์ Date, Province และพิกัด)');
    if (url !== gsConfig_().url) { p.setProperty(GS_P.url, url); const st = gsJson_(GS_P.state, {}); st.sheets = {}; st.pending = { total: 0, byProv: {} }; gsSaveJson_(GS_P.state, st); changed.push('url'); }
  }
  if (b.enabled !== undefined) { p.setProperty(GS_P.enabled, b.enabled ? '1' : '0'); changed.push('enabled=' + (b.enabled ? 'on' : 'off')); }
  if (changed.length) audit_(user, 'hs_sync_setup', 'ตั้งค่าดึง Google Sheet: ' + changed.join(' '));
  return { ok: true, status: gsStatus_() };
}
function gsSyncRunApi_(user, b) {
  requireNational_(user);
  return gsSyncRun_({ force: !!b.force, apply: !!b.apply, actor: user });
}
