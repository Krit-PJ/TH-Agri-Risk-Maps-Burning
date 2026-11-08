/* ตัวควบคุมหลักของระบบ */
const App = (() => {
  const el = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('th-TH');
  let available = [];            // จังหวัดที่มีข้อมูล HS [{code,name,count,first,last}]
  let provFC = null;             // ขอบเขตจังหวัดทั้งประเทศ
  let current = null;            // { code, name, last, ... }
  let appliedRange = null;
  let loadToken = 0;

  /* ============================ boot ============================ */
  async function init() {
    MapModule.init();
    try { Dashboard.init(); } catch (err) { console.warn('[Dashboard]', err); }
    renderLinks();
    renderRiskCriteria();
    el('footer-year').textContent = new Date().getFullYear() + 543;
    initPanels();
    initSidebarToggle();
    populateLands();
    bindProvinceControls();
    bindPrint();
    await Admin.init({
      currentProvince: () => current?.code || '',
      onDataChanged: code => refreshAfterDataChange(code),
      onSettingsChanged: () => { loadSettings(); MapModule.clearRiskCache(); refreshAfterDataChange(''); }
    });
    // เข้าสู่ระบบ/ออกจากระบบ: โหลดระดับความเสี่ยงใหม่ (ผู้ดูแลเห็นรายละเอียดคะแนนและแนวโน้ม)
    document.addEventListener('agri-risk:auth-changed', () => { if (current) applyCurrent(); });
    initCounter();
    loadSettings();
    provFC = await Geo.provinces();
    await loadAvailable();
    window.addEventListener('hashchange', routeFromHash);
    routeFromHash();
  }

  function renderLinks() {
    const icon = '<svg class="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';
    const team = '<svg class="h-3.5 w-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    const attrs = l => l.internal ? '' : ' target="_blank" rel="noopener noreferrer"';
    el('ext-links').innerHTML = CONFIG.LINKS.map(l => `<a class="hdr-link" href="${l.url}"${attrs(l)} title="${l.title}">${l.internal ? team : ''}${l.label}${l.internal ? '' : icon}</a>`).join('');
    el('links-dropdown').innerHTML = CONFIG.LINKS.map(l => `<a class="dropdown-item" href="${l.url}"${attrs(l)}><span class="font-semibold">${l.label}</span><span class="block text-xs text-ink-soft">${l.title}</span></a>`).join('');
    el('btn-links-menu').addEventListener('click', e => { e.stopPropagation(); const open = el('links-dropdown').classList.toggle('hidden') === false; el('btn-links-menu').setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', () => el('links-dropdown').classList.add('hidden'));
  }
  function renderRiskCriteria() {
    el('risk-criteria').innerHTML = CONFIG.RISK_LEVELS.slice().reverse().map(l => `<li class="flex items-center gap-2"><span class="risk-dot" style="background:${l.color}"></span><strong class="w-16 shrink-0">${l.label}</strong><span class="text-ink-soft">${l.desc}</span></li>`).join('');
  }
  async function loadSettings() {
    if (!Api.configured()) return;
    try {
      const r = await Api.get('settings'); const a = el('risk-guide-link');
      a.href = r.settings.guideUrl || CONFIG.GUIDE_PDF; a.classList.remove('hidden');
    } catch { }
  }

  /* ============================ visitor counter ============================ */
  async function initCounter() {
    if (!Api.configured()) return;
    let action = 'counter';
    try { if (!sessionStorage.getItem('agri-risk-visited')) { action = 'hit'; sessionStorage.setItem('agri-risk-visited', '1'); } } catch { action = 'hit'; }
    try {
      const r = await Api.get(action);
      el('counter-total').textContent = fmt(r.counter.total);
      el('counter-today').textContent = fmt(r.counter.today);
    } catch (err) { console.warn('[Counter]', err.message); }
  }

  /* ============================ national ============================ */
  async function loadAvailable() {
    available = [];
    if (Api.configured()) {
      try { available = (await Api.get('provinces')).provinces.sort((a, b) => b.count - a.count); }
      catch (err) { console.warn(err); Admin.toast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: ' + err.message, 'error'); }
    }
    renderProvinceList();
    const latest = available.map(p => p.last).sort().pop();
    el('last-updated').textContent = `ข้อมูลล่าสุด: ${latest ? Geo.thaiDate(latest) : '-'}`;
  }
  function renderProvinceList() {
    const q = Geo.clean(el('province-search').value);
    const list = available.filter(p => !q || Geo.clean(p.name).includes(q));
    el('province-list').innerHTML = list.length ? list.map(p => `<li><button type="button" class="prov-item" data-code="${p.code}">
        <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">${p.code}</span>
        <span class="min-w-0"><span class="block truncate font-semibold">${p.name}</span><span class="block text-xs text-ink-soft">ล่าสุด ${Geo.thaiDate(p.last)}</span></span>
        <span class="prov-count" title="จำนวนจุดความร้อนทั้งหมด">${fmt(p.count)}</span></button></li>`).join('')
      : `<li class="px-3 py-8 text-center text-sm leading-relaxed text-ink-soft">${!Api.configured() ? 'ยังไม่ได้เชื่อมต่อฐานข้อมูล<br>ผู้ดูแลระบบตั้งค่า API_URL ใน js/config.js' : available.length ? 'ไม่พบจังหวัดที่ค้นหา' : 'ยังไม่มีจังหวัดที่นำเข้าข้อมูล HS<br>ผู้ดูแลจังหวัดเข้าสู่ระบบเพื่อนำเข้าข้อมูล'}</li>`;
    el('province-list-foot').textContent = `มีข้อมูล HS ${available.length} จาก 77 จังหวัด`;
    el('province-list').querySelectorAll('[data-code]').forEach(b => {
      b.addEventListener('click', () => go(b.dataset.code));
      b.addEventListener('mouseenter', () => MapModule.highlightProvince(b.dataset.code, true));
      b.addEventListener('mouseleave', () => MapModule.highlightProvince(b.dataset.code, false));
    });
  }
  function showNationalView() {
    loadToken++;
    current = null; appliedRange = null;
    document.body.dataset.mode = 'national';
    el('national-panel').classList.remove('hidden'); el('province-panel').classList.add('hidden');
    el('right-panel').classList.add('hidden'); el('period-bar').classList.add('hidden');
    el('btn-print').classList.add('hidden'); el('map-legend').classList.add('hidden'); el('crop-bar').classList.add('hidden');
    el('mobile-toggle-left').textContent = 'รายการจังหวัด'; el('mobile-toggle-right').classList.add('hidden');
    el('header-province').textContent = '';
    el('map-hint').classList.remove('hidden');
    el('map-hint').textContent = available.length ? 'เลือกจังหวัดที่มีข้อมูลจุดความร้อน เพื่อเปิดแผนที่ความเสี่ยงและรายงาน' : 'ยังไม่มีจังหวัดที่มีข้อมูลจุดความร้อน';
    document.title = 'Agri-Risk Map Burning | ระบบเฝ้าระวังความเสี่ยงการเผาในพื้นที่เกษตร';
    setTimeout(() => { MapModule.invalidate(); MapModule.showNational(provFC, available, { onSelect: go, onHover: (code, on) => el('province-list').querySelector(`[data-code="${code}"]`)?.classList.toggle('is-hover', on) }); }, 30);
  }

  /* ============================ routing ============================ */
  function go(code) { closePanels(); location.hash = code ? `p=${code}` : ''; }
  function routeFromHash() {
    const code = (location.hash.match(/p=(\d{2})/) || [])[1];
    if (code && available.some(p => p.code === code)) openProvince(code);
    else { if (code && Api.configured()) Admin.toast('จังหวัดนี้ยังไม่มีข้อมูลจุดความร้อน', 'error'); showNationalView(); }
  }

  /* ============================ province ============================ */
  async function openProvince(code) {
    const token = ++loadToken;
    const info = available.find(p => p.code === code);
    setLoading(true, `กำลังโหลดข้อมูลจังหวัด${info.name}…`);
    try {
      const [bundle, hs] = await Promise.all([Geo.provinceBundle(code), Api.get('hotspots', { province: code, land: currentLand() })]);
      if (token !== loadToken) return;
      const hotspots = Geo.buildHotspots(hs, bundle);
      current = { ...info, bundle };
      MapModule.setProvince(bundle, hotspots, code);
      document.body.dataset.mode = 'province';
      el('national-panel').classList.add('hidden'); el('province-panel').classList.remove('hidden');
      el('right-panel').classList.remove('hidden'); el('period-bar').classList.remove('hidden');
      el('btn-print').classList.remove('hidden'); el('map-hint').classList.add('hidden');
      el('mobile-toggle-left').textContent = 'ชั้นข้อมูล'; el('mobile-toggle-right').classList.remove('hidden');
      el('header-province').textContent = ` — จังหวัด${info.name}`;
      el('province-title').textContent = info.name;
      document.title = `จังหวัด${info.name} | Agri-Risk Map Burning`;
      populateDistricts(bundle); populateCrops(hotspots);
      setupPeriod(hotspots);
      MapModule.invalidate();
      applyCurrent();
    } catch (err) {
      console.error(err); Admin.toast('โหลดข้อมูลจังหวัดไม่สำเร็จ: ' + err.message, 'error');
      if (token === loadToken) { location.hash = ''; }
    } finally { if (token === loadToken) setLoading(false); }
  }
  function currentLand() { return el('filter-land')?.value || CONFIG.DEFAULT_LAND; }
  /** เปลี่ยนประเภทพื้นที่: โหลดจุดความร้อนของประเภทที่เลือกใหม่ (คงช่วงเวลา/อำเภอที่เลือกไว้) แล้วประเมินใหม่ */
  async function changeLand() {
    if (!current) return;
    const token = ++loadToken, code = current.code;
    setLoading(true, `กำลังโหลดจุดความร้อน${landLabel(currentLand())}…`);
    try {
      const hs = await Api.get('hotspots', { province: code, land: currentLand() });
      if (token !== loadToken) return;
      const hotspots = Geo.buildHotspots(hs, current.bundle);
      MapModule.setProvince(current.bundle, hotspots, code);
      const crop = el('filter-crop').value; populateCrops(hotspots);
      if (crop && el('filter-crop').querySelector(`option[value="${crop}"]`)) el('filter-crop').value = crop;
      await applyCurrent();
    } catch (err) { Admin.toast('โหลดข้อมูลไม่สำเร็จ: ' + err.message, 'error'); }
    finally { if (token === loadToken) setLoading(false); }
  }
  const landLabel = l => l === 'ALL' ? 'ทุกประเภทพื้นที่' : l;
  function populateLands() {
    const sel = el('filter-land'); if (!sel || sel.options.length) return;
    sel.innerHTML = CONFIG.LAND_TYPES.map(l => `<option value="${l}">${l}${l === CONFIG.DEFAULT_LAND ? ' (ค่าเริ่มต้น)' : ''}</option>`).join('') + '<option value="ALL">ทุกประเภทพื้นที่</option>';
    sel.value = CONFIG.DEFAULT_LAND;
  }
  function setLoading(on, text) { el('map-loading').classList.toggle('hidden', !on); el('map-loading').classList.toggle('grid', on); if (text) el('map-loading-text').textContent = text; }

  function populateDistricts(bundle) {
    const sel = el('filter-district');
    const list = bundle.district.features.map(f => f.properties).sort((a, b) => a.amp_th.localeCompare(b.amp_th, 'th'));
    sel.innerHTML = '<option value="">ทุกอำเภอ</option>' + list.map(p => `<option value="${p.amp_code}">${p.amp_th}</option>`).join('');
    populateSubdistricts();
  }
  function populateSubdistricts() {
    const d = el('filter-district').value, sel = el('filter-subdistrict');
    const list = d ? current.bundle.subdistrict.features.map(f => f.properties).filter(p => p.amp_code === d).sort((a, b) => a.tam_th.localeCompare(b.tam_th, 'th')) : [];
    sel.innerHTML = d ? '<option value="">ทุกตำบล</option>' + list.map(p => `<option value="${p.tam_code}">${p.tam_th}</option>`).join('') : '<option value="">เลือกอำเภอก่อน</option>';
    sel.disabled = !d;
  }
  function populateCrops(fc) {
    const present = new Set(fc.features.map(f => f.properties.__crop));
    el('filter-crop').innerHTML = '<option value="">ทุกชนิดพืช</option>' + CONFIG.PLANT_TYPES.filter(p => present.has(p)).map(p => `<option value="${p}">${p}</option>`).join('');
  }

  /* ---------- period (ต้นแบบ: ต.ค. ปีก่อน → เดือนล่าสุดของข้อมูล) ---------- */
  function setupPeriod(fc) {
    const yms = fc.features.map(f => f.properties.__ym);
    const maxYM = yms.length ? Math.max(...yms) : Geo.ymIndex(new Date().getFullYear() + 543, new Date().getMonth() + 1);
    const minYM = yms.length ? Math.min(...yms) : maxYM;
    const latest = Geo.ymFromIndex(maxYM), first = Geo.ymFromIndex(minYM);
    const years = []; for (let y = Math.min(first.year, latest.year - 1); y <= latest.year; y++) years.push(y);
    const mOpts = CONFIG.MONTH_SHORT.slice(1).map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    const yOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');
    ['range-start-month', 'range-end-month'].forEach(id => { el(id).innerHTML = mOpts; });
    ['range-start-year', 'range-end-year'].forEach(id => { el(id).innerHTML = yOpts; });
    // ค่าเริ่มต้น: ต.ค. ของฤดูกาลล่าสุด ถึงเดือนล่าสุดที่มีข้อมูล
    const season = Geo.seasonOf(latest.year, latest.month);
    setRangeUI(season - 1, 10, latest.year, latest.month);
    appliedRange = readRange();
    current.defaultRange = { ...appliedRange };
    el('btn-apply-period').classList.remove('ring-2', 'ring-amber-400');
  }
  function setRangeUI(sy, sm, ey, em) { el('range-start-year').value = sy; el('range-start-month').value = sm; el('range-end-year').value = ey; el('range-end-month').value = em; }
  function readRange() {
    let s = Geo.ymIndex(el('range-start-year').value, el('range-start-month').value), e = Geo.ymIndex(el('range-end-year').value, el('range-end-month').value);
    if (s > e) [s, e] = [e, s];
    const a = Geo.ymFromIndex(s), b = Geo.ymFromIndex(e);
    return { startYear: a.year, startMonth: a.month, endYear: b.year, endMonth: b.month, startYM: s, endYM: e };
  }

  function filterState() {
    return { district: el('filter-district').value, subdistrict: el('filter-subdistrict').value, crop: el('filter-crop').value, land: currentLand(), ...appliedRange };
  }
  let applySeq = 0;
  async function applyCurrent() {
    if (!current) return;
    const seq = ++applySeq, crop = el('filter-crop').value;
    el('timeline-status').textContent = `HS สะสม ${Geo.periodText(appliedRange)} · กำลังประเมินระดับความเสี่ยง…`;
    const info = await MapModule.applyFilter(filterState());
    if (seq !== applySeq || info.stale) return;
    current.seasons = info.seasons; current.risk = info.risk;
    Dashboard.refresh();
    renderCropBar();
    const riskText = info.error ? ` · ประเมินระดับความเสี่ยงไม่สำเร็จ: ${info.error}` : info.basis ? ` · ระดับความเสี่ยง: ${info.basis}` : '';
    el('timeline-status').textContent = `HS สะสม ${Geo.periodText(appliedRange)} · ${landLabel(currentLand())}${crop ? ` · ชนิดพืช: ${crop}` : ''}${riskText}`;
  }
  function scopeText() {
    const d = el('filter-district'), t = el('filter-subdistrict');
    if (t.value) return `ตำบล${t.selectedOptions[0].text} อำเภอ${d.selectedOptions[0].text} จังหวัด${current.name}`;
    if (d.value) return `อำเภอ${d.selectedOptions[0].text} จังหวัด${current.name}`;
    return `ทั้งจังหวัด${current.name}`;
  }

  function bindProvinceControls() {
    el('province-search').addEventListener('input', renderProvinceList);
    el('btn-back-national').addEventListener('click', () => go(''));
    el('filter-district').addEventListener('change', () => { populateSubdistricts(); applyCurrent(); });
    el('filter-subdistrict').addEventListener('change', applyCurrent);
    el('filter-crop').addEventListener('change', applyCurrent);
    el('filter-land').addEventListener('change', changeLand);
    el('btn-reset-filter').addEventListener('click', () => {
      el('filter-district').value = ''; populateSubdistricts(); el('filter-crop').value = '';
      if (current?.defaultRange) { const r = current.defaultRange; setRangeUI(r.startYear, r.startMonth, r.endYear, r.endMonth); appliedRange = { ...r }; }
      if (currentLand() !== CONFIG.DEFAULT_LAND) { el('filter-land').value = CONFIG.DEFAULT_LAND; changeLand(); } else applyCurrent();
    });
    ['range-start-month', 'range-start-year', 'range-end-month', 'range-end-year'].forEach(id => el(id).addEventListener('change', () => {
      el('btn-apply-period').classList.add('ring-2', 'ring-amber-400');
      el('timeline-status').textContent = `เลือกช่วง ${Geo.periodText(readRange())} แล้ว กด "แสดงข้อมูล" เพื่อใช้ช่วงนี้`;
    }));
    el('btn-apply-period').addEventListener('click', () => {
      appliedRange = readRange(); const r = appliedRange; setRangeUI(r.startYear, r.startMonth, r.endYear, r.endMonth);
      el('btn-apply-period').classList.remove('ring-2', 'ring-amber-400'); applyCurrent();
    });
    document.addEventListener('agri-risk:area-click', e => {
      if (e.detail.level !== 'district' || el('filter-district').value) return;
      el('filter-district').value = e.detail.code; populateSubdistricts(); applyCurrent();
    });
  }

  async function refreshAfterDataChange(code) {
    MapModule.clearRiskCache();
    await loadAvailable();
    if (current && (!code || code === current.code)) {
      if (available.some(p => p.code === current.code)) openProvince(current.code); else go('');
    } else if (!current) showNationalView();
  }

  /* ============================ print ============================ */
  function printCtx() { return { province: current, scopeText: scopeText(), periodText: Geo.periodText(appliedRange), seasons: current.seasons || [], risk: current.risk || null, land: landLabel(currentLand()), basis: MapModule.riskBasisText(false) }; }
  function bindPrint() {
    el('btn-print').addEventListener('click', async () => {
      if (!current) return;
      const b = el('btn-print'); b.disabled = true;
      try { await Report.print(printCtx()); } finally { b.disabled = false; }
    });
    window.addEventListener('beforeprint', () => { if (current && document.body.dataset.printing !== '1') Report.build(printCtx()); });
  }

  /* ============================ panels (desktop/mobile) ============================ */
  function initPanels() {
    const left = el('left-panel'), right = el('right-panel'), overlay = el('mobile-overlay');
    const toggle = panel => { const open = !panel.classList.contains('mobile-open'); closePanels(); if (open) { panel.classList.add('mobile-open'); overlay.classList.remove('hidden'); } };
    el('mobile-toggle-left').addEventListener('click', () => toggle(left));
    el('mobile-toggle-right').addEventListener('click', () => toggle(right));
    overlay.addEventListener('click', closePanels);
    window.addEventListener('resize', () => { if (window.innerWidth >= 768) closePanels(); clearTimeout(initPanels._t); initPanels._t = setTimeout(() => { MapModule.invalidate(); fitCropBar(); }, 150); });
  }
  /* ---------- แถบซ้าย: ย่อ/ขยาย (Desktop) ---------- */
  const SIDEBAR_KEY = 'agri-risk-left-collapsed';
  function initSidebarToggle() {
    let collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { }
    setSidebar(collapsed, false);
    el('btn-sidebar').addEventListener('click', () => setSidebar(!document.body.classList.contains('left-collapsed'), true));
    el('left-panel').addEventListener('transitionend', e => { if (e.target === el('left-panel')) { MapModule.invalidate(); fitCropBar(); } });
  }
  function setSidebar(collapsed, save) {
    document.body.classList.toggle('left-collapsed', collapsed);
    const label = collapsed ? 'ขยายแถบด้านซ้าย' : 'ย่อแถบด้านซ้าย';
    el('btn-sidebar').setAttribute('aria-expanded', String(!collapsed));
    el('btn-sidebar').title = label; el('btn-sidebar-label').textContent = label;
    if (save) { try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { } }
    setTimeout(MapModule.invalidate, 280);
  }

  /* ---------- แถบ icon ชนิดพืชบนแผนที่ (เชื่อมกับตัวกรองชนิดพืช) ---------- */
  function cropCounts() {
    const st = MapModule.getState(), counts = {};
    (MapModule.getData().hotspot?.features || []).forEach(f => {
      const p = f.properties;
      if (!MapModule.inRange(p) || (st.district && p.__dCode !== st.district) || (st.subdistrict && p.__sCode !== st.subdistrict)) return;
      counts[p.__crop] = (counts[p.__crop] || 0) + 1;
    });
    return counts;
  }
  function renderCropBar() {
    const bar = el('crop-bar');
    if (!current) { bar.classList.add('hidden'); return; }
    const counts = cropCounts(), selected = el('filter-crop').value;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const chip = (value, label, icon, n) => {
      const on = value === selected, off = !on && value && !n;
      return `<button type="button" class="crop-chip${on ? ' is-on' : ''}" data-crop="${value}" aria-pressed="${on}" ${off ? 'disabled' : ''} title="${value || 'ทุกชนิดพืช'}: ${fmt(n)} จุดในช่วงที่เลือก${value && on ? ' (กดอีกครั้งเพื่อยกเลิก)' : ''}">
        ${icon}<span class="crop-chip-label">${label}</span><span class="crop-chip-n">${fmt(n)}</span></button>`;
    };
    bar.innerHTML = chip('', 'ทุกชนิด', '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>', total)
      + CONFIG.PLANT_TYPES.map(c => chip(c, CONFIG.CROP_ICONS[c].short, Geo.cropIcon(c), counts[c] || 0)).join('');
    bar.classList.remove('hidden');
    fitCropBar();
    bar.querySelectorAll('[data-crop]').forEach(b => b.addEventListener('click', () => setCrop(b.dataset.crop === selected ? '' : b.dataset.crop)));
  }
  function fitCropBar() {
    const bar = el('crop-bar'); if (bar.classList.contains('hidden')) return;
    bar.classList.remove('is-compact');
    if (bar.scrollWidth > bar.clientWidth + 1) bar.classList.add('is-compact');
  }
  function setCrop(crop) {
    const sel = el('filter-crop');
    if (crop && !sel.querySelector(`option[value="${crop}"]`)) sel.insertAdjacentHTML('beforeend', `<option value="${crop}">${crop}</option>`);
    sel.value = crop;
    applyCurrent();
  }

  function closePanels() { el('left-panel').classList.remove('mobile-open'); el('right-panel').classList.remove('mobile-open'); el('mobile-overlay').classList.add('hidden'); }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init().catch(err => {
  console.error('[App] fatal:', err);
  const box = document.createElement('div');
  box.className = 'fixed inset-x-4 bottom-4 z-[4000] rounded-lg bg-red-800 p-3 text-sm text-white';
  box.textContent = 'โหลดระบบไม่สำเร็จ: ' + err.message;
  document.body.appendChild(box);
}));
