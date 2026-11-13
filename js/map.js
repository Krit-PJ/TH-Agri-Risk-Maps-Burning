/* แผนที่หลัก: โหมดประเทศ (เลือกจังหวัด) และโหมดจังหวัด (วิเคราะห์ความเสี่ยงตามต้นแบบ) */
const MapModule = (() => {
  let map, basemapKey = 'voyager';
  const base = {};
  const shown = { national: null, province: null, district: null, subdistrict: null, risk: null, hotspot: null, hotspotPrev: null };
  const raw = { bundle: null, hotspot: null, riskDistrict: null, riskSubdistrict: null, seasons: [], risk: null, code: '', dataFirst: '', dataMonths: [] };
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
    // ลำดับชั้น: ระดับความเสี่ยง (overlayPane 400) < จุดความร้อนช่วงเดียวกันปีก่อน (440) < จุดความร้อนช่วงที่เลือก (450, ชั้นบนสุดของข้อมูล)
    map.createPane('hsPrev').style.zIndex = 440; map.createPane('hsCur').style.zIndex = 450;
    map.fitBounds(CONFIG.THAILAND_BOUNDS, { animate: false });

    document.querySelectorAll('input[name="basemap"]').forEach(el => el.addEventListener('change', () => setBasemap(el.value)));
    ['lyr-province', 'lyr-district', 'lyr-subdistrict'].forEach(id => document.getElementById(id)?.addEventListener('change', renderBoundaries));
    document.getElementById('lyr-hotspot')?.addEventListener('change', renderHotspots);
    document.getElementById('lyr-hotspot-prev')?.addEventListener('change', () => { renderHotspots(); renderLegend(); });
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
    ['province', 'district', 'subdistrict', 'risk', 'hotspot', 'hotspotPrev'].forEach(k => { remove(shown[k]); shown[k] = null; });
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
  /** ปีงบของวันสิ้นสุดช่วงที่เลือก (ใช้ในป๊อปอัปพื้นที่: ยอดทั้งปีงบก่อนหน้า) */
  function displaySeason() {
    if (state.endYM) { const e = Geo.ymFromIndex(state.endYM); return Geo.seasonOf(e.year, e.month); }
    return raw.seasons[raw.seasons.length - 1] || null;
  }
  /** v3.9.1: จุดบนแผนที่ = ทุกจุดในช่วงที่เลือก (จำนวนเท่ากับการ์ดสรุปและตารางเปรียบเทียบ) — เดิมแสดงเฉพาะปีงบล่าสุด ทำให้จำนวนบนแผนที่น้อยกว่าข้อมูลจริงเมื่อช่วงคาบเกี่ยวหลายปีงบ */
  function mapHotspots() { return filteredHotspots(); }
  /** ช่วงที่เลือกเทียบช่วงเดียวกันปีก่อน (Geo.compareWindow) — แหล่งเดียวสำหรับการ์ด ตาราง ป๊อปอัป ชั้นข้อมูลปีก่อน และรายงาน */
  function compareInfo() {
    if (!state.endYM) return null;
    const s = Geo.ymFromIndex(state.startYM || state.endYM), e = Geo.ymFromIndex(state.endYM);
    const latest = (raw.hotspot?.features || []).reduce((a, f) => f.properties.__date > a ? f.properties.__date : a, '');
    const end = isoDate(e.year - 543, e.month, new Date(Date.UTC(e.year - 543, e.month, 0)).getUTCDate());
    return Object.assign(Geo.compareWindow(isoDate(s.year - 543, s.month, 1), end, latest, raw.dataFirst, raw.dataMonths), { latest });
  }
  /** จุดความร้อนช่วงเดียวกันปีก่อน (ตามตัวกรองพื้นที่/ชนิดพืช) สำหรับชั้นข้อมูลบนแผนที่ */
  function prevHotspots() {
    const W = compareInfo(); if (!W || W.none) return [];
    return (raw.hotspot?.features || []).filter(f => { const p = f.properties; return W.inPrev(p.__date) && (!state.crop || p.__crop === state.crop) && (!state.district || p.__dCode === state.district) && (!state.subdistrict || p.__sCode === state.subdistrict); });
  }
  function scopeUnits(level) {
    if (!raw.bundle) return [];
    if (level === 'district') return raw.bundle.district.features.filter(f => !state.district || districtCodeOf(f) === state.district);
    return raw.bundle.subdistrict.features.filter(f => (!state.district || f.properties.amp_code === state.district) && (!state.subdistrict || subdistrictCodeOf(f) === state.subdistrict));
  }

  /** ปีงบที่อยู่ในช่วงข้อมูลที่เลือก */
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

  /* ---------------- ระดับความเสี่ยง — คำนวณที่ Backend (ABRI-2Y / Model 5 / Model 4) ---------------- */
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
  const AREA_MODELS = ['M4', 'M5'];   // สูตรที่ใช้พื้นที่เพาะปลูก: ไม่มีพื้นที่เกษตร = ไม่ประเมิน (-1)
  function buildRiskCollection(level) {
    const units = scopeUnits(level), api = raw.risk, key = level === 'district' ? '__dCode' : '__sCode';
    const counts = {};
    filteredHotspots().forEach(h => { const c = h.properties[key]; counts[c] = (counts[c] || 0) + 1; });
    const table = api?.[level] || {}, cols = (level === 'district' && api?.distCols) ? api.distCols : (api?.cols || []), na = AREA_MODELS.includes(api?.model);
    const at = (row, name) => row ? row[cols.indexOf(name)] : undefined;
    return {
      type: 'FeatureCollection',
      features: units.map(feature => {
        const p = feature.properties, code = level === 'district' ? districtCodeOf(feature) : subdistrictCodeOf(feature);
        const row = table[code], raw0 = row ? Number(at(row, 'level')) : 0, lvl = na ? (row ? raw0 : -1) : Math.max(0, raw0);
        const detail = api?.detailed && row ? Object.assign({ model: api.model }, Object.fromEntries(cols.map((c, i) => [c, row[i]]))) : null;
        return {
          type: 'Feature', geometry: feature.geometry,
          properties: {
            code, name: level === 'district' ? p.amp_th : p.tam_th, district_code: p.amp_code, level,
            risk_level: lvl, risk_score: lvl < 0 ? null : detail && at(row, 'score') !== null && at(row, 'score') !== undefined ? Number(at(row, 'score')) : LEVEL_MID[lvl],
            selected_hotspot_count: counts[code] || 0, season_hotspot_count: row ? Number(at(row, 'hs0')) : 0, detail,
            n_high: row && cols.includes('nHigh') ? at(row, 'nHigh') : null, n_tambon: row && cols.includes('nTambon') ? at(row, 'nTambon') : null
          }
        };
      })
    };
  }
  function computeRiskLayers() {
    raw.seasons = [...new Set([...(raw.hotspot?.features || []).map(f => f.properties.__season)])].sort((a, b) => a - b);
    raw.riskDistrict = buildRiskCollection('district');
    raw.riskSubdistrict = buildRiskCollection('subdistrict');
  }
  /** สรุปผลการประเมินสำหรับแสดงผล (null = ยังจัดระดับไม่ได้) */
  function riskInfo() {
    const r = raw.risk; if (!r || r.empty || r.noHistory) return null;
    return { model: r.model, version: r.modelVersion, season: r.season, assessmentYear: r.assessmentYear, end: r.end, latest: r.latest, history: r.history || [], seasons: r.history || [],
      land: r.land, detailed: !!r.detailed, cuts: r.cuts, minHs: r.minHs, weights: r.weights, months: r.months, monthsText: r.monthsText, fullYear: r.fullYear, note: r.note,
      source: r.source, window: r.window, satellitePolicy: r.satellitePolicy };
  }
  const span = H => { const a = (H || []).slice().sort((x, y) => x - y); return a.length > 1 ? `${a[0]}–${a[a.length - 1]}` : `${a[0] || '-'}`; };
  /** ข้อความฐานการประเมิน — ใช้ร่วมกันทุกส่วน (สถานะ/ป๊อปอัป/รายงาน) */
  function riskBasisText(short = false) {
    const r = raw.risk;
    if (!r || r.empty) return '';
    if (r.model === 'ABRI') {
      if (r.noHistory) return 'ABRI-2Y: ยังไม่มีข้อมูลปีฐานสำหรับประเมิน';
      return short ? `ABRI-2Y · ปีงบ ${r.assessmentYear} (ฐานปีงบ ${span(r.history)}) · เทียบภายในจังหวัด`
        : `ABRI-2Y: ระดับความเสี่ยงเชิงประวัติ ปีงบประมาณ ${r.assessmentYear} จากจำนวนจุดความร้อนสะสมปีงบ ${span(r.history)} (ฐาน 2 ปี ตรึงตลอดปีงบ) จัดลำดับเทียบพื้นที่ในจังหวัดเดียวกัน: สูงมาก = 10% บนสุด · สูง = ถัดไป 15% · ปานกลาง = ถัดไป 25% · จุดรวมน้อยกว่า ${r.minHs ?? 3} จุด = ต่ำ · จุดความร้อนปีงบ ${r.assessmentYear} ใช้เฝ้าระวังเท่านั้น ไม่นำมาคิดคะแนน · เป็นการประเมินจากข้อมูลที่ผ่านมา ไม่ใช่การทำนาย${r.note ? ` (${r.note})` : ''}`;
    }
    if (r.model === 'M5') {
      if (r.noHistory) return 'Model 5: ยังไม่มีข้อมูลปีฐานสำหรับประเมิน';
      const mt = r.fullYear ? 'ทั้งปีงบประมาณ' : `เฉพาะ ${r.monthsText}`;
      return short ? `Model 5 · ข้อมูลย้อนหลังปีงบ ${span(r.history)} (${mt}) · เทียบภายในจังหวัด`
        : `Model 5: ระดับความเสี่ยงการเผาจากข้อมูลที่เกิดขึ้นแล้ว ปีงบ ${span(r.history)} (${mt}) — ความหนาแน่นจุดความร้อนต่อพื้นที่เพาะปลูก ${Math.round((r.weights?.D ?? 0.7) * 100)}% + การเผาซ้ำ (กริด 1 กม.) ${Math.round((r.weights?.R ?? 0.3) * 100)}% จัดลำดับเทียบพื้นที่ในจังหวัดเดียวกัน · จุดรวมน้อยกว่า ${r.minHs ?? 3} จุด = ต่ำ · ไม่ใช่การทำนาย${r.note ? ` (${r.note})` : ''}`;
    }
    if (r.noHistory) return 'Model 4: ยังไม่มีปีฐานที่ครบสำหรับประเมิน';
    return short ? `Model 4 · ปีงบ ${r.season} จากปีงบ ${span(r.history)} · เกณฑ์กลาง`
      : `Model 4: คะแนนจัดลำดับเฝ้าระวังปีงบ ${r.season} จากความหนาแน่นการตรวจพบไฟเกษตร (กริด 500 ม.–วัน, NASA FIRMS Suomi-NPP) ต่อพื้นที่เพาะปลูก ปีงบ ${span(r.history)} เทียบเกณฑ์กลางที่ตรึงไว้ ใช้เกณฑ์เดียวกันทุกจังหวัด · คะแนนไม่ใช่ความน่าจะเป็นการเผา`;
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
    if (!raw.bundle || !raw.risk || raw.risk.empty || raw.risk.noHistory || !document.getElementById('lyr-risk')?.checked) return;   // ไม่มีผลประเมิน = ไม่ระบายสี (ไม่แสดงเป็น "ต่ำ")
    const level = state.district ? 'subdistrict' : 'district';
    const fc = level === 'district' ? raw.riskDistrict : raw.riskSubdistrict;
    shown.risk = L.geoJSON(fc, {
      style: f => { const l = levelOf(f.properties); return { color: '#ffffff', weight: 0.8, fillColor: l.color, fillOpacity: f.properties.risk_level < 0 ? 0.35 : 0.5, dashArray: f.properties.risk_level < 0 ? '3 3' : null }; },
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

  const TREND_TEXT = { up: '↑ เพิ่มขึ้นจากช่วงเดียวกันปีก่อน', down: '↓ ลดลงจากช่วงเดียวกันปีก่อน', flat: '→ ใกล้เคียงช่วงเดียวกันปีก่อน' };
  /** ชี้: ชื่อพื้นที่ + ระดับความเสี่ยง (สั้น) — คลิกเพื่อดูรายละเอียดรายฤดู */
  function riskTooltip(p, level) {
    const lv = levelOf(p);
    return `<strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><br><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span><br><span style="color:#4a5a51">คลิกเพื่อดูข้อมูลรายฤดู</span>`;
  }

  /* ---------- ข้อมูลพื้นที่เมื่อคลิก: บรรทัด 1 ช่วงที่เลือก · บรรทัด 2 ช่วงเดียวกันปีก่อน · ถัดไปรายละเอียด ---------- */
  const isoDate = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shortDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${CONFIG.MONTH_SHORT[m]} ${String(y + 543).slice(2)}`; };
  const minusYear = iso => { const [y, m, d] = iso.split('-').map(Number), last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate(); return isoDate(y - 1, m, Math.min(d, last)); };
  function areaPopup(p, level) {
    const fmt = n => Number(n || 0).toLocaleString('th-TH'), key = level === 'district' ? '__dCode' : '__sCode';
    const lv = levelOf(p), S = displaySeason();
    const base = (raw.hotspot?.features || []).filter(f => f.properties[key] === p.code && (!state.crop || f.properties.__crop === state.crop)).map(f => f.properties);
    const W = compareInfo(), latest = W?.latest || '';
    const sel = base.filter(x => inRange(x)), monthly = W?.mode === 'month';
    const curC = W ? base.filter(x => W.inCur(x.__date)) : [], prev = W ? base.filter(x => W.inPrev(x.__date)) : [], prevAll = base.filter(x => x.__season === S - 1);
    const chg = !W || W.none ? null : prev.length ? Math.round((curC.length - prev.length) * 100 / prev.length) : null;
    const crops = Object.entries(sel.reduce((o, x) => { o[x.__crop] = (o[x.__crop] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]);
    const s0 = Geo.ymFromIndex(state.startYM || state.endYM), e0 = Geo.ymFromIndex(state.endYM);
    let selEnd = isoDate(e0.year - 543, e0.month, new Date(Date.UTC(e0.year - 543, e0.month, 0)).getUTCDate()); if (latest && selEnd > latest) selEnd = latest;
    const lines = [
      `<div class="ap-line ap-now"><b>ช่วงที่เลือก</b> ${shortDate(isoDate(s0.year - 543, s0.month, 1))}–${shortDate(selEnd)}: <b>${fmt(sel.length)} จุด</b></div>`,
      `<div class="ap-line ap-prev"><b>ช่วงเดียวกันปีก่อน</b> ${!W || W.none ? 'ไม่มีข้อมูล' : monthly ? `${W.prevLabel} ${fmt(prev.length)} จุด (ปีนี้ ${W.curLabel} ${fmt(curC.length)} จุด)` : `${fmt(prev.length)} จุด`} · ทั้งปีงบ ${S - 1} ${fmt(prevAll.length)} จุด${monthly || W?.none ? `<br><span class="ap-note">${W.note}</span>` : ''}</div>`
    ];
    const extra = [];
    const what = monthly ? 'เดือนที่มีข้อมูลทั้งสองปี' : 'ช่วงเดียวกันปีก่อน';
    if (chg !== null) extra.push(`เทียบ${what} ${chg > 0 ? '+' : ''}${chg}%`); else if (W && !W.none && curC.length) extra.push(`${what}: ปีก่อนไม่พบจุด`);
    if (crops.length) extra.push(`ชนิดพืช: ${crops.map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}`);
    if (state.crop) extra.push(`กรองชนิดพืช: ${state.crop}`);
    if (p.n_high !== null && p.n_high !== undefined) extra.push(`ตำบลระดับสูง–สูงมาก ${p.n_high}/${p.n_tambon} ตำบล`);
    if (raw.risk && !raw.risk.empty) extra.push(riskBasisText(true));
    let admin = '';
    const d = p.detail, H = raw.risk?.history || [], f1 = x => x === null || x === undefined ? '-' : Number(x).toLocaleString('th-TH', { maximumFractionDigits: 3 });
    if (d?.model === 'ABRI') {
      admin = `<div class="tip-admin">ผู้ดูแล · ABRI-2Y${d.score ? ` · ลำดับ ${Number(d.score).toFixed(1)}/100 ในจังหวัด` : ''}<br>จุดความร้อนปีฐาน ${H[0] || ''}: ${fmt(d.n1)}${H[1] ? ` · ${H[1]}: ${fmt(d.n2)}` : ''} · รวม ${fmt(d.n2y)} จุด${d.density !== null && d.density !== undefined ? `<br>ความหนาแน่น ${f1(d.density)} จุด/1,000 ไร่เกษตร/ปี (ข้อมูลประกอบ)` : ''}${d.crop ? `<br>ชนิดพืชหลัก: ${d.crop}` : ''}<br>เฝ้าระวังปีงบ ${raw.risk?.assessmentYear || ''}: ${fmt(d.hs0)} จุด (ไม่คิดคะแนน)<br>${d.reason || ''}</div>`;
    } else if (d?.model === 'M5') {
      const ns = H.map((s, i) => `${s}: ${fmt(d['n' + i])}`).join(' · ');
      const tr = { up: '↑ ปีล่าสุดสูงกว่าค่าเฉลี่ยปีก่อน', down: '↓ ปีล่าสุดต่ำกว่าค่าเฉลี่ยปีก่อน', flat: '→ ใกล้เคียงค่าเฉลี่ยปีก่อน' }[d.trend] || '';
      admin = `<div class="tip-admin">ผู้ดูแล · Model 5${d.score !== null && d.score !== undefined ? ` · ลำดับ ${Number(d.score).toFixed(1)}/100 ในจังหวัด` : ''}<br>ความหนาแน่น ${f1(d.D)} จุด/1,000 ไร่/ปี${d.R !== null && d.R !== undefined ? ` · เผาซ้ำ ${d.R}%` : ''} · พื้นที่ ${f1(d.cropRai)} ไร่<br>จุดความร้อนปีฐาน (${raw.risk?.monthsText || ''}) ${ns || '-'}${tr ? `<br>แนวโน้ม: ${tr}` : ''}${d.crop ? `<br>ชนิดพืช: ${d.crop}` : ''}<br>${d.reason || ''}</div>`;
    } else if (d?.model === 'M4') {
      const us = H.map((s, i) => `${s}: ${f1(d['u' + i])}`).join(' · ');
      const sig = `สัญญาณปีงบ ${raw.risk?.season || ''}: ${fmt(d.hs0)} จุด${d.base !== null && d.base !== undefined ? ` เทียบช่วงเดียวกันปีก่อน ${fmt(d.base)} จุด${d.trend ? ` · ${TREND_TEXT[d.trend]}` : ''}` : ''}`;
      admin = `<div class="tip-admin">ผู้ดูแล · Model 4${d.score !== null && d.score !== undefined ? ` · คะแนน ${Number(d.score).toFixed(1)}/100` : ''}${d.H !== null && d.H !== undefined ? ` · H ${f1(d.H)} หน่วย/1,000 ไร่เกษตร` : ''}<br>พื้นที่เกษตร ${f1(d.cropRai)} ไร่ · หน่วยตรวจพบ (กริด 500 ม.–วัน) ${us || '-'}<br>${d.reason || ''}<br>${sig}</div>`;
    }
    const drill = level === 'district' && !state.district ? `<button type="button" class="ap-drill" data-drill>ดูรายตำบลในอำเภอนี้</button>` : '';
    return `<div class="area-pop-in"><div class="ap-head"><strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span></div>
      ${lines.join('')}${extra.length ? `<div class="ap-more">${extra.map(x => `<div>${x}</div>`).join('')}</div>` : ''}${admin}${drill}</div>`;
  }

  function hsPopup(p, prev) {
    return `<div class="hs-pop"><strong>จุดความร้อน${prev ? ' · ช่วงเดียวกันปีก่อน' : ''}</strong>
          <div>${Geo.thaiDateTime(p.__date, p.__time)}${p.__time && p.__timeSrc === 'hsid' ? ' <span class="hs-pop-note" title="ไฟล์ต้นทางไม่มีเวลา ระบบคำนวณจากเวลา UTC ใน hsID ของ NASA FIRMS">(จาก hsID)</span>' : ''}</div>
          <div>อ.${p.__district} ต.${p.__subdistrict}${p.__village ? ` · ${p.__village}` : ''}</div>
          <div class="hs-pop-crop">${Geo.cropIcon(p.__crop, 'hs-pop-ic')}<span>${p.__crop}</span></div>${p.__land ? `<div class="hs-pop-note">พื้นที่: ${p.__land}</div>` : ''}
          <div class="hs-pop-note">ปีงบประมาณ ${p.__season} (ต.ค. ${p.__season - 1} – ก.ย. ${p.__season})</div></div>`;
  }
  /** จุดความร้อน 2 ชั้น: ช่วงที่เลือก (ชั้นบนสุด สีน้ำเงิน) และช่วงเดียวกันปีก่อน (ชั้นล่าง สีเทา) */
  function renderHotspots() {
    remove(shown.hotspot); shown.hotspot = null; remove(shown.hotspotPrev); shown.hotspotPrev = null;
    if (!raw.bundle) return;
    // วงกลมกลุ่มจุดใช้สีกลาง (ไม่ใช้เขียว/เหลือง/ส้มค่าเริ่มต้นที่ซ้ำกับสีระดับความเสี่ยง) ตัวเลข = จำนวนจุดความร้อนในกลุ่ม
    const layer = (features, prev) => {
      const pane = prev ? 'hsPrev' : 'hsCur';
      const group = L.markerClusterGroup({ disableClusteringAtZoom: 11, chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50, clusterPane: pane,
        iconCreateFunction: c => { const n = c.getChildCount(), size = n < 10 ? 30 : n < 100 ? 36 : 44;
          return L.divIcon({ html: `<span>${n.toLocaleString('th-TH')}</span>`, className: prev ? 'hs-cluster hs-cluster-prev' : 'hs-cluster', iconSize: [size, size] }); } });
      L.geoJSON({ type: 'FeatureCollection', features }, {
        pointToLayer: (f, ll) => L.circleMarker(ll, prev ? { pane, radius: 4.5, fillColor: '#94a3b8', color: '#ffffff', weight: 1, fillOpacity: 0.8 } : { pane, radius: 5.5, fillColor: CONFIG.SEASON_COLORS[0], color: '#ffffff', weight: 1.4, fillOpacity: 0.95 }),
        onEachFeature: (f, l) => l.bindPopup(hsPopup(f.properties, prev))
      }).addTo(group);
      return group.addTo(map);
    };
    if (document.getElementById('lyr-hotspot-prev')?.checked) shown.hotspotPrev = layer(prevHotspots(), true);
    if (document.getElementById('lyr-hotspot')?.checked) shown.hotspot = layer(mapHotspots(), false);
  }

  /** คำอธิบายแผนที่: เฉพาะระดับความเสี่ยงการเผา (รายละเอียดสูตรอยู่ในแถบสถานะ ป๊อปอัป และรายงาน) */
  function renderLegend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const na = AREA_MODELS.includes(raw.risk?.model);
    el.innerHTML = `<div class="p-3 text-xs">
      <p class="mb-1.5 font-bold text-ink">ระดับความเสี่ยงการเผา (พื้นที่)</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">${CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span class="risk-pill text-xs"><span class="risk-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')}</div>
      ${na ? `<span class="risk-pill mt-1 text-xs"><span class="risk-dot" style="background:${NA_LEVEL.color}"></span>ไม่ประเมิน (ไม่มีพื้นที่เกษตร)</span>` : ''}
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
  const NA_LEVEL = { label: 'ไม่ประเมิน', color: '#cbd5e1', min: -1, max: -1 };
  const levelOf = p => p.risk_level < 0 ? NA_LEVEL : (CONFIG.RISK_LEVELS[p.risk_level] || CONFIG.RISK_LEVELS[0]);

  return {
    setDataStart: d => { raw.dataFirst = d || ''; }, setDataMonths: m => { raw.dataMonths = Array.isArray(m) ? m : []; }, compareInfo, prevHotspots, levelOf,
    init, showNational, highlightProvince, setProvince, clearProvince, applyFilter, focusSelection, seasonColor, riskInfo, riskBasisText, viewerDetailed,
    clearRiskCache: () => riskCache.clear(),
    map: () => map, getData: () => raw, getState: () => ({ ...state }), filteredHotspots, mapHotspots, displaySeason, inRange, selectionFeatures,
    getRiskForScope: level => level === 'district' ? raw.riskDistrict : raw.riskSubdistrict,
    invalidate: () => map?.invalidateSize({ pan: false })
  };
})();
