/* ============================== RISK MODEL 5: ประเมินระดับความเสี่ยงการเผาย้อนหลังรายจังหวัด (ทางเลือก: ความหนาแน่นต่อพื้นที่เกษตร + การเผาซ้ำ) ==============================
 * วัตถุประสงค์: ใช้ข้อมูลจุดความร้อนที่เกิดขึ้นแล้ว 2–3 ปีงบประมาณ (เท่าที่มี) บ่งชี้ระดับความเสี่ยงการเผาของแต่ละตำบล/อำเภอ
 *   "ไม่ใช่การทำนาย" — เป็นการสรุปพฤติกรรมการเผาที่ผ่านมาของพื้นที่ เทียบกันภายในจังหวัดเดียวกัน (ใช้ข้อมูลของจังหวัดนั้นเท่านั้น)
 * ข้อมูล: แหล่งข้อมูลหลัก (ชุดที่เปิดใช้งาน) ประเภทพื้นที่ที่เลือก · ดาวเทียมหลัก Suomi-NPP (VIIRS) ตลอดช่วงที่มี แล้วจึงใช้ NOAA-20 (hsActive_)
 * ปีฐาน: ปีงบประมาณ (1 ต.ค.–30 ก.ย.) ของวันสิ้นสุดช่วงที่เลือก และย้อนหลังไม่เกิน 2 ปีที่มีข้อมูล (รวม ≤ 3 ปี)
 *   ใช้เฉพาะ "เดือนที่มีข้อมูลครบทุกปีฐาน" เพื่อให้เทียบกันได้ (ปัจจุบันไฟล์ปี 2567–2568 มีเฉพาะ ม.ค.–พ.ค.)
 * ตัวชี้วัดรายตำบล
 *   D = ความหนาแน่น: จำนวนจุดความร้อนเฉลี่ยต่อปี ต่อ 1,000 ไร่พื้นที่เพาะปลูก (ESA WorldCover; ประเภทพื้นที่อื่นใช้พื้นที่ตำบล)
 *   R = การเผาซ้ำ: สัดส่วนจุดที่อยู่ในกริด 1 กม. ที่พบจุดความร้อน ≥ 2 ปีฐาน (ใช้เมื่อมี ≥ 2 ปีฐาน)
 *   เกณฑ์ขั้นต่ำ: จุดรวมทุกปีฐาน < 3 จุด = ต่ำ และไม่นำมาจัดลำดับ (กันพื้นที่ที่พบจุดเพียง 1–2 จุดถูกจัดระดับสูงโดยอัตโนมัติ)
 *   คะแนน = 0.7·เปอร์เซ็นไทล์ของ D + 0.3·เปอร์เซ็นไทล์ของ R เทียบตำบลที่ผ่านเกณฑ์ขั้นต่ำในจังหวัดเดียวกัน
 *   ระดับ = ลำดับเปอร์เซ็นไทล์ของคะแนน: ≥ 90 สูงมาก · ≥ 75 สูง · ≥ 50 ปานกลาง · < 50 ต่ำ
 *   ไม่มีพื้นที่เพาะปลูก = ไม่ประเมิน · แนวโน้ม (ปีล่าสุดเทียบค่าเฉลี่ยปีก่อน) และชนิดพืช = ข้อมูลประกอบ ไม่คิดคะแนน
 * อำเภอ: รวมจุดและพื้นที่เกษตรของทุกตำบลในอำเภอ แล้วคำนวณและจัดลำดับเทียบอำเภออื่นในจังหวัดด้วยวิธีเดียวกัน */
const M5_VERSION = 'M5-2569.1';
const M5_CUTS = [50, 75, 90];
const M5_W = { D: 0.7, R: 0.3 };
const M5_MIN_HS = 3;
const M5_GRID_M = 1000;
const M5_MAX_YEARS = 3;
const M5_COS = Math.cos(17 * Math.PI / 180);
const MONTH_TH_ = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const FY_MONTHS_ = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function fyYm_(s, m) { return (m >= 10 ? s - 544 : s - 543) + '-' + pad2_(m); }
/** ข้อความช่วงเดือน เช่น [1,2,3,4,5] → "ม.ค.–พ.ค." (เรียงตามปีงบประมาณ) */
function monthsText_(ms) {
  if (ms.length === 12) return 'ทั้งปีงบประมาณ (ต.ค.–ก.ย.)';
  const ord = FY_MONTHS_.filter(m => ms.indexOf(m) >= 0), runs = [];
  ord.forEach(m => { const last = runs[runs.length - 1], i = FY_MONTHS_.indexOf(m); if (last && FY_MONTHS_.indexOf(last[1]) === i - 1) last[1] = m; else runs.push([m, m]); });
  return runs.map(r => r[0] === r[1] ? MONTH_TH_[r[0]] : MONTH_TH_[r[0]] + '–' + MONTH_TH_[r[1]]).join(', ');
}
/** ปีฐานและเดือนที่ใช้: ปีงบ S ย้อนหลัง ≤ 3 ปีที่มีข้อมูล · เดือน = เดือนที่มีข้อมูลครบทุกปีฐาน (ปี S ตัดที่วันสิ้นสุด) */
function m5Years_(S, end) {
  const dm = {}; dataMonths_().forEach(x => { dm[x] = 1; });
  const cov = s => FY_MONTHS_.filter(m => dm[fyYm_(s, m)] && (s < S || fyYm_(s, m) <= end.slice(0, 7)));
  let H = [];
  for (let s = S; s >= S - 8 && H.length < M5_MAX_YEARS; s--) if (cov(s).length) H.push(s);
  const inter = hs => hs.reduce((acc, s) => { const c = cov(s); return acc.filter(m => c.indexOf(m) >= 0); }, FY_MONTHS_.slice());
  let W = inter(H);
  if (!W.length && H.length > 1 && H[0] === S && cov(S).length < 12) {
    // ปีงบ S ยังมีข้อมูลไม่ครอบคลุมเดือนเดียวกับปีก่อน → ประเมินจากปีงบที่ผ่านมา (≤ 3 ปี) และแจ้งไว้
    const r = m5Years_(S - 1, (S - 543) + '-09-30');
    return { H: r.H, W: r.W, note: `ปีงบ ${S} มีข้อมูลเฉพาะ ${monthsText_(cov(S))} ยังไม่ครอบคลุมเดือนเดียวกับปีฐาน จึงประเมินจากปีงบ ${r.H.slice().sort().join(', ')}` };
  }
  while (!W.length && H.length > 1) { H = H.slice(0, -1); W = inter(H); }
  return { H: H, W: W, note: '' };
}
function m5Level_(p) { return p >= M5_CUTS[2] ? 3 : p >= M5_CUTS[1] ? 2 : p >= M5_CUTS[0] ? 1 : 0; }

/** Model 5 ของจังหวัด ณ วันสิ้นสุด endIso (ค่าเริ่มต้น = วันล่าสุดของข้อมูล) */
function riskM5_(prov, endIso, landIn) {
  const land = landParam_(landIn), source = hsSource_();
  const cache = CacheService.getScriptCache(), ver = cache.get('ver:all') || '0';
  const endKey = /^\d{4}-\d{2}-\d{2}$/.test(String(endIso || '')) ? String(endIso) : 'latest';
  const key = 'm5:' + prov + ':' + land + ':' + source + ':' + ver + ':' + M5_VERSION + ':' + endKey;
  const hit = cacheGet_(cache, key); if (hit) return JSON.parse(hit);

  const range = dataRange_(source);
  let end = endKey === 'latest' ? range.last : endKey;
  if (range.last && end > range.last) end = range.last;
  if (!end) return { ok: true, empty: true, model: 'M5', land: land, source: source };
  const S = seasonOfDate_(end), yw = m5Years_(S, end), H = yw.H, W = yw.W;   // S = ปีงบที่เลือก
  const agri = AGRI_LANDS.indexOf(land) >= 0, crop = cropRai_(), area = unitArea_().subdistrict, names = geoNames_();
  const tams = Object.keys(area).filter(c => c.slice(0, 2) === prov);
  const denom = c => agri ? (crop[c] || 0) : (area[c] || 0);
  const fyStart = (S - 544) + '-10-01';
  const T = {}, cellYears = {}, pts = [];
  hsActive_(prov, source).forEach(r => {
    if (!landMatch_(land, r[15])) return;
    const date = normalizeDate_(r[1]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > end) return;
    const tam = String(r[4]); if (!tam) return;
    const t = T[tam] || (T[tam] = { n: {}, hs0: 0, plant: {}, pts: 0, rep: 0 });
    if (date >= fyStart) t.hs0++;   // จุดความร้อนปีงบ S ถึงวันสิ้นสุด (ทุกเดือน) — ข้อมูลปีล่าสุดที่แสดงบนแผนที่
    const s = seasonOfDate_(date), m = +date.slice(5, 7);
    if (H.indexOf(s) < 0 || W.indexOf(m) < 0) return;
    t.n[s] = (t.n[s] || 0) + 1; t.pts++;
    const pl = String(r[8] || 'อื่น ๆ'); t.plant[pl] = (t.plant[pl] || 0) + 1;
    const lat = Number(r[9]), lng = Number(r[10]);
    const cell = isFinite(lat) && isFinite(lng) ? Math.floor(lng * 111320 * M5_COS / M5_GRID_M) + '_' + Math.floor(lat * 110574 / M5_GRID_M) : '';
    if (cell) { const cy = cellYears[cell] || (cellYears[cell] = {}); cy[s] = 1; }
    pts.push([tam, cell]);
  });
  pts.forEach(p => { if (p[1] && Object.keys(cellYears[p[1]]).length >= 2) T[p[0]].rep++; });
  const nY = H.length || 1, useR = H.length >= 2;
  const r1 = x => Math.round(x * 10) / 10, r3 = x => Math.round(x * 1000) / 1000;
  const cropText = pl => { const tot = Object.keys(pl).reduce((a, k) => a + pl[k], 0); return tot ? Object.keys(pl).sort((a, b) => pl[b] - pl[a]).slice(0, 2).map(k => k + ' ' + Math.round(pl[k] * 100 / tot) + '%').join(' · ') : ''; };

  /** ให้คะแนน/ระดับชุดหน่วย (ตำบลหรืออำเภอ) ภายในจังหวัด: u = {code: {A, n:{s}, pts, rep}} */
  const scoreUnits = u => {
    const codes = Object.keys(u).filter(c => u[c].A >= 1);
    const tot = c => H.reduce((a, s) => a + (u[c].n[s] || 0), 0);
    const dens = c => tot(c) / nY / (u[c].A / 1000), rep = c => useR && u[c].pts >= M5_MIN_HS ? u[c].rep / u[c].pts : 0;
    // จัดลำดับเฉพาะพื้นที่ที่พบจุดรวม ≥ เกณฑ์ขั้นต่ำ (พื้นที่ที่ไม่พบ/พบน้อย = ต่ำ) — กันช่วงระดับหายเมื่อมีพื้นที่ไม่พบจุดจำนวนมาก
    const elig = codes.filter(c => tot(c) >= M5_MIN_HS);
    const D = elig.map(dens), R = elig.map(rep), pD = midrank_(D), pR = midrank_(R);
    const pS = midrank_(elig.map((c, i) => useR ? M5_W.D * pD[i] + M5_W.R * pR[i] : pD[i]));
    const out = {};
    codes.forEach(c => { const t = tot(c); out[c] = { lvl: 0, score: 0, D: r3(dens(c)), R: useR ? Math.round(rep(c) * 100) : null, tot: t, floored: t < M5_MIN_HS }; });
    elig.forEach((c, i) => { out[c].lvl = m5Level_(pS[i]); out[c].score = r1(pS[i]); });
    const ref = { units: codes.length, ranked: elig.length, dP50: r3(percentile_(D, 50)), dP75: r3(percentile_(D, 75)), dP90: r3(percentile_(D, 90)) };
    return { out: out, ref: ref };
  };
  const reasonOf = (o, nYears) => {
    if (!o.tot) return `ไม่พบจุดความร้อนใน ${nYears} ปีฐาน`;
    if (o.floored) return `จุดรวม ${o.tot} จุดใน ${nYears} ปีฐาน ต่ำกว่าเกณฑ์ขั้นต่ำ ${M5_MIN_HS} จุด`;
    return `เฉลี่ย ${r3(o.D)} จุด/1,000 ไร่${agri ? 'เกษตร' : ''}/ปี · ลำดับ ${r1(o.score)} จาก 100 ในจังหวัด${o.R !== null ? ` · จุดในพื้นที่เผาซ้ำ ${o.R}%` : ''}`;
  };

  const tu = {}; tams.forEach(c => { const t = T[c] || { n: {}, pts: 0, rep: 0 }; tu[c] = { A: denom(c), n: t.n, pts: t.pts, rep: t.rep }; });
  const ts = scoreUnits(tu);
  const sub = {}, agg = {};
  tams.forEach(c => {
    const t = T[c] || { n: {}, hs0: 0, plant: {}, pts: 0, rep: 0 }, A = tu[c].A, ns = H.map(s => t.n[s] || 0);
    const last = ns[0] || 0, prevMean = ns.length > 1 ? Math.round(ns.slice(1).reduce((a, b) => a + b, 0) / (ns.length - 1)) : null;
    const tr = ns.length > 1 ? trend_(last, prevMean) : '';
    const nn = [0, 1, 2].map(i => ns[i] === undefined ? null : ns[i]);
    if (!(A >= 1) || !H.length) {
      sub[c] = [-1, null, null, null, Math.round(A), nn[0], nn[1], nn[2], t.hs0, tr, cropText(t.plant), !(A >= 1) ? 'ไม่มีพื้นที่เพาะปลูกในข้อมูลพื้นที่เกษตร' : 'ยังไม่มีข้อมูลปีฐาน'];
    } else {
      const o = ts.out[c];
      sub[c] = [o.lvl, o.score, o.D, o.R, Math.round(A), nn[0], nn[1], nn[2], t.hs0, tr, cropText(t.plant), reasonOf(o, H.length)];
    }
    const d = c.slice(0, 4), g = agg[d] || (agg[d] = { A: 0, n: {}, pts: 0, rep: 0, hs0: 0, plant: {}, nT: 0, nHigh: 0, cropHigh: 0 });
    g.nT++; g.hs0 += t.hs0;
    Object.keys(t.plant).forEach(k => { g.plant[k] = (g.plant[k] || 0) + t.plant[k]; });
    if (A >= 1) { g.A += A; g.pts += t.pts; g.rep += t.rep; H.forEach(s => { g.n[s] = (g.n[s] || 0) + (t.n[s] || 0); }); if (sub[c][0] >= 2) { g.nHigh++; g.cropHigh += A; } }
  });
  const ds = scoreUnits(agg), dist = {};
  Object.keys(unitArea_().district).filter(c => c.slice(0, 2) === prov).forEach(d => {
    const g = agg[d] || { A: 0, n: {}, hs0: 0, plant: {}, nT: 0, nHigh: 0, cropHigh: 0 }, ns = H.map(s => g.n[s] || 0);
    const nn = [0, 1, 2].map(i => ns[i] === undefined ? null : ns[i]);
    const tr = ns.length > 1 ? trend_(ns[0], Math.round(ns.slice(1).reduce((a, b) => a + b, 0) / (ns.length - 1))) : '';
    const o = ds.out[d];
    if (!o || !H.length) { dist[d] = [-1, null, null, null, Math.round(g.A), nn[0], nn[1], nn[2], g.hs0, tr, cropText(g.plant), 'ไม่มีพื้นที่เพาะปลูกในข้อมูลพื้นที่เกษตร', 0, 0, g.nT]; return; }
    dist[d] = [o.lvl, o.score, o.D, o.R, Math.round(g.A), nn[0], nn[1], nn[2], g.hs0, tr, cropText(g.plant),
      reasonOf(o, H.length) + ` · ตำบลระดับสูง–สูงมาก ${g.nHigh}/${g.nT} ตำบล`, g.nHigh, Math.round(g.cropHigh), g.nT];
  });
  const result = { ok: true, model: 'M5', modelVersion: M5_VERSION, province: prov, land: land, source: source, season: S, end: end, latest: range.last, first: range.first,
    history: H, seasons: H, months: W, monthsText: monthsText_(W), fullYear: W.length === 12, noHistory: !H.length, note: yw.note,
    window: { start: fyStart, end: end }, cuts: M5_CUTS, weights: M5_W, minHs: M5_MIN_HS, gridM: M5_GRID_M, satellitePolicy: SAT_POLICY_TEXT,
    ref: { subdistrict: ts.ref, district: ds.ref },
    cols: ['level', 'score', 'D', 'R', 'cropRai', 'n0', 'n1', 'n2', 'hs0', 'trend', 'crop', 'reason'],
    distCols: ['level', 'score', 'D', 'R', 'cropRai', 'n0', 'n1', 'n2', 'hs0', 'trend', 'crop', 'reason', 'nHigh', 'cropHigh', 'nTambon'],
    district: dist, subdistrict: sub, names: { district: Object.keys(dist).reduce((m, c) => (m[c] = names.district[c] || '', m), {}),
      subdistrict: tams.reduce((m, c) => (m[c] = names.subdistrict[c] || '', m), {}) } };
  cachePut_(cache, key, JSON.stringify(result));
  return result;
}
