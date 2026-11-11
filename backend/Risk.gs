/* ============================== RISK MODEL: Burning Risk Index (BRI) v2 ==============================
 * เป้าหมาย: ประเมิน "โอกาสเกิดการเผา" ของพื้นที่ (อำเภอ/ตำบล) ในฤดูที่กำลังจะมาถึง/กำลังดำเนินอยู่ เพื่อวางแผนเฝ้าระวังล่วงหน้า
 * หลักการ (คู่มือ: docs/Agri-Risk-Manual.pdf)
 *  1) ฐานการประเมิน = ฤดูที่ครบแล้ว (1 ต.ค.–30 ก.ย.) ล่าสุดไม่เกิน 3 ฤดู ทั้งฤดู — พฤติกรรมการเผาเกิดซ้ำที่เดิมสูง
 *     (ตรวจสอบย้อนหลังด้วย NASA FIRMS 2566–2569: ฤดูก่อนทำนายฤดูถัดไปได้ ρ 0.94–0.95, AUC 0.97–0.98 ระดับอำเภอ)
 *     ไม่ใช้ข้อมูลต้นฤดูปัจจุบันเป็นฐาน เพราะต้นฤดูยังน้อยและ (สำหรับพื้นที่ป่า) ไม่สัมพันธ์กับช่วงพีค
 *  2) BRI = wD·D + wP·P + wC·C  (0–100)
 *     D = ความหนาแน่น HS ต่อพื้นที่ ถ่วงฤดู 0.40/0.35/0.25 (ใหม่→เก่า) ปรับเสถียรด้วย Empirical Bayes (Clayton & Kaldor 1987)
 *         แล้วแปลงเป็นเปอร์เซ็นไทล์เทียบการแจกแจงของฤดูอ้างอิง
 *     P = การเกิดซ้ำ: สัดส่วนฤดูที่พบ HS (ต้องมี ≥ 2 ฤดู) · C = คะแนนชนิดพืชของจุด HS (เฉพาะพื้นที่เกษตร/เขต สปก.)
 *     น้ำหนักปรับตามจำนวนฤดูที่มี (k):  พื้นที่เกษตร k≥2 → 0.60/0.20/0.20 · k=1 → 0.80/0/0.20
 *                                      พื้นที่อื่น/ทุกประเภท k≥2 → 0.75/0.25/0 · k=1 → 1.00/0/0
 *  3) 4 ระดับ: จุดตัด P50/P75/P90 ของ BRI ในฤดูอ้างอิง (auto = ฤดูฐานการประเมิน) แสดงผลเป็นคะแนน 25/50/75
 *  4) สัญญาณเฝ้าระวัง (ผู้ดูแล): จำนวน HS ฤดูปัจจุบันถึงวันที่เลือก เทียบช่วงเดียวกันของฤดูก่อน → ลูกศรแนวโน้ม
 *  ฐานการเปรียบเทียบ (μ, s² ของ EB, การแจกแจงอ้างอิง และจุดตัด) คำนวณจากข้อมูลของจังหวัดนั้นเอง (ฐานรายจังหวัด)
 *  ใช้แหล่งข้อมูลหลักเดียว และเฉพาะชุดข้อมูลที่เปิดใช้งาน
 *  สูตรที่เลือกใช้ได้ (ตั้งค่าระบบ risk_model): BRI2 = Model 3 BRI เวอร์ชัน 2 (ค่าเริ่มต้น, คำนวณที่นี่)
 *                                          PROTO = Model 1 ต้นแบบ (คำนวณที่หน้าเว็บจากข้อมูลจังหวัดและช่วงที่เลือก — js/map.js) */
const RISK_MODELS = ['M4', 'BRI2', 'PROTO'];   // M4 = Model 4 (ค่าเริ่มต้น, Model4.gs) · BRI2 = Model 3 · PROTO = Model 1
const RISK_MODEL_LABELS = { M4: 'Model 4: คะแนนจัดลำดับเฝ้าระวังการเผาเกษตร (ความหนาแน่นต่อพื้นที่เกษตร เกณฑ์กลาง)', BRI2: 'Model 3: BRI เวอร์ชัน 2 (ฐานรายจังหวัด)', PROTO: 'Model 1: ต้นแบบ' };
function riskModel_() { const v = String(setting_('risk_model') || '').toUpperCase(); return RISK_MODELS.indexOf(v) >= 0 ? v : 'M4'; }
const RISK_SEASON_W = [0.40, 0.35, 0.25];
const RISK_CROP = { 'นาข้าว': 70, 'อ้อย': 80, 'ข้าวโพดและไร่หมุนเวียน': 90, 'เกษตรอื่น ๆ': 55, 'พื้นที่ป่า': 50, 'อื่น ๆ': 45 };
const RISK_LEVEL_LABELS = ['ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'];
const RISK_MAX_SEASONS = 3;

function riskWeights_(land, k) {
  const agri = AGRI_LANDS.indexOf(land) >= 0;
  if (agri) return k >= 2 ? { D: 0.60, P: 0.20, C: 0.20 } : { D: 0.80, P: 0, C: 0.20 };
  return k >= 2 ? { D: 0.75, P: 0.25, C: 0 } : { D: 1, P: 0, C: 0 };
}

function hsSource_() { const s = setting_('hs_source').toUpperCase(); return s === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }
/** ฤดูอ้างอิงที่ตั้งไว้ ([] = auto: ใช้ฤดูฐานการประเมิน) */
function refSeasons_() {
  const v = String(setting_('risk_ref_seasons') || 'auto').trim();
  if (!v || v.toLowerCase() === 'auto') return [];
  return v.split(',').map(x => Number(String(x).trim())).filter(x => x > 2500 && x < 2700).sort((a, b) => b - a);
}
function refSeasonsText_() { const l = refSeasons_(); return l.length ? l.slice().sort().join(',') : 'auto'; }
function rowSource_(v) { return String(v || '').toUpperCase() === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }

/** อ่านจุด HS ของแหล่งข้อมูลหลัก (ชุดที่เปิดใช้งาน, ประเภทพื้นที่ที่เลือก) ของจังหวัด: [{date, d, s, plant}] */
function riskRows_(source, land, prov) {
  const out = [], off = inactiveBatches_();
  [hsSheet_(prov, false)].filter(Boolean).forEach(sh => {
    const last = sh.getLastRow(); if (last < 2) return;
    sh.getRange(2, 1, last - 1, HS_HEADERS.length).getValues().forEach(r => {
      if (!r[0] || rowSource_(r[13]) !== source || off[String(r[11])] || !landMatch_(land, r[15])) return;
      const date = normalizeDate_(r[1]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      out.push({ date: date, d: String(r[3]), s: String(r[4]), plant: String(r[8]) });
    });
  });
  return out;
}

/** ช่วงวันที่ของฐานข้อมูล (แหล่งข้อมูลหลัก, ชุดที่เปิดใช้งาน) จากชีต Batches — ใช้ตัดสินว่าฤดู/ช่วงปีก่อนมีข้อมูลครบหรือไม่ */
function dataRange_(source) {
  const src = source || hsSource_();
  let first = '', last = '';
  readAll_('Batches').forEach(b => {
    if (batchInactive_(b.active) || rowSource_(b.source) !== src || !(Number(b.accepted) > 0)) return;
    const f = normalizeDate_(b.firstDate), l = normalizeDate_(b.lastDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(f) && (!first || f < first)) first = f;
    if (/^\d{4}-\d{2}-\d{2}$/.test(l) && (!last || l > last)) last = l;
  });
  return { first: first, last: last };
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

/** คำนวณ BRI ทุกอำเภอ/ตำบลของจังหวัด ณ วันสิ้นสุด endIso โดยใช้ข้อมูลของจังหวัดนั้นเป็นฐาน (แคชตามจังหวัด/แหล่งข้อมูล/ประเภทพื้นที่/วันที่/เวอร์ชันข้อมูล) */
function riskProvinceCalc_(prov, endIso, landIn) {
  const source = hsSource_(), land = landParam_(landIn);
  const cache = CacheService.getScriptCache();
  const ver = cache.get('ver:all') || '0', tag = prov + ':' + source + ':' + land + ':' + ver + ':' + refSeasonsText_();
  const knownLatest = cache.get('rlatest:' + tag);
  let endKey = /^\d{4}-\d{2}-\d{2}$/.test(String(endIso || '')) ? String(endIso) : 'latest';
  if (knownLatest && endKey !== 'latest' && endKey >= knownLatest) endKey = 'latest';
  const key = 'risk3:' + tag + ':' + endKey;
  const hit = cacheGet_(cache, key); if (hit) return JSON.parse(hit);

  const rows = riskRows_(source, land, prov);
  if (!rows.length) return { ok: true, empty: true, source: source, land: land };
  // ช่วงข้อมูลของทั้งฐานข้อมูล (ไม่ใช่ของจังหวัด) — จังหวัดที่จุดแรกมาช้ายังถือว่าฤดูนั้นมีข้อมูลครบ
  const dates = rows.map(r => r.date).sort(), range = dataRange_(source);
  const first = range.first && range.first < dates[0] ? range.first : dates[0];
  const latest = range.last && range.last > dates[dates.length - 1] ? range.last : dates[dates.length - 1];
  let end = endKey === 'latest' ? latest : endKey;
  if (end > latest) end = latest;
  const S = seasonOfDate_(end), md = { m: +end.slice(5, 7), d: +end.slice(8, 10) };
  // ฤดูที่มีข้อมูลตั้งแต่ต้นฤดู (เผื่อ 31 วัน) และครบทั้งฤดู ณ วันสิ้นสุดที่ประเมิน
  const covered = s => first <= (s - 544) + '-10-31';
  const complete = s => covered(s) && seasonWindow_(s, null).end <= end;
  const H = [];
  for (let s = S; s >= S - 8 && H.length < RISK_MAX_SEASONS; s--) if (complete(s)) H.push(s);
  const refSet = refSeasons_().filter(complete);
  const ref = refSet.length ? refSet : H.slice();
  const W = riskWeights_(land, H.length);
  const curWin = seasonWindow_(S, md), prevOk = covered(S - 1), prevWin = seasonWindow_(S - 1, md);
  const areas = unitArea_();
  const result = { ok: true, source: source, land: land, season: S, end: end, latest: latest, first: first,
    history: H, seasons: H, refSeasons: ref, refAuto: !refSet.length, weights: W, noHistory: !H.length,
    window: curWin, prevWindow: prevOk ? prevWin : null, cuts: {}, units: {} };

  ['district', 'subdistrict'].forEach(level => {
    const codes = Object.keys(areas[level]).filter(c => c.slice(0, 2) === prov);   // ฐานรายจังหวัด
    const idx = {}; codes.forEach((c, i) => { idx[c] = i; });
    const rai = codes.map(c => areas[level][c]);
    const field = level === 'district' ? 'd' : 's';
    const countIn = w => { const arr = new Array(codes.length).fill(0);
      rows.forEach(r => { if (r.date >= w.start && r.date <= w.end && idx[r[field]] !== undefined) arr[idx[r[field]]]++; }); return arr; };
    const countFor = s => countIn(seasonWindow_(s, null));
    const cropFor = list => { const sum = new Array(codes.length).fill(0), n = new Array(codes.length).fill(0);
      const wins = list.map(s => seasonWindow_(s, null));
      rows.forEach(r => { const i = idx[r[field]]; if (i === undefined || !wins.some(w => r.date >= w.start && r.date <= w.end)) return;
        sum[i] += (RISK_CROP[r.plant] !== undefined ? RISK_CROP[r.plant] : 50); n[i]++; });
      return sum.map((v, i) => n[i] ? Math.max(0, Math.min(100, (v / n[i] - 45) / 45 * 100)) : 0); };
    const score = (hist, crop, refSorted, w8) => {
      const w = RISK_SEASON_W.slice(0, hist.length), tw = w.reduce((a, b) => a + b, 0) || 1;
      const o = codes.map((_, i) => hist.reduce((a, h, k) => a + h[i] * w[k] / tw, 0));
      const R = ebRates_(o, rai);
      return codes.map((_, i) => {
        const D = ecdf_(refSorted, R[i]);
        const P = hist.length ? hist.reduce((a, h) => a + (h[i] > 0 ? 1 : 0), 0) / hist.length * 100 : 0;
        const bri = o[i] > 0 ? w8.D * D + w8.P * P + w8.C * crop[i] : 0;
        return { bri: bri, D: D, P: P, C: crop[i] };
      });
    };
    const cur = countIn(curWin), prev = prevOk ? countIn(prevWin) : null;
    const r1 = x => Math.round(x * 10) / 10;
    const units = {};
    if (!H.length) {   // ยังไม่มีฤดูที่ครบ: ไม่จัดระดับ (ผู้ดูแลยังเห็นสัญญาณเฝ้าระวังของฤดูปัจจุบัน)
      result.cuts[level] = null;
      codes.forEach((c, i) => { units[c] = [-1, 0, 0, 0, 0, 0, 0, 0, cur[i], prev ? prev[i] : null, trend_(cur[i], prev ? prev[i] : null)]; });
      result.units[level] = units; return;
    }
    // ฤดูอ้างอิง: การแจกแจงความหนาแน่น (รายฤดู) และจุดตัดระดับ
    const refHist = ref.map(countFor);
    const refDens = [].concat.apply([], refHist.map(h => ebRates_(h, rai))).sort((a, b) => a - b);
    const refScores = score(refHist, cropFor(ref), refDens, riskWeights_(land, ref.length)).map(x => x.bri);
    const cuts = [percentile_(refScores, 50), percentile_(refScores, 75), percentile_(refScores, 90)];
    result.cuts[level] = cuts.map(r1);
    // ฤดูฐานการประเมิน
    const hist = H.map(countFor);
    const sc = score(hist, cropFor(H), refDens, W);
    const disp = b => { const c = cuts, seg = (v, a, z, lo) => lo + 25 * Math.max(0, Math.min(1, (v - a) / Math.max(1e-9, z - a)));
      return b <= 0 ? 0 : b < c[0] ? seg(b, 0, c[0], 0) : b < c[1] ? seg(b, c[0], c[1], 25) : b < c[2] ? seg(b, c[1], c[2], 50) : Math.min(100, seg(b, c[2], 100, 75)); };
    codes.forEach((c, i) => {
      const b = sc[i].bri, lvl = b <= 0 ? 0 : b < cuts[0] ? 0 : b < cuts[1] ? 1 : b < cuts[2] ? 2 : 3;
      units[c] = [lvl, r1(b), r1(disp(b)), r1(sc[i].D), r1(sc[i].P), r1(sc[i].C), hist[0][i], hist[1] ? hist[1][i] : null,
        cur[i], prev ? prev[i] : null, trend_(cur[i], prev ? prev[i] : null)];
    });
    result.units[level] = units;
  });
  const txt = JSON.stringify(result);
  cachePut_(cache, key, txt);
  if (end === latest) { if (endKey !== 'latest') cachePut_(cache, 'risk3:' + tag + ':latest', txt); cache.put('rlatest:' + tag, latest, 21600); }
  return result;
}
/** แนวโน้มฤดูปัจจุบันเทียบช่วงเดียวกันของฤดูก่อน: log2((ปัจจุบัน+3)/(ก่อน+3)) > 0.32 (≈ +25%) และต่างกันอย่างน้อย 3 จุด */
function trend_(cur, prev) {
  if (prev === null || prev === undefined) return '';
  const lr = Math.log((cur + 3) / (prev + 3)) / Math.LN2;
  return (lr > 0.32 && cur - prev >= 3) ? 'up' : (lr < -0.32 && prev - cur >= 3) ? 'down' : 'flat';
}

/** ผลการประเมินของจังหวัด — ประชาชนได้เฉพาะระดับและจำนวนจุดฤดูปัจจุบัน ส่วนผู้ดูแลได้รายละเอียดคะแนนและสัญญาณเฝ้าระวัง */
function riskForProvince_(prov, endIso, detailed, land, modelIn) {
  prov = String(prov || '').padStart(2, '0');
  if (!PROVINCES[prov]) return { ok: false, error: 'invalid province' };
  const want = RISK_MODELS.indexOf(String(modelIn || '').toUpperCase()) >= 0 ? String(modelIn).toUpperCase() : riskModel_();
  let fallback = '';
  if (want === 'M4') {
    if (m4Applicable_(prov, land)) {
      const r = riskM4_(prov, endIso, land);
      if (r.empty) return r;
      const pickM4 = (units, dist) => { const out = {}; Object.keys(units).forEach(c => { const u = units[c]; out[c] = detailed ? u : dist ? [u[0], u[7], u[11], u[13]] : [u[0], u[7]]; }); return out; };
      const res = Object.assign({}, r, { detailed: !!detailed, levels: RISK_LEVEL_LABELS, cols: detailed ? r.cols : ['level', 'hs0'], distCols: detailed ? r.distCols : ['level', 'hs0', 'nHigh', 'nTambon'],
        district: pickM4(r.district, true), subdistrict: pickM4(r.subdistrict, false) });
      if (!detailed) { delete res.names; delete res.base; }
      return res;
    }
    fallback = 'Model 4 ใช้กับพื้นที่เกษตร/เขต สปก. ของ 17 จังหวัดที่มีข้อมูลพื้นที่เพาะปลูก ประเภทพื้นที่นี้จึงประเมินด้วย Model 3';
  }
  if (want === 'PROTO') {   // Model 1 ต้นแบบ: หน้าเว็บคำนวณจากข้อมูลจังหวัดและช่วงที่เลือก
    const range = dataRange_();
    return { ok: true, province: prov, model: 'PROTO', land: landParam_(land), source: hsSource_(), first: range.first, latest: range.last, detailed: !!detailed };
  }
  const nat = riskProvinceCalc_(prov, endIso, land);
  if (nat.empty) return { ok: true, empty: true, model: 'BRI2', source: nat.source, land: nat.land };
  const pick = units => {
    const out = {};
    Object.keys(units).forEach(c => { const u = units[c]; out[c] = detailed ? u : [u[0], u[8]]; });
    return out;
  };
  const res = { ok: true, province: prov, model: 'BRI2', fallback: fallback, basis: 'province', first: nat.first, source: nat.source, land: nat.land, season: nat.season, end: nat.end, latest: nat.latest,
    history: nat.history, seasons: nat.seasons, noHistory: nat.noHistory, window: nat.window, levels: RISK_LEVEL_LABELS, detailed: !!detailed,
    cols: detailed ? ['level', 'bri', 'score', 'D', 'P', 'C', 'hsH0', 'hsH1', 'hs0', 'base', 'trend'] : ['level', 'hs0'],
    district: pick(nat.units.district), subdistrict: pick(nat.units.subdistrict) };
  if (detailed) { res.cuts = nat.cuts; res.refSeasons = nat.refSeasons; res.refAuto = nat.refAuto; res.weights = nat.weights; res.prevWindow = nat.prevWindow; }
  return res;
}

/** คำนวณผลประเมินล่วงหน้าหลังนำเข้า/เปิด-ปิดชุดข้อมูล (ผู้ใช้คนถัดไปไม่ต้องรอ) — ทุกจังหวัดในขอบเขตสิทธิ์ที่มีข้อมูล */
function riskWarm_(user, b) {
  const model = riskModel_();
  if (model === 'PROTO') return { ok: true, model: 'PROTO', provinces: 0 };
  const t = Date.now();
  const provs = readAll_('ProvinceSummary').filter(r => Number(r.hsCount) > 0).map(r => String(r.provinceCode).padStart(2, '0'))
    .filter(p => inScope_(user, p) && (!b.provinceCode || p === String(b.provinceCode)));
  let r = {};
  provs.forEach(p => { if (Date.now() - t < 280000) r = (model === 'M4' && m4Applicable_(p, b.land || DEFAULT_LAND)) ? riskM4_(p, '', b.land || DEFAULT_LAND) : riskProvinceCalc_(p, '', b.land || DEFAULT_LAND); });
  return { ok: true, model: model, ms: Date.now() - t, provinces: provs.length, season: r.season, history: r.history || [], latest: r.latest || '' };
}

/** เรียกจาก Editor หรือตัวจับเวลา: คำนวณผลประเมินล่วงหน้าทุกจังหวัด (พื้นที่เกษตร) */
function warmRiskCache() { return riskWarm_({ role: 'superadmin', prov: '*', name: 'EDITOR' }, {}); }

/** ข้อมูลทั้งสองแหล่งของจังหวัด (พื้นที่เกษตร, ชุดที่เปิดใช้งาน) สำหรับหน้าเปรียบเทียบ */
function hsCompare_(user, b) {
  const prov = requireProvince_(user, b.provinceCode);
  const sh = hsSheet_(prov, false), off = inactiveBatches_();
  const rows = (sh && sh.getLastRow() > 1) ? sh.getRange(2, 1, sh.getLastRow() - 1, HS_HEADERS.length).getValues() : [];
  return { ok: true, province: prov, active: hsSource_(), cols: ['date', 'time', 'dCode', 'sCode', 'plant', 'lat', 'lng', 'source', 'satellite'],
    rows: rows.filter(r => r[0] && !off[String(r[11])] && rowLand_(r[15]) === DEFAULT_LAND)
      .map(r => [normalizeDate_(r[1]), normalizeTime_(r[2]), String(r[3]), String(r[4]), r[8], Number(r[9]), Number(r[10]), rowSource_(r[13]), String(r[14] || '')]) };
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

/** ติดตั้ง v3.5: (1) คอลัมน์ landType — ข้อมูลเดิมเป็นพื้นที่เกษตร (เดิมนำเข้าเฉพาะพื้นที่เกษตร)
 *  (2) จุด NASA FIRMS ใช้วันที่/เวลาไทย (UTC+7) จากเวลา UTC ใน hsID · (3) ชุดข้อมูลเดิมเปิดใช้งาน · (4) ฤดูอ้างอิง = auto */
function migrateV35_() {
  let land = 0, firms = 0;
  db_().getSheets().filter(sh => /^HS_\d{2}$/.test(sh.getName())).forEach(sh => {
    sh.getRange(1, 1, 1, HS_HEADERS.length).setValues([HS_HEADERS]).setFontWeight('bold').setBackground('#14532d').setFontColor('#ffffff');
    const last = sh.getLastRow(); if (last < 2) return;
    const data = sh.getRange(2, 1, last - 1, HS_HEADERS.length).getValues();
    let changed = 0;
    data.forEach(r => {
      if (!r[0]) return;
      if (!String(r[15] || '').trim()) { r[15] = DEFAULT_LAND; land++; changed++; }
      if (rowSource_(r[13]) === 'FIRMS') {
        const x = String(r[0]).match(/^VI\d(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})_/);
        if (x) {
          const utc = new Date(Date.UTC(+x[1], +x[2] - 1, +x[3], +x[4], +x[5]));
          const d = Utilities.formatDate(utc, 'Asia/Bangkok', 'yyyy-MM-dd'), t = Utilities.formatDate(utc, 'Asia/Bangkok', 'HH:mm');
          if (normalizeDate_(r[1]) !== d || normalizeTime_(r[2]) !== t) { r[1] = d; r[2] = t; firms++; changed++; }
        }
      }
    });
    if (changed) { hsTextFormat_(sh, 2, data.length); sh.getRange(2, 1, data.length, HS_HEADERS.length).setValues(data); }
  });
  const col = SHEETS.Batches.indexOf('active') + 1, bsh = sheet_('Batches');
  readAll_('Batches').forEach(r => { if (r.active === '' || r.active === undefined) bsh.getRange(r._row, col).setValue(true); });
  const ref = findRow_('Settings', r => r.key === 'risk_ref_seasons');
  if (ref && String(ref.value) === '2567,2568') updateRow_('Settings', ref._row, { value: 'auto' });
  INACTIVE_MEMO_ = null;
  Object.keys(PROVINCES).forEach(p => { if (hsSheet_(p, false)) { refreshSummary_(p); bumpCache_(p); } });
  return (land || firms) ? 'landType ' + land + ' แถว, FIRMS เวลาไทย ' + firms + ' แถว' : '';
}

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

/** เรียกจาก Editor (ครั้งเดียว ตอนเปลี่ยนเป็นฐานข้อมูล HS ชุดใหม่): ปิดใช้งานชุดข้อมูลที่นำเข้าก่อน cutoffIso (ค่าเริ่มต้น = วันนี้)
 *  ยกเว้นชุดที่ระบุใน keepIds — ข้อมูลไม่ถูกลบ เปิดกลับได้ที่แท็บ “ชุดข้อมูลที่นำเข้า” */
function deactivateBatchesBefore(cutoffIso, keepIds) {
  const cut = String(cutoffIso || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
  const keep = {}; (keepIds || []).forEach(k => { keep[String(k)] = 1; });
  const col = SHEETS.Batches.indexOf('active') + 1, sh = sheet_('Batches'), provs = {};
  let n = 0;
  readAll_('Batches').forEach(r => {
    if (keep[String(r.batchId)] || String(r.importedAt) >= cut || batchInactive_(r.active)) return;
    sh.getRange(r._row, col).setValue(false); provs[String(r.provinceCode)] = 1; n++;
  });
  INACTIVE_MEMO_ = null;
  Object.keys(provs).forEach(p => { refreshSummary_(p); bumpCache_(p); });
  audit_({ sub: 'EDITOR', role: 'system', prov: '' }, 'hs_batch_off', 'ปิดชุดข้อมูลที่นำเข้าก่อน ' + cut + ' จำนวน ' + n + ' ชุด');
  Logger.log('deactivated ' + n + ' batches imported before ' + cut);
  return n;
}
