/* แผนที่หลัก: โหมดประเทศ (เลือกจังหวัด) และโหมดจังหวัด (วิเคราะห์ความเสี่ยงตามต้นแบบ) */
const MapModule = (() => {
  let map, basemapKey = 'voyager';
  const base = {};
  const shown = { national: null, province: null, district: null, subdistrict: null, risk: null, hotspot: null };
  const raw = { bundle: null, hotspot: null, riskDistrict: null, riskSubdistrict: null, seasons: [], risk: null, code: '' };
  const riskCache = new Map();
  let state = { district: '', subdistrict: '', crop: '', startYM: null, endYM: null };
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
    const detailed = viewerDetailed(), end = endDateOfRange();
    const key = `${raw.code}|${end}|${detailed ? 'd' : 'p'}`;
    if (!riskCache.has(key)) {
      const req = detailed ? Api.post('risk_detail', { province: raw.code, end }) : Api.get('risk', { province: raw.code, end });
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
        const row = table[code], lvl = row ? Number(at(row, 'level')) : 0;
        const detail = api?.detailed && row ? { bri: at(row, 'bri'), D: at(row, 'D'), P: at(row, 'P'), C: at(row, 'C'), hs0: at(row, 'hs0'), hs1: at(row, 'hs1'), hs2: at(row, 'hs2'), base: at(row, 'base'), trend: at(row, 'trend') } : null;
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
  function computeRiskLayers() {
    raw.seasons = [...new Set([...(raw.hotspot?.features || []).map(f => f.properties.__season)])].sort((a, b) => a - b);
    raw.riskDistrict = buildRiskCollection('district');
    raw.riskSubdistrict = buildRiskCollection('subdistrict');
  }
  /** คำอธิบายช่วงประเมินความเสี่ยงสำหรับแสดงผล */
  function riskInfo() {
    const r = raw.risk; if (!r || r.empty) return null;
    return { season: r.season, early: r.early, start: r.window?.start, end: r.window?.end, latest: r.latest, seasons: r.seasons || [], detailed: !!r.detailed, cuts: r.cuts, refSeasons: r.refSeasons, source: r.source };
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
    if (!raw.bundle || !raw.risk || raw.risk.empty || !document.getElementById('lyr-risk')?.checked) return;   // ไม่มีผลประเมิน = ไม่ระบายสี (ไม่แสดงเป็น "ต่ำ")
    const level = state.district ? 'subdistrict' : 'district';
    const fc = level === 'district' ? raw.riskDistrict : raw.riskSubdistrict;
    shown.risk = L.geoJSON(fc, {
      style: f => { const l = CONFIG.RISK_LEVELS[f.properties.risk_level] || CONFIG.RISK_LEVELS[0]; return { color: '#ffffff', weight: 0.8, fillColor: l.color, fillOpacity: 0.5 }; },
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindTooltip(riskTooltip(p, level), { sticky: true, className: 'prov-tip' });
        l.on('click', () => document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level, code: p.code, district: p.district_code } })));
      }
    }).addTo(map);
    [shown.subdistrict, shown.district, shown.province].forEach(x => x?.bringToFront());
  }

  const TREND_TEXT = { up: '↑ เพิ่มขึ้นจากค่าฐาน', down: '↓ ลดลงจากค่าฐาน', flat: '→ ใกล้เคียงค่าฐาน' };
  /** ประชาชน: ระดับ + จำนวนจุดในช่วงที่เลือก · ผู้ดูแล: คะแนน องค์ประกอบ และแนวโน้มเพิ่ม */
  function riskTooltip(p, level) {
    const lv = CONFIG.RISK_LEVELS[p.risk_level] || CONFIG.RISK_LEVELS[0], fmt = n => Number(n || 0).toLocaleString('th-TH');
    let html = `<strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><br><span class="risk-pill"><span class="risk-dot" style="background:${lv.color}"></span>ความเสี่ยง${lv.label}</span><br>จุดความร้อนในช่วงที่เลือก ${fmt(p.selected_hotspot_count)} จุด`;
    if (p.detail) {
      const d = p.detail;
      html += `<div class="tip-admin">ผู้ดูแล · BRI ${Number(d.bri).toFixed(1)} (D ${Number(d.D).toFixed(0)} · P ${Number(d.P).toFixed(0)} · C ${Number(d.C).toFixed(0)})<br>HS ช่วงประเมิน ${fmt(d.hs0)} · ค่าฐาน ${Number(d.base).toFixed(1)}${d.trend ? ` · ${TREND_TEXT[d.trend]}` : ''}</div>`;
    }
    return html;
  }

  function renderHotspots() {
    remove(shown.hotspot); shown.hotspot = null;
    if (!raw.bundle || !document.getElementById('lyr-hotspot')?.checked) return;
    // วงกลมกลุ่มจุดใช้สีกลาง (ไม่ใช้เขียว/เหลือง/ส้มค่าเริ่มต้นที่ซ้ำกับสีระดับความเสี่ยง) ตัวเลข = จำนวนจุดความร้อนในกลุ่ม
    const group = L.markerClusterGroup({ disableClusteringAtZoom: 11, chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50,
      iconCreateFunction: c => { const n = c.getChildCount(), size = n < 10 ? 30 : n < 100 ? 36 : 44;
        return L.divIcon({ html: `<span>${n.toLocaleString('th-TH')}</span>`, className: 'hs-cluster', iconSize: [size, size] }); } });
    L.geoJSON({ type: 'FeatureCollection', features: filteredHotspots() }, {
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5.5, fillColor: seasonColor(f.properties.__season), color: '#ffffff', weight: 1.4, fillOpacity: 0.95 }),
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<div class="hs-pop"><strong>จุดความร้อน</strong>
          <div>${Geo.thaiDateTime(p.__date, p.__time)}${p.__time && p.__timeSrc === 'hsid' ? ' <span class="hs-pop-note" title="ไฟล์ต้นทางไม่มีเวลา ระบบคำนวณจากเวลา UTC ใน hsID ของ NASA FIRMS">(จาก hsID)</span>' : ''}</div>
          <div>อ.${p.__district} ต.${p.__subdistrict}${p.__village ? ` · ${p.__village}` : ''}</div>
          <div class="hs-pop-crop">${Geo.cropIcon(p.__crop, 'hs-pop-ic')}<span>${p.__crop}</span></div>
          <div class="hs-pop-note">ฤดูกาล ${p.__season} (ต.ค. ${p.__season - 1} – ก.ย. ${p.__season})</div></div>`);
      }
    }).addTo(group);
    group.addTo(map); shown.hotspot = group;
  }

  function renderLegend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const seasons = [...new Set(filteredHotspots().map(f => f.properties.__season))].sort((a, b) => b - a);
    const info = riskInfo();
    const basis = info ? (info.early ? `ประเมินจากฤดู ${info.seasons.join(', ')} (ฤดู ${info.season} ทั้งฤดู เนื่องจากต้นฤดูข้อมูลยังน้อย)` : `ประเมินจากฤดู ${info.seasons.join(', ')} ช่วง 1 ต.ค.–${Geo.thaiDate(info.end)} ของทุกฤดู`) : 'กำลังประเมิน…';
    el.innerHTML = `<div class="max-w-[17rem] p-3 text-xs">
      <p class="mb-1.5 font-bold text-ink">ระดับความเสี่ยงการเผา (พื้นที่)</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">${CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span class="risk-pill text-xs"><span class="risk-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')}</div>
      <p class="mt-1 leading-snug text-ink-soft">${basis}</p>
      ${seasons.length ? `<p class="mb-1.5 mt-2.5 font-bold text-ink">จุดความร้อน (ตำแหน่ง) ตามฤดูกาล ต.ค.–ก.ย.</p><div class="flex flex-wrap gap-x-3 gap-y-1">${seasons.map(s => `<span class="risk-pill text-xs"><span class="risk-dot ring-1 ring-white" style="background:${seasonColor(s)}"></span>${s}</span>`).join('')}</div>
      <p class="mt-1.5 flex items-center gap-1.5 leading-snug text-ink-soft"><span class="hs-cluster-mini">12</span>ตัวเลขในวงกลม = จำนวนจุดความร้อนที่อยู่รวมกัน</p>` : ''}
    </div>`;
    el.classList.remove('hidden');
  }

  /** แสดงจุด/ขอบเขตทันที แล้วโหลดระดับความเสี่ยงจาก Backend (แคชตามจังหวัด+วันสิ้นสุดช่วง) */
  async function applyFilter(next) {
    state = { district: next.district || '', subdistrict: next.subdistrict || '', crop: next.crop || '', startYM: Number(next.startYM) || null, endYM: Number(next.endYM) || null, startYear: next.startYear, startMonth: next.startMonth, endYear: next.endYear, endMonth: next.endMonth };
    const code = raw.code;
    computeRiskLayers(); renderBoundaries(); renderHotspots(); renderLegend(); focusSelection();
    let error = '';
    try { const r = await loadRisk(); if (code !== raw.code) return { stale: true }; raw.risk = r; }
    catch (err) { error = err.message; raw.risk = null; }
    computeRiskLayers(); renderRisk(); renderLegend();
    return { seasons: activeSeasons(), risk: riskInfo(), error };
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
    init, showNational, highlightProvince, setProvince, clearProvince, applyFilter, focusSelection, getRiskLevel, seasonColor, riskInfo, viewerDetailed,
    clearRiskCache: () => riskCache.clear(),
    map: () => map, getData: () => raw, getState: () => ({ ...state }), filteredHotspots, inRange, selectionFeatures,
    getRiskForScope: level => level === 'district' ? raw.riskDistrict : raw.riskSubdistrict,
    invalidate: () => map?.invalidateSize({ pan: false })
  };
})();
