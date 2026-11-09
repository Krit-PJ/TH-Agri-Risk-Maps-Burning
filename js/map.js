/* แผนที่หลัก: โหมดประเทศ (เลือกจังหวัด) และโหมดจังหวัด (วิเคราะห์ความเสี่ยงตามต้นแบบ) */
const MapModule = (() => {
  let map, basemapKey = 'voyager';
  const base = {};
  const shown = { national: null, province: null, district: null, subdistrict: null, risk: null, hotspot: null };
  const raw = { bundle: null, hotspot: null, riskDistrict: null, riskSubdistrict: null, seasons: [], risk: null, code: '', dataFirst: '' };
  const riskCache = new Map();
  let state = { district: '', subdistrict: '', crop: '', land: CONFIG.DEFAULT_LAND, startYM: null, endYM: null };
  let nationalLayers = new Map();

  /* ---------------- init ---------------- */
  function init() {
    map = L.map('map', { center: CONFIG.MAP_CENTER, zoom: CONFIG.MAP_ZOOM, minZoom: CONFIG.MAP_MIN_ZOOM, maxZoom: CONFIG.MAP_MAX_ZOOM, zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k, b]) => { if (k !== 'print') base[k] = L.tileLayer(b.url, { maxZoom: 19, attribution: b.attribution, crossOrigin: true }); });
    base[basemapKey].addTo(map);
    map.fitBounds(CONFIG.THAILAND_BOUNDS, { animate: false });

    document.querySelectorAll('input[name="basemap"]').forEach(el => el.addEventListener('change', () => setBasemap(el.value)));
    ['lyr-province', 'lyr-district', 'lyr-subdistrict'].forEach(id => document.getElementById(id)?.addEventListener('change', renderBoundaries));
    document.getElementById('lyr-hotspot')?.addEventListener('change', renderHotspots);
    document.getElementById('lyr-risk')?.addEventListener('change', renderRisk);
    return map;
  }
  function setBasemap(key) {
    if (!base[key] || key === basemapKey) return;
    map.removeLayer(base[basemapKey]); basemapKey = key; base[key].addTo(map); base[key].bringToBack();
    if (raw.bundle) renderBoundaries();
  }
  const onSatellite = () => basemapKey === 'satellite';
  function boundaryStyle(kind) {
    const s = { ...CONFIG.BOUNDARY[kind] };
    if (onSatellite() && ['province', 'district', 'subdistrict'].includes(kind)) s.color = kind === 'province' ? '#f8fafc' : '#e2e8f0';
    return s;
  }
  const remove = l => { if (l && map.hasLayer(l)) map.removeLayer(l); };

  /* ---------------- National mode ---------------- */
  function showNational(provFC, available, handlers = {}) {
    clearProvince();
    remove(shown.national);
    nationalLayers = new Map();
    const avail = new Map(available.map(p => [p.code, p]));
    shown.national = L.geoJSON(provFC, {
      style: f => avail.has(f.properties.pro_code) ? CONFIG.BOUNDARY.available : CONFIG.BOUNDARY.national,
      interactive: true,
      onEachFeature: (f, layer) => {
        const code = f.properties.pro_code, info = avail.get(code);
        nationalLayers.set(code, layer);
        if (!info) { layer.options.interactive = false; return; }
        layer.bindTooltip(`<strong>จ.${f.properties.pro_th}</strong><br>HS ${info.count.toLocaleString('th-TH')} จุด<br><span style="color:#4a5a51">คลิกเพื่อเปิดข้อมูลจังหวัด</span>`, { sticky: true, className: 'prov-tip', direction: 'top', offset: [0, -6] });
        layer.on({
          mouseover: () => { highlightProvince(code, true); handlers.onHover?.(code, true); },
          mouseout: () => { highlightProvince(code, false); handlers.onHover?.(code, false); },
          click: () => handlers.onSelect?.(code)
        });
      }
    }).addTo(map);
    map.fitBounds(shown.national.getBounds(), { padding: [10, 10], animate: false });
  }
  function highlightProvince(code, on) {
    const l = nationalLayers.get(code); if (!l || !l.options.interactive) return;
    l.setStyle(on ? CONFIG.BOUNDARY.hover : CONFIG.BOUNDARY.available);
    if (on) l.bringToFront();
  }
  function hideNational() { remove(shown.national); shown.national = null; }

  /* ---------------- Province mode ---------------- */
  function setProvince(bundle, hotspotFC, code) {
    hideNational();
    raw.bundle = bundle; raw.hotspot = hotspotFC; raw.code = code || ''; raw.risk = null;
  }
  function clearProvince() {
    ['province', 'district', 'subdistrict', 'risk', 'hotspot'].forEach(k => { remove(shown[k]); shown[k] = null; });
    raw.bundle = null; raw.hotspot = null; raw.riskDistrict = null; raw.riskSubdistrict = null; raw.risk = null; raw.code = '';
  }

  const districtCodeOf = f => f.properties.amp_code;
  const subdistrictCodeOf = f => f.properties.tam_code;
  function inRange(p) {
    const s = Number(state.startYM), e = Number(state.endYM);
    return (!s || p.__ym >= s) && (!e || p.__ym <= e);
  }
  function matchesFeature(f) {
    const p = f.properties;
    return inRange(p) && (!state.crop || p.__crop === state.crop) && (!state.district || p.__dCode === state.district) && (!state.subdistrict || p.__sCode === state.subdistrict);
  }
  function filteredHotspots() { return (raw.hotspot?.features || []).filter(matchesFeature); }
  /** ฤดูที่แสดงบนแผนที่ = ฤดูของวันสิ้นสุดช่วงที่เลือก (ฤดูล่าสุด) — ข้อมูลฤดูก่อนหน้าดูได้เมื่อคลิกพื้นที่ */
  function displaySeason() {
    if (state.endYM) { const e = Geo.ymFromIndex(state.endYM); return Geo.seasonOf(e.year, e.month); }
    return raw.seasons[raw.seasons.length - 1] || null;
  }
  function mapHotspots() { const s = displaySeason(); return filteredHotspots().filter(f => f.properties.__season === s); }
  function scopeUnits(level) {
    if (!raw.bundle) return [];
    if (level === 'district') return raw.bundle.district.features.filter(f => !state.district || districtCodeOf(f) === state.district);
    return raw.bundle.subdistrict.features.filter(f => (!state.district || f.properties.amp_code === state.district) && (!state.subdistrict || subdistrictCodeOf(f) === state.subdistrict));
  }

  /** ฤดูกาลที่อยู่ในช่วงข้อมูลที่เลือก (ใช้แทน "ปีที่เลือก" ของต้นแบบ) */
  function activeSeasons() {
    const set = new Set();
    (raw.hotspot?.features || []).forEach(f => { if (inRange(f.properties) && (!state.crop || f.properties.__crop === state.crop)) set.add(f.properties.__season); });
    if (!set.size && state.endYM) { const e = Geo.ymFromIndex(state.endYM); set.add(Geo.seasonOf(e.year, e.month)); }
    return [...set].sort((a, b) => a - b);
  }
  function seasonColor(season) {
    const seasons = raw.seasons.length ? raw.seasons : [season];
    const idx = seasons.length - 1 - seasons.indexOf(season);
    return CONFIG.SEASON_COLORS[Math.max(0, idx) % CONFIG.SEASON_COLORS.length];
  }

  /* ---------------- ระดับความเสี่ยง (BRI) — คำนวณที่ Backend จากทุกจังหวัดที่มีข้อมูล ---------------- */
  /** ผู้ดูแลระบบในขอบเขตสิทธิ์จะเห็นคะแนน องค์ประกอบ และแนวโน้มเพิ่ม (ประชาชนเห็นเฉพาะระดับ 4 สี) */
  function viewerDetailed() {
    const u = Api.session()?.user;
    return !!u && (u.role === 'superadmin' || u.role === 'minisuper' || u.prov === raw.code);
  }
  function endDateOfRange() {
    if (!state.endYM) return '';
    const e = Geo.ymFromIndex(state.endYM), y = e.year - 543, last = new Date(Date.UTC(y, e.month, 0)).getUTCDate();
    return `${y}-${String(e.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  async function loadRisk() {
    if (!raw.code || !Api.configured()) return null;
    const detailed = viewerDetailed(), end = endDateOfRange(), land = state.land || CONFIG.DEFAULT_LAND;
    const key = `${raw.code}|${end}|${land}|${detailed ? 'd' : 'p'}`;
    if (!riskCache.has(key)) {
      const req = detailed ? Api.post('risk_detail', { province: raw.code, end, land }) : Api.get('risk', { province: raw.code, end, land });
      riskCache.set(key, req.catch(err => { riskCache.delete(key); throw err; }));
    }
    return riskCache.get(key);
  }
  const LEVEL_MID = [12.5, 37.5, 62.5, 87.5];
  function buildRiskCollection(level) {
    const units = scopeUnits(level), api = raw.risk, key = level === 'district' ? '__dCode' : '__sCode';
    const counts = {};
    filteredHotspots().forEach(h => { const c = h.properties[key]; counts[c] = (counts[c] || 0) + 1; });
    const table = api?.[level] || {}, cols = api?.cols || [];
    const at = (row, name) => row ? row[cols.indexOf(name)] : undefined;
    return {
      type: 'FeatureCollection',
      features: units.map(feature => {
        const p = feature.properties, code = level === 'district' ? districtCodeOf(feature) : subdistrictCodeOf(feature);
        const row = table[code], lvl = row ? Math.max(0, Number(at(row, 'level'))) : 0;
        const detail = api?.detailed && row ? { bri: at(row, 'bri'), D: at(row, 'D'), P: at(row, 'P'), C: at(row, 'C'), hsH0: at(row, 'hsH0'), hsH1: at(row, 'hsH1'), hs0: at(row, 'hs0'), base: at(row, 'base'), trend: at(row, 'trend') } : null;
        return {
          type: 'Feature', geometry: feature.geometry,
          properties: {
            code, name: level === 'district' ? p.amp_th : p.tam_th, district_code: p.amp_code, level,
            risk_level: lvl, risk_score: detail ? Number(at(row, 'score')) : LEVEL_MID[lvl],
            selected_hotspot_count: counts[code] || 0, season_hotspot_count: row ? Number(at(row, 'hs0')) : 0, detail
          }
        };
      })
    };
  }
  /* ---------- Model 1 ต้นแบบ (V3 แรก – 5 พ.ย. 2569): คำนวณจาก HS ของจังหวัดในช่วงที่เลือก ----------
   *  1 ฤดู  : Unified annual evidence-gate (1–2 จุด ต่ำ · 3–5 ปานกลาง · 6–10 สูง · >10 สูงมาก ปรับด้วยชนิดพืช/ขนาดพื้นที่ภายในช่วงระดับ)
   *  ≥2 ฤดู : Multi-year Model A = 0.40·HS ถ่วงฤดู (เทียบค่าสูงสุดในจังหวัด) + 0.20·แนวโน้ม + 0.20·ชนิดพืช + 0.20·ขนาดพื้นที่ */
  const PROTO = { seasonWeights: [0.40, 0.35, 0.25, 0.15, 0.10], weights: { hotspot: 0.40, trend: 0.20, crop: 0.20, area: 0.20 },
    crop: { 'นาข้าว': 70, 'อ้อย': 80, 'ข้าวโพดและไร่หมุนเวียน': 90, 'เกษตรอื่น ๆ': 55, 'พื้นที่ป่า': 50, 'อื่น ๆ': 45 } };
  const isProto = () => raw.risk?.model === 'PROTO';
  function protoSeasonWeights(seasons) {
    const cfg = PROTO.seasonWeights, vals = seasons.map((s, i) => cfg[seasons.length - 1 - i] ?? cfg[cfg.length - 1]);
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(seasons.map((s, i) => [s, vals[i] / total]));
  }
  function annualEvidenceScore(count, cropScore, areaScore) {
    const exposure = Math.max(0, Math.min(100, (Number(cropScore || 0) + Number(areaScore || 0)) / 2));
    let score = 0;
    if (count <= 0) score = 0;
    else if (count <= 2) score = 5 + (count - 1) * 10 + exposure * 0.09;
    else if (count <= 5) score = 25 + ((count - 3) / 2) * 15 + exposure * 0.09;
    else if (count <= 10) score = 50 + ((count - 6) / 4) * 15 + exposure * 0.09;
    else score = 75 + Math.min(20, Math.log1p(count - 10) * 7) + exposure * 0.05;
    const cap = count <= 2 ? 24.99 : count <= 5 ? 49.99 : count <= 10 ? 74.99 : 100;
    const floor = count <= 0 ? 0 : count <= 2 ? 0 : count <= 5 ? 25 : count <= 10 ? 50 : 75;
    return Math.max(floor, Math.min(cap, score));
  }
  function buildProtoCollection(level, seasons) {
    const w = protoSeasonWeights(seasons), factors = PROTO.weights, units = scopeUnits(level);
    const key = level === 'district' ? '__dCode' : '__sCode';
    const pool = filteredHotspots();
    const rows = units.map(feature => {
      const code = level === 'district' ? districtCodeOf(feature) : subdistrictCodeOf(feature);
      const fs = pool.filter(h => h.properties[key] === code);
      const counts = {}; let cropSum = 0;
      seasons.forEach(x => { counts[x] = 0; });
      fs.forEach(h => { counts[h.properties.__season] = (counts[h.properties.__season] || 0) + 1; cropSum += PROTO.crop[h.properties.__crop] ?? 50; });
      const weighted = seasons.reduce((sum, x) => sum + (counts[x] || 0) * (w[x] || 0), 0);
      let trend = 0;
      if (seasons.length >= 2) {
        const prev = counts[seasons[seasons.length - 2]] || 0, cur = counts[seasons[seasons.length - 1]] || 0;
        trend = prev === 0 ? (cur > 0 ? 100 : 0) : Math.max(0, Math.min(100, 50 + ((cur - prev) / prev) * 100));
      }
      return { feature, code, counts, weighted, trend, total: fs.length, crop: fs.length ? cropSum / fs.length : 0, area: Number(feature.properties.area_sqkm || 0) * 625 };
    });
    const referenceMax = Math.max(1, ...rows.flatMap(r => seasons.map(x => r.counts[x] || 0)));
    const logs = rows.map(r => Math.log1p(r.area)), minL = logs.length ? Math.min(...logs) : 0, maxL = logs.length ? Math.max(...logs) : 0;
    return { type: 'FeatureCollection', features: rows.map((r, i) => {
      const hs = seasons.length ? Math.max(0, Math.min(100, r.weighted / referenceMax * 100)) : 0;
      const area = maxL === minL ? (rows.length === 1 ? 50 : 0) : (logs[i] - minL) / (maxL - minL) * 100;
      let score = 0, method = '-';
      if (seasons.length === 1) { score = annualEvidenceScore(r.total, r.crop, area); method = 'evidence-gate (1 ฤดู)'; }
      else if (seasons.length >= 2) { score = hs * factors.hotspot + r.trend * factors.trend + r.crop * factors.crop + area * factors.area; method = `Model A (${seasons.length} ฤดู)`; }
      const p = r.feature.properties, lv = CONFIG.RISK_LEVELS.findIndex(x => score >= x.min && score < x.max);
      return { type: 'Feature', geometry: r.feature.geometry, properties: {
        code: r.code, name: level === 'district' ? p.amp_th : p.tam_th, district_code: p.amp_code, level,
        risk_level: Math.max(0, lv), risk_score: +score.toFixed(2), selected_hotspot_count: r.total, season_hotspot_count: r.total,
        detail: viewerDetailed() ? { proto: true, score, hs, trend: r.trend, crop: r.crop, area, method, total: r.total } : null } };
    }) };
  }
  function computeRiskLayers() {
    raw.seasons = [...new Set([...(raw.hotspot?.features || []).map(f => f.properties.__season)])].sort((a, b) => a - b);
    const build = isProto() ? (lv => buildProtoCollection(lv, activeSeasons())) : buildRiskCollection;
    raw.riskDistrict = build('district');
    raw.riskSubdistrict = build('subdistrict');
  }
  /** คำอธิบายฐานการประเมินความเสี่ยงสำหรับแสดงผล (null = ยังจัดระดับไม่ได้) */
  function riskInfo() {
    const r = raw.risk; if (!r || r.empty || r.noHistory) return null;
    if (r.model === 'PROTO') return { model: 'PROTO', seasons: activeSeasons(), history: activeSeasons(), land: r.land, detailed: !!r.detailed, source: r.source };
    return { model: 'BRI2', season: r.season, end: r.end, latest: r.latest, history: r.history || r.seasons || [], seasons: r.history || r.seasons || [], land: r.land, detailed: !!r.detailed, cuts: r.cuts, refSeasons: r.refSeasons, refAuto: r.refAuto, weights: r.weights, source: r.source, window: r.window };
  }
  /** ข้อความฐานการประเมิน — ใช้ร่วมกันทุกส่วน (สถานะ/คำอธิบายแผนที่/ป๊อปอัป/รายงาน) */
  function riskBasisText(short = false) {
    const r = raw.risk;
    if (!r || r.empty) return '';
    const landTxt = r.land === 'ALL' ? 'ทุกประเภทพื้นที่' : r.land;
    if (r.model === 'PROTO') {
      const ss = activeSeasons(), sTxt = ss.length > 1 ? `ฤดู ${ss[0]}–${ss[ss.length - 1]}` : `ฤดู ${ss[0] || '-'}`;
      return short ? `Model 1 ต้นแบบ · ${sTxt} ในช่วงที่เลือก` : `Model 1 ต้นแบบ: ประเมินจากจุดความร้อน${landTxt}ในช่วงที่เลือก (${sTxt}) จากข้อมูลของจังหวัด — ${ss.length > 1 ? 'Model A: HS ถ่วงฤดู 40% · แนวโน้ม 20% · ชนิดพืช 20% · ขนาดพื้นที่ 20%' : 'เกณฑ์จำนวนจุด 1–2 ต่ำ · 3–5 ปานกลาง · 6–10 สูง · >10 สูงมาก'}`;
    }
    if (r.noHistory) return short ? 'ยังไม่จัดระดับ (ยังไม่มีฤดูที่ครบ)' : `ยังไม่จัดระดับความเสี่ยง: ข้อมูล${landTxt}ยังไม่มีฤดูที่ครบ (1 ต.ค.–30 ก.ย.) ก่อนฤดู ${r.season} จึงยังไม่มีฐานสำหรับประเมิน`;
    const H = (r.history || []).slice().sort((a, b) => a - b);
    const basis = H.length > 1 ? `ฤดู ${H[0]}–${H[H.length - 1]} (${H.length} ฤดู)` : `ฤดู ${H[0]}`;
    return short ? `Model 3 BRI · ประเมินฤดู ${r.season} จากข้อมูล${basis}` : `Model 3 BRI เวอร์ชัน 2: ประเมินความเสี่ยงฤดู ${r.season} จากจุดความร้อน${landTxt}${basis} ทั้งฤดู (ฤดูที่ครบแล้ว) เทียบภายในจังหวัด${H.length < 3 ? ' — ข้อมูลยังมีน้อยกว่า 3 ฤดู ผลประเมินจะแม่นยำขึ้นเมื่อมีข้อมูลเพิ่ม' : ''}`;
  }

  /* ---------------- render ---------------- */
  function renderBoundaries() {
    ['province', 'district', 'subdistrict'].forEach(k => { remove(shown[k]); shown[k] = null; });
    if (!raw.bundle) return;
    const b = raw.bundle;
    const showProv = document.getElementById('lyr-province')?.checked;
    const showDist = document.getElementById('lyr-district')?.checked || !!state.district;
    const showSub = document.getElementById('lyr-subdistrict')?.checked || !!state.subdistrict;
    if (showDist) shown.district = L.geoJSON({ type: 'FeatureCollection', features: b.district.features.filter(f => !state.district || districtCodeOf(f) === state.district) }, {
      style: boundaryStyle('district'), interactive: false
    }).addTo(map);
    if (showSub) shown.subdistrict = L.geoJSON({ type: 'FeatureCollection', features: b.subdistrict.features.filter(f => (!state.district || f.properties.amp_code === state.district) && (!state.subdistrict || subdistrictCodeOf(f) === state.subdistrict)) }, {
      style: boundaryStyle('subdistrict'), interactive: false
    }).addTo(map);
    if (showProv && b.province) shown.province = L.geoJSON(b.province, { style: boundaryStyle('province'), interactive: false }).addTo(map);
    shown.risk?.bringToFront?.();
    [shown.subdistrict, shown.district, shown.province].forEach(l => l?.bringToFront());
  }

  function renderRisk() {
    remove(shown.risk); shown.risk = null;
    if (!raw.bundle || !raw.risk || raw.risk.empty || (!isProto() && raw.risk.noHistory) || !document.getElementById('lyr-risk')?.checked) return;   // ไม่มีผลประเมิน = ไม่ระบายสี (ไม่แสดงเป็น "ต่ำ")
    const level = state.district ? 'subdistrict' : 'district';
    const fc = level === 'district' ? raw.riskDistrict : raw.riskSubdistrict;
    shown.risk = L.geoJSON(fc, {
      style: f => { const l = CONFIG.RISK_LEVELS[f.properties.risk_level] || CONFIG.RISK_LEVELS[0]; return { color: '#ffffff', weight: 0.8, fillColor: l.color, fillOpacity: 0.5 }; },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindTooltip(riskTooltip(p, level), { sticky: true, className: 'prov-tip' });
        l.bindPopup(() => areaPopup(p, level), { className: 'area-pop', maxWidth: 320, autoPanPadding: [24, 24] });
        l.on('popupopen', e => {
          e.popup.getElement()?.querySelector('[data-drill]')?.addEventListener('click', () => {
            map.closePopup();
            document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level, code: p.code, district: p.district_code } }));
          });
        });
      }
    }).addTo(map);
    [shown.subdistrict, shown.district, shown.province].forEach(x => x?.bringToFront());
  }

  const TREND_TEXT = { up: '↑ เพิ่มขึ้นจากช่วงเดียวกันฤดูก่อน', down: '↓ ลดลงจากช่วงเดียวกันฤดูก่อน', flat: '→ ใกล้เคียงช่วงเดียวกันฤดูก่อน' };
  /** ชี้: ชื่อพื้นที่ + ระดับความเสี่ยง (สั้น) — คลิกเพื่อดูรายละเอียดรายฤดู */
  function riskTooltip(p, level) {
    const lv = CONFIG.RISK_LEVELS[p.risk_level] || CONFIG.RISK_LEVELS[0];
    return `<strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><br><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span><br><span style="color:#4a5a51">คลิกเพื่อดูข้อมูลรายฤดู</span>`;
  }

  /* ---------- ข้อมูลพื้นที่เมื่อคลิก: บรรทัด 1 ฤดูล่าสุด · บรรทัด 2 ฤดูก่อนหน้า · ถัดไปรายละเอียด ---------- */
  const isoDate = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shortDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${CONFIG.MONTH_SHORT[m]} ${String(y + 543).slice(2)}`; };
  const minusYear = iso => { const [y, m, d] = iso.split('-').map(Number), last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate(); return isoDate(y - 1, m, Math.min(d, last)); };
  function areaPopup(p, level) {
    const fmt = n => Number(n || 0).toLocaleString('th-TH'), key = level === 'district' ? '__dCode' : '__sCode';
    const lv = CONFIG.RISK_LEVELS[p.risk_level] || CONFIG.RISK_LEVELS[0], S = displaySeason();
    const base = (raw.hotspot?.features || []).filter(f => f.properties[key] === p.code && (!state.crop || f.properties.__crop === state.crop)).map(f => f.properties);
    const latest = (raw.hotspot?.features || []).reduce((a, f) => f.properties.__date > a ? f.properties.__date : a, '');
    const s0 = Geo.ymFromIndex(state.startYM || state.endYM), e0 = Geo.ymFromIndex(state.endYM);
    const seasonStart = isoDate(S - 544, 10, 1);
    let start = isoDate(s0.year - 543, s0.month, 1); if (start < seasonStart) start = seasonStart;
    const W = Geo.compareWindow(start, isoDate(e0.year - 543, e0.month, new Date(Date.UTC(e0.year - 543, e0.month, 0)).getUTCDate()), latest, raw.dataFirst);
    let end = W.cur[1]; if (latest && end > latest) end = latest;
    const cur = base.filter(x => x.__date >= W.cur[0] && x.__date <= W.cur[1]);
    const [pStart, pEnd] = W.prev, monthly = W.mode === 'month';
    const prev = base.filter(x => x.__date >= pStart && x.__date <= pEnd), prevAll = base.filter(x => x.__season === S - 1);
    const chg = prev.length ? Math.round((cur.length - prev.length) * 100 / prev.length) : null;
    const crops = Object.entries(cur.reduce((o, x) => { o[x.__crop] = (o[x.__crop] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
    const lines = [
      `<div class="ap-line ap-now"><b>ฤดู ${S} (ล่าสุด)</b> ${shortDate(start)}–${shortDate(end)}: <b>${fmt(cur.length)} จุด</b></div>`,
      `<div class="ap-line ap-prev"><b>ฤดู ${S - 1} (ปีก่อน)</b> ${monthly ? `เดือนเดียวกัน (${Geo.monthSpan(pStart, pEnd)})` : 'ช่วงเดียวกัน'} ${fmt(prev.length)} จุด · ทั้งฤดู ${fmt(prevAll.length)} จุด${monthly ? `<br><span class="ap-note">${W.note}</span>` : ''}</div>`
    ];
    const extra = [];
    const what = monthly ? 'เดือนเดียวกันปีก่อน (ผลรวมรายเดือน)' : 'ช่วงเดียวกันปีก่อน';
    if (chg !== null) extra.push(`เทียบ${what} ${chg > 0 ? '+' : ''}${chg}%`); else if (cur.length) extra.push(`${what}ไม่พบจุด`);
    if (crops.length) extra.push(`ชนิดพืช: ${crops.map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`);
    if (state.crop) extra.push(`กรองชนิดพืช: ${state.crop}`);
    if (raw.risk && !raw.risk.empty) extra.push(riskBasisText(true));
    let admin = '';
    if (p.detail?.proto) {
      const d = p.detail;
      admin = `<div class="tip-admin">ผู้ดูแล · Model 1 ${d.method} · คะแนน ${d.score.toFixed(1)}<br>HS ${d.total} จุด · คะแนน HS ${d.hs.toFixed(0)} · แนวโน้ม ${d.trend.toFixed(0)} · ชนิดพืช ${d.crop.toFixed(0)} · ขนาดพื้นที่ ${d.area.toFixed(0)}</div>`;
    } else if (p.detail) {
      const d = p.detail, H = raw.risk?.history || [], w = raw.risk?.weights;
      const sig = `สัญญาณฤดู ${raw.risk?.season || ""}: ${fmt(d.hs0)} จุด${d.base !== null && d.base !== undefined ? ` เทียบช่วงเดียวกันฤดูก่อน ${fmt(d.base)} จุด${d.trend ? ` · ${TREND_TEXT[d.trend]}` : ''}` : ''}`;
      admin = `<div class="tip-admin">ผู้ดูแล${H.length ? ` · BRI ${Number(d.bri).toFixed(1)} (D ${Number(d.D).toFixed(0)}${w?.P ? ` · P ${Number(d.P).toFixed(0)}` : ''}${w?.C ? ` · C ${Number(d.C).toFixed(0)}` : ''})<br>HS ฤดูฐาน ${H[0]} ${fmt(d.hsH0)} จุด${H[1] ? ` · ${H[1]} ${fmt(d.hsH1)} จุด` : ''}` : ''}<br>${sig}</div>`;
    }
    const drill = level === 'district' && !state.district ? `<button type="button" class="ap-drill" data-drill>ดูรายตำบลในอำเภอนี้</button>` : '';
    return `<div class="area-pop-in"><div class="ap-head"><strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span></div>
      ${lines.join('')}${extra.length ? `<div class="ap-more">${extra.map(x => `<div>${x}</div>`).join('')}</div>` : ''}${admin}${drill}</div>`;
  }

  function renderHotspots() {
    remove(shown.hotspot); shown.hotspot = null;
    if (!raw.bundle || !document.getElementById('lyr-hotspot')?.checked) return;
    // วงกลมกลุ่มจุดใช้สีกลาง (ไม่ใช้เขียว/เหลือง/ส้มค่าเริ่มต้นที่ซ้ำกับสีระดับความเสี่ยง) ตัวเลข = จำนวนจุดความร้อนในกลุ่ม
    const group = L.markerClusterGroup({ disableClusteringAtZoom: 11, chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50,
      iconCreateFunction: c => { const n = c.getChildCount(), size = n < 10 ? 30 : n < 100 ? 36 : 44;
        return L.divIcon({ html: `<span>${n.toLocaleString('th-TH')}</span>`, className: 'hs-cluster', iconSize: [size, size] }); } });
    L.geoJSON({ type: 'FeatureCollection', features: mapHotspots() }, {
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5.5, fillColor: CONFIG.SEASON_COLORS[0], color: '#ffffff', weight: 1.4, fillOpacity: 0.95 }),
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<div class="hs-pop"><strong>จุดความร้อน</strong>
          <div>${Geo.thaiDateTime(p.__date, p.__time)}${p.__time && p.__timeSrc === 'hsid' ? ' <span class="hs-pop-note" title="ไฟล์ต้นทางไม่มีเวลา ระบบคำนวณจากเวลา UTC ใน hsID ของ NASA FIRMS">(จาก hsID)</span>' : ''}</div>
          <div>อ.${p.__district} ต.${p.__subdistrict}${p.__village ? ` · ${p.__village}` : ''}</div>
          <div class="hs-pop-crop">${Geo.cropIcon(p.__crop, 'hs-pop-ic')}<span>${p.__crop}</span></div>${p.__land ? `<div class="hs-pop-note">พื้นที่: ${p.__land}</div>` : ''}
          <div class="hs-pop-note">ฤดูกาล ${p.__season} (ต.ค. ${p.__season - 1} – ก.ย. ${p.__season})</div></div>`);
      }
    }).addTo(group);
    group.addTo(map); shown.hotspot = group;
  }

  function renderLegend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const S = displaySeason(), nPts = mapHotspots().length;
    const rr = raw.risk, nH = (rr?.history || []).length;
    const basis = !rr ? 'กำลังประเมิน…' : rr.empty ? 'ไม่มีข้อมูลสำหรับประเมิน' : rr.model === 'PROTO' ? riskBasisText(false) : rr.noHistory ? riskBasisText(false) : `${riskBasisText(true)} (ฤดูที่ครบแล้ว)${nH < 3 ? ' · ข้อมูลยังน้อยกว่า 3 ฤดู' : ''}`;
    el.innerHTML = `<div class="max-w-[17rem] p-3 text-xs">
      <p class="mb-1.5 font-bold text-ink">ระดับความเสี่ยงการเผา (พื้นที่)</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">${CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span class="risk-pill text-xs"><span class="risk-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')}</div>
      <p class="mt-1 leading-snug text-ink-soft">${basis}</p>
      ${S ? `<p class="mb-1.5 mt-2.5 font-bold text-ink">จุดความร้อน (ตำแหน่ง) · ${state.land === 'ALL' ? 'ทุกประเภทพื้นที่' : state.land}</p><span class="risk-pill text-xs"><span class="risk-dot ring-1 ring-white" style="background:${CONFIG.SEASON_COLORS[0]}"></span>ฤดู ${S} (ล่าสุด) ${nPts.toLocaleString('th-TH')} จุด</span>
      ${nPts ? `<p class="mt-1.5 flex items-center gap-1.5 leading-snug text-ink-soft"><span class="hs-cluster-mini">12</span>ตัวเลขในวงกลม = จำนวนจุดความร้อนที่อยู่รวมกัน</p>` : ''}
      <p class="mt-1 leading-snug text-ink-soft">ข้อมูลฤดูก่อนหน้า: คลิกพื้นที่อำเภอ/ตำบลบนแผนที่</p>` : ''}
    </div>`;
    el.classList.remove('hidden');
  }

  /** แสดงจุด/ขอบเขตทันที แล้วโหลดระดับความเสี่ยงจาก Backend (แคชตามจังหวัด+วันสิ้นสุดช่วง) */
  async function applyFilter(next) {
    state = { district: next.district || '', subdistrict: next.subdistrict || '', crop: next.crop || '', land: next.land || CONFIG.DEFAULT_LAND, startYM: Number(next.startYM) || null, endYM: Number(next.endYM) || null, startYear: next.startYear, startMonth: next.startMonth, endYear: next.endYear, endMonth: next.endMonth };
    const code = raw.code;
    computeRiskLayers(); renderBoundaries(); renderHotspots(); renderLegend(); focusSelection();
    let error = '';
    try { const r = await loadRisk(); if (code !== raw.code) return { stale: true }; raw.risk = r; if (r?.first && !raw.dataFirst) raw.dataFirst = r.first; }
    catch (err) { error = err.message; raw.risk = null; }
    computeRiskLayers(); renderRisk(); renderLegend();
    return { seasons: activeSeasons(), risk: riskInfo(), basis: riskBasisText(true), error };
  }

  function selectionFeatures() {
    if (!raw.bundle) return [];
    if (state.subdistrict) return raw.bundle.subdistrict.features.filter(f => subdistrictCodeOf(f) === state.subdistrict);
    if (state.district) return raw.bundle.district.features.filter(f => districtCodeOf(f) === state.district);
    return raw.bundle.province ? [raw.bundle.province] : raw.bundle.district.features;
  }
  function focusSelection(options = {}) {
    const fs = selectionFeatures();
    if (!fs.length) return;
    const bounds = L.geoJSON({ type: 'FeatureCollection', features: fs }).getBounds(), opts = { padding: options.padding || [24, 24], animate: false };
    map.stop();
    map.fitBounds(bounds, opts);
    // หากแผนที่ยังอยู่ระหว่างแอนิเมชันซูมก่อนหน้า (พบบนมือถือ) ให้จัดกรอบซ้ำเมื่อแอนิเมชันจบ
    if (map._animatingZoom) map.once('zoomend', () => map.fitBounds(bounds, opts));
  }
  function getRiskLevel(score) { return CONFIG.RISK_LEVELS.find(x => score >= x.min && score < x.max) || CONFIG.RISK_LEVELS[0]; }

  return {
    setDataStart: d => { raw.dataFirst = d || ''; }, isProto,
    init, showNational, highlightProvince, setProvince, clearProvince, applyFilter, focusSelection, getRiskLevel, seasonColor, riskInfo, riskBasisText, viewerDetailed,
    clearRiskCache: () => riskCache.clear(),
    map: () => map, getData: () => raw, getState: () => ({ ...state }), filteredHotspots, mapHotspots, displaySeason, inRange, selectionFeatures,
    getRiskForScope: level => level === 'district' ? raw.riskDistrict : raw.riskSubdistrict,
    invalidate: () => map?.invalidateSize({ pan: false })
  };
})();
