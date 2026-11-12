/* ============================== RISK: สูตรที่เลือกใช้ได้ และฟังก์ชันร่วม ==============================
 * สูตรประเมินความเสี่ยง (ตั้งค่าระบบ risk_model เลือกได้ครั้งละ 1 สูตร มีผลทั้งระบบ):
 *   ABRI = ABRI-2Y v1.0 (ค่าเริ่มต้น, Abri.gs)  — จำนวนจุดความร้อนสะสม 2 ปีงบฐาน จัดลำดับภายในจังหวัด
 *   M5   = Model 5 (Model5.gs)                — ความหนาแน่นต่อพื้นที่เกษตร + การเผาซ้ำ จัดลำดับภายในจังหวัด
 *   M4   = Model 4 (Model4.gs)                — ความหนาแน่นการตรวจพบไฟเกษตร (NASA FIRMS) เทียบเกณฑ์กลางเดียวกันทุกจังหวัด
 * ทุกสูตรเป็นการประเมินจากข้อมูลที่ผ่านมา ระดับเป็นค่าสัมพัทธ์ ไม่ใช่ความน่าจะเป็นการเผา (คู่มือหัวข้อ 4) */
const RISK_MODELS = ['ABRI', 'M5', 'M4'];
const RISK_MODEL_LABELS = {
  ABRI: 'ABRI-2Y: ระดับความเสี่ยงเชิงประวัติจากจุดความร้อน 2 ปีงบฐาน (จัดลำดับภายในจังหวัด)',
  M5: 'Model 5: ความหนาแน่นต่อพื้นที่เกษตร + การเผาซ้ำ (จัดลำดับภายในจังหวัด)',
  M4: 'Model 4: ความหนาแน่นการตรวจพบไฟเกษตร NASA FIRMS (เกณฑ์กลางทุกจังหวัด)' };
const RISK_LEVEL_LABELS = ['ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'];
function riskModel_() { const v = String(setting_('risk_model') || '').toUpperCase(); return RISK_MODELS.indexOf(v) >= 0 ? v : 'ABRI'; }

function hsSource_() { const s = setting_('hs_source').toUpperCase(); return s === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }
function rowSource_(v) { return String(v || '').toUpperCase() === 'FIRMS' ? 'FIRMS' : 'AGENCY'; }
function satelliteFromId_(id) { const m = String(id || '').match(/^VI(\d)/); return m ? ({ '1': 'Suomi-NPP', '2': 'NOAA-20', '3': 'NOAA-21' }[m[1]] || '') : ''; }

/** จุด HS ที่ใช้งานของจังหวัด (แหล่งข้อมูลหลัก ประเภทพื้นที่ที่เลือก): [{date, d, s, plant}] */
function riskRows_(source, land, prov) {
  const out = [];
  hsActive_(prov, source).forEach(r => {
    if (!landMatch_(land, r[15])) return;
    const date = normalizeDate_(r[1]); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    out.push({ date: date, d: String(r[3]), s: String(r[4]), plant: String(r[8]) });
  });
  return out;
}

/** ช่วงวันที่ของฐานข้อมูล (แหล่งข้อมูลหลัก ชุดที่เปิดใช้งาน) จากชีต Batches */
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
/** ปีงบประมาณ (พ.ศ.) ของวันที่ ISO: 1 ต.ค. 2568 – 30 ก.ย. 2569 = ปีงบ 2569 */
function seasonOfDate_(iso) { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 10 ? y + 544 : y + 543; }
/** ช่วงของปีงบ s ตัดที่วันเดียวกับ md ({m,d}) หรือทั้งปีเมื่อ md = null */
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
/** แนวโน้ม: log2((ปัจจุบัน+3)/(ก่อน+3)) > 0.32 (≈ +25%) และต่างกันอย่างน้อย 3 จุด */
function trend_(cur, prev) {
  if (prev === null || prev === undefined) return '';
  const lr = Math.log((cur + 3) / (prev + 3)) / Math.LN2;
  return (lr > 0.32 && cur - prev >= 3) ? 'up' : (lr < -0.32 && prev - cur >= 3) ? 'down' : 'flat';
}

/** ผลการประเมินของจังหวัด — ประชาชนได้ระดับและจำนวนจุดปีปัจจุบัน ผู้ดูแล/ผู้ถือ API key ได้รายละเอียดคะแนน */
function riskForProvince_(prov, endIso, detailed, land, modelIn) {
  prov = String(prov || '').padStart(2, '0');
  if (!PROVINCES[prov]) return { ok: false, error: 'invalid province' };
  let model = RISK_MODELS.indexOf(String(modelIn || '').toUpperCase()) >= 0 ? String(modelIn).toUpperCase() : riskModel_(), fallback = '';
  if (model === 'M4' && !m4Applicable_(prov, land)) { model = 'ABRI'; fallback = 'Model 4 ใช้กับพื้นที่เกษตร/เขต สปก. ของจังหวัดที่มีข้อมูลพื้นที่เพาะปลูก ประเภทพื้นที่นี้จึงประเมินด้วย ABRI-2Y'; }
  const end = endIso || defaultEnd_();   // ไม่ระบุวันสิ้นสุด = ปีงบประมาณล่าสุดที่ครบแล้ว (ค่าเริ่มต้นเดียวกับหน้าเว็บ)
  const r = model === 'M4' ? riskM4_(prov, endIso, land) : model === 'M5' ? riskM5_(prov, end, land) : riskAbri_(prov, end, land);
  if (r.empty) return r;
  // คอลัมน์สาธารณะ: ระดับ + จำนวนจุดปีปัจจุบัน (+ จำนวนตำบลระดับสูงในอำเภอ)
  const pub = c => ['level', 'hs0', 'nHigh', 'nTambon'].filter(k => c.indexOf(k) >= 0);
  const pick = (units, cols) => { const idx = pub(cols).map(k => cols.indexOf(k)), out = {}; Object.keys(units).forEach(c => { out[c] = detailed ? units[c] : idx.map(i => units[c][i]); }); return out; };
  const res = Object.assign({}, r, { detailed: !!detailed, levels: RISK_LEVEL_LABELS, fallback: fallback,
    cols: detailed ? r.cols : pub(r.cols), distCols: detailed ? r.distCols : pub(r.distCols),
    district: pick(r.district, r.distCols), subdistrict: pick(r.subdistrict, r.cols) });
  if (!detailed) { delete res.names; delete res.ref; delete res.base; }
  return res;
}

/** คำนวณผลประเมินล่วงหน้าหลังนำเข้า/เปิด-ปิดชุดข้อมูล — ทุกจังหวัดในขอบเขตสิทธิ์ที่มีข้อมูล */
function riskWarm_(user, b) {
  const model = riskModel_(), land = b.land || DEFAULT_LAND, t = Date.now();
  const provs = readAll_('ProvinceSummary').filter(r => Number(r.hsCount) > 0).map(r => String(r.provinceCode).padStart(2, '0'))
    .filter(p => inScope_(user, p) && (!b.provinceCode || p === String(b.provinceCode)));
  let r = {};
  provs.forEach(p => { if (Date.now() - t < 280000) r = riskForProvince_(p, b.end || '', false, land, model); });
  return { ok: true, model: model, ms: Date.now() - t, provinces: provs.length, season: r.season, history: r.history || [], latest: r.latest || '' };
}
/** เรียกจาก Editor หรือตัวจับเวลา: คำนวณผลประเมินล่วงหน้าทุกจังหวัด (พื้นที่เกษตร) */
function warmRiskCache() { return riskWarm_({ role: 'superadmin', prov: '*', name: 'EDITOR' }, {}); }

/** ข้อมูลทั้งสองแหล่งของจังหวัด (พื้นที่เกษตร, ชุดที่เปิดใช้งาน) สำหรับแท็บเปรียบเทียบแหล่งข้อมูล */
function hsCompare_(user, b) {
  const prov = requireProvince_(user, b.provinceCode);
  const sh = hsSheet_(prov, false), off = inactiveBatches_();
  const rows = (sh && sh.getLastRow() > 1) ? sh.getRange(2, 1, sh.getLastRow() - 1, HS_HEADERS.length).getValues() : [];
  return { ok: true, province: prov, active: hsSource_(), cols: ['date', 'time', 'dCode', 'sCode', 'plant', 'lat', 'lng', 'source', 'satellite'],
    rows: rows.filter(r => r[0] && !off[String(r[11])] && rowLand_(r[15]) === DEFAULT_LAND)
      .map(r => [normalizeDate_(r[1]), normalizeTime_(r[2]), String(r[3]), String(r[4]), r[8], Number(r[9]), Number(r[10]), rowSource_(r[13]), String(r[14] || '')]) };
}
