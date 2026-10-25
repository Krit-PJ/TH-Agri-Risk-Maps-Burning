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
        __date: date, __time: String(r[idx.time] || ''), __month: month, __day: Number(m[3]), year_be: year,
        __ym: ymIndex(year, month), __season: seasonOf(year, month),
        __dCode: dCode, __sCode: sCode,
        __district: dByCode.get(dCode)?.properties.amp_th || clean(r[idx.dName]) || 'ไม่ระบุ',
        __subdistrict: sByCode.get(sCode)?.properties.tam_th || clean(r[idx.sName]) || 'ไม่ระบุ',
        __village: String(r[idx.village] || ''), __crop: normalizeCrop(r[idx.plant])
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

  return { provinces, provinceBundle, clean, normalizeCrop, ymIndex, ymFromIndex, seasonOf, periodText, thaiDate, buildHotspots, resolveCodes, insideProvince };
})();
