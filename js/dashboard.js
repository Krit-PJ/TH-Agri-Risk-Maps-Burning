/* Dashboard ด้านขวา — คำนวณสรุปจากชุดข้อมูลจังหวัดที่เลือก (ใช้ร่วมกับรายงานพิมพ์) */
const Dashboard = (() => {
  const charts = {};
  const el = id => document.getElementById(id);
  const fmt = n => Number(n || 0).toLocaleString('th-TH');

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
    const current = base.filter(f => f.properties.__ym >= s && f.properties.__ym <= e);
    const prior = base.filter(f => f.properties.__ym >= s - 12 && f.properties.__ym <= e - 12);
    const countBy = fs => fs.reduce((o, f) => { const k = f.properties[unitKey] || '-'; o[k] = (o[k] || 0) + 1; return o; }, {});
    const cur = countBy(current), prev = countBy(prior);
    const rows = risk.map(f => {
      const p = f.properties, lv = MapModule.getRiskLevel(p.risk_score);
      return { code: p.code, name: p.name, current: cur[p.code] || 0, previous: prev[p.code] || 0, score: p.risk_score, level: lv, change: pctChange(cur[p.code] || 0, prev[p.code] || 0) };
    });
    const unassigned = (cur['-'] || 0);
    const levels = CONFIG.RISK_LEVELS.map(l => rows.filter(r => r.level === l).length);
    const months = [];
    for (let i = s; i <= e && months.length < 48; i++) months.push(i);
    const byMonth = months.map(i => current.filter(f => f.properties.__ym === i).length);
    return { level, unitLabel: level === 'district' ? 'อำเภอ' : 'ตำบล', rows, current, prior, unassigned, levels, months, byMonth,
      totalCur: current.length, totalPrev: prior.length, change: pctChange(current.length, prior.length),
      priorText: Geo.periodText({ startYear: Geo.ymFromIndex(s - 12).year, startMonth: Geo.ymFromIndex(s - 12).month, endYear: Geo.ymFromIndex(e - 12).year, endMonth: Geo.ymFromIndex(e - 12).month, startYM: s - 12, endYM: e - 12 }) };
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
      [`<span class="chg ${S.change.cls} align-middle text-base">${S.change.text}</span>`, `เทียบช่วงเดียวกันปีก่อน (${fmt(S.totalPrev)} จุด)`],
      [`${fmt(withHs)}<span class="text-base font-semibold text-ink-soft">/${fmt(S.rows.length)}</span>`, `${u}ที่พบจุดความร้อน`],
      [fmt(highCount), `${u}เสี่ยงสูง–สูงมาก`]
    ].map(([v, l]) => `<div class="kpi"><div class="kpi-v">${v}</div><div class="kpi-l">${l}</div></div>`).join('');

    // comparison table (template)
    const cmp = S.rows.slice().sort((a, b) => b.current - a.current || a.name.localeCompare(b.name, 'th'));
    el('comparison-area-header').textContent = u;
    el('title-comparison').textContent = `เปรียบเทียบ HS ราย${u}`;
    el('comparison-period').textContent = `${Geo.periodText(MapModule.getState().startYM ? currentRange() : null)} เทียบ ${S.priorText}`;
    document.querySelector('#tbl-hotspot-comparison tbody').innerHTML = cmp.map(r => `<tr><td>${r.name}</td><td class="num">${fmt(r.previous)}</td><td class="num">${fmt(r.current)}</td><td class="num"><span class="chg ${r.change.cls}">${r.change.text}</span></td></tr>`).join('');
    el('comparison-previous-total').textContent = fmt(S.totalPrev);
    el('comparison-current-total').textContent = fmt(S.totalCur);
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
    document.querySelector('#tbl-top-district tbody').innerHTML = cmp.map((r, i) => `<tr><td class="num text-ink-mute">${i + 1}</td><td>${r.name}</td><td class="num">${fmt(r.current)}</td><td><span class="risk-pill" title="คะแนน ${r.score.toFixed(1)}"><span class="risk-dot" style="background:${r.level.color}"></span>${r.level.label}</span></td></tr>`).join('');
    return S;
  }
  function currentRange() { const s = MapModule.getState(); return { startYear: s.startYear, startMonth: s.startMonth, endYear: s.endYear, endMonth: s.endMonth, startYM: s.startYM, endYM: s.endYM }; }

  return { init, refresh, summary, pctChange };
})();
