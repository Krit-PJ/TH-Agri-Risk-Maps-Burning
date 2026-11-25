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

  const span = H => { const a = (H || []).slice().sort((x, y) => x - y); return a.length > 1 ? `${a[0]}–${a[a.length - 1]}` : `${a[0] || ''}`; };
  /** v3.15 แหล่งข้อมูลจุดความร้อนตามแหล่งข้อมูลหลักที่ตั้งค่าไว้ (ผลประเมินระบุ source) */
  const hsSourceText = ctx => ctx.risk?.source === 'FIRMS' ? 'NASA FIRMS (ดาวเทียม VIIRS)' : 'สำนักงานส่งเสริมและพัฒนาการเกษตรที่ 6 จังหวัดเชียงใหม่';
  /** v3.15 วิธีประเมิน (รูปแบบที่ผู้ใช้กำหนด) — ABRI-2Y: 4 ข้อ · สูตรอื่น: คำอธิบายสูตร + แหล่งข้อมูล */
  function methodHtml(ctx, unit) {
    const r = ctx.risk, src = `แหล่งข้อมูลจุดความร้อนจาก ${hsSourceText(ctx)}`;
    const multiNote = ctx.multi ? ' · <b>ประเมินแยกรายจังหวัด</b> สีระดับความเสี่ยงบนแผนที่จึงเปรียบเทียบข้ามจังหวัดไม่ได้ (เทียบจำนวนจุดจากตาราง)' : '';
    if (!r) return `<ol><li>${ctx.basis || 'ยังไม่มีผลประเมินระดับความเสี่ยง'}</li><li>${src}</li></ol>`;
    if (r.model !== 'ABRI') return `<ol><li>${ctx.basis}</li><li>${src}</li></ol>`;
    const yrs = span(r.history), c = r.cuts || [50, 75, 90];
    return `<ol>
      <li>ระดับความเสี่ยง หมายถึง ระดับความเสี่ยงจากการจัดกลุ่มจำนวนจุดความร้อนย้อนหลัง 2 ปีงบประมาณ (ปีงบ ${yrs})</li>
      <li>จัดกลุ่มด้วยหลักการ Percentile เทียบ${unit}ภายในจังหวัดเดียวกัน เป็นการประเมินความเสี่ยงเชิงประวัติจากการเกิดจุดความร้อนซ้ำในแต่ละพื้นที่ ซึ่งสะท้อนพฤติกรรมการเผาของพื้นที่${multiNote}</li>
      <li>${src}</li>
      <li>เกณฑ์: สูงมาก ≥ P${c[2]} · สูง P${c[1]}–${c[2]} · ปานกลาง P${c[0]}–${c[1]} · ต่ำ &lt; P${c[0]} หรือจุดรวมน้อยกว่า ${r.minHs ?? 3} จุด · เป็นการประเมินจากข้อมูลที่ผ่านมา ไม่ใช่การทำนาย</li>
    </ol>`;
  }
  const GOAL_TEXT = 'เพื่อจัดลำดับพื้นที่เสี่ยงเชิงประวัติและพฤติกรรมการเผา และส่งเสริมการใช้ประโยชน์จากวัสดุเหลือใช้ทางการเกษตร สร้างทางเลือกให้เกิดรายได้เพิ่ม';
  function build(ctx) {
    const S = Dashboard.summary();
    if (!S) return null;
    const st = MapModule.getState(), raw = MapModule.getData();
    const prov = ctx.province;
    // ---- header/meta ----
    el('pr-province').textContent = ctx.multi ? (prov.all ? `ทุกจังหวัดที่มีข้อมูล (${prov.multi.length} จังหวัด)` : `${prov.multi.length} จังหวัด`) : `จังหวัด${prov.name}`;
    el('pr-scope').textContent = ctx.scopeText;
    el('pr-period').textContent = ctx.periodText + ` · ${ctx.land || 'พื้นที่เกษตร'}` + (st.crop ? ` (${st.crop})` : '');
    el('pr-updated').textContent = Geo.thaiDate(prov.last);
    el('pr-date').textContent = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    // ---- table: every district/subdistrict in scope, including zero HS ----
    // v3.15: เรียงตามระดับความเสี่ยง สูงมาก → ต่ำ (ไม่ประเมิน/ไม่มีผล อยู่ท้าย) ระดับเท่ากันเรียงตามรหัสพื้นที่
    const rank = r => CONFIG.RISK_LEVELS.indexOf(r.level);
    // v3.17 หลายจังหวัด: แถว = จังหวัด เรียงตามรหัสจังหวัด (ระดับความเสี่ยงเป็นของรายอำเภอภายในแต่ละจังหวัด)
    const rows = S.rows.slice().sort((a, b) => S.multi ? String(a.code).localeCompare(String(b.code)) : rank(b) - rank(a) || String(a.code).localeCompare(String(b.code)));
    el('pr-table-title').textContent = `จุดความร้อน (HS) ราย${S.unitLabel} — ครบ ${rows.length} ${S.unitLabel}`;
    // v3.15 ลำดับคอลัมน์: ลำดับ · พื้นที่ · ระดับความเสี่ยง (ปีงบฐาน) · HS ช่วงเดียวกันปีที่ผ่านมา · HS ช่วงที่เลือก · เพิ่ม/ลด — หัวคอลัมน์ 2 บรรทัด ตัดที่รอยต่อคำ
    const partial = S.compareMode === 'month' && !S.compareNone;
    const yrs = ctx.risk?.model === 'ABRI' ? span(ctx.risk.history) : '';
    const two = (a, b) => `<span class="l">${a}</span><span class="l">${b}</span>`;
    // v3.20 ผู้ดูแล: ไม่เกิน 3 ปีล่าสุด (ให้พอดี A4 1 หน้า) เรียงปีเก่า → ใหม่ · หัวคอลัมน์ปีงบ · ช่วงที่เลือกเน้น · แนวโน้ม (ทุกปีที่เลือก) · % เทียบปีก่อนหน้า
    //       ผู้ใช้ทั่วไป = หัวคอลัมน์แบบเดิม (v3.15)
    const adm = !!S.adminView, all = S.prevCols, cols = adm ? all.slice(-3) : all.slice(-1), ci = cols.map(c => all.indexOf(c));
    const near = all[all.length - 1], trend = adm && all.length >= 2;
    const pc = (c, v) => c.none ? 'ไม่มีข้อมูล' : fmt(v);
    const prevHead = c => adm ? two('ช่วงเดียวกัน', `${c.label}${c.partial ? '*' : ''}`) : two('จุดความร้อน', `ช่วงเดียวกันปีที่ผ่านมา${c.partial ? '*' : ''}`);
    const curHead = adm && S.curShort ? two(`ปีงบ ${S.curShort}`, 'ช่วงที่เลือก') : two('จุดความร้อน', 'ช่วงที่เลือก');
    const chgHead = adm && !near.none ? two('เพิ่ม/ลด', `เทียบ ${near.short}${partial ? '*' : ''}`) : `เพิ่ม/ลด${partial ? '*' : ''}`;
    const N = 5 + cols.length + (trend ? 1 : 0);
    const sp = vals => trend ? `<td class="pr-trend">${Dashboard.spark(vals, 40, 12)}</td>` : '';
    el('pr-table').classList.toggle('pr-adm', adm);
    el('pr-table').querySelector('thead').innerHTML = `<tr><th class="num">ลำดับ</th><th>${S.unitLabel}</th><th>${S.multi ? two('อำเภอเสี่ยงสูง–สูงมาก', yrs ? `(ปีงบ ${yrs})` : '') : yrs ? two('ระดับความเสี่ยง', `(ปีงบ ${yrs})`) : 'ระดับความเสี่ยง'}</th>${cols.map(c => `<th class="num">${prevHead(c)}</th>`).join('')}<th class="num pr-cur">${curHead}</th>${trend ? `<th class="pr-trend">${two('แนวโน้ม', `${all.length + 1} ช่วง`)}</th>` : ''}<th class="num">${chgHead}</th></tr>`;
    const lvCell = l => `<span class="lv"><i style="background:${l.color}"></i>${l.label}</span>`;
    const hasExtra = S.unassigned || cols.some(c => c.unassigned);
    const extra = hasExtra ? `<tr><td class="num">–</td><td>ไม่ระบุพื้นที่</td><td>–</td>${cols.map(c => `<td class="num">${pc(c, c.unassigned)}</td>`).join('')}<td class="num pr-cur">${fmt(S.unassigned)}</td>${trend ? '<td></td>' : ''}<td class="num">–</td></tr>` : '';
    const lvOf = r => S.multi ? (r.level.key === 'prov' ? `<span class="lv"><i style="background:${r.nHigh ? CONFIG.RISK_LEVELS[3].color : CONFIG.RISK_LEVELS[0].color}"></i>${fmt(r.nHigh)} / ${fmt(r.nUnits)} อำเภอ</span>` : lvCell(r.level)) : lvCell(r.level);
    el('pr-table').querySelector('tbody').innerHTML = rows.map((r, i) => `<tr><td class="num">${i + 1}</td><td>${r.name}</td><td>${lvOf(r)}</td>${cols.map((c, j) => `<td class="num">${pc(c, r.prevs[ci[j]])}</td>`).join('')}<td class="num pr-cur"><b>${fmt(r.current)}</b></td>${sp([...all.map((c, k) => c.none ? 0 : r.prevs[k]), r.cmpCurrent])}<td class="num">${r.change.text}</td></tr>`).join('') + extra;
    const fnotes = [];
    if (partial) fnotes.push(`* ${adm ? near.label + ' ' : 'ปีที่ผ่านมา'}มีข้อมูลไม่ครบทุกเดือน: นับและคำนวณ % เพิ่ม/ลด เฉพาะเดือนที่มีข้อมูลทั้งสองปี (${S.prevLabel}) · คอลัมน์ช่วงที่เลือกแสดงจำนวนจริงทั้งหมด`);
    if (adm && all.length > 1) {
      all.slice(0, -1).forEach(c => { if (c.partial) fnotes.push(`${c.label}* นับเฉพาะ ${c.prevLabel}`); });
      if (trend) fnotes.push(`แนวโน้ม: ${all[0].label} → ช่วงที่เลือก${partial ? ' (นับเฉพาะเดือนเดียวกับปีที่เทียบ)' : ''}`);
      if (all.length > cols.length) fnotes.push(`ตารางแสดง ${cols.length} ปีล่าสุดจาก ${all.length} ปีที่เลือก`);
    }
    el('pr-table').querySelector('tfoot').innerHTML = `<tr><th></th><th>รวม</th><th>${S.multi ? `${fmt(S.levels[2] + S.levels[3])} / ${fmt(S.nLevelUnits)} อำเภอ` : ''}</th>${cols.map(c => `<th class="num">${pc(c, c.total)}</th>`).join('')}<th class="num pr-cur">${fmt(S.totalCur)}</th>${trend ? `<th class="pr-trend">${Dashboard.spark([...all.map(c => c.none ? 0 : c.total), S.totalCmp], 40, 12)}</th>` : ''}<th class="num">${S.change.text}</th></tr>`
      + (fnotes.length ? `<tr><td colspan="${N}" class="pr-foot-note">${fnotes.join(' · ')}</td></tr>` : '');
    el('pr-src-hs').textContent = `จุดความร้อน ${hsSourceText(ctx)}`;
    // fit all rows on one page
    const n = rows.length + (hasExtra ? 1 : 0) + (fnotes.length ? 4 : 3);
    const h = Math.min(7, 156 / n);                         // mm per row
    const fs = Math.max(5.6, Math.min(8, h * 1.45));          // pt (v3.16 สูงสุด 8pt ให้ชื่อพื้นที่/หัวคอลัมน์ไม่ตัดบรรทัด)
    const pad = Math.max(0.25, (h - fs * 0.3528 * 1.25) / 2); // mm
    const table = el('pr-table'), right = table.parentElement, notes = el('pr-notes');
    const setSize = (f, p) => { table.style.setProperty('--pr-fs', f.toFixed(2) + 'pt'); table.style.setProperty('--pr-pad', p.toFixed(2) + 'mm'); };
    // ---- v3.16: ใต้ตาราง = วิธีประเมิน (เต็มความกว้าง) · นำ “สรุประดับความเสี่ยง” ออก · เป้าหมายฯ ย้ายไปใต้การ์ดสรุป (คอลัมน์ซ้าย) ----
    notes.innerHTML = `<div class="pr-method"><h3>วิธีประเมิน</h3>${methodHtml(ctx, S.unitLabel)}</div>`;
    el('pr-goal').innerHTML = `<h3>เป้าหมายในการพัฒนาระบบฯ</h3><p>${GOAL_TEXT}</p>`;
    // ลำดับการย่อเมื่อไม่พอ 1 หน้า: ย่อตารางถึง 6.4pt → ย่อวิธีประเมิน → ย่อตารางต่อ → ซ่อนวิธีประเมิน (สุดท้าย)
    let f = fs, p = pad; setSize(f, p); notes.style.display = ''; notes.classList.remove('compact');
    const fits = () => right.scrollHeight <= right.clientHeight + 1 && table.scrollWidth <= right.clientWidth + 1;   // ทั้งความสูงและความกว้าง
    while (!fits() && f > 6.4) { f -= 0.25; p = Math.max(0.12, p - 0.1); setSize(f, p); }
    if (!fits()) notes.classList.add('compact');
    while (!fits() && f > 5.2) { f -= 0.25; p = Math.max(0.12, p - 0.1); setSize(f, p); }
    if (!fits()) notes.style.display = 'none';

    // ---- legend & KPIs (outside the map so nothing covers data) ----
    el('pr-legend').innerHTML = CONFIG.RISK_LEVELS.slice().reverse().map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('')
      + `<span><i class="pt" style="background:${CONFIG.SEASON_COLORS[0]}"></i>HS ช่วงที่เลือก (${fmt(S.totalCur)} จุด)</span>`
      + `<span class="north">▲ ทิศเหนือ</span>`;
    const withHs = rows.filter(r => r.current > 0).length;
    el('pr-kpis').innerHTML = [
      [fmt(S.totalCur), 'จุดความร้อนในช่วงที่เลือก'],
      [S.change.text, S.compareText],
      [`${withHs}/${rows.length}`, `${S.unitLabel}ที่พบจุดความร้อน`],
      [String(S.levels[2] + S.levels[3]), `${S.levelUnit || S.unitLabel}เสี่ยงสูง–สูงมาก`]
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

    // ---- map ----
    const m = ensureMap();
    layers.forEach(l => m.removeLayer(l)); layers = [];
    const riskFC = MapModule.getRiskForScope(S.multi ? 'district' : S.level);
    const riskLayer = L.geoJSON(riskFC, { style: f => ({ color: '#ffffff', weight: 0.6, fillColor: MapModule.levelOf(f.properties).color, fillOpacity: ctx.risk ? (f.properties.risk_level < 0 ? 0.3 : 0.55) : 0 }), interactive: false }).addTo(m);
    layers.push(riskLayer);
    const outline = S.level === 'district' || S.multi
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
    const labelFs = S.multi ? focus : riskFC.features;   // v3.17 หลายจังหวัด: ป้ายชื่อจังหวัด (อำเภอมากเกินอ่าน)
    const labelSize = S.multi ? (labelFs.length > 10 ? 7.5 : 9) : riskFC.features.length > 24 ? 7 : riskFC.features.length > 14 ? 8 : 9.5;
    labelFs.forEach(f => {
      let c; try { c = turf.pointOnFeature(f).geometry.coordinates; } catch { return; }
      const t = L.tooltip({ permanent: true, direction: 'center', className: 'area-label', interactive: false }).setLatLng([c[1], c[0]]).setContent(`<span style="font-size:${labelSize}px">${S.multi ? f.properties.pro_th : f.properties.name}</span>`);
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
