/* แผนที่หลัก: โหมดประเทศ (เลือกจังหวัด) และโหมดจังหวัด (วิเคราะห์ความเสี่ยงตามต้นแบบ) */
const MapModule = (() => {
  let map, basemapKey = 'voyager';
  const base = {};
  const shown = { national: null, province: null, district: null, subdistrict: null, risk: null, hotspot: null };
  const raw = { bundle: null, hotspot: null, riskDistrict: null, riskSubdistrict: null, seasons: [], risk: null, code: '', multi: null, dataFirst: '', dataMonths: [] };
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
    map.createPane('hsCur').style.zIndex = 450;   // v3.16: นำชั้นจุดช่วงเดียวกันปีก่อน (hsPrev) ออก — แผนที่แสดงเฉพาะจุดของช่วงที่เลือก
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
        const fyText = info.fyCount !== null && info.fyCount !== undefined ? `HS ปีงบ ${info.fiscalYear}: ${Number(info.fyCount).toLocaleString('th-TH')} จุด` : `HS ${Number(info.count).toLocaleString('th-TH')} จุด`;
        layer.bindTooltip(`<strong>จ.${f.properties.pro_th}</strong><br>${fyText}<br><span style="color:#4a5a51">คลิกเพื่อเปิดข้อมูลจังหวัด</span>`, { sticky: true, className: 'prov-tip', direction: 'top', offset: [0, -6] });
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
    raw.bundle = bundle; raw.hotspot = hotspotFC; raw.code = code || ''; raw.risk = null; raw.multi = null;
  }
  /** v3.17 หลายจังหวัด (Super/Mini Super Admin): bundle รวมขอบเขตทุกจังหวัดที่เลือก · ระดับความเสี่ยงยังประเมินแยกรายจังหวัด */
  function setMulti(bundle, hotspotFC, codes) {
    hideNational();
    raw.bundle = bundle; raw.hotspot = hotspotFC; raw.code = ''; raw.risk = null; raw.multi = codes.slice();
  }
  function clearProvince() {
    ['province', 'district', 'subdistrict', 'risk', 'hotspot'].forEach(k => { remove(shown[k]); shown[k] = null; });
    raw.bundle = null; raw.hotspot = null; raw.riskDistrict = null; raw.riskSubdistrict = null; raw.risk = null; raw.code = ''; raw.multi = null;
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
  function compareInfo(k = 1) {
    if (!state.endYM) return null;
    const s = Geo.ymFromIndex(state.startYM || state.endYM), e = Geo.ymFromIndex(state.endYM);
    const latest = (raw.hotspot?.features || []).reduce((a, f) => f.properties.__date > a ? f.properties.__date : a, '');
    const end = isoDate(e.year - 543, e.month, new Date(Date.UTC(e.year - 543, e.month, 0)).getUTCDate());
    return Object.assign(Geo.compareWindow(isoDate(s.year - 543, s.month, 1), end, latest, raw.dataFirst, raw.dataMonths, k), { latest });
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
    return !!u && (u.role === 'superadmin' || u.role === 'minisuper' || (!!raw.code && u.prov === raw.code));
  }
  function endDateOfRange() {
    if (!state.endYM) return '';
    const e = Geo.ymFromIndex(state.endYM), y = e.year - 543, last = new Date(Date.UTC(y, e.month, 0)).getUTCDate();
    return `${y}-${String(e.month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  function loadRiskOf(code) {
    const detailed = viewerDetailed(), end = endDateOfRange(), land = state.land || CONFIG.DEFAULT_LAND;
    const key = `${code}|${end}|${land}|${detailed ? 'd' : 'p'}`;
    if (!riskCache.has(key)) {
      const req = detailed ? Api.post('risk_detail', { province: code, end, land }) : Api.get('risk', { province: code, end, land });
      riskCache.set(key, req.catch(err => { riskCache.delete(key); throw err; }));
    }
    return riskCache.get(key);
  }
  async function loadRisk() {
    if (!Api.configured()) return null;
    if (raw.multi) return loadRiskMulti(raw.multi);
    if (!raw.code) return null;
    return loadRiskOf(raw.code);
  }
  /** v3.17 ผลประเมินรายจังหวัด (แต่ละจังหวัดจัดลำดับภายในจังหวัดตนเอง) รวมเป็นตารางเดียวสำหรับแสดงบนแผนที่ — รหัสอำเภอ/ตำบลไม่ซ้ำข้ามจังหวัด
   * จังหวัดที่ยังไม่มีผลประเมิน: อำเภอ/ตำบลของจังหวัดนั้นแสดงเป็น “ไม่ประเมิน” (ไม่ระบายเป็นระดับต่ำ) */
  async function loadRiskMulti(codes) {
    const rs = await Promise.all(codes.map(c => loadRiskOf(c).then(r => [c, r]).catch(err => [c, { empty: true, error: err.message }])));
    const ok = rs.filter(([, r]) => r && !r.empty && !r.noHistory);
    if (!ok.length) return rs[0]?.[1] || null;
    const base = ok[0][1];
    return Object.assign({}, base, {
      multi: true, validProvinces: ok.map(([c]) => c), failed: rs.filter(([, r]) => r?.error).map(([c]) => c),
      district: Object.assign({}, ...ok.map(([, r]) => r.district || {})), subdistrict: Object.assign({}, ...ok.map(([, r]) => r.subdistrict || {}))
    });
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
        const unrated = api?.multi && !api.validProvinces.includes(String(code).slice(0, 2));   // v3.17 จังหวัดที่ยังไม่มีผลประเมิน
        const row = table[code], raw0 = row ? Number(at(row, 'level')) : 0, lvl = unrated ? -1 : na ? (row ? raw0 : -1) : Math.max(0, raw0);
        const detail = api?.detailed && row ? Object.assign({ model: api.model }, Object.fromEntries(cols.map((c, i) => [c, row[i]]))) : null;
        return {
          type: 'Feature', geometry: feature.geometry,
          properties: {
            code, name: level === 'district' ? p.amp_th : p.tam_th, district_code: p.amp_code, province_code: String(p.amp_code || '').slice(0, 2), level,
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

  /* v3.14 คลิกพื้นที่บนแผนที่ = เลือกพื้นที่นั้นทันที (อำเภอ → เจาะรายตำบล · ตำบล → เลือก/ยกเลิก) แล้วทุกส่วนเปลี่ยนตาม (ไม่มีกล่องข้อมูลแล้ว
   * ตามที่ผู้ใช้กำหนด: นำกล่องข้อมูลเมื่อคลิกออก ไม่แสดงที่อื่นแทน) · คลิกได้แม้ปิดชั้นระดับความเสี่ยงหรือยังไม่มีผลประเมิน (ชั้นโปร่งใส) */
  function renderRisk() {
    remove(shown.risk); shown.risk = null;
    if (!raw.bundle) return;
    const colored = !!(raw.risk && !raw.risk.empty && !raw.risk.noHistory && document.getElementById('lyr-risk')?.checked);   // ไม่มีผลประเมิน = ไม่ระบายสี (ไม่แสดงเป็น "ต่ำ")
    const level = state.district ? 'subdistrict' : 'district';
    const fc = level === 'district' ? raw.riskDistrict : raw.riskSubdistrict;
    if (!fc) return;
    shown.risk = L.geoJSON(fc, {
      style: f => {
        const picked = level === 'subdistrict' && state.subdistrict === f.properties.code;
        if (!colored) return { color: picked ? '#14532d' : '#ffffff', weight: picked ? 2.5 : 0, fillColor: '#ffffff', fillOpacity: 0.01 };
        const l = levelOf(f.properties);
        return { color: picked ? '#14532d' : '#ffffff', weight: picked ? 2.5 : 0.8, fillColor: l.color, fillOpacity: f.properties.risk_level < 0 ? 0.35 : 0.5, dashArray: f.properties.risk_level < 0 ? '3 3' : null };
      },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindTooltip(riskTooltip(p, level, colored), { sticky: true, className: 'prov-tip' });
        l.on('click', () => document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level, code: p.code, district: p.district_code, source: 'map' } })));
      }
    }).addTo(map);
    [shown.subdistrict, shown.district, shown.province].forEach(x => x?.bringToFront());
  }


  /** ชี้: ชื่อพื้นที่ + ระดับความเสี่ยง (สั้น) + สิ่งที่จะเกิดเมื่อคลิก */
  function riskTooltip(p, level, colored = true) {
    const lv = levelOf(p), picked = level === 'subdistrict' && state.subdistrict === p.code;
    const act = raw.multi ? 'คลิกเพื่อเปิดจังหวัดนี้และเลือกอำเภอนี้' : level === 'district' ? 'คลิกเพื่อเลือกอำเภอนี้ (ดูรายตำบล)' : picked ? 'คลิกอีกครั้งเพื่อยกเลิกการเลือกตำบล' : 'คลิกเพื่อเลือกตำบลนี้';
    const pName = raw.multi ? provinceName(p.province_code) : '';
    return `<strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}${pName ? ` จ.${pName}` : ''}</strong>${colored ? `<br><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span>` : ''}<br><span style="color:#4a5a51">${act}</span>`;
  }

  const isoDate = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function hsPopup(p, prev) {
    return `<div class="hs-pop"><strong>จุดความร้อน${prev ? ' · ช่วงเดียวกันปีก่อน' : ''}</strong>
          <div>${Geo.thaiDateTime(p.__date, p.__time)}${p.__time && p.__timeSrc === 'hsid' ? ' <span class="hs-pop-note" title="ไฟล์ต้นทางไม่มีเวลา ระบบคำนวณจากเวลา UTC ใน hsID ของ NASA FIRMS">(จาก hsID)</span>' : ''}</div>
          <div>อ.${p.__district} ต.${p.__subdistrict}${p.__village ? ` · ${p.__village}` : ''}</div>
          <div class="hs-pop-crop">${Geo.cropIcon(p.__crop, 'hs-pop-ic')}<span>${p.__crop}</span></div>${p.__land ? `<div class="hs-pop-note">พื้นที่: ${p.__land}</div>` : ''}
          <div class="hs-pop-note">ปีงบประมาณ ${p.__season} (ต.ค. ${p.__season - 1} – ก.ย. ${p.__season})</div></div>`;
  }
  /* v3.13 จุดความร้อน 2 ชั้น: ช่วงที่เลือก (ชั้นบนสุด จุดสีน้ำเงิน) และช่วงเดียวกันปีก่อน (ชั้นล่าง จุดสีเทา)
   * ปกติแสดงเป็นจุดทุกจุด ไม่มีตัวเลข · รวมกลุ่มอัตโนมัติเฉพาะเมื่อชั้นนั้นมีจุดเกิน HS_CLUSTER_MIN และเฉพาะบริเวณที่จุดทับกัน (ซูม ≥ 11 แยกเป็นจุดเสมอ)
   * สีวงกลมกลุ่ม (ช่วงที่เลือก) = ระดับความเสี่ยงของตำบลที่จุดส่วนใหญ่ในกลุ่มอยู่ (ผลเดียวกับที่ระบายสีพื้นที่ — สีบนแผนที่มีความหมายเดียว) ใช้เฉดเข้ม + ขอบขาว
   * ยังไม่มีผลประเมิน = สีกรมท่ากลาง · ช่วงเดียวกันปีก่อน = สีเทา */
  const HS_CLUSTER_MIN = CONFIG.HS_CLUSTER_MIN || 800;
  const CLUSTER_DARK = ['#1e8449', '#a67c00', '#c0560f', '#b03a2e'];   // ต่ำ ปานกลาง สูง สูงมาก (เฉดเข้มของ CONFIG.RISK_LEVELS)
  let clustered = false;
  function subdistrictLevels() {
    const m = new Map();
    if (!raw.risk || raw.risk.empty || raw.risk.noHistory) return m;
    (raw.riskSubdistrict?.features || []).forEach(f => m.set(f.properties.code, f.properties.risk_level));
    return m;
  }
  function renderHotspots() {
    remove(shown.hotspot); shown.hotspot = null; clustered = false;
    if (!raw.bundle) return;
    const lv = subdistrictLevels();
    const layer = features => {
      const pane = 'hsCur';
      const pts = L.geoJSON({ type: 'FeatureCollection', features }, {
        pointToLayer: (f, ll) => L.circleMarker(ll, { pane, radius: 5.5, fillColor: CONFIG.SEASON_COLORS[0], color: '#ffffff', weight: 1.4, fillOpacity: 0.95 }),
        onEachFeature: (f, l) => l.bindPopup(hsPopup(f.properties, false))
      });
      if (features.length <= HS_CLUSTER_MIN) return pts.addTo(map);   // จุดไม่มาก: แสดงทุกจุด ไม่มีตัวเลข
      clustered = true;
      const group = L.markerClusterGroup({ disableClusteringAtZoom: 11, chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 28, clusterPane: pane,
        iconCreateFunction: c => {
          const ms = c.getAllChildMarkers(), n = ms.length, size = n < 10 ? 26 : n < 50 ? 32 : n < 200 ? 38 : 44;
          let bg = '#1e293b', label = '';
          if (lv.size) {
            const cnt = [0, 0, 0, 0]; ms.forEach(m => { const l = lv.get(m.feature?.properties?.__sCode); if (l >= 0) cnt[l]++; });
            const best = cnt.reduce((b, v, i) => v >= cnt[b] && v > 0 ? i : b, 0);   // เสมอกันใช้ระดับที่สูงกว่า
            if (cnt[best] > 0) { bg = CLUSTER_DARK[best]; label = ` · ส่วนใหญ่อยู่ในตำบลระดับ${CONFIG.RISK_LEVELS[best].label}`; }
          }
          return L.divIcon({ html: `<span style="background:${bg}" title="จุดความร้อน ${n.toLocaleString('th-TH')} จุด${label}">${n.toLocaleString('th-TH')}</span>`, className: 'hs-cluster', iconSize: [size, size] });
        } });
      pts.addTo(group);
      return group.addTo(map);
    };
    if (document.getElementById('lyr-hotspot')?.checked) shown.hotspot = layer(mapHotspots());
  }

  /** คำอธิบายแผนที่: เฉพาะระดับความเสี่ยงการเผา (รายละเอียดสูตรอยู่ในแถบสถานะ ป๊อปอัป และรายงาน) */
  function renderLegend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const na = AREA_MODELS.includes(raw.risk?.model);
    el.innerHTML = `<div class="p-3 text-xs">
      <p class="mb-1.5 font-bold text-ink">ระดับความเสี่ยงการเผา (พื้นที่)</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">${CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span class="risk-pill text-xs"><span class="risk-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')}</div>
      ${na ? `<span class="risk-pill mt-1 text-xs"><span class="risk-dot" style="background:${NA_LEVEL.color}"></span>ไม่ประเมิน (ไม่มีพื้นที่เกษตร)</span>` : ''}
      ${raw.multi ? '<p class="mt-1.5 max-w-[14rem] leading-snug text-amber-800">ระดับความเสี่ยงจัดลำดับภายในแต่ละจังหวัด — เปรียบเทียบสีข้ามจังหวัดไม่ได้ (เทียบจำนวนจุดจากตารางรายจังหวัด)</p>' : ''}
      ${clustered ? '<p class="mt-1.5 max-w-[14rem] leading-snug text-ink-soft">วงกลมตัวเลข = กลุ่มจุดความร้อนที่ทับกัน (แสดงเมื่อจุดมาก) สีตามระดับความเสี่ยงของตำบลที่จุดส่วนใหญ่อยู่ · ซูมเข้าเพื่อดูรายจุด</p>' : ''}
    </div>`;
    el.classList.remove('hidden');
  }

  /** แสดงจุด/ขอบเขตทันที แล้วโหลดระดับความเสี่ยงจาก Backend (แคชตามจังหวัด+วันสิ้นสุดช่วง) */
  async function applyFilter(next) {
    state = { district: next.district || '', subdistrict: next.subdistrict || '', crop: next.crop || '', land: next.land || CONFIG.DEFAULT_LAND, startYM: Number(next.startYM) || null, endYM: Number(next.endYM) || null, startYear: next.startYear, startMonth: next.startMonth, endYear: next.endYear, endMonth: next.endMonth };
    const code = raw.code;
    computeRiskLayers(); renderBoundaries(); renderRisk(); renderHotspots(); renderLegend(); focusSelection();
    let error = '';
    try { const r = await loadRisk(); if (code !== raw.code) return { stale: true }; raw.risk = r; if (r?.first && !raw.dataFirst) raw.dataFirst = r.first; }
    catch (err) { error = err.message; raw.risk = null; }
    computeRiskLayers(); renderRisk(); if (clustered) renderHotspots(); renderLegend();
    return { seasons: activeSeasons(), risk: riskInfo(), basis: riskBasisText(true), error };
  }

  function selectionFeatures() {
    if (!raw.bundle) return [];
    if (state.subdistrict) return raw.bundle.subdistrict.features.filter(f => subdistrictCodeOf(f) === state.subdistrict);
    if (state.district) return raw.bundle.district.features.filter(f => districtCodeOf(f) === state.district);
    const pv = raw.bundle.province;
    return pv ? (pv.type === 'FeatureCollection' ? pv.features : [pv]) : raw.bundle.district.features;
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
  function provinceName(code) {
    const pv = raw.bundle?.province, fs = pv?.type === 'FeatureCollection' ? pv.features : pv ? [pv] : [];
    return fs.find(f => f.properties.pro_code === code)?.properties.pro_th || '';
  }

  return {
    setDataStart: d => { raw.dataFirst = d || ''; }, setDataMonths: m => { raw.dataMonths = Array.isArray(m) ? m : []; }, compareInfo, levelOf,
    init, showNational, highlightProvince, setProvince, setMulti, provinceName, clearProvince, applyFilter, focusSelection, seasonColor, riskInfo, riskBasisText, viewerDetailed,
    clearRiskCache: () => riskCache.clear(),
    map: () => map, getData: () => raw, getState: () => ({ ...state }), filteredHotspots, mapHotspots, displaySeason, inRange, selectionFeatures,
    getRiskForScope: level => level === 'district' ? raw.riskDistrict : raw.riskSubdistrict,
    invalidate: () => map?.invalidateSize({ pan: false })
  };
})();
