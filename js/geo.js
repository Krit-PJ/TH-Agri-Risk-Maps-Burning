/* ขอบเขตการปกครอง + ฟังก์ชันช่วยด้านพื้นที่/วันที่ */
const Geo = (() => {
  const cache = {};

  async function fetchJSON(url) {
    if (cache[url]) return cache[url];
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return (cache[url] = await r.json());
  }
  const provinces = () => fetchJSON(CONFIG.DATA.provinces);
  async function provinceBundle(code) {
    const [d, s, o, p] = await Promise.all([fetchJSON(CONFIG.DATA.district(code)), fetchJSON(CONFIG.DATA.subdistrict(code)), fetchJSON(CONFIG.DATA.outline(code)), provinces()]);
    const meta = p.features.find(f => f.properties.pro_code === code)?.properties || {};
    const province = { ...o.features[0], properties: { ...o.features[0].properties, pro_th: meta.pro_th, pro_en: meta.pro_en } };
    return { province, district: d, subdistrict: s };
  }

  /* ---------- ชื่อพื้นที่ ---------- */
  const clean = v => String(v ?? '').replace(/^(อ\.|อำเภอ|เขต|ต\.|ตำบล|แขวง|จ\.|จังหวัด)\s*/, '').replace(/\s+/g, '').trim();

  /* ---------- ชนิดพืช (ใช้หมวด PlantType จากตารางต้นทาง) ---------- */
  function normalizeCrop(v) {
    const s = String(v ?? '').trim();
    if (!s) return 'อื่น ๆ';
    if (['นาข้าว', 'ข้าว'].includes(s)) return 'นาข้าว';
    if (s.includes('ข้าวโพด') || s.includes('ไร่หมุนเวียน')) return 'ข้าวโพดและไร่หมุนเวียน';
    if (s.includes('อ้อย')) return 'อ้อย';
    if (s.replace(/\s/g, '') === 'เกษตรอื่นๆ') return 'เกษตรอื่น ๆ';
    if (['อื่น ๆ', 'อื่นๆ', 'อื่น'].includes(s)) return 'อื่น ๆ';
    if (s.replace(/\s/g, '') === 'พื้นที่ป่า' || s === 'ป่า') return 'พื้นที่ป่า';
    return s;
  }

  /* ---------- วันที่ / ฤดูกาล ---------- */
  const ymIndex = (yearBE, month) => Number(yearBE) * 12 + Number(month);
  const ymFromIndex = i => ({ year: Math.floor((Number(i) - 1) / 12), month: ((Number(i) - 1) % 12) + 1 });
  /** ฤดูกาลเผา = ปีงบประมาณ (ต.ค.–ก.ย.) ตั้งชื่อตามปี พ.ศ. ที่สิ้นสุด */
  const seasonOf = (yearBE, month) => Number(month) >= 10 ? Number(yearBE) + 1 : Number(yearBE);
  function periodText(r) {
    if (!r) return '-';
    const M = CONFIG.MONTH_SHORT;
    const a = `${M[r.startMonth]} ${r.startYear}`, b = `${M[r.endMonth]} ${r.endYear}`;
    return r.startYM === r.endYM ? a : `${a} – ${b}`;
  }
  /** เวลาเป็น "HH:MM" (เวลาไทย) จาก: Date ของ Excel, เศษส่วนวัน, 1322, "13:22", "Sat Dec 30 1899 13:22:00 GMT+0642" */
  function normalizeTime(v) {
    if (v === undefined || v === null || v === '') return '';
    let mins = NaN;
    if (v instanceof Date && !Number.isNaN(v.getTime())) mins = Math.round(v.getHours() * 60 + v.getMinutes() + v.getSeconds() / 60); // ปัดวินาทีที่คลาดจาก LMT ปี 1899
    else if (typeof v === 'number') mins = v >= 0 && v < 1 ? Math.round(v * 1440) : v > 1 && !Number.isInteger(v) ? Math.round((v % 1) * 1440) : Number.isInteger(v) && v <= 2359 ? Math.floor(v / 100) * 60 + (v % 100 < 60 ? v % 100 : NaN) : NaN;
    else {
      const s = String(v).trim(); let x;
      if ((x = s.match(/(\d{1,2}):(\d{2})/))) mins = +x[1] * 60 + +x[2];
      else if ((x = s.match(/^(\d{1,2})(\d{2})$/))) mins = +x[2] < 60 ? +x[1] * 60 + +x[2] : NaN;
      else if (/^0?\.\d+$/.test(s)) return normalizeTime(Number(s));
    }
    if (!Number.isFinite(mins)) return '';
    mins = ((mins % 1440) + 1440) % 1440;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h < 24 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : '';
  }
  /** "2 ธ.ค. 2568 เวลา 13:22 น." */
  function thaiDateTime(iso, time, short = false) {
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    const date = Number.isNaN(d.getTime()) ? (iso || '-') : d.toLocaleDateString('th-TH', { year: 'numeric', month: short ? 'short' : 'long', day: 'numeric', timeZone: 'UTC' });
    return time ? `${date} เวลา ${time} น.` : date;
  }
  function thaiDate(iso) {
    if (!iso) return '-';
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  /**
   * แปลงแถวจาก API เป็น GeoJSON และผูกรหัสอำเภอ/ตำบลกับขอบเขต
   * ลำดับ: รหัสที่บันทึกไว้ → ชื่อจากตารางต้นทาง → ตำแหน่งพิกัด (point-in-polygon)
   */
  function buildHotspots(api, bundle) {
    const dByCode = new Map(bundle.district.features.map(f => [f.properties.amp_code, f]));
    const sByCode = new Map(bundle.subdistrict.features.map(f => [f.properties.tam_code, f]));
    const dByName = new Map(bundle.district.features.map(f => [clean(f.properties.amp_th), f.properties.amp_code]));
    const sByName = new Map(bundle.subdistrict.features.map(f => [f.properties.amp_code + '|' + clean(f.properties.tam_th), f.properties.tam_code]));
    const idx = Object.fromEntries((api.cols || []).map((c, i) => [c, i]));
    const features = [];
    (api.rows || []).forEach(r => {
      const lat = Number(r[idx.lat]), lng = Number(r[idx.lng]);
      const date = String(r[idx.date] || '');
      const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} };
      let dCode = String(r[idx.dCode] || ''), sCode = String(r[idx.sCode] || '');
      if (!dByCode.has(dCode)) dCode = dByName.get(clean(r[idx.dName])) || '';
      if (!sByCode.has(sCode) || sCode.slice(0, 4) !== dCode) sCode = dCode ? (sByName.get(dCode + '|' + clean(r[idx.sName])) || '') : '';
      if ((!dCode || !sCode) && window.turf) {
        const hit = bundle.subdistrict.features.find(poly => { try { return turf.booleanPointInPolygon(pt, poly); } catch { return false; } });
        if (hit) { dCode = dCode || hit.properties.amp_code; if (!sCode && hit.properties.amp_code === dCode) sCode = hit.properties.tam_code; }
      }
      const year = Number(m[1]) + 543, month = Number(m[2]);
      Object.assign(pt.properties, {
        __date: date, __time: normalizeTime(r[idx.time]), __timeSrc: idx.tsrc !== undefined ? String(r[idx.tsrc] || '') : '', __month: month, __day: Number(m[3]), year_be: year,
        __ym: ymIndex(year, month), __season: seasonOf(year, month),
        __dCode: dCode, __sCode: sCode,
        __district: dByCode.get(dCode)?.properties.amp_th || clean(r[idx.dName]) || 'ไม่ระบุ',
        __subdistrict: sByCode.get(sCode)?.properties.tam_th || clean(r[idx.sName]) || 'ไม่ระบุ',
        __village: String(r[idx.village] || ''), __crop: normalizeCrop(r[idx.plant]), __land: idx.land !== undefined ? String(r[idx.land] || '') : ''
      });
      features.push(pt);
    });
    return { type: 'FeatureCollection', features };
  }

  /** ใช้ตอนนำเข้า: หารหัสอำเภอ/ตำบลจากชื่อ แล้วพิกัด */
  function resolveCodes(bundle, lng, lat, dName, sName) {
    const r = buildHotspots({ cols: ['date', 'time', 'dCode', 'sCode', 'dName', 'sName', 'village', 'plant', 'lat', 'lng'], rows: [['2000-01-01', '', '', '', dName, sName, '', '', lat, lng]] }, bundle);
    const p = r.features[0]?.properties || {};
    return { dCode: p.__dCode || '', sCode: p.__sCode || '' };
  }
  function insideProvince(bundle, lng, lat) {
    if (!window.turf || !bundle.province) return true;
    try { return turf.booleanPointInPolygon(turf.point([lng, lat]), bundle.province); } catch { return true; }
  }

  function cropIcon(crop, cls = 'h-4 w-4') {
    const ic = CONFIG.CROP_ICONS[crop] || CONFIG.CROP_ICONS['อื่น ๆ'];
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic.svg}</svg>`;
  }
  /** ช่วงเทียบ "ช่วงเดียวกันปีก่อน" (ใช้ร่วมกันทุกส่วน: การ์ดสรุป ตารางเปรียบเทียบ ป๊อปอัป ชั้นข้อมูลปีก่อนบนแผนที่ รายงาน)
   *  - ปกติ: เทียบวันต่อวัน (ตัดที่วันล่าสุดของข้อมูล)
   *  - ถ้าบางเดือนของช่วงปีก่อนไม่มีข้อมูล (dataMonths = เดือนที่ฐานข้อมูลมีข้อมูล) หรือปีก่อนเริ่มก่อนวันแรกของข้อมูล
   *    → เทียบเฉพาะเดือนที่มีข้อมูลทั้งสองปี (ระดับเดือน) และแจ้งช่วงที่มีข้อมูล
   *  คืน { mode, cur:[a,b], prev:[a,b], inCur(date), inPrev(date), months, note, none } */
  function compareWindow(start, end, latest, dataFirst, dataMonths) {
    const pad = n => String(n).padStart(2, '0');
    const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
    const minus1 = d => { const y = +d.slice(0, 4) - 1, m = +d.slice(5, 7); return `${y}-${pad(m)}-${pad(Math.min(+d.slice(8, 10), dim(y, m)))}`; };
    const pym = ym => `${+ym.slice(0, 4) - 1}${ym.slice(4)}`;
    let e = end; if (latest && e > latest) e = latest;
    if (e < start) e = start;
    const months = []; for (let y = +start.slice(0, 4), m = +start.slice(5, 7); `${y}-${pad(m)}` <= e.slice(0, 7); m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${pad(m)}`);
    const has = dataMonths && dataMonths.length ? new Set(dataMonths) : null;
    const prevStart = minus1(start), prevEnd = minus1(e);
    const allPrev = has ? months.every(m => has.has(pym(m))) : true;
    if (allPrev && (!dataFirst || prevStart >= dataFirst)) {
      return { mode: 'day', cur: [start, e], prev: [prevStart, prevEnd], months, note: '', none: false,
        inCur: d => d >= start && d <= e, inPrev: d => d >= prevStart && d <= prevEnd };
    }
    const okPrev = m => has ? has.has(pym(m)) : `${pym(m)}-${pad(dim(+pym(m).slice(0, 4), +m.slice(5, 7)))}` >= (dataFirst || '');
    const matched = months.filter(m => (!has || has.has(m)) && okPrev(m)), set = new Set(matched), pset = new Set(matched.map(pym));
    const label = list => monthsLabel(list);
    if (!matched.length) {
      return { mode: 'month', cur: [start, e], prev: [prevStart, prevEnd], months: [], none: true, inCur: () => false, inPrev: () => false,
        note: `ไม่มีข้อมูลช่วงเดียวกันปีก่อน${dataFirst ? ` (ข้อมูลตั้งแต่ ${thaiDate(dataFirst)})` : ''}` };
    }
    const a = matched[0] + '-01', z = matched[matched.length - 1], zEnd = `${z}-${pad(dim(+z.slice(0, 4), +z.slice(5, 7)))}`, cEnd = zEnd < e ? zEnd : e;
    const pEnd = minus1(cEnd);
    return { mode: 'month', cur: [a, cEnd], prev: [pym(matched[0]) + '-01', pEnd], months: matched, none: false,
      inCur: d => set.has(d.slice(0, 7)) && d <= cEnd, inPrev: d => pset.has(d.slice(0, 7)) && d <= pEnd,
      curLabel: label(matched), prevLabel: label(matched.map(pym)),
      note: `ช่วงปีก่อนมีข้อมูลเฉพาะ ${label(matched.map(pym))} · เทียบเฉพาะเดือนที่มีข้อมูลทั้งสองปี` };
  }
  /** ['2025-01',…,'2025-05'] → "ม.ค. – พ.ค. 68" (ช่วงไม่ต่อเนื่องคั่นด้วย ,) */
  function monthsLabel(list) {
    const idx = ym => (+ym.slice(0, 4)) * 12 + (+ym.slice(5, 7)), runs = [];
    list.slice().sort().forEach(ym => { const r = runs[runs.length - 1]; if (r && idx(ym) === idx(r[1]) + 1) r[1] = ym; else runs.push([ym, ym]); });
    const lab = ym => CONFIG.MONTH_SHORT[+ym.slice(5, 7)], yy = ym => String(+ym.slice(0, 4) + 543).slice(2);
    return runs.map(([x, y]) => x === y ? `${lab(x)} ${yy(x)}` : yy(x) === yy(y) ? `${lab(x)}–${lab(y)} ${yy(y)}` : `${lab(x)} ${yy(x)} – ${lab(y)} ${yy(y)}`).join(', ');
  }
  const monthSpan = (a, b) => { const f = d => `${CONFIG.MONTH_SHORT[+d.slice(5, 7)]} ${String(+d.slice(0, 4) + 543).slice(2)}`; return f(a) === f(b) ? f(a) : `${f(a)} – ${f(b)}`; };
  return { compareWindow, monthsLabel, monthSpan, provinces, provinceBundle, clean, normalizeCrop, ymIndex, ymFromIndex, seasonOf, periodText, thaiDate, thaiDateTime, normalizeTime, cropIcon, buildHotspots, resolveCodes, insideProvince };
})();
