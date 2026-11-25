/* Dashboard ด้านขวา — คำนวณสรุปจากชุดข้อมูลจังหวัดที่เลือก (ใช้ร่วมกับรายงานพิมพ์) */
const Dashboard = (() => {
  const charts = {};
  const el = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('th-TH');
  const NO_LEVEL = { label: 'ยังไม่ประเมิน', color: '#cbd5e1', key: 'none' };

  function pctChange(current, previous) {
    if (previous === 0) return current === 0 ? { text: '0%', cls: 'chg-flat' } : { text: 'ใหม่', cls: 'chg-up' };
    const pct = Math.round((current - previous) * 100 / previous);
    return { text: `${pct > 0 ? '+' : ''}${pct}%`, cls: pct > 0 ? 'chg-up' : pct < 0 ? 'chg-down' : 'chg-flat' };
  }

  /* v3.20 เทียบช่วงเดียวกันย้อนหลังหลายปี (Admin / Mini Super Admin / Super Admin) — ผู้ใช้ทั่วไปเทียบปีก่อน 1 ปีเหมือนเดิม
   * เลือกจาก Drop-down “เทียบย้อนหลัง n ปี” — รายการสร้างจากปีที่มีข้อมูลในระบบอัตโนมัติ (ปีใหม่เข้ามา = มีตัวเลือกเพิ่มเอง)
   * “ทั้งหมด” = ขยายตามข้อมูลอัตโนมัติ · ปีที่เทียบติดกันเสมอ · % เพิ่ม/ลด เทียบกับปีก่อนหน้า (k = 1) · จำค่าที่เลือกในเบราว์เซอร์ */
  const CMP_KEY = 'agri-risk-cmp-n', CMP_CAP = 10, SIDE_MAX = 3;
  let cmpPref = (() => { try { const v = localStorage.getItem(CMP_KEY); return v === 'all' ? 'all' : Math.max(1, parseInt(v, 10) || 1); } catch { return 1; } })();
  const canMultiYear = () => ['admin', 'minisuper', 'superadmin'].includes(Api.session()?.user?.role);
  /** 'all' | n | [k…] (รูปแบบเดิม v3.19 = ใช้ค่ามากสุด) */
  function setCompareYears(v) {
    if (Array.isArray(v)) v = Math.max(1, ...v.map(Number).filter(Number.isFinite));
    cmpPref = v === 'all' ? 'all' : Math.max(1, Math.min(CMP_CAP, parseInt(v, 10) || 1));
    try { localStorage.setItem(CMP_KEY, String(cmpPref)); } catch { }
  }
  const fyOf = d => { const y = +d.slice(0, 4) + 543, m = +d.slice(5, 7); return m >= 10 ? y + 1 : y; };
  /** ปีงบของช่วงเปรียบเทียบ (ใช้เป็นหัวคอลัมน์) — ช่วงคร่อมหลายปีงบแสดงเป็นเดือน/ปี */
  function prevColLabel(W) {
    if (!W.prev[0]) return '';
    return fyOf(W.prev[0]) === fyOf(W.prev[1]) ? `ปีงบ ${fyOf(W.prev[0])}` : Geo.monthSpan(W.prev[0], W.prev[1]);
  }
  const shortLabel = lb => lb.replace(/^ปีงบ /, '');
  /** แท่งแนวโน้มขนาดเล็ก (ปีเก่า → ช่วงที่เลือก · แท่งสุดท้าย = ช่วงที่เลือก) */
  function spark(vals, w = 46, h = 16) {
    const m = Math.max(1, ...vals), bw = w / vals.length;
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => { const bh = v ? Math.max(2, Math.round(v / m * (h - 1))) : 1;
      return `<rect x="${(i * bw + 0.75).toFixed(1)}" y="${h - bh}" width="${Math.max(2, bw - 2.5).toFixed(1)}" height="${bh}" rx="1" fill="${i === vals.length - 1 ? '#2563eb' : '#a8b3ad'}"/>`; }).join('')}</svg>`;
  }

  /** สรุปข้อมูลตามตัวกรองปัจจุบัน — ใช้ทั้งหน้าจอและรายงาน */
  function summary() {
    const raw = MapModule.getData(), st = MapModule.getState();
    if (!raw.bundle) return null;
    const multi = !!raw.multi;   // v3.17 หลายจังหวัด: ตาราง/อันดับเป็นรายจังหวัด · ระดับความเสี่ยงนับรายอำเภอ (ประเมินแยกรายจังหวัด)
    const level = multi ? 'province' : st.district ? 'subdistrict' : 'district';
    const unitKey = level === 'province' ? '__pCode' : level === 'district' ? '__dCode' : '__sCode';
    const risk = MapModule.getRiskForScope(multi ? 'district' : level)?.features || [];
    const base = (raw.hotspot?.features || []).filter(f => {
      const p = f.properties;
      return (!st.crop || p.__crop === st.crop) && (!st.district || p.__dCode === st.district) && (!st.subdistrict || p.__sCode === st.subdistrict);
    });
    const s = Number(st.startYM), e = Number(st.endYM);
    // เทียบช่วงเดียวกันปีก่อน (MapModule.compareInfo → Geo.compareWindow): วันต่อวัน หรือเฉพาะเดือนที่มีข้อมูลทั้งสองปี
    // v3.20 ปีที่เทียบได้ = ย้อนไปถึงปีแรกที่มีข้อมูลในระบบ (อัตโนมัติ) · ตัดปีท้ายที่ไม่มีข้อมูล
    const firstY = raw.dataFirst ? +raw.dataFirst.slice(0, 4) : 0, sY = st.startYM ? Geo.ymFromIndex(st.startYM).year - 543 : 0;
    const opts = [];
    for (let k = 1; k <= CMP_CAP; k++) { const Wk = MapModule.compareInfo(k); if (!Wk) break; if (k > 1 && firstY && sY - k < firstY - 1) break; opts.push({ k, W: Wk, label: prevColLabel(Wk), none: !!Wk.none }); }
    while (opts.length > 1 && opts[opts.length - 1].none) opts.pop();
    const avail = Math.max(1, opts.length), adminView = canMultiYear();
    const nYears = adminView ? Math.min(avail, cmpPref === 'all' ? avail : cmpPref) : 1;
    const years = Array.from({ length: nYears }, (_, i) => i + 1), k0 = 1;
    const W = opts[0]?.W || { mode: 'day', none: true, inCur: () => false, inPrev: () => false, cur: ['', ''], prev: ['', ''], note: '' };
    const latest = W.latest || '';
    const current = base.filter(f => f.properties.__ym >= s && f.properties.__ym <= e);           // ทุกจุดในช่วงที่เลือก
    const curCmp = base.filter(f => W.inCur(f.properties.__date));                                    // ส่วนของช่วงที่เลือกที่ใช้เทียบ
    const prior = base.filter(f => W.inPrev(f.properties.__date));
    const countBy = fs => fs.reduce((o, f) => { const k = f.properties[unitKey] || '-'; o[k] = (o[k] || 0) + 1; return o; }, {});
    const cur = countBy(current), cmpC = countBy(curCmp), prev = countBy(prior);
    // v3.19 คอลัมน์ช่วงเดียวกันรายปี (เรียงจากปีเก่า → ปีใกล้ที่สุด) · ปีที่ใกล้ที่สุดใช้ W เดิม
    const prevCols = years.slice().reverse().map(k => {
      const Wk = k === k0 ? W : (opts[k - 1]?.W || W), fs = k === k0 ? prior : base.filter(f => Wk.inPrev(f.properties.__date));
      const label = prevColLabel(Wk);
      return { k, label, short: shortLabel(label), none: !!Wk.none, partial: Wk.mode === 'month' && !Wk.none, note: Wk.note || '', prevLabel: Wk.prevLabel || '',
        range: Wk.none ? '' : Wk.mode === 'month' ? Wk.prevLabel : `${Geo.thaiDate(Wk.prev[0])} – ${Geo.thaiDate(Wk.prev[1])}`, counts: countBy(fs), total: fs.length };
    });
    const NA = { text: '–', cls: 'chg-flat' };
    const unitLevels = risk.map(f => MapModule.riskInfo() ? MapModule.levelOf(f.properties) : NO_LEVEL);
    const rows = multi
      ? raw.multi.map(code => {
        const ds = risk.filter(f => f.properties.province_code === code), lvs = ds.map(f => MapModule.riskInfo() ? MapModule.levelOf(f.properties) : NO_LEVEL);
        const high = lvs.filter(l => l === CONFIG.RISK_LEVELS[2] || l === CONFIG.RISK_LEVELS[3]).length;
        const rated = !!MapModule.riskInfo() && ds.some(f => f.properties.risk_level >= 0);
        return { code, name: MapModule.provinceName(code) || code, current: cur[code] || 0, cmpCurrent: cmpC[code] || 0, previous: prev[code] || 0, prevs: prevCols.map(c => c.counts[code] || 0), score: high, nUnits: ds.length, nHigh: high,
          level: rated ? { label: `สูง–สูงมาก ${high}/${ds.length} อำเภอ`, color: high ? CONFIG.RISK_LEVELS[3].color : CONFIG.RISK_LEVELS[0].color, key: 'prov' } : NO_LEVEL,
          change: W.none ? NA : pctChange(cmpC[code] || 0, prev[code] || 0) };
      })
      : risk.map((f, i) => {
        const p = f.properties, lv = unitLevels[i];
        return { code: p.code, name: p.name, current: cur[p.code] || 0, cmpCurrent: cmpC[p.code] || 0, previous: prev[p.code] || 0, prevs: prevCols.map(c => c.counts[p.code] || 0), score: p.risk_score ?? 0, level: lv,
          change: W.none ? NA : pctChange(cmpC[p.code] || 0, prev[p.code] || 0) };
      });
    // จุดที่ไม่มีรหัส/ไม่ตรงกับขอบเขตพื้นที่ในแผนที่ — แสดงเป็นแถว “ไม่ระบุพื้นที่” เพื่อให้ผลรวมตาราง = จำนวนจุดจริงในช่วงที่เลือก
    const sumOf = k => rows.reduce((a, r) => a + r[k], 0);
    const unassigned = Math.max(0, current.length - sumOf('current')), unassignedPrev = Math.max(0, prior.length - sumOf('previous')), unassignedCmp = Math.max(0, curCmp.length - sumOf('cmpCurrent'));
    const levels = CONFIG.RISK_LEVELS.map(l => unitLevels.filter(x => x === l).length);   // จำนวนพื้นที่ (อำเภอ/ตำบล) ต่อระดับ
    prevCols.forEach((c, i) => { c.unassigned = Math.max(0, c.total - rows.reduce((a, r) => a + r.prevs[i], 0)); });
    const yearOptions = opts.map(o => ({ k: o.k, label: o.label, short: shortLabel(o.label), none: o.none }));
    // หัวคอลัมน์ช่วงที่เลือก: ปีงบเดียว = เลขปีงบ · คร่อมปีงบ = “ช่วงที่เลือก”
    const curShort = (() => { const a = Geo.ymFromIndex(s), z = Geo.ymFromIndex(e), f = m => m.month >= 10 ? m.year + 1 : m.year; return f(a) === f(z) ? String(f(a)) : ''; })();
    const months = [];
    for (let i = s; i <= e && months.length < 48; i++) months.push(i);
    const byMonth = months.map(i => current.filter(f => f.properties.__ym === i).length);
    const partial = W.mode === 'month';
    const [startD, endD] = W.cur, [pStart, pEnd] = W.prev;
    const selText = (() => { const a = Geo.ymFromIndex(s), z = Geo.ymFromIndex(e), zd = new Date(Date.UTC(z.year - 543, z.month, 0)).getUTCDate();
      let end = `${z.year - 543}-${String(z.month).padStart(2, '0')}-${zd}`; if (latest && end > latest) end = latest;
      return `${Geo.thaiDate(`${a.year - 543}-${String(a.month).padStart(2, '0')}-01`)} – ${Geo.thaiDate(end)}`; })();
    return { prevCols, years, multiYear: years.length > 1, canMultiYear: adminView, adminView, avail, nYears, cmpPref, yearOptions, curShort, level, multi, unitLabel: level === 'province' ? 'จังหวัด' : level === 'district' ? 'อำเภอ' : 'ตำบล', levelUnit: level === 'subdistrict' ? 'ตำบล' : 'อำเภอ', nLevelUnits: unitLevels.length, rows, current, curCmp, prior, unassigned, unassignedPrev, unassignedCmp, levels, months, byMonth,
      totalCur: current.length, totalCmp: curCmp.length, totalPrev: prior.length, change: W.none ? NA : pctChange(curCmp.length, prior.length),
      compareMode: W.mode, compareNote: W.note, compareNone: !!W.none, selText, curLabel: W.curLabel || '', prevLabel: W.prevLabel || '',
      currentText: W.none ? selText : partial ? `${W.curLabel} (เดือนที่มีข้อมูลทั้งสองปี${latest && endD >= latest ? ` · ข้อมูลถึง ${Geo.thaiDate(latest)}` : ''})` : `${Geo.thaiDate(startD)} – ${Geo.thaiDate(endD)}`,
      priorText: W.none ? W.note : partial ? `${W.prevLabel} (${W.note})` : `${Geo.thaiDate(pStart)} – ${Geo.thaiDate(pEnd)}`,
      compareText: (() => { const py = k0 === 1 ? 'ปีก่อน' : prevColLabel(W); return W.none ? W.note : partial ? `เทียบช่วงเดียวกัน${py} ${fmt(prior.length)} จุด (คิดเฉพาะเดือนที่มีข้อมูลทั้งสองปี: ${W.prevLabel})` : `เทียบช่วงเดียวกัน${py} (${fmt(prior.length)} จุด)`; })() };
  }

  function chartBase() {
    return { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', titleColor: '#17231c', bodyColor: '#17231c', borderColor: '#dfe6e2', borderWidth: 1, padding: 10 } },
      scales: { x: { grid: { display: false }, ticks: { color: '#4a5a51', font: { family: 'IBM Plex Sans Thai', size: 11 } } }, y: { beginAtZero: true, grid: { color: '#eef2ef' }, ticks: { color: '#4a5a51', precision: 0, font: { family: 'IBM Plex Sans Thai', size: 11 } } } } };
  }
  function init() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.font.family = '"IBM Plex Sans Thai", sans-serif';
    charts.trend = new Chart(el('chart-trend'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 3 }] }, options: chartBase() });
    const top = chartBase(); top.indexAxis = 'y'; top.scales.x.grid = { color: '#eef2ef' }; top.scales.y.grid = { display: false };
    charts.top = new Chart(el('chart-top-district'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: '#475569', borderRadius: 3 }] }, options: top });
    charts.risk = new Chart(el('chart-risk'), { type: 'doughnut', data: { labels: CONFIG.RISK_LEVELS.map(l => l.label), datasets: [{ data: [0, 0, 0, 0], backgroundColor: CONFIG.RISK_LEVELS.map(l => l.color), borderColor: '#fff', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '58%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw} พื้นที่` } } } } });
  }

  function refresh() {
    const S = summary(); if (!S) return null;
    const u = S.unitLabel;
    // KPI
    const withHs = S.rows.filter(r => r.current > 0).length;
    const highCount = S.levels[2] + S.levels[3];
    el('summary-cards').innerHTML = [
      [fmt(S.totalCur), 'จุดความร้อนในช่วงที่เลือก'],
      [`<span class="chg ${S.change.cls} align-middle text-base">${S.change.text}</span>`, S.compareText],
      [`${fmt(withHs)}<span class="text-base font-semibold text-ink-soft">/${fmt(S.rows.length)}</span>`, `${u}ที่พบจุดความร้อน`],
      [S.multi ? `${fmt(highCount)}<span class="text-base font-semibold text-ink-soft">/${fmt(S.nLevelUnits)}</span>` : fmt(highCount), `${S.levelUnit}เสี่ยงสูง–สูงมาก${S.multi ? ' (เทียบในแต่ละจังหวัด)' : ''}`]
    ].map(([v, l]) => `<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div></div>`).join('');

    // comparison table (template)
    const cmp = S.rows.slice().sort((a, b) => b.current - a.current || b.cmpCurrent - a.cmpCurrent || a.name.localeCompare(b.name, 'th'));
    // v3.9.1: คอลัมน์ “ช่วงที่เลือก” = จำนวนจุดจริงทั้งหมดในช่วงที่เลือก (ผลรวม = KPI) · “ช่วงเดียวกันปีก่อน” = ไม่มีข้อมูล เมื่อฐานข้อมูลไม่มีปีก่อน
    const st = MapModule.getState(), partial = S.compareMode === 'month' && !S.compareNone;
    const T = cmpTable(S, cmp, 'side');
    const tbl = el('tbl-hotspot-comparison');
    tbl.querySelector('thead').innerHTML = T.head;
    tbl.classList.toggle('is-multi', T.compact);
    tbl.classList.toggle('is-admin', S.adminView);
    renderYearPicker(S);
    el('title-comparison').textContent = `เปรียบเทียบ HS ราย${u}`;
    el('comparison-period').textContent = S.adminView
      ? `${S.selText}${st.crop ? ` · ${st.crop}` : ''}`
      : `${S.compareNone ? `${S.selText} · ${S.priorText}` : partial ? `${S.selText} · เทียบเดือนที่มีข้อมูลทั้งสองปี` : `${S.currentText} เทียบ ${S.priorText}`}${st.crop ? ` · ${st.crop}` : ''}`;
    const picked = S.level === 'district' ? st.district : st.subdistrict;
    const tb = tbl.querySelector('tbody');
    tb.innerHTML = T.rows(r => ` class="cmp-row${picked === r.code ? ' cmp-picked' : ''}" data-cmp-code="${r.code}" tabindex="0" title="คลิกเพื่อ${S.level === 'province' ? `เปิดจังหวัด${r.name} (รายอำเภอ)` : S.level === 'district' ? 'ดูรายตำบลในอำเภอนี้' : picked === r.code ? 'ยกเลิกการเลือกตำบล' : 'เลือกตำบลนี้'}"`);
    tb.querySelectorAll('[data-cmp-code]').forEach(tr => {
      const go = () => document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level: S.level, code: tr.dataset.cmpCode, source: 'table' } }));
      tr.addEventListener('click', go); tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    tbl.querySelector('tfoot').innerHTML = T.foot;
    if (el('comparison-note')) el('comparison-note').textContent = T.notes.join(' · ');
    if (fullOpen()) renderFull(S, cmp);

    // monthly trend
    if (charts.trend) {
      charts.trend.data.labels = S.months.map(i => { const m = Geo.ymFromIndex(i); return `${CONFIG.MONTH_SHORT[m.month]} ${String(m.year).slice(2)}`; });
      charts.trend.data.datasets[0].data = S.byMonth;
      charts.trend.data.datasets[0].backgroundColor = S.months.map(i => { const m = Geo.ymFromIndex(i); return MapModule.seasonColor(Geo.seasonOf(m.year, m.month)); });
      charts.trend.update('none');
    }
    // top 5
    el('title-top5').textContent = `5 อันดับ${u}ที่มี HS สูงสุด`;
    if (charts.top) {
      const t5 = cmp.filter(r => r.current > 0).slice(0, 5);
      charts.top.data.labels = t5.map(r => r.name); charts.top.data.datasets[0].data = t5.map(r => r.current); charts.top.update('none');
    }
    // risk donut + legend list
    if (charts.risk) { charts.risk.data.datasets[0].data = S.levels; charts.risk.update('none'); }
    const tot = S.levels.reduce((a, b) => a + b, 0);
    el('risk-legend-list').innerHTML = CONFIG.RISK_LEVELS.slice().reverse().map(l => {
      const i = CONFIG.RISK_LEVELS.indexOf(l), v = S.levels[i];
      return `<div class="flex items-center gap-2 text-[13px]"><span class="risk-dot" style="background:${l.color}"></span><span class="flex-1">${l.label}</span><span class="tabular-nums text-ink-soft">${v} ${S.levelUnit}</span><strong class="w-12 text-right tabular-nums">${tot ? (v * 100 / tot).toFixed(1) : '0.0'}%</strong></div>`;
    }).join('');

    // all units ranked (template "ทุกอำเภอ")
    el('rank-area-header').textContent = u;
    el('title-top10').textContent = `ทุก${u} เรียงตามจำนวน HS`;
    document.querySelector('#tbl-top-district tbody').innerHTML = cmp.map((r, i) => `<tr><td class="num text-ink-mute">${i + 1}</td><td>${r.name}</td><td class="num">${fmt(r.current)}</td><td><span class="risk-pill"${MapModule.viewerDetailed() ? ` title="คะแนน ${Number(r.score).toFixed(1)}"` : ''}><span class="risk-dot" style="background:${r.level.color}"></span>${r.level.label}</span></td></tr>`).join('');
    return S;
  }

  /** ตารางเปรียบเทียบ (ใช้ร่วม: แผงด้านขวา = 'side' แสดงไม่เกิน 3 ปีล่าสุด · หน้าต่างดูแบบเต็ม = 'full' ทุกปี)
   *  ผู้ใช้ทั่วไป = ตารางแบบเดิม (ช่วงเดียวกันปีก่อน → ช่วงที่เลือก → เพิ่ม/ลด) */
  function cmpTable(S, cmp, mode) {
    const partial = S.compareMode === 'month' && !S.compareNone;
    const pc = (c, v) => c.none ? '<span class="text-ink-mute text-xs">ไม่มีข้อมูล</span>' : fmt(v);
    const unassignedRow = S.unassigned || S.prevCols.some(c => c.unassigned);
    const notes = [];
    if (!S.adminView) {
      const c = S.prevCols[0];
      const head = `<tr><th>${S.unitLabel}</th><th class="num" title="${c.none ? c.note : c.range}">ช่วงเดียวกันปีก่อน${c.partial ? '*' : ''}</th><th class="num">ช่วงที่เลือก</th><th class="num">เพิ่ม/ลด</th></tr>`;
      const rows = attr => cmp.map(r => `<tr${attr(r)}><td>${r.name}</td><td class="num">${pc(c, r.prevs[0])}</td><td class="num">${fmt(r.current)}</td><td class="num"><span class="chg ${r.change.cls}">${r.change.text}</span></td></tr>`).join('')
        + (unassignedRow ? `<tr class="text-ink-soft"><td>ไม่ระบุพื้นที่</td><td class="num">${pc(c, c.unassigned)}</td><td class="num">${fmt(S.unassigned)}</td><td class="num">–</td></tr>` : '');
      const foot = `<tr><th>รวม</th><th class="num">${pc(c, c.total)}</th><th class="num" id="comparison-current-total">${fmt(S.totalCur)}</th><th class="num" id="comparison-change-total"><span class="chg ${S.change.cls}">${S.change.text}</span></th></tr>`;
      if (partial) notes.push(`* ปีก่อนมีข้อมูลไม่ครบทุกเดือน จึงนับและคำนวณ % เพิ่ม/ลด เฉพาะเดือนที่มีข้อมูลทั้งสองปี (${S.prevLabel}) · คอลัมน์ช่วงที่เลือกแสดงจำนวนจริงทั้งหมด`);
      else if (S.compareNone) notes.push(`ช่วงที่เลือกแสดงจำนวนจุดความร้อนจริง ${fmt(S.totalCur)} จุด · ${S.compareNote}`);
      return { head, rows, foot, notes, compact: false };
    }
    // ผู้ดูแล: คอลัมน์ = ปีงบ (เก่า → ใหม่) · ช่วงที่เลือก (เน้น) · แนวโน้ม · เทียบปีก่อนหน้า
    const all = S.prevCols, cols = mode === 'side' ? all.slice(-SIDE_MAX) : all, idx = cols.map(c => all.indexOf(c));
    const near = all[all.length - 1], trend = all.length >= 2;
    const curHead = S.curShort ? `<span class="block">${S.curShort}</span><span class="block cmp-sub">ช่วงที่เลือก</span>` : 'ช่วงที่เลือก';
    const chgHead = near.none ? 'เพิ่ม/ลด' : `<span class="block">เทียบ</span><span class="block">${near.short}${partial ? '*' : ''}</span>`;
    const head = `<tr><th>${S.unitLabel}</th>${cols.map(c => `<th class="num cmp-old" title="${c.none ? c.note : `ช่วงเดียวกัน ${c.label}: ${c.range}`}">${c.short}${c.partial ? '*' : ''}</th>`).join('')}<th class="num cmp-cur" id="th-cmp-cur" title="${S.selText}">${curHead}</th>${trend ? '<th class="cmp-trend">แนวโน้ม</th>' : ''}<th class="num">${chgHead}</th></tr>`;
    const tr = (vals) => trend ? `<td class="cmp-trend">${spark(vals)}</td>` : '';
    const rows = attr => cmp.map(r => `<tr${attr(r)}><td>${r.name}</td>${cols.map((c, j) => `<td class="num cmp-old">${pc(c, r.prevs[idx[j]])}</td>`).join('')}<td class="num cmp-cur">${fmt(r.current)}</td>${tr([...all.map((c, i) => c.none ? 0 : r.prevs[i]), r.cmpCurrent])}<td class="num"><span class="chg ${r.change.cls}">${r.change.text}</span></td></tr>`).join('')
      + (unassignedRow ? `<tr class="text-ink-soft"><td>ไม่ระบุพื้นที่</td>${cols.map(c => `<td class="num cmp-old">${pc(c, c.unassigned)}</td>`).join('')}<td class="num cmp-cur">${fmt(S.unassigned)}</td>${trend ? '<td></td>' : ''}<td class="num">–</td></tr>` : '');
    const foot = `<tr><th>รวม</th>${cols.map(c => `<th class="num cmp-old">${pc(c, c.total)}</th>`).join('')}<th class="num cmp-cur" id="comparison-current-total">${fmt(S.totalCur)}</th>${trend ? `<th class="cmp-trend">${spark([...all.map(c => c.none ? 0 : c.total), S.totalCmp])}</th>` : ''}<th class="num" id="comparison-change-total"><span class="chg ${S.change.cls}">${S.change.text}</span></th></tr>`;
    if (near.none) notes.push(near.note);
    else notes.push(`% เพิ่ม/ลด เทียบช่วงเดียวกันของ${near.label}`);
    if (partial) notes.push(`* นับเฉพาะเดือนที่มีข้อมูลทั้งสองปี (${S.prevLabel}) · ช่วงที่เลือกแสดงจำนวนจริงทั้งหมด`);
    all.slice(0, -1).forEach(c => { if (c.partial) notes.push(`${c.short}* นับเฉพาะ ${c.prevLabel}`); else if (c.none) notes.push(`${c.short}: ${c.note}`); });
    if (trend) notes.push(`แนวโน้ม: ปีเก่า → ช่วงที่เลือก (แท่งสีน้ำเงิน${partial ? ' · นับเฉพาะเดือนเดียวกับปีที่เทียบ' : ''})`);
    if (mode === 'side' && all.length > cols.length) notes.push(`แสดง ${cols.length} ปีล่าสุดจาก ${all.length} ปี — ดูครบที่ “ดูแบบเต็ม”`);
    return { head, rows, foot, notes, compact: cols.length >= 2 || trend };
  }

  /** v3.20 Drop-down “เทียบย้อนหลัง” (เฉพาะ Admin / Mini Super Admin / Super Admin) — ตัวเลือกตามปีที่มีข้อมูลในระบบ */
  function yearSelectHtml(S, id) {
    const o = S.yearOptions, rng = k => { const a = o[k - 1]?.short || '', z = o[0]?.short || ''; return k === 1 ? z : `${a}–${z}`; };
    const cur = S.cmpPref === 'all' || S.cmpPref >= S.avail ? 'all' : String(S.cmpPref);
    const items = o.slice(0, -1).map(x => `<option value="${x.k}"${cur === String(x.k) ? ' selected' : ''}>${x.k} ปี (${rng(x.k)})</option>`);
    items.push(`<option value="all"${cur === 'all' ? ' selected' : ''}>${S.avail > 1 ? `ทั้งหมด ${S.avail} ปี (${rng(S.avail)})` : `1 ปี (ปีงบ ${rng(1)})`}</option>`);
    return `<select id="${id}" class="cmp-select" aria-label="เทียบช่วงเดียวกันย้อนหลัง">${items.join('')}</select>`;
  }
  function bindYearSelect(id) {
    const s = el(id); if (!s) return;
    s.addEventListener('change', () => { setCompareYears(s.value); refresh(); });
  }
  function renderYearPicker(S) {
    const box = el('cmp-years'); if (!box) return;
    if (!S.adminView) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    box.innerHTML = `<label for="cmp-n" class="cmp-lbl">เทียบย้อนหลัง</label>${yearSelectHtml(S, 'cmp-n')}<button type="button" id="cmp-full-open" class="cmp-full-btn" title="ดูทุกปีพร้อมกราฟและส่งออก CSV">⤢ ดูแบบเต็ม</button>`;
    bindYearSelect('cmp-n');
    el('cmp-full-open').addEventListener('click', openFull);
  }

  /* ---------- v3.20 หน้าต่างดูแบบเต็ม: ทุกปีที่เลือก + กราฟรวมรายปี + ส่งออก CSV ---------- */
  const fullOpen = () => !!el('cmp-full') && !el('cmp-full').classList.contains('hidden');
  function openFull() { const m = el('cmp-full'); if (!m) return; m.classList.remove('hidden'); const S = summary(); if (S) renderFull(S); }
  function renderFull(S, cmp) {
    cmp = cmp || S.rows.slice().sort((a, b) => b.current - a.current || a.name.localeCompare(b.name, 'th'));
    const T = cmpTable(S, cmp, 'full');
    el('cmp-full-title').textContent = `เปรียบเทียบ HS ราย${S.unitLabel} — ย้อนหลัง ${S.nYears} ปี`;
    const raw = MapModule.getData();
    el('cmp-full-period').textContent = `${raw.multi ? `${raw.multi.length} จังหวัด` : `จังหวัด${MapModule.provinceName(raw.code) || ''}`} · ช่วงที่เลือก ${S.selText}${MapModule.getState().crop ? ` · ${MapModule.getState().crop}` : ''}`;
    el('cmp-full-pick').innerHTML = yearSelectHtml(S, 'cmp-n-full'); bindYearSelect('cmp-n-full');
    const t = el('cmp-full-table'); t.querySelector('thead').innerHTML = T.head; t.querySelector('tbody').innerHTML = T.rows(() => ''); t.querySelector('tfoot').innerHTML = T.foot.replace(/ id="[^"]*"/g, '');
    el('cmp-full-note').textContent = T.notes.join(' · ');
    // กราฟรวมรายปี (ปีเก่า → ช่วงที่เลือก)
    // ปีที่มีข้อมูลไม่ครบ: แท่งช่วงที่เลือกใช้เฉพาะเดือนเดียวกัน (เทียบกันได้จริง) · ครบ = จำนวนจริงทั้งหมด
    const partial = S.compareMode === 'month' && !S.compareNone;
    const labels = [...S.prevCols.map(c => c.short + (c.partial ? '*' : '')), `${S.curShort || 'ช่วงที่เลือก'}${partial ? ` (${S.curLabel})` : S.curShort ? ' (ช่วงที่เลือก)' : ''}`];
    const data = [...S.prevCols.map(c => c.none ? 0 : c.total), partial ? S.totalCmp : S.totalCur];
    el('cmp-full-chart-title').textContent = partial ? `จำนวน HS รวมรายปี — เฉพาะเดือนที่มีข้อมูลทุกปี (* ${S.prevLabel})` : 'จำนวน HS รวมรายปี (ช่วงเดียวกัน)';
    if (typeof Chart !== 'undefined') {
      if (!charts.full) { const o = chartBase(); o.plugins.tooltip.callbacks = { label: c => ` ${fmt(c.raw)} จุด` }; charts.full = new Chart(el('cmp-full-chart'), { type: 'bar', data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderRadius: 4, maxBarThickness: 56 }] }, options: o }); }
      charts.full.data.labels = labels; charts.full.data.datasets[0].data = data;
      charts.full.data.datasets[0].backgroundColor = data.map((_, i) => i === data.length - 1 ? '#2563eb' : '#a8b3ad');
      charts.full.update('none');
    }
    el('cmp-full-csv').onclick = () => exportCsv(S, cmp);
  }
  function exportCsv(S, cmp) {
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const head = [S.unitLabel, ...S.prevCols.map(c => `ช่วงเดียวกัน ${c.label}${c.partial ? ' (เฉพาะ ' + c.prevLabel + ')' : ''}`), `ช่วงที่เลือก (${S.selText})`, `% เพิ่ม/ลด เทียบ${S.prevCols[S.prevCols.length - 1].label}`];
    const val = (c, v) => c.none ? '' : v;
    const lines = [head, ...cmp.map(r => [r.name, ...S.prevCols.map((c, i) => val(c, r.prevs[i])), r.current, r.change.text]),
      ...(S.unassigned || S.prevCols.some(c => c.unassigned) ? [['ไม่ระบุพื้นที่', ...S.prevCols.map(c => val(c, c.unassigned)), S.unassigned, '']] : []),
      ['รวม', ...S.prevCols.map(c => val(c, c.total)), S.totalCur, S.change.text]];
    const blob = new Blob(['﻿' + lines.map(l => l.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `HS-compare-${MapModule.getData().multi ? 'multi' : MapModule.getData().code}-${S.nYears}y.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { init, refresh, summary, pctChange, spark, setCompareYears, compareYears: () => summary()?.years || [1], openFull };
})();
