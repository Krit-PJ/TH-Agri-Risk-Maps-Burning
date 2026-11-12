/* ============================== RISK MODEL 4: คะแนนจัดลำดับพื้นที่เฝ้าระวังการเผาเกษตร (ทางเลือก: เกณฑ์กลางทุกจังหวัด) ==============================
 * หลักการ (คู่มือหัวข้อ 4.4)
 *  - หน่วยตรวจพบ = กริด 500 ม.–วันที่พบจุดความร้อนเกษตร (นับซ้ำในกริดเดียวกันวันเดียวกันเป็น 1) จากดาวเทียมดวงเดียว (NASA FIRMS VIIRS Suomi-NPP)
 *    ฤดูกาล 1 ต.ค.–30 ก.ย. วันที่เวลาไทย
 *  - H_i = หน่วยตรวจพบต่อ 1,000 ไร่พื้นที่เพาะปลูก (ESA WorldCover) ของตำบล ถ่วงฤดูที่ครบแล้ว ≤ 3 ฤดู (0.40/0.35/0.25 ใหม่→เก่า)
 *    ปรับให้นิ่งด้วย Empirical Bayes โดยใช้ค่าฐานกลาง μ, s² ที่ตรึงไว้ (Clayton & Kaldor, 1987)
 *  - คะแนน 0–100 = เปอร์เซ็นไทล์ของ H เทียบการแจกแจงฐานกลาง (ทุกตำบล 17 จังหวัด ฤดู 2567–2568) ที่ตรึงไว้ — เกณฑ์เดียวกันทุกจังหวัด
 *    ไม่พบหน่วยตรวจพบในฤดูฐานเลย = 0 · ไม่มีพื้นที่เพาะปลูก = ไม่ประเมิน (ไม่แสดงเป็นความเสี่ยงต่ำ)
 *  - ระดับ: ต่ำ < 50 ≤ ปานกลาง < 75 ≤ สูง < 90 ≤ สูงมาก (ลำดับเชิงเปรียบเทียบกับฐานกลาง ไม่ใช่ความน่าจะเป็น)
 *  - อำเภอ/จังหวัด = ค่าเฉลี่ยถ่วงพื้นที่เพาะปลูกของคะแนนตำบล + จำนวนตำบลคะแนนสูง และพื้นที่เพาะปลูกในตำบลคะแนนสูง
 *  - ไม่ใช้ชนิดพืชจากสัดส่วนจุด HS (ทดสอบแล้วไม่ช่วย) · ยังไม่มีปัจจัยการจัดการ (M) และเชื้อเพลิงคงเหลือ (F)
 *  - จำนวนจุดฤดูปัจจุบันจากข้อมูลหน่วยงาน (แหล่งข้อมูลหลัก) แสดงเป็นสัญญาณเฝ้าระวัง ไม่เปลี่ยนคะแนน */
const M4_CUTS = [50, 75, 90];
const M4_W = [0.40, 0.35, 0.25];
const M4_COS = Math.cos(17 * Math.PI / 180);

function m4Score_(R) {
  if (!(R > 0)) return 0;
  const q = M4_BASE.q, n = q.length - 1;
  if (R <= q[0]) return 0;
  if (R >= q[n]) return 100;
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (q[m] <= R) lo = m; else hi = m; }
  // ช่วงค่าซ้ำ (เช่น ศูนย์) ให้ใช้กึ่งกลางช่วง
  const frac = q[hi] > q[lo] ? (R - q[lo]) / (q[hi] - q[lo]) : 0.5;
  return (lo + frac) / n * 100;
}
function m4Level_(s) { return s < M4_CUTS[0] ? 0 : s < M4_CUTS[1] ? 1 : s < M4_CUTS[2] ? 2 : 3; }
function m4Applicable_(prov, land) {
  const l = landParam_(land), cr = cropRai_();
  return AGRI_LANDS.indexOf(l) >= 0 && Object.keys(cr).some(c => c.slice(0, 2) === prov);
}

/** หน่วยตรวจพบ (กริด 500 ม.–วัน) รายตำบลรายฤดู จากจุด NASA FIRMS ดาวเทียม Suomi-NPP ของจังหวัด (ชุดข้อมูลที่เปิดใช้งาน) */
function m4Units_(prov) {
  const sh = hsSheet_(prov, false), off = inactiveBatches_(), seen = {}, out = {};
  let first = '', last = '';
  if (!sh || sh.getLastRow() < 2) return { units: out, first: first, last: last };
  sh.getRange(2, 1, sh.getLastRow() - 1, HS_HEADERS.length).getValues().forEach(r => {
    if (!r[0] || rowSource_(r[13]) !== 'FIRMS' || off[String(r[11])]) return;
    const sat = String(r[14] || '') || satelliteFromId_(r[0]);
    if (sat !== M4_BASE.satellite) return;
    const d = normalizeDate_(r[1]), lat = Number(r[9]), lng = Number(r[10]), tam = String(r[4]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !isFinite(lat) || !isFinite(lng) || !tam) return;
    if (!first || d < first) first = d; if (!last || d > last) last = d;
    const k = Math.floor(lng * 111320 * M4_COS / M4_BASE.gridM) + '_' + Math.floor(lat * 110574 / M4_BASE.gridM) + '_' + d;
    if (seen[k]) return; seen[k] = 1;
    const s = seasonOfDate_(d), u = out[tam] || (out[tam] = {});
    u[s] = (u[s] || 0) + 1;
  });
  return { units: out, first: first, last: last };
}

/** Model 4 ของจังหวัด ณ วันสิ้นสุด endIso — คืนผลรายตำบลและสรุปรายอำเภอ */
function riskM4_(prov, endIso, landIn) {
  const land = landParam_(landIn), source = hsSource_();
  const cache = CacheService.getScriptCache(), ver = cache.get('ver:all') || '0';
  const endKey = /^\d{4}-\d{2}-\d{2}$/.test(String(endIso || '')) ? String(endIso) : 'latest';
  const key = 'm4:' + prov + ':' + land + ':' + source + ':' + ver + ':' + M4_BASE.version + ':' + endKey;
  const hit = cacheGet_(cache, key); if (hit) return JSON.parse(hit);

  const fu = m4Units_(prov), range = dataRange_(source);
  let end = endKey === 'latest' ? (range.last || fu.last) : endKey;
  if (range.last && end > range.last) end = range.last;
  if (!end) return { ok: true, empty: true, model: 'M4', land: land, source: source };
  const S = seasonOfDate_(end), md = { m: +end.slice(5, 7), d: +end.slice(8, 10) };
  // ฤดูฐานการประเมิน: ฤดูที่ครบแล้วของข้อมูล FIRMS (ถึงวันสิ้นสุดที่ประเมิน) ไม่เกิน 3 ฤดู
  const firmsEnd = fu.last && fu.last < end ? fu.last : end;
  const H = [];
  for (let s = S; s >= S - 8 && H.length < 3; s--) {
    const w = seasonWindow_(s, null);
    if (fu.first && fu.first <= (s - 544) + '-10-31' && w.end <= firmsEnd) H.push(s);
  }
  const sw = M4_W.slice(0, H.length), tw = sw.reduce((a, b) => a + b, 0) || 1;
  // สัญญาณฤดูปัจจุบันจากข้อมูลแหล่งหลัก (ช่วงเดียวกันฤดูก่อน)
  const rows = riskRows_(source, land, prov);
  const curWin = seasonWindow_(S, md), prevWin = seasonWindow_(S - 1, md), prevOk = !range.first || range.first <= (S - 545) + '-10-31';
  const cnt = (field, w) => { const m = {}; rows.forEach(r => { if (r.date >= w.start && r.date <= w.end) m[r[field]] = (m[r[field]] || 0) + 1; }); return m; };
  const curS = cnt('s', curWin), prevS = prevOk ? cnt('s', prevWin) : null, curD = cnt('d', curWin), prevD = prevOk ? cnt('d', prevWin) : null;
  const crop = cropRai_(), names = geoNames_(), r1 = x => Math.round(x * 10) / 10, r3 = x => Math.round(x * 1000) / 1000;
  const tams = Object.keys(unitArea_().subdistrict).filter(c => c.slice(0, 2) === prov);
  const sub = {}, agg = {};
  tams.forEach(c => {
    const A = crop[c] || 0, u = fu.units[c] || {}, hs = H.map(s => u[s] || 0);
    const cur = curS[c] || 0, prev = prevS ? (prevS[c] || 0) : null, tr = trend_(cur, prev);
    if (!(A >= 1) || !H.length) {   // ไม่มีพื้นที่เพาะปลูก หรือยังไม่มีฤดูฐาน → ไม่ประเมิน
      sub[c] = [-1, null, null, A, hs[0] === undefined ? null : hs[0], hs[1] === undefined ? null : hs[1], hs[2] === undefined ? null : hs[2], cur, prev, tr, !(A >= 1) ? 'ไม่มีพื้นที่เพาะปลูกในข้อมูลพื้นที่เกษตร' : 'ยังไม่มีฤดูฐานที่ครบ'];
      return;
    }
    const E = A / 1000, o = hs.reduce((a, h, k) => a + h * sw[k] / tw, 0);
    const B = M4_BASE.mu / (M4_BASE.mu + M4_BASE.s2 * E), R = o > 0 ? B * M4_BASE.mu + (1 - B) * (o / E) : 0;
    const score = m4Score_(R), lvl = m4Level_(score), hit = hs.filter(h => h > 0).length;
    const ratio = M4_BASE.mu > 0 ? R / M4_BASE.mu : 0;
    const reason = o <= 0 ? `ไม่พบการตรวจพบไฟเกษตรใน ${H.length} ฤดูฐาน`
      : `หนาแน่น ${r3(R)} หน่วย/1,000 ไร่เกษตร (${ratio >= 1 ? r1(ratio) + ' เท่าของ' : 'ต่ำกว่า'}ค่าฐานกลาง) · พบ ${hit}/${H.length} ฤดู`;
    sub[c] = [lvl, r1(score), r3(R), Math.round(A), hs[0], hs[1] === undefined ? null : hs[1], hs[2] === undefined ? null : hs[2], cur, prev, tr, reason];
    const d = c.slice(0, 4), g = agg[d] || (agg[d] = { w: 0, sw: 0, n: 0, nHigh: 0, cropHigh: 0, h0: 0, h1: 0, h2: 0 });
    g.w += A; g.sw += A * score; g.n++; g.h0 += hs[0] || 0; g.h1 += hs[1] || 0; g.h2 += hs[2] || 0;
    if (lvl >= 2) { g.nHigh++; g.cropHigh += A; }
  });
  const dist = {};
  Object.keys(unitArea_().district).filter(c => c.slice(0, 2) === prov).forEach(d => {
    const g = agg[d], cur = curD[d] || 0, prev = prevD ? (prevD[d] || 0) : null, tr = trend_(cur, prev);
    const nT = tams.filter(c => c.slice(0, 4) === d).length;
    if (!g || !(g.w > 0)) { dist[d] = [-1, null, null, 0, null, null, null, cur, prev, tr, 'ไม่มีพื้นที่เพาะปลูกในข้อมูลพื้นที่เกษตร', 0, 0, nT]; return; }
    const score = g.sw / g.w, lvl = m4Level_(score);
    dist[d] = [lvl, r1(score), null, Math.round(g.w), g.h0, H.length > 1 ? g.h1 : null, H.length > 2 ? g.h2 : null, cur, prev, tr,
      `คะแนนเฉลี่ยถ่วงพื้นที่เกษตร ${r1(score)} · ตำบลคะแนนสูง–สูงมาก ${g.nHigh}/${nT} ตำบล (${Math.round(g.cropHigh).toLocaleString()} ไร่เกษตร)`, g.nHigh, Math.round(g.cropHigh), nT];
  });
  const result = { ok: true, model: 'M4', modelVersion: M4_BASE.version, province: prov, land: land, source: source, season: S, end: end, latest: range.last,
    first: range.first, history: H, seasons: H, window: curWin, prevWindow: prevOk ? prevWin : null, noHistory: !H.length,
    base: { seasons: M4_BASE.baseSeasons, satellite: M4_BASE.satellite, gridM: M4_BASE.gridM, mu: M4_BASE.mu }, cuts: M4_CUTS,
    firms: { first: fu.first, last: fu.last },
    cols: ['level', 'score', 'H', 'cropRai', 'u0', 'u1', 'u2', 'hs0', 'base', 'trend', 'reason'],
    distCols: ['level', 'score', 'H', 'cropRai', 'u0', 'u1', 'u2', 'hs0', 'base', 'trend', 'reason', 'nHigh', 'cropHigh', 'nTambon'],
    district: dist, subdistrict: sub, names: { district: Object.keys(dist).reduce((m, c) => (m[c] = names.district[c] || '', m), {}),
      subdistrict: tams.reduce((m, c) => (m[c] = names.subdistrict[c] || '', m), {}) } };
  cachePut_(cache, key, JSON.stringify(result));
  return result;
}
