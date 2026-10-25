/* แผนที่หลัก: โหมดประเทศ (เลือกจังหวัด) และโหมดจังหวัด (วิเคราะห์ความเสี่ยงตามต้นแบบ) */
const MapModule = (() => {
  let map, basemapKey = 'voyager';
  const base = {};
  const shown = { national: null, province: null, district: null, subdistrict: null, risk: null, hotspot: null };
  const raw = { bundle: null, hotspot: null, riskDistrict: null, riskSubdistrict: null, seasons: [] };
  let state = { district: '', subdistrict: '', crop: '', startYM: null, endYM: null };
  let nationalLayers = new Map();

  /* ---------------- init ---------------- */
  function init() {
    map = L.map('map', { center: CONFIG.MAP_CENTER, zoom: CONFIG.MAP_ZOOM, minZoom: CONFIG.MAP_MIN_ZOOM, maxZoom: CONFIG.MAP_MAX_ZOOM, zoomControl: false, zoomSnap: 0.25 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k, b]) => { if (k !== 'print') base[k] = L.tileLayer(b.url, { maxZoom: 19, attribution: b.attribution, crossOrigin: true }); });
    base[basemapKey].addTo(map);
    map.fitBounds(CONFIG.THAILAND_BOUNDS);

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
  function setProvince(bundle, hotspotFC) {
    hideNational();
    raw.bundle = bundle; raw.hotspot = hotspotFC;
  }
  function clearProvince() {
    ['province', 'district', 'subdistrict', 'risk', 'hotspot'].forEach(k => { remove(shown[k]); shown[k] = null; });
    raw.bundle = null; raw.hotspot = null; raw.riskDistrict = null; raw.riskSubdistrict = null;
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
  function seasonWeights(seasons) {
    const cfg = CONFIG.RISK_MODEL.seasonWeights;
    const vals = seasons.map((s, i) => cfg[seasons.length - 1 - i] ?? cfg[cfg.length - 1]);
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(seasons.map((s, i) => [s, vals[i] / total]));
  }

  /* ---- ต้นแบบ: annual evidence-gate model ---- */
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

  function scopeUnits(level) {
    if (!raw.bundle) return [];
    if (level === 'district') return raw.bundle.district.features.filter(f => !state.district || districtCodeOf(f) === state.district);
    return raw.bundle.subdistrict.features.filter(f => (!state.district || f.properties.amp_code === state.district) && (!state.subdistrict || subdistrictCodeOf(f) === state.subdistrict));
  }

  function buildRiskCollection(level, seasons) {
    const w = seasonWeights(seasons), factors = CONFIG.RISK_MODEL.weights;
    const units = scopeUnits(level);
    const key = level === 'district' ? '__dCode' : '__sCode';
    const pool = (raw.hotspot?.features || []).filter(f => inRange(f.properties) && (!state.crop || f.properties.__crop === state.crop));
    const rows = units.map(feature => {
      const code = level === 'district' ? districtCodeOf(feature) : subdistrictCodeOf(feature);
      const fs = pool.filter(h => h.properties[key] === code);
      const counts = {}; let cropSum = 0;
      seasons.forEach(s => { counts[s] = 0; });
      fs.forEach(h => { counts[h.properties.__season] = (counts[h.properties.__season] || 0) + 1; cropSum += CONFIG.CROP_RISK[h.properties.__crop] ?? 50; });
      const weighted = seasons.reduce((sum, s) => sum + (counts[s] || 0) * (w[s] || 0), 0);
      let trend = 0;
      if (seasons.length >= 2) {
        const prev = counts[seasons[seasons.length - 2]] || 0, cur = counts[seasons[seasons.length - 1]] || 0;
        trend = prev === 0 ? (cur > 0 ? 100 : 0) : Math.max(0, Math.min(100, 50 + ((cur - prev) / prev) * 100));
      }
      return { feature, code, counts, weighted, trend, total: fs.length, crop: fs.length ? cropSum / fs.length : 0, area: Number(feature.properties.area_sqkm || 0) * 625 };
    });
    const referenceMax = Math.max(1, ...rows.flatMap(r => seasons.map(s => r.counts[s] || 0)));
    const logs = rows.map(r => Math.log1p(r.area));
    const minL = logs.length ? Math.min(...logs) : 0, maxL = logs.length ? Math.max(...logs) : 0;
    return {
      type: 'FeatureCollection',
      features: rows.map((r, i) => {
        const hs = seasons.length ? Math.max(0, Math.min(100, r.weighted / referenceMax * 100)) : 0;
        const area = maxL === minL ? (rows.length === 1 ? 50 : 0) : (logs[i] - minL) / (maxL - minL) * 100;
        let score = 0, method = '-';
        if (seasons.length === 1) { score = annualEvidenceScore(r.total, r.crop, area); method = 'Unified annual evidence-gate model'; }
        else if (seasons.length >= 2) { score = hs * factors.hotspot + r.trend * factors.trend + r.crop * factors.crop + area * factors.area; method = 'Multi-year Model A'; }
        const p = r.feature.properties;
        return {
          type: 'Feature', geometry: r.feature.geometry,
          properties: {
            code: r.code, name: level === 'district' ? p.amp_th : p.tam_th, district_code: p.amp_code, level,
            risk_score: +score.toFixed(2), hotspot_score: +hs.toFixed(2), trend_score: +r.trend.toFixed(2), crop_score: +r.crop.toFixed(2), area_score: +area.toFixed(2),
            selected_hotspot_count: r.total, risk_method: method, seasons: seasons.join(',')
          }
        };
      })
    };
  }

  function computeDynamicRisk() {
    const seasons = activeSeasons();
    raw.seasons = [...new Set([...(raw.hotspot?.features || []).map(f => f.properties.__season)])].sort((a, b) => a - b);
    raw.riskDistrict = buildRiskCollection('district', seasons);
    raw.riskSubdistrict = buildRiskCollection('subdistrict', seasons);
    return { seasons };
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
    if (!raw.bundle || !document.getElementById('lyr-risk')?.checked) return;
    const level = state.district ? 'subdistrict' : 'district';
    const fc = level === 'district' ? raw.riskDistrict : raw.riskSubdistrict;
    shown.risk = L.geoJSON(fc, {
      style: f => { const l = getRiskLevel(f.properties.risk_score); return { color: '#ffffff', weight: 0.8, fillColor: l.color, fillOpacity: 0.5 }; },
      onEachFeature: (f, l) => {
        const p = f.properties, lv = getRiskLevel(p.risk_score);
        l.bindTooltip(`<strong>${level === 'district' ? 'อ.' : 'ต.'}${p.name}</strong><br>HS ${p.selected_hotspot_count.toLocaleString('th-TH')} จุด<br>ความเสี่ยง: ${lv.label} (${p.risk_score.toFixed(1)})`, { sticky: true, className: 'prov-tip' });
        l.on('click', () => document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level, code: p.code, district: p.district_code } })));
      }
    }).addTo(map);
    [shown.subdistrict, shown.district, shown.province].forEach(x => x?.bringToFront());
  }

  function renderHotspots() {
    remove(shown.hotspot); shown.hotspot = null;
    if (!raw.bundle || !document.getElementById('lyr-hotspot')?.checked) return;
    const group = L.markerClusterGroup({ disableClusteringAtZoom: 11, chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 50 });
    L.geoJSON({ type: 'FeatureCollection', features: filteredHotspots() }, {
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5.5, fillColor: seasonColor(f.properties.__season), color: '#ffffff', weight: 1.4, fillOpacity: 0.95 }),
      onEachFeature: (f, l) => {
        const p = f.properties;
        l.bindPopup(`<strong>จุดความร้อน ${Geo.thaiDate(p.__date)}</strong>${p.__time ? ` เวลา ${p.__time}` : ''}<br>อ.${p.__district} ต.${p.__subdistrict}${p.__village ? `<br>${p.__village}` : ''}<br>ชนิดพืช: ${p.__crop}<br>ฤดูกาล ${p.__season}`);
      }
    }).addTo(group);
    group.addTo(map); shown.hotspot = group;
  }

  function renderLegend() {
    const el = document.getElementById('map-legend'); if (!el) return;
    const seasons = [...new Set(filteredHotspots().map(f => f.properties.__season))].sort((a, b) => b - a);
    el.innerHTML = `<div class="p-3 text-xs">
      <p class="mb-1.5 font-bold text-ink">ระดับความเสี่ยง</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">${CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span class="risk-pill text-xs"><span class="risk-dot" style="background:${l.color}"></span>${l.label}</span>`).join('')}</div>
      ${seasons.length ? `<p class="mb-1.5 mt-2.5 font-bold text-ink">จุดความร้อน (ฤดูกาล ต.ค.–ก.ย.)</p><div class="flex flex-wrap gap-x-3 gap-y-1">${seasons.map(s => `<span class="risk-pill text-xs"><span class="risk-dot ring-1 ring-white" style="background:${seasonColor(s)}"></span>${s}</span>`).join('')}</div>` : ''}
    </div>`;
    el.classList.remove('hidden');
  }

  function applyFilter(next) {
    state = { district: next.district || '', subdistrict: next.subdistrict || '', crop: next.crop || '', startYM: Number(next.startYM) || null, endYM: Number(next.endYM) || null, startYear: next.startYear, startMonth: next.startMonth, endYear: next.endYear, endMonth: next.endMonth };
    const info = computeDynamicRisk();
    renderRisk(); renderBoundaries(); renderHotspots(); renderLegend(); focusSelection();
    return info;
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
    map.fitBounds(L.geoJSON({ type: 'FeatureCollection', features: fs }).getBounds(), { padding: options.padding || [24, 24], animate: false });
  }
  function getRiskLevel(score) { return CONFIG.RISK_LEVELS.find(x => score >= x.min && score < x.max) || CONFIG.RISK_LEVELS[0]; }

  return {
    init, showNational, highlightProvince, setProvince, clearProvince, applyFilter, focusSelection, getRiskLevel, seasonColor,
    map: () => map, getData: () => raw, getState: () => ({ ...state }), filteredHotspots, inRange, selectionFeatures,
    getRiskForScope: level => level === 'district' ? raw.riskDistrict : raw.riskSubdistrict,
    invalidate: () => map?.invalidateSize({ pan: false })
  };
})();
