document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await ConfigLoader.load();const p=ProvinceContext.get(),r=CONFIG.RISK_MODEL,g=r.annualEvidenceGate;
    const label=new URL(location.href).searchParams.get('scopeLabel')||ProvinceContext.label();
    document.getElementById('guide-province').textContent=`${label} · ${p.organizationName}`;
    document.title=`คู่มือ Agri-Risk Map Burning | ${label}`;
    document.getElementById('guide-formula').textContent=`Risk = ${r.weights.hotspot.toFixed(2)}H + ${r.weights.trend.toFixed(2)}T + ${r.weights.crop.toFixed(2)}C + ${r.weights.area.toFixed(2)}A`;
    document.getElementById('guide-gate').textContent=`ต่ำ: 0–${g.lowMaxCount} จุด; ปานกลาง: ${g.lowMaxCount+1}–${g.mediumMaxCount} จุด; สูง: ${g.mediumMaxCount+1}–${g.highMaxCount} จุด; สูงมาก: มากกว่า ${g.highMaxCount} จุด`;
    const host=document.getElementById('guide-levels');CONFIG.RISK_LEVELS.forEach(l=>{const row=document.createElement('tr');[l.label,`${l.min}–${Math.min(100,l.max-.01)}`].forEach(text=>{const cell=document.createElement('td');cell.textContent=text;row.append(cell);});host.append(row);});
  }catch(err){document.getElementById('guide-province').textContent='โหลด config ไม่สำเร็จ: '+err.message;}
});
