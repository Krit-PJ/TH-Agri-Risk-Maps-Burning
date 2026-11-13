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

  /** สรุปข้อมูลตามตัวกรองปัจจุบัน — ใช้ทั้งหน้าจอและรายงาน */
  function summary() {
    const raw = MapModule.getData(), st = MapModule.getState();
    if (!raw.bundle) return null;
    const level = st.district ? 'subdistrict' : 'district';
    const unitKey = level === 'district' ? '__dCode' : '__sCode';
    const risk = MapModule.getRiskForScope(level)?.features || [];
    const base = (raw.hotspot?.features || []).filter(f => {
      const p = f.properties;
      return (!st.crop || p.__crop === st.crop) && (!st.district || p.__dCode === st.district) && (!st.subdistrict || p.__sCode === st.subdistrict);
    });
    const s = Number(st.startYM), e = Number(st.endYM);
    // เทียบช่วงเดียวกันปีก่อน (MapModule.compareInfo → Geo.compareWindow): วันต่อวัน หรือเฉพาะเดือนที่มีข้อมูลทั้งสองปี
    const W = MapModule.compareInfo() || { mode: 'day', none: true, inCur: () => false, inPrev: () => false, cur: ['', ''], prev: ['', ''], note: '' };
    const latest = W.latest || '';
    const current = base.filter(f => f.properties.__ym >= s && f.properties.__ym <= e);           // ทุกจุดในช่วงที่เลือก
    const curCmp = base.filter(f => W.inCur(f.properties.__date));                                    // ส่วนของช่วงที่เลือกที่ใช้เทียบ
    const prior = base.filter(f => W.inPrev(f.properties.__date));
    const countBy = fs => fs.reduce((o, f) => { const k = f.properties[unitKey] || '-'; o[k] = (o[k] || 0) + 1; return o; }, {});
    const cur = countBy(current), cmpC = countBy(curCmp), prev = countBy(prior);
    const NA = { text: '–', cls: 'chg-flat' };
    const rows = risk.map(f => {
      const p = f.properties, lv = MapModule.riskInfo() ? MapModule.levelOf(p) : NO_LEVEL;
      return { code: p.code, name: p.name, current: cur[p.code] || 0, cmpCurrent: cmpC[p.code] || 0, previous: prev[p.code] || 0, score: p.risk_score ?? 0, level: lv,
        change: W.none ? NA : pctChange(cmpC[p.code] || 0, prev[p.code] || 0) };
    });
    // จุดที่ไม่มีรหัส/ไม่ตรงกับขอบเขตพื้นที่ในแผนที่ — แสดงเป็นแถว “ไม่ระบุพื้นที่” เพื่อให้ผลรวมตาราง = จำนวนจุดจริงในช่วงที่เลือก
    const sumOf = k => rows.reduce((a, r) => a + r[k], 0);
    const unassigned = Math.max(0, current.length - sumOf('current')), unassignedPrev = Math.max(0, prior.length - sumOf('previous')), unassignedCmp = Math.max(0, curCmp.length - sumOf('cmpCurrent'));
    const levels = CONFIG.RISK_LEVELS.map(l => rows.filter(r => r.level === l).length);
    const months = [];
    for (let i = s; i <= e && months.length < 48; i++) months.push(i);
    const byMonth = months.map(i => current.filter(f => f.properties.__ym === i).length);
    const partial = W.mode === 'month';
    const [startD, endD] = W.cur, [pStart, pEnd] = W.prev;
    const selText = (() => { const a = Geo.ymFromIndex(s), z = Geo.ymFromIndex(e), zd = new Date(Date.UTC(z.year - 543, z.month, 0)).getUTCDate();
      let end = `${z.year - 543}-${String(z.month).padStart(2, '0')}-${zd}`; if (latest && end > latest) end = latest;
      return `${Geo.thaiDate(`${a.year - 543}-${String(a.month).padStart(2, '0')}-01`)} – ${Geo.thaiDate(end)}`; })();
    return { level, unitLabel: level === 'district' ? 'อำเภอ' : 'ตำบล', rows, current, curCmp, prior, unassigned, unassignedPrev, unassignedCmp, levels, months, byMonth,
      totalCur: current.length, totalCmp: curCmp.length, totalPrev: prior.length, change: W.none ? NA : pctChange(curCmp.length, prior.length),
      compareMode: W.mode, compareNote: W.note, compareNone: !!W.none, selText, curLabel: W.curLabel || '', prevLabel: W.prevLabel || '',
      currentText: W.none ? selText : partial ? `${W.curLabel} (เดือนที่มีข้อมูลทั้งสองปี${latest && endD >= latest ? ` · ข้อมูลถึง ${Geo.thaiDate(latest)}` : ''})` : `${Geo.thaiDate(startD)} – ${Geo.thaiDate(endD)}`,
      priorText: W.none ? W.note : partial ? `${W.prevLabel} (${W.note})` : `${Geo.thaiDate(pStart)} – ${Geo.thaiDate(pEnd)}`,
      compareText: W.none ? W.note : partial ? `เทียบเดือนที่มีข้อมูลทั้งสองปี: ${W.prevLabel} ${fmt(prior.length)} จุด → ${W.curLabel} ${fmt(curCmp.length)} จุด` : `เทียบช่วงเดียวกันปีก่อน (${fmt(prior.length)} จุด)` };
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
      [fmt(highCount), `${u}เสี่ยงสูง–สูงมาก`]
    ].map(([v, l]) => `<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div></div>`).join('');

    // comparison table (template)
    const cmp = S.rows.slice().sort((a, b) => b.current - a.current || b.cmpCurrent - a.cmpCurrent || a.name.localeCompare(b.name, 'th'));
    el('comparison-area-header').textContent = u;
    // v3.9.1: คอลัมน์ “ช่วงที่เลือก” = จำนวนจุดจริงทั้งหมดในช่วงที่เลือก (ผลรวม = KPI) · “ช่วงเดียวกันปีก่อน” = ไม่มีข้อมูล เมื่อฐานข้อมูลไม่มีปีก่อน
    const st = MapModule.getState(), partial = S.compareMode === 'month' && !S.compareNone;
    if (el('th-cmp-prev')) { el('th-cmp-prev').textContent = partial ? 'ช่วงเดียวกันปีก่อน*' : 'ช่วงเดียวกันปีก่อน'; el('th-cmp-cur').textContent = 'ช่วงที่เลือก'; }
    el('title-comparison').textContent = `เปรียบเทียบ HS ราย${u}`;
    el('comparison-period').textContent = `${S.compareNone ? `${S.selText} · ${S.priorText}` : partial ? `${S.selText} · เทียบเดือนที่มีข้อมูลทั้งสองปี` : `${S.currentText} เทียบ ${S.priorText}`}${st.crop ? ` · ${st.crop}` : ''}`;
    const prevCell = v => S.compareNone ? '<span class="text-ink-mute text-xs">ไม่มีข้อมูล</span>' : fmt(v);
    const curCell = (v, c) => partial && c !== v ? `${fmt(v)}<span class="block text-[10px] text-ink-mute">เทียบ ${fmt(c)}</span>` : fmt(v);
    const picked = S.level === 'district' ? st.district : st.subdistrict;
    const body = cmp.map(r => `<tr class="cmp-row${picked === r.code ? ' cmp-picked' : ''}" data-cmp-code="${r.code}" tabindex="0" title="คลิกเพื่อ${S.level === 'district' ? 'ดูรายตำบลในอำเภอนี้' : picked === r.code ? 'ยกเลิกการเลือกตำบล' : 'เลือกตำบลนี้'}"><td>${r.name}</td><td class="num">${prevCell(r.previous)}</td><td class="num">${curCell(r.current, r.cmpCurrent)}</td><td class="num"><span class="chg ${r.change.cls}">${r.change.text}</span></td></tr>`);
    if (S.unassigned || S.unassignedPrev) body.push(`<tr class="text-ink-soft"><td>ไม่ระบุพื้นที่</td><td class="num">${prevCell(S.unassignedPrev)}</td><td class="num">${curCell(S.unassigned, S.unassignedCmp)}</td><td class="num">–</td></tr>`);
    const tb = document.querySelector('#tbl-hotspot-comparison tbody');
    tb.innerHTML = body.join('');
    tb.querySelectorAll('[data-cmp-code]').forEach(tr => {
      const go = () => document.dispatchEvent(new CustomEvent('agri-risk:area-click', { detail: { level: S.level, code: tr.dataset.cmpCode, source: 'table' } }));
      tr.addEventListener('click', go); tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
    el('comparison-previous-total').innerHTML = prevCell(S.totalPrev);
    el('comparison-current-total').innerHTML = curCell(S.totalCur, S.totalCmp);
    if (el('comparison-note')) el('comparison-note').textContent = partial
      ? `* ปีก่อนมีข้อมูลไม่ครบทุกเดือน จึงนับปีก่อนและคำนวณ % เพิ่ม/ลด เฉพาะเดือนที่มีข้อมูลทั้งสองปี (${S.prevLabel} เทียบ ${S.curLabel}) — ตัวเลข “เทียบ” ใต้ช่วงที่เลือกคือจำนวนจุดในเดือนเหล่านั้น`
      : S.compareNone ? `ช่วงที่เลือกแสดงจำนวนจุดความร้อนจริง ${fmt(S.totalCur)} จุด · ${S.compareNote}` : '';
    el('comparison-change-total').innerHTML = `<span class="chg ${S.change.cls}">${S.change.text}</span>`;

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
      return `<div class="flex items-center gap-2 text-[13px]"><span class="risk-dot" style="background:${l.color}"></span><span class="flex-1">${l.label}</span><span class="tabular-nums text-ink-soft">${v} ${u}</span><strong class="w-12 text-right tabular-nums">${tot ? (v * 100 / tot).toFixed(1) : '0.0'}%</strong></div>`;
    }).join('');

    // all units ranked (template "ทุกอำเภอ")
    el('rank-area-header').textContent = u;
    el('title-top10').textContent = `ทุก${u} เรียงตามจำนวน HS`;
    document.querySelector('#tbl-top-district tbody').innerHTML = cmp.map((r, i) => `<tr><td class="num text-ink-mute">${i + 1}</td><td>${r.name}</td><td class="num">${fmt(r.current)}</td><td><span class="risk-pill"${MapModule.viewerDetailed() ? ` title="คะแนน ${Number(r.score).toFixed(1)}"` : ''}><span class="risk-dot" style="background:${r.level.color}"></span>${r.level.label}</span></td></tr>`).join('');
    return S;
  }

  return { init, refresh, summary, pctChange };
})();
