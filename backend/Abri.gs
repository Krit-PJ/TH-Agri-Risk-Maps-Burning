/* ============================== ABRI-2Y v1.0: Agricultural Burning Risk Index — Historical HS Priority Ranking (ค่าเริ่มต้น v3.9) ==============================
 * วัตถุประสงค์: จำแนกระดับความเสี่ยงการเผาเชิงประวัติ (Historical Hotspot Risk) 4 ระดับ รายตำบล/อำเภอ จากจุดความร้อนที่เกิดขึ้นแล้ว
 *   เพื่อกำหนดพื้นที่เป้าหมายส่งเสริมการลดการเผาและการใช้ประโยชน์เศษวัสดุ — ไม่ใช่การทำนาย และไม่ใช่ความน่าจะเป็นการเผา
 * ปีฐาน (กฎหมุนอัตโนมัติ): ปีงบประมาณที่ประเมิน Y → ปีฐาน = Y−2 และ Y−1 (1 ต.ค.–30 ก.ย.) · ตรึงผลไว้ตลอดปีงบ Y
 *   Y = ปีงบถัดจากปีงบล่าสุดที่ครบแล้ว ณ วันสิ้นสุดช่วงที่เลือก (เลือกปีงบ 2569 ที่ครบแล้ว หรือปีงบ 2570 ที่กำลังดำเนิน → Y = 2570, ฐาน 2568+2569)
 *   ข้อมูลปีงบ Y เองใช้เพื่อเฝ้าระวัง (hs0) เท่านั้น ไม่นำมาคิดคะแนน
 * ข้อมูล: แหล่งข้อมูลหลัก ชุดที่เปิดใช้งาน ดาวเทียมตามนโยบายใน hsActive_ · ประเภทพื้นที่ที่เลือก (ค่าเริ่มต้นพื้นที่เกษตร)
 *   ในพื้นที่เกษตร/เขต สปก. ไม่นับจุดที่ PlantType = พื้นที่ป่า (ไม่ใช่การเผาเศษวัสดุเกษตร)
 * สูตร (Provisional — ยังไม่มีพื้นที่ปลูกรายพืชรายปี จึงยังไม่ปรับด้วยขนาดพื้นที่):
 *   N2Y_g = HS_{g,Y−2} + HS_{g,Y−1}
 *   ABRI_g = เปอร์เซ็นไทล์แบบลำดับกลาง (mid-rank) ของ N2Y เทียบหน่วยพื้นที่ในจังหวัดเดียวกันที่มี N2Y ≥ 3
 *   ระดับ: ABRI ≥ 90 สูงมาก · ≥ 75 สูง · ≥ 50 ปานกลาง · < 50 ต่ำ · N2Y < 3 = ต่ำ (เกณฑ์ขั้นต่ำ ไม่นำมาจัดลำดับ)
 *   ตำบลและอำเภอจัดลำดับแยกกัน (อำเภอ = ผลรวมจุดของทุกตำบลในอำเภอ) · ใช้ข้อมูลของจังหวัดนั้นเท่านั้น
 *   ข้อมูลประกอบ (ไม่คิดคะแนน): ชนิดพืชหลัก · ความหนาแน่นต่อพื้นที่เกษตร (ESA WorldCover) · จุดความร้อนปีงบ Y (เฝ้าระวัง) */
const ABRI_VERSION = 'ABRI-2Y-1.0';
const ABRI_CUTS = [50, 75, 90];
const ABRI_MIN_HS = 3;

/** ปีงบที่ประเมินจากวันสิ้นสุดช่วงที่เลือก */
function abriYear_(end) {
  const S = seasonOfDate_(end);
  return end >= (S - 543) + '-09-30' ? S + 1 : S;
}
/** ค่าเริ่มต้นของหน้าเว็บและ API = ปีงบประมาณล่าสุดที่ครบแล้ว (30 ก.ย.) */
function defaultEnd_() {
  const last = dataRange_().last; if (!last) return '';
  const S = seasonOfDate_(last), fyEnd = (S - 543) + '-09-30';
  return last >= fyEnd ? fyEnd : (S - 544) + '-09-30';
}
/** เปอร์เซ็นไทล์แบบลำดับกลาง 0–100 ของค่าแต่ละตัวในชุด */
function midrank_(vals) {
  const n = vals.length, s = vals.slice().sort((a, b) => a - b);
  const bound = (v, le) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (le ? s[m] <= v : s[m] < v) lo = m + 1; else hi = m; } return lo; };
  return vals.map(v => n ? (bound(v, false) + 0.5 * (bound(v, true) - bound(v, false))) / n * 100 : 0);
}
function riskLevel_(p) { return p >= ABRI_CUTS[2] ? 3 : p >= ABRI_CUTS[1] ? 2 : p >= ABRI_CUTS[0] ? 1 : 0; }
/** จัดระดับชุดหน่วยพื้นที่ภายในจังหวัด: counts = {code: N2Y} → {code: [level, score]} */
function rankUnits_(counts) {
  const elig = Object.keys(counts).filter(c => counts[c] >= ABRI_MIN_HS), p = midrank_(elig.map(c => counts[c])), out = {};
  Object.keys(counts).forEach(c => { out[c] = [0, 0]; });
  elig.forEach((c, i) => { out[c] = [riskLevel_(p[i]), Math.round(p[i] * 10) / 10]; });
  return out;
}

/** ABRI-2Y ของจังหวัด — ผลรายตำบลและรายอำเภอ (แคชตามปีงบที่ประเมิน) */
function riskAbri_(prov, endIso, landIn) {
  const land = landParam_(landIn), source = hsSource_(), range = dataRange_(source);
  let end = /^\d{4}-\d{2}-\d{2}$/.test(String(endIso || '')) ? String(endIso) : defaultEnd_();
  if (range.last && end > range.last) end = range.last;
  if (!end) return { ok: true, empty: true, model: 'ABRI', land: land, source: source };
  const Y = abriYear_(end), H = [Y - 1, Y - 2];
  const cache = CacheService.getScriptCache(), ver = cache.get('ver:all') || '0';
  const key = 'abri:' + prov + ':' + land + ':' + source + ':' + ver + ':' + ABRI_VERSION + ':' + Y;
  const hit = cacheGet_(cache, key); if (hit) return JSON.parse(hit);

  const months = {}; dataMonths_().forEach(m => { months[seasonOfDate_(m + '-01')] = (months[seasonOfDate_(m + '-01')] || 0) + 1; });
  const base = H.filter(s => months[s]);   // ปีฐานที่มีข้อมูล
  const agri = AGRI_LANDS.indexOf(land) >= 0, crop = cropRai_(), names = geoNames_();
  const tams = Object.keys(unitArea_().subdistrict).filter(c => c.slice(0, 2) === prov);
  const T = {}; tams.forEach(c => { T[c] = { n: {}, hs0: 0, plant: {} }; });
  hsActive_(prov, source).forEach(r => {
    if (!landMatch_(land, r[15]) || (agri && String(r[8]) === 'พื้นที่ป่า')) return;
    const t = T[String(r[4])]; if (!t) return;
    const s = seasonOfDate_(r[1]);
    if (s === Y) { t.hs0++; return; }
    if (base.indexOf(s) < 0) return;
    t.n[s] = (t.n[s] || 0) + 1;
    const pl = String(r[8] || 'อื่น ๆ'); t.plant[pl] = (t.plant[pl] || 0) + 1;
  });
  const sum = n => H.reduce((a, s) => a + (n[s] || 0), 0);
  const cropText = pl => { const tot = Object.keys(pl).reduce((a, k) => a + pl[k], 0); return tot ? Object.keys(pl).sort((a, b) => pl[b] - pl[a]).slice(0, 2).map(k => k + ' ' + Math.round(pl[k] * 100 / tot) + '%').join(' · ') : ''; };
  const dens = (n, A) => A >= 1 && base.length ? Math.round(n / base.length / (A / 1000) * 1000) / 1000 : null;
  const reason = (n, sc) => !n ? `ไม่พบจุดความร้อนในปีงบ ${H.slice().reverse().join('–')}` : n < ABRI_MIN_HS ? `จุดรวม ${n} จุด ต่ำกว่าเกณฑ์ขั้นต่ำ ${ABRI_MIN_HS} จุด` : `จุดรวม 2 ปี ${n} จุด · ลำดับ ${sc} จาก 100 ในจังหวัด`;
  const tc = {}; tams.forEach(c => { tc[c] = sum(T[c].n); });
  const tr = rankUnits_(tc), sub = {}, agg = {};
  tams.forEach(c => {
    const t = T[c], n = tc[c], A = crop[c] || 0, rk = tr[c];
    sub[c] = [rk[0], rk[1], n, t.n[H[0]] || 0, t.n[H[1]] || 0, t.hs0, cropText(t.plant), agri ? dens(n, A) : null, reason(n, rk[1])];
    const d = c.slice(0, 4), g = agg[d] || (agg[d] = { n: {}, hs0: 0, plant: {}, A: 0, nT: 0, nHigh: 0 });
    H.forEach(s => { g.n[s] = (g.n[s] || 0) + (t.n[s] || 0); }); g.hs0 += t.hs0; g.A += A; g.nT++; if (rk[0] >= 2) g.nHigh++;
    Object.keys(t.plant).forEach(k => { g.plant[k] = (g.plant[k] || 0) + t.plant[k]; });
  });
  const dists = Object.keys(unitArea_().district).filter(c => c.slice(0, 2) === prov), dc = {};
  dists.forEach(d => { dc[d] = agg[d] ? sum(agg[d].n) : 0; });
  const dr = rankUnits_(dc), dist = {};
  dists.forEach(d => {
    const g = agg[d] || { n: {}, hs0: 0, plant: {}, A: 0, nT: 0, nHigh: 0 }, n = dc[d], rk = dr[d];
    dist[d] = [rk[0], rk[1], n, g.n[H[0]] || 0, g.n[H[1]] || 0, g.hs0, cropText(g.plant), agri ? dens(n, g.A) : null, reason(n, rk[1]) + ` · ตำบลระดับสูง–สูงมาก ${g.nHigh}/${g.nT}`, g.nHigh, g.nT];
  });
  const result = { ok: true, model: 'ABRI', modelVersion: ABRI_VERSION, province: prov, land: land, source: source, season: Y, assessmentYear: Y, end: end, latest: range.last, first: range.first,
    history: base, baseYears: H, noHistory: !base.length, note: base.length < 2 && base.length ? `มีข้อมูลปีฐานเพียงปีงบ ${base[0]}` : '',
    window: { start: (Y - 544) + '-10-01', end: range.last }, cuts: ABRI_CUTS, minHs: ABRI_MIN_HS, satellitePolicy: SAT_POLICY_TEXT,
    cols: ['level', 'score', 'n2y', 'n1', 'n2', 'hs0', 'crop', 'density', 'reason'],
    distCols: ['level', 'score', 'n2y', 'n1', 'n2', 'hs0', 'crop', 'density', 'reason', 'nHigh', 'nTambon'],
    district: dist, subdistrict: sub,
    names: { district: dists.reduce((m, c) => (m[c] = names.district[c] || '', m), {}), subdistrict: tams.reduce((m, c) => (m[c] = names.subdistrict[c] || '', m), {}) } };
  cachePut_(cache, key, JSON.stringify(result));
  return result;
}
