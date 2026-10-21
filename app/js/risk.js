// Default operational model; not a national standard. Preserve the audited annual gate.
const RiskModule={
  scoreFromCount:n=>Math.min(100,Number(n||0)*5),
  getLevelFromScore:s=>CONFIG.RISK_LEVELS.find(x=>s>=x.min&&s<x.max)||CONFIG.RISK_LEVELS[0],
  annualEvidenceScore(count,cropScore,areaScore){
    const g=CONFIG.RISK_MODEL.annualEvidenceGate;
    const exposure=Math.max(0,Math.min(100,(Number(cropScore||0)+Number(areaScore||0))/2));
    if(count<=0)return 0;
    let score,index;
    if(count<=g.lowMaxCount){index=0;score=g.lowBase+(count-1)*g.lowStep+exposure*g.exposureWeight;}
    else if(count<=g.mediumMaxCount){index=1;score=g.mediumBase+((count-g.lowMaxCount-1)/(g.mediumMaxCount-g.lowMaxCount-1))*g.mediumSpan+exposure*g.exposureWeight;}
    else if(count<=g.highMaxCount){index=2;score=g.highBase+((count-g.mediumMaxCount-1)/(g.highMaxCount-g.mediumMaxCount-1))*g.highSpan+exposure*g.exposureWeight;}
    else{index=3;score=g.veryHighBase+Math.min(g.veryHighSpan,Math.log1p(count-g.highMaxCount)*g.veryHighLogScale)+exposure*g.veryHighExposureWeight;}
    return Math.max(g.floors[index],Math.min(g.caps[index],score));
  }
};
