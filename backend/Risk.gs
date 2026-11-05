/* ============================== RISK MODEL: Burning Risk Index (BRI) ==============================
 * BRI = 0.60·D + 0.20·P + 0.20·C  (เอกสาร: สูตร Model ประเมินพื้นที่เสี่ยงเผาในพื้นที่เกษตร — ข้อเสนอเชิงวิชาการ)
 *  D = ความหนาแน่น HS ถ่วงฤดู (0.40/0.35/0.25 ใหม่→เก่า) ปรับด้วย Empirical Bayes แล้วเทียบเปอร์เซ็นไทล์กับฤดูอ้างอิง
 *  P = การเกิดซ้ำ: สัดส่วนฤดูที่พบ HS · C = คะแนนชนิดพืชของจุด HS (45→0, 90→100)
 *  ระดับ 4 ระดับ: จุดตัด P50/P75/P90 ของ BRI ในฤดูอ้างอิง (ค่าเริ่มต้น 2567–2568) แล้วแปลงเป็นคะแนนแสดงผล 25/50/75
 *  ทุกฤดูใช้ช่วงวันเดียวกัน (1 ต.ค. → วันสิ้นสุด) ก่อน 30 พ.ย. ใช้ฤดูที่ครบล่าสุด (ข้อมูลต้นฤดูยังน้อยเกินไป)
 *  คำนวณจากทุกจังหวัดที่มีข้อมูล (เทียบข้ามจังหวัดได้) และใช้แหล่งข้อมูลหลักเพียงแหล่งเดียว */
const RISK_W = { D: 0.60, P: 0.20, C: 0.20 };
const RISK_SEASON_W = [0.40, 0.35, 0.25];
const RISK_CROP = { 'นาข้าว': 70, 'อ้อย': 80, 'ข้าวโพดและไร่หมุนเวียน': 90, 'เกษตรอื่น ๆ': 55, 'อื่น ๆ': 45 };
const RISK_LEVEL_LABELS = ['ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'];

function hsSource_() { const s = setting_('hs_source').toUpperCase(); return s === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }
function refSeasons_() {
  const v = setting_('risk_ref_seasons') || '2567,2568';
  const list = v.split(',').map(x => Number(String(x).trim())).filter(x => x > 2500 && x < 2700);
  return list.length ? list.sort((a, b) => b - a) : [2568, 2567];
}
function rowSource_(v) { return String(v || '').toUpperCase() === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }

/** อ่านจุด HS ของแหล่งข้อมูลหลักจากทุกจังหวัด: [{date, d, s, plant}] */
function riskRows_(source) {
  const out = [];
  db_().getSheets().filter(sh => /^HS_\d{2}$/.test(sh.getName())).forEach(sh => {
    const last = sh.getLastRow(); if (last < 2) return;
    sh.getRange(2, 1, last - 1, HS_HEADERS.length).getValues().forEach(r => {
      if (!r[0] || rowSource_(r[13]) !== source) return;
      const date = normalizeDate_(r[1]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      out.push({ date: date, d: String(r[3]), s: String(r[4]), plant: String(r[8]) });
    });
  });
  return out;
}

const pad2_ = n => ('0' + n).slice(-2);
function seasonOfDate_(iso) { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 10 ? y + 544 : y + 543; }
/** ช่วงของฤดู s ตัดที่วันเดียวกับ md ({m,d}) หรือทั้งฤดูเมื่อ md = null */
function seasonWindow_(s, md) {
  const y0 = s - 544, start = y0 + '-10-01', full = (y0 + 1) + '-09-30';
  if (!md) return { start: start, end: full };
  const y = md.m >= 10 ? y0 : y0 + 1;
  const dim = new Date(Date.UTC(y, md.m, 0)).getUTCDate();
  const end = y + '-' + pad2_(md.m) + '-' + pad2_(Math.min(md.d, dim));
  return { start: start, end: end < full ? end : full };
}

function percentile_(arr, p) {
  const a = arr.slice().sort((x, y) => x - y); if (!a.length) return 0;
  const idx = (a.length - 1) * p / 100, lo = Math.floor(idx), hi = Math.ceil(idx);
  return a[lo] + (a[hi] - a[lo]) * (idx - lo);
}
/** Empirical Bayes (global, method of moments) สำหรับอัตราต่อพื้นที่ — Clayton & Kaldor (1987) */
function ebRates_(o, rai) {
  const E = rai.map(x => x / 1e5), sumE = E.reduce((a, b) => a + b, 0) || 1;
  const r = o.map((x, i) => E[i] > 0 ? x / E[i] : 0);
  const mu = o.reduce((a, b) => a + b, 0) / sumE;
  const meanE = sumE / E.length;
  const s2 = Math.max(E.reduce((a, e, i) => a + e * Math.pow(r[i] - mu, 2), 0) / sumE - mu / meanE, 1e-9);
  return r.map((x, i) => { const B = mu / (mu + s2 * E[i]); return B * mu + (1 - B) * x; });
}
function ecdf_(sortedRef, x) { let lo = 0, hi = sortedRef.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedRef[m] <= x) lo = m + 1; else hi = m; } return sortedRef.length ? lo / sortedRef.length * 100 : 0; }

/** คำนวณ BRI ทุกหน่วยของทุกจังหวัดที่มีข้อมูล ณ วันสิ้นสุด endIso (แคชตามแหล่งข้อมูล/วันที่/เวอร์ชันข้อมูล) */
function riskNational_(endIso) {
  const source = hsSource_();
  const cache = CacheService.getScriptCache();
  const key = 'risk1:' + source + ':' + (endIso || 'latest') + ':' + (cache.get('ver:all') || '0') + ':' + refSeasons_().join('-');
  const hit = cacheGet_(cache, key); if (hit) return JSON.parse(hit);

  const rows = riskRows_(source);
  if (!rows.length) return { ok: true, empty: true, source: source };
  const dates = rows.map(r => r.date).sort(), first = dates[0], latest = dates[dates.length - 1];
  let end = /^\d{4}-\d{2}-\d{2}$/.test(String(endIso || '')) ? String(endIso) : latest;
  if (end > latest) end = latest;
  let S = seasonOfDate_(end), md = { m: +end.slice(5, 7), d: +end.slice(8, 10) }, early = false;
  if (end < (S - 544) + '-11-30') { S -= 1; md = null; early = true; }         // ต้นฤดู: ใช้ฤดูที่ครบล่าสุด
  const seasons = [S, S - 1, S - 2].filter(s => seasonWindow_(s, null).end >= first);
  const ref = refSeasons_().filter(s => seasonWindow_(s, null).end >= first);
  const provs = {}; rows.forEach(r => { provs[r.d.slice(0, 2)] = 1; });
  const areas = unitArea_();
  const result = { ok: true, source: source, season: S, early: early, end: end, latest: latest, first: first,
    window: seasonWindow_(S, md), seasons: seasons, refSeasons: ref, cuts: {}, units: {} };

  ['district', 'subdistrict'].forEach(level => {
    const codes = Object.keys(areas[level]).filter(c => provs[c.slice(0, 2)]);
    const idx = {}; codes.forEach((c, i) => { idx[c] = i; });
    const rai = codes.map(c => areas[level][c]);
    const field = level === 'district' ? 'd' : 's';
    const countFor = s => { const w = seasonWindow_(s, md), arr = new Array(codes.length).fill(0);
      rows.forEach(r => { if (r.date >= w.start && r.date <= w.end && idx[r[field]] !== undefined) arr[idx[r[field]]]++; }); return arr; };
    const cropFor = list => { const sum = new Array(codes.length).fill(0), n = new Array(codes.length).fill(0);
      const wins = list.map(s => seasonWindow_(s, md));
      rows.forEach(r => { const i = idx[r[field]]; if (i === undefined || !wins.some(w => r.date >= w.start && r.date <= w.end)) return;
        sum[i] += (RISK_CROP[r.plant] !== undefined ? RISK_CROP[r.plant] : 50); n[i]++; });
      return sum.map((v, i) => n[i] ? Math.max(0, Math.min(100, (v / n[i] - 45) / 45 * 100)) : 0); };
    const score = (hist, crop, refSorted) => {
      const w = RISK_SEASON_W.slice(0, hist.length), tw = w.reduce((a, b) => a + b, 0) || 1;
      const o = codes.map((_, i) => hist.reduce((a, h, k) => a + h[i] * w[k] / tw, 0));
      const R = ebRates_(o, rai);
      return codes.map((_, i) => {
        const D = ecdf_(refSorted, R[i]);
        const P = hist.reduce((a, h) => a + (h[i] > 0 ? 1 : 0), 0) / hist.length * 100;
        const bri = o[i] > 0 ? RISK_W.D * D + RISK_W.P * P + RISK_W.C * crop[i] : 0;
        return { bri: bri, D: D, P: P, C: crop[i] };
      });
    };
    // ฤดูอ้างอิง: การแจกแจงความหนาแน่นและจุดตัดระดับ
    const refHist = ref.map(countFor);
    const refDens = [].concat.apply([], refHist.map(h => ebRates_(h, rai))).sort((a, b) => a - b);
    const refScores = refHist.length ? score(refHist, cropFor(ref), refDens).map(x => x.bri) : [];
    const cuts = refScores.length ? [percentile_(refScores, 50), percentile_(refScores, 75), percentile_(refScores, 90)] : [25, 50, 75];
    result.cuts[level] = cuts.map(x => Math.round(x * 10) / 10);
    // ฤดูที่ประเมิน
    const hist = seasons.map(countFor);
    const sc = score(hist, cropFor(seasons), refDens);
    const disp = b => { const c = cuts, seg = (v, a, z, lo) => lo + 25 * Math.max(0, Math.min(1, (v - a) / Math.max(1e-9, z - a)));
      return b < c[0] ? seg(b, 0, c[0], 0) : b < c[1] ? seg(b, c[0], c[1], 25) : b < c[2] ? seg(b, c[1], c[2], 50) : Math.min(100, seg(b, c[2], 100, 75)); };
    const units = {};
    codes.forEach((c, i) => {
      const b = sc[i].bri, lvl = b <= 0 ? 0 : b < cuts[0] ? 0 : b < cuts[1] ? 1 : b < cuts[2] ? 2 : 3;
      const h0 = hist[0] ? hist[0][i] : 0, h1 = hist[1] ? hist[1][i] : 0, h2 = hist[2] ? hist[2][i] : 0;
      const base = hist.length >= 3 ? 0.6 * h1 + 0.4 * h2 : h1;
      const lr = Math.log((h0 + 3) / (base + 3)) / Math.LN2;
      const arrow = hist.length < 2 ? '' : (lr > 0.32 && h0 - base >= 3) ? 'up' : (lr < -0.32 && base - h0 >= 3) ? 'down' : 'flat';
      const r1 = x => Math.round(x * 10) / 10;
      units[c] = [lvl, r1(b), r1(disp(b)), r1(sc[i].D), r1(sc[i].P), r1(sc[i].C), h0, h1, h2, r1(base), arrow];
    });
    result.units[level] = units;
  });
  cachePut_(cache, key, JSON.stringify(result));
  return result;
}

/** ผลการประเมินของจังหวัด — ประชาชนได้เฉพาะระดับและจำนวนจุด ส่วนผู้ดูแลได้รายละเอียดคะแนนและแนวโน้ม */
function riskForProvince_(prov, endIso, detailed) {
  prov = String(prov || '').padStart(2, '0');
  if (!PROVINCES[prov]) return { ok: false, error: 'invalid province' };
  const nat = riskNational_(endIso);
  if (nat.empty) return { ok: true, empty: true, source: nat.source };
  const pick = units => {
    const out = {};
    Object.keys(units).forEach(c => { if (c.slice(0, 2) !== prov) return; const u = units[c]; out[c] = detailed ? u : [u[0], u[6]]; });
    return out;
  };
  const res = { ok: true, province: prov, source: nat.source, season: nat.season, early: nat.early, end: nat.end, latest: nat.latest,
    window: nat.window, seasons: nat.seasons, levels: RISK_LEVEL_LABELS, detailed: !!detailed,
    cols: detailed ? ['level', 'bri', 'score', 'D', 'P', 'C', 'hs0', 'hs1', 'hs2', 'base', 'trend'] : ['level', 'hs0'],
    district: pick(nat.units.district), subdistrict: pick(nat.units.subdistrict) };
  if (detailed) { res.cuts = nat.cuts; res.refSeasons = nat.refSeasons; res.weights = RISK_W; }
  return res;
}

/** ข้อมูลทั้งสองแหล่งของจังหวัด สำหรับหน้าเปรียบเทียบ (ผู้ดูแลในขอบเขตสิทธิ์) */
function hsCompare_(user, b) {
  const prov = requireProvince_(user, b.provinceCode);
  const sh = hsSheet_(prov, false);
  const rows = (sh && sh.getLastRow() > 1) ? sh.getRange(2, 1, sh.getLastRow() - 1, HS_HEADERS.length).getValues() : [];
  return { ok: true, province: prov, active: hsSource_(), cols: ['date', 'time', 'dCode', 'sCode', 'plant', 'lat', 'lng', 'source', 'satellite'],
    rows: rows.filter(r => r[0]).map(r => [normalizeDate_(r[1]), normalizeTime_(r[2]), String(r[3]), String(r[4]), r[8], Number(r[9]), Number(r[10]), rowSource_(r[13]), String(r[14] || '')]) };
}

/** ติดตั้ง v3.4: เพิ่มคอลัมน์ source/satellite ใน HS_xx — ข้อมูลเดิมทั้งหมดเป็นข้อมูลจากหน่วยงานต้นสังกัด (AGENCY) */
function migrateHsSource_() {
  let n = 0;
  db_().getSheets().filter(sh => /^HS_\d{2}$/.test(sh.getName())).forEach(sh => {
    sh.getRange(1, 1, 1, HS_HEADERS.length).setValues([HS_HEADERS]).setFontWeight('bold').setBackground('#14532d').setFontColor('#ffffff');
    const last = sh.getLastRow(); if (last < 2) return;
    const ids = sh.getRange(2, 1, last - 1, 1).getValues();
    const rng = sh.getRange(2, 14, last - 1, 2), vals = rng.getValues();
    let changed = false;
    const next = vals.map((r, i) => {
      const src = r[0] || 'AGENCY', sat = r[1] || satelliteFromId_(ids[i][0]);
      if (src !== r[0] || sat !== r[1]) { changed = true; n++; }
      return [src, sat];
    });
    if (changed) { rng.setValues(next); bumpCache_(sh.getName().slice(3)); }
  });
  return n;
}
function satelliteFromId_(id) { const m = String(id || '').match(/^VI(\d)/); return m ? ({ '1': 'Suomi-NPP', '2': 'NOAA-20', '3': 'NOAA-21' }[m[1]] || '') : ''; }

/** เรียกจาก Editor ครั้งเดียว: ระบุแหล่งข้อมูล FIRMS ให้ชุดข้อมูลที่นำเข้าจากไฟล์ FIRMS ก่อนหน้าเว็บรองรับคอลัมน์ Source
 *  (เงื่อนไข: ชื่อไฟล์ของชุดข้อมูลมีคำว่า FIRMS และ hsID รูปแบบ VIn + เวลา UTC + _lat_lon ที่ระบบสร้างจาก NASA FIRMS) */
function retagFirmsBatches() {
  const batches = readAll_('Batches').filter(b => /FIRMS/i.test(String(b.fileName || '')));
  const ids = {}; batches.forEach(b => { ids[String(b.batchId)] = 1; });
  let n = 0;
  db_().getSheets().filter(sh => /^HS_\d{2}$/.test(sh.getName())).forEach(sh => {
    const last = sh.getLastRow(); if (last < 2) return;
    const data = sh.getRange(2, 1, last - 1, HS_HEADERS.length).getValues();
    const rng = sh.getRange(2, 14, last - 1, 2), vals = rng.getValues();
    let changed = 0;
    data.forEach((r, i) => {
      if (ids[String(r[11])] && /^VI\d\d{12}_\d+_\d+$/.test(String(r[0])) && vals[i][0] !== 'FIRMS') { vals[i] = ['FIRMS', vals[i][1] || satelliteFromId_(r[0])]; changed++; }
    });
    if (changed) { rng.setValues(vals); n += changed; refreshSummary_(sh.getName().slice(3)); bumpCache_(sh.getName().slice(3)); }
  });
  batches.forEach(b => { if (String(b.source || '') !== 'FIRMS') updateRow_('Batches', b._row, { source: 'FIRMS' }); });
  bumpCache_('all');
  audit_({ sub: 'EDITOR', role: 'system', prov: '' }, 'hs_retag', 'FIRMS ' + n + ' จุด จาก ' + batches.length + ' ชุดข้อมูล');
  Logger.log('retagged ' + n + ' rows in ' + batches.length + ' batches');
  return n;
}
