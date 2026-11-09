/* รายงานพิมพ์ A4 แนวนอน: แผนที่พอดีขอบเขตที่เลือก + ตาราง HS ครบทุกอำเภอ/ตำบล (ไม่มีแถบคะแนนทับแผนที่) */
const Report = (() => {
  let prMap = null, layers = [];
  const el = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('th-TH');

  function ensureMap() {
    if (prMap) return prMap;
    prMap = L.map('pr-map', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0.1, fadeAnimation: false, zoomAnimation: false });
    prMap.__base = L.tileLayer(CONFIG.BASEMAPS.print.url, { maxZoom: 19, crossOrigin: true }).addTo(prMap);
    return prMap;
  }

  /** คำอธิบายวิธีประเมินระดับความเสี่ยง (BRI) สำหรับรายงาน — ภาษาทั่วไป ไม่แสดงคะแนน */
  function riskMethodText(ctx) {
    const r = ctx.risk;
    if (!r) return `${ctx.basis || 'ยังไม่มีผลประเมินระดับความเสี่ยง'} จำนวนจุดในตารางเป็นของช่วงที่เลือก`;
    if (r.model === 'PROTO') return `${ctx.basis} ระดับเป็นการเทียบภายในจังหวัดและขึ้นกับช่วงเวลาที่เลือก (สูตรต้นแบบ ไม่ได้ปรับด้วยขนาดพื้นที่แบบความหนาแน่น)`;
    const w = r.weights || {}, pct = x => Math.round((x || 0) * 100) + '%';
    const parts = [`ความหนาแน่นจุดความร้อนต่อพื้นที่ ${pct(w.D)}${(r.history || []).length > 1 ? ' (ฤดูล่าสุดมีน้ำหนักมากที่สุด)' : ''}`];
    if (w.P) parts.push(`การเกิดซ้ำในแต่ละฤดู ${pct(w.P)}`);
    if (w.C) parts.push(`ชนิดพืช ${pct(w.C)}`);
    return `${ctx.basis} ด้วยดัชนีความเสี่ยงการเผา (BRI): ${parts.join(' ')} แล้วจัด 4 ระดับเทียบกับทุกพื้นที่ของทุกจังหวัดที่มีข้อมูล (จุดตัดเปอร์เซ็นไทล์ 50/75/90) ระดับความเสี่ยงคือ “โอกาสเกิดการเผา” จึงอาจไม่ตรงกับจำนวนจุดของช่วงที่เลือกในตาราง`;
  }
  function build(ctx) {
    const S = Dashboard.summary();
    if (!S) return null;
    const st = MapModule.getState(), raw = MapModule.getData();
    const prov = ctx.province;
    // ---- header/meta ----
    el('pr-province').textContent = `จังหวัด${prov.name}`;
    el('pr-scope').textContent = ctx.scopeText;
    el('pr-period').textContent = ctx.periodText + ` · ${ctx.land || 'พื้นที่เกษตร'}` + (st.crop ? ` (${st.crop})` : '');
    el('pr-updated').textContent = Geo.thaiDate(prov.last);
    el('pr-date').textContent = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    // ---- table: every district/subdistrict in scope, including zero HS ----
    const rows = S.rows.slice().sort((a, b) => b.current - a.current || b.score - a.score || a.name.localeCompare(b.name, 'th'));
    el('pr-table-title').textContent = `จุดความร้อน (HS) ราย${S.unitLabel} — ครบ ${rows.length} ${S.unitLabel}`;
    el('pr-table').querySelector('thead').innerHTML = `<tr><th class="num">ลำดับ</th><th>${S.unitLabel}</th><th class="num">HS ช่วงที่เลือก</th><th class="num">ช่วงเดียวกันปีก่อน</th><th class="num">เพิ่ม/ลด</th><th>ระดับความเสี่ยง</th></tr>`;
    const extra = S.unassigned ? `<tr><td class="num">–</td><td>ไม่ระบุพื้นที่</td><td class="num">${fmt(S.unassigned)}</td><td class="num">–</td><td class="num">–</td><td>–</td></tr>` : '';
    el('pr-table').querySelector('tbody').innerHTML = rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${r.name}</td><td class="num"><b>${fmt(r.current)}</b></td><td class="num">${fmt(r.previous)}</td><td class="num">${r.change.text}</td><td><span class="lv"><i style="background:${r.level.color}"></i>${r.level.label}</span></td></tr>`).join('') + extra;
    el('pr-table').querySelector('tfoot').innerHTML = `<tr><th></th><th>รวม</th><th class="num">${fmt(S.totalCur)}</th><th class="num">${fmt(S.totalPrev)}</th><th class="num">${S.change.text}</th><th></th></tr>`;
    // fit all rows on one page
    const n = rows.length + (S.unassigned ? 1 : 0) + 2;
    const h = Math.min(7, 158 / n);                         // mm per row
    const fs = Math.max(5.6, Math.min(9, h * 1.45));          // pt
    const pad = Math.max(0.25, (h - fs * 0.3528 * 1.25) / 2); // mm
    const table = el('pr-table'), right = table.parentElement, notes = el('pr-notes');
    const setSize = (f, p) => { table.style.setProperty('--pr-fs', f.toFixed(2) + 'pt'); table.style.setProperty('--pr-pad', p.toFixed(2) + 'mm'); };
    // ---- notes under the table: risk distribution + method ----
    const totU = S.levels.reduce((a, b) => a + b, 0) || 1;
    notes.innerHTML = `<div><h3>สรุประดับความเสี่ยง</h3><table>${CONFIG.RISK_LEVELS.slice().reverse().map(l => { const v = S.levels[CONFIG.RISK_LEVELS.indexOf(l)]; return `<tr><td><span class="lv"><i style="background:${l.color};width:2.4mm;height:2.4mm;border-radius:50%;display:inline-block;margin-right:1mm"></i>${l.label}</span></td><td class="num">${v} ${S.unitLabel}</td><td class="num">${(v * 100 / totU).toFixed(1)}%</td></tr>`; }).join('')}</table></div>
      <div><h3>วิธีประเมิน</h3><p>${riskMethodText(ctx)}</p><p>เปรียบเทียบกับช่วงเดียวกันปีก่อน: ${S.priorText}</p></div>`;
    let f = fs, p = pad; setSize(f, p); notes.style.display = '';
    const fits = () => right.scrollHeight <= right.clientHeight + 1;
    if (!fits()) notes.style.display = 'none';
    while (!fits() && f > 5.2) { f -= 0.25; p = Math.max(0.12, p - 0.1); setSize(f, p); }

    // ---- legend & KPIs (outside the map so nothing covers data) ----
    const seasons = MapModule.displaySeason() ? [MapModule.displaySeason()] : [];
    el('pr-legend').innerHTML = CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('')
      + seasons.map(s => `<span><i class="pt" style="background:${CONFIG.SEASON_COLORS[0]}"></i>HS ฤดู ${s} (ล่าสุด)</span>`).join('')
      + `<span class="north">▲ ทิศเหนือ</span>`;
    const withHs = rows.filter(r => r.current > 0).length;
    el('pr-kpis').innerHTML = [
      [fmt(S.totalCur), 'จุดความร้อนในช่วงที่เลือก'],
      [S.change.text, S.compareMode === 'month' ? `เทียบเดือนเดียวกันปีก่อน (${fmt(S.totalPrev)} จุด) · ${S.compareNote}` : `เทียบช่วงเดียวกันปีก่อน (${fmt(S.totalPrev)} จุด)`],
      [`${withHs}/${rows.length}`, `${S.unitLabel}ที่พบจุดความร้อน`],
      [String(S.levels[2] + S.levels[3]), `${S.unitLabel}เสี่ยงสูง–สูงมาก`]
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

    // ---- map ----
    const m = ensureMap();
    layers.forEach(l => m.removeLayer(l)); layers = [];
    const riskFC = MapModule.getRiskForScope(S.level);
    const riskLayer = L.geoJSON(riskFC, { style: f => ({ color: '#ffffff', weight: 0.6, fillColor: MapModule.getRiskLevel(f.properties.risk_score).color, fillOpacity: ctx.risk ? 0.55 : 0 }), interactive: false }).addTo(m);
    layers.push(riskLayer);
    const outline = S.level === 'district'
      ? L.geoJSON(raw.bundle.district, { style: { color: '#334155', weight: 1.1, fill: false }, interactive: false })
      : L.geoJSON({ type: 'FeatureCollection', features: raw.bundle.subdistrict.features.filter(f => f.properties.amp_code === st.district && (!st.subdistrict || f.properties.tam_code === st.subdistrict)) }, { style: { color: '#475569', weight: 0.8, fill: false }, interactive: false });
    layers.push(outline.addTo(m));
    const focus = MapModule.selectionFeatures();
    const frame = L.geoJSON({ type: 'FeatureCollection', features: focus }, { style: { color: '#0f172a', weight: 2.2, fill: false }, interactive: false }).addTo(m);
    layers.push(frame);
    const pts = L.geoJSON({ type: 'FeatureCollection', features: MapModule.mapHotspots() }, {
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 2.4, fillColor: CONFIG.SEASON_COLORS[0], color: '#ffffff', weight: 0.6, fillOpacity: 1 }), interactive: false
    }).addTo(m);
    layers.push(pts);
    // labels at an interior point of every unit
    const labelSize = riskFC.features.length > 24 ? 7 : riskFC.features.length > 14 ? 8 : 9.5;
    riskFC.features.forEach(f => {
      let c; try { c = turf.pointOnFeature(f).geometry.coordinates; } catch { return; }
      const t = L.tooltip({ permanent: true, direction: 'center', className: 'area-label', interactive: false }).setLatLng([c[1], c[0]]).setContent(`<span style="font-size:${labelSize}px">${f.properties.name}</span>`);
      t.addTo(m); layers.push(t);
    });
    m.invalidateSize({ pan: false });
    m.fitBounds(frame.getBounds(), { padding: [14, 14], animate: false });
    return m;
  }

  function waitTiles(m, timeout = 4500) {
    return new Promise(resolve => {
      let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
      const base = m.__base;
      if (!base.isLoading || !base.isLoading()) setTimeout(finish, 350);
      base.once('load', () => setTimeout(finish, 200));
      setTimeout(finish, timeout);
    });
  }

  async function print(ctx) {
    const m = build(ctx);
    if (!m) return;
    await waitTiles(m);
    window.print();
  }
  return { build, print };
})();
