/* All province values live in config/. Recovery uses a generated config snapshot. */
const ConfigLoader = (() => {
  const baseURL = new URL('../', document.currentScript.src);
  const copy = x => JSON.parse(JSON.stringify(x));
  const warnings = [];
  let bundle, active;
  function warn(message) { warnings.push(message); console.warn('[Config]', message); }
  function validProvince(p) {
    return p && typeof p.provinceCode==='string' && /^\d{2}$/.test(p.provinceCode) && typeof p.provinceNameTH==='string' && p.provinceNameTH.trim() && typeof p.provinceNameEN==='string';
  }
  function validRisk(r) {
    const weights=Object.values(r?.weights||{});
    return ['hotspot','trend','crop','area'].every(k=>Number.isFinite(r?.weights?.[k])&&r.weights[k]>=0) &&
      Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-8 && r.levels?.length===4 &&
      r.levels.every((l,i)=>typeof l.label==='string'&&/^[a-z][a-z0-9-]*$/.test(l.class)&&/^#[0-9a-f]{6}$/i.test(l.color)&&l.min<l.max&&(!i||l.min===r.levels[i-1].max)) &&
      r.levels[0].min===0 && r.levels.at(-1).max>100 &&
      r.annualEvidenceGate?.lowMaxCount>0 && r.annualEvidenceGate.mediumMaxCount>r.annualEvidenceGate.lowMaxCount &&
      r.annualEvidenceGate.highMaxCount>r.annualEvidenceGate.mediumMaxCount+1 && r.annualEvidenceGate.mediumMaxCount>r.annualEvidenceGate.lowMaxCount+1 &&
      ['lowBase','lowStep','mediumBase','mediumSpan','highBase','highSpan','veryHighBase','veryHighLogScale','veryHighSpan','exposureWeight','veryHighExposureWeight'].every(k=>Number.isFinite(r.annualEvidenceGate[k])) &&
      r.annualEvidenceGate.caps?.length===4 && r.annualEvidenceGate.floors?.length===4 && [...r.annualEvidenceGate.caps,...r.annualEvidenceGate.floors].every(Number.isFinite) &&
      Object.values(r.cropScores||{}).length>0 && Object.values(r.cropScores).every(Number.isFinite) && typeof r.emptyCropType==='string' &&
      Object.values(r.yearWeights||{}).every(x=>Number.isFinite(x)&&x>=0) &&
      r.highCoverageRule?.enabled===false && r.aggregationRule?.district==='recompute-from-hotspots' && r.aggregationRule?.province==='distribution-of-district-risk';
  }
  function resolvePath(path) {
    if(path==='')return baseURL.href;
    if(!path)return null;
    const url=new URL(path,baseURL);
    if(url.origin!==baseURL.origin||!url.pathname.startsWith(baseURL.pathname))throw new Error('เส้นทางข้อมูลต้องอยู่ภายใน package');
    return url.href;
  }
  async function read(path,fallback,validate) {
    try {
      const response=await fetch(resolvePath(path),{cache:'no-cache'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const result=await response.json();
      if(!validate(result))throw new Error('config ไม่ตรง schema');
      return result;
    } catch(err) { warn(`${path}: ${err.message} — ใช้ recovery config`); return copy(fallback); }
  }
  async function load() {
    warnings.length=0;
    const recovery=window.AGRI_CONFIG_FALLBACK;
    if(!recovery)throw new Error('ไม่พบ recovery config กรุณาตรวจ config/fallback.js');
    const [system,provinces,activeConfig,risk,importRules]=await Promise.all([
      read('config/system.json',recovery.system,x=>typeof x?.defaultProvinceCode==='string'&&/^(?:\d{2})?$/.test(x.defaultProvinceCode)&&x?.provinceDefaults&&Number.isInteger(x.currentYearBE)),
      read('config/provinces.json',recovery.provinces,x=>Array.isArray(x)&&x.length>0&&x.every(validProvince)&&new Set(x.map(p=>p.provinceCode)).size===x.length),
      read('config/active-province.json',recovery.active,x=>typeof x?.activeProvinceCode==='string'&&/^(?:\d{2})?$/.test(x.activeProvinceCode)),
      read('config/risk-model.default.json',recovery.risk,validRisk),
      read('config/import-rules.default.json',recovery.importRules,x=>x?.schemaVersion===2&&Array.isArray(x.detailProfiles)&&x.detailProfiles.length===2&&Array.isArray(x.dateFields)&&x.plantAliases&&x.landAliases)
    ]);
    bundle={system,provinces,risk,importRules};
    let stored='';try{stored=localStorage.getItem('activeProvinceCode')||'';}catch{warn('ไม่สามารถอ่าน localStorage; การเลือกจังหวัดจะอยู่เฉพาะการเปิดครั้งนี้');}
    const queryCode=new URL(location.href).searchParams.get('province');
    const code=queryCode||stored||activeConfig.activeProvinceCode||system.defaultProvinceCode;
    const found=provinces.find(p=>p.provinceCode===code);
    if(code&&!found)warn(`ไม่พบรหัสจังหวัด ${code}; ใช้จังหวัด default`);
    active=mergeProvince(found||provinces.find(p=>p.provinceCode===system.defaultProvinceCode)||recovery.provinces.find(p=>p.provinceCode===recovery.system.defaultProvinceCode));
    applyConfig();
    return {active,firstRun:!stored&&!queryCode,warnings};
  }
  function mergeProvince(p) {
    const recovery=window.AGRI_CONFIG_FALLBACK.system.provinceDefaults;
    const value={...copy(recovery),...copy(bundle.system.provinceDefaults),...copy(p||{provinceCode:"",provinceNameTH:"",provinceNameEN:""})};
    if(!Array.isArray(value.defaultMapCenter)||value.defaultMapCenter.length!==2||!value.defaultMapCenter.every(Number.isFinite)||Math.abs(value.defaultMapCenter[0])>90||Math.abs(value.defaultMapCenter[1])>180){warn('map center ไม่ถูกต้อง ใช้ recovery center');value.defaultMapCenter=copy(recovery.defaultMapCenter);}
    ['defaultZoom','minZoom','maxZoom'].forEach(k=>{if(!Number.isFinite(value[k])||value[k]<0||value[k]>22){warn(`${k} ไม่ถูกต้อง ใช้ default`);value[k]=recovery[k];}});
    if(value.minZoom>value.defaultZoom||value.defaultZoom>value.maxZoom){warn('ช่วง zoom ไม่ถูกต้อง ใช้ default');['defaultZoom','minZoom','maxZoom'].forEach(k=>value[k]=recovery[k]);}
    if(!Number.isInteger(value.fiscalYearStartMonth)||value.fiscalYearStartMonth<1||value.fiscalYearStartMonth>12){warn('เดือนเริ่มปีงบประมาณไม่ถูกต้อง ใช้ default');value.fiscalYearStartMonth=recovery.fiscalYearStartMonth;}
    ['enabledPlantTypes','allowedLandTypes'].forEach(k=>{if(!Array.isArray(value[k])||!value[k].length||!value[k].every(x=>typeof x==='string')){warn(`${k} ไม่ถูกต้อง ใช้ default`);value[k]=copy(recovery[k]);}});
    if(!['fiscal-to-latest','calendar-to-latest'].includes(value.defaultPeriodMode))value.defaultPeriodMode=recovery.defaultPeriodMode;
    for(const key of ['boundaryPath','hotspotPath'])if(!value[key]||typeof value[key]!=='object'||Array.isArray(value[key])){warn(`${key} ไม่ถูกต้อง ใช้ default`);value[key]=copy(recovery[key]);}
    const expand=x=>typeof x==='string'?x.replace(/\{provinceCode\}/g,value.provinceCode).replace(/\{provinceNameTH\}/g,value.provinceNameTH):x;
    Object.keys(value).forEach(k=>{if(typeof value[k]==='string')value[k]=expand(value[k]);});
    ['boundaryPath','hotspotPath'].forEach(k=>value[k]=Object.fromEntries(Object.entries(value[k]).map(([a,b])=>[a,expand(b)])));
    return value;
  }
  function applyConfig() {
    CONFIG.MAP_CENTER=active.defaultMapCenter;CONFIG.MAP_ZOOM=active.defaultZoom;
    CONFIG.MAP_MIN_ZOOM=active.minZoom;CONFIG.MAP_MAX_ZOOM=active.maxZoom;
    CONFIG.CURRENT_YEAR_BE=bundle.system.currentYearBE;
    CONFIG.RISK_LEVELS=bundle.risk.levels;CONFIG.RISK_MODEL=bundle.risk;CONFIG.CROP_RISK=bundle.risk.cropScores;
    // Legacy property names remain aliases; modules use the central loaders.
    CONFIG.DATA={district_kpt:active.boundaryPath.district,subdistrict_kpt:active.boundaryPath.subdistrict,
      crop_kpt:active.cropPath,burnscar_kpt:active.burnscarPath,hotspot:active.hotspotPath};
  }
  function select(code) {
    const p=bundle.provinces.find(x=>x.provinceCode===code);
    if(!p)throw new Error('ไม่พบจังหวัดที่เลือก');
    active=mergeProvince(p);applyConfig();
    try {localStorage.setItem('activeProvinceCode',code);return true;}catch{warn('บันทึกจังหวัดไม่ได้; ปิดหน้านี้แล้วต้องเลือกใหม่');return false;}
  }
  function activate(code,extra={}){active=mergeProvince({...bundle.provinces.find(p=>p.provinceCode===code)||{provinceCode:'',provinceNameTH:'',provinceNameEN:''},...extra});applyConfig();}
  return {load,select,activate,mergeProvince,resolvePath,get active(){return active;},get bundle(){return bundle;},warnings};
})();

const ProvinceContext = (() => {
  const get = () => ConfigLoader.active;
  const label=()=>{const p=get();return p.provinceCode?'จังหวัด'+p.provinceNameTH:p.provinceNameTH||'ยังไม่เลือกพื้นที่';};
  const fileCode=()=>get().provinceCode||(get().scopeCodes?.length===77?'TH':get().scopeCodes?.length?'MULTI':'UNSET');
  function applyProvinceContext() {
    const p=get();document.title=`${p.dashboardTitle} | ${label()}`;
    document.documentElement.dataset.provinceCode=p.provinceCode;
    document.querySelectorAll('[data-province-field]').forEach(el=>el.textContent=p[el.dataset.provinceField]||'');
    document.querySelectorAll('[data-province-logo]').forEach(el=>{el.hidden=!p.logoPath;if(p.logoPath)el.src=ConfigLoader.resolvePath(p.logoPath);el.alt=`ตราจังหวัด${p.provinceNameTH}`;});
    const credit=document.querySelector('.developer-credit');if(credit)credit.hidden=!p.developerCredit;
    const scope=document.getElementById('print-scope');if(scope)scope.textContent=`ขอบเขต: ${label()}`;
    const guide=document.getElementById('risk-guide-drive-link');
    if(guide){const url=new URL(p.guideUrl||'docs/multi-province-guide.html',ConfigLoader.resolvePath(''));if(url.origin===new URL(ConfigLoader.resolvePath('')).origin){url.searchParams.set('province',p.provinceCode);url.searchParams.set('scopeLabel',label());}if(['http:','https:'].includes(url.protocol))guide.href=url.href;}
    const mapLegend=document.getElementById('map-legend');if(mapLegend){mapLegend.replaceChildren();const title=document.createElement('strong');title.textContent='ระดับความเสี่ยง';mapLegend.append(title);CONFIG.RISK_LEVELS.forEach(l=>{const row=document.createElement('div'),dot=document.createElement('span');dot.className='dot';dot.style.background=l.color;row.append(dot,document.createTextNode(' '+l.label));mapLegend.append(row);});}
    const crop=document.getElementById('filter-crop');
    if(crop){crop.replaceChildren(new Option('ทุกชนิดพืช',''));p.enabledPlantTypes.forEach(x=>crop.add(new Option(x,x)));crop.disabled=false;}
    const land=document.getElementById('filter-land-type');
    if(land){land.replaceChildren();p.allowedLandTypes.forEach(x=>land.add(new Option(x,x)));if(!land.options.length)land.add(new Option('พื้นที่เกษตร','พื้นที่เกษตร'));land.value=p.allowedLandTypes.includes('พื้นที่เกษตร')?'พื้นที่เกษตร':land.options[0].value;}
    const year=document.getElementById('timeline-year');if(year){year.dataset.years=Object.keys(p.hotspotPath).join(',');year.replaceChildren();Object.keys(p.hotspotPath).forEach(y=>year.add(new Option(y,y)));}
    const importYear=document.getElementById('import-year');if(importYear){importYear.value=CONFIG.CURRENT_YEAR_BE;importYear.min='2400';}
    const section=document.getElementById('excel-import-section');if(section)section.querySelector('h3').textContent=`นำเข้าข้อมูลจุดความร้อนจาก Excel${p.provinceNameTH?' — '+p.provinceNameTH:''}`;
    const levelHosts=document.querySelectorAll('.risk-levels');
    levelHosts.forEach(host=>{host.replaceChildren();[...CONFIG.RISK_LEVELS].reverse().forEach(l=>{const row=document.createElement('div');row.className='risk-level';const swatch=document.createElement('span');swatch.className='risk-swatch';swatch.style.background=l.color;row.append(swatch,document.createTextNode(`${l.label}: ${l.min}–${Math.min(100,l.max-.01)} คะแนน`));host.append(row);});});
    const printLevels=document.querySelector('.print-risk-level-grid');if(printLevels){printLevels.replaceChildren();[...CONFIG.RISK_LEVELS].reverse().forEach(l=>{const row=document.createElement('div');row.className='print-risk-level-item';const swatch=document.createElement('span');swatch.style.background=l.color;const label=document.createElement('strong');label.textContent=l.label;const range=document.createElement('em');range.textContent=`${l.min}–${Math.min(100,l.max-.01)}`;row.append(swatch,label,range);printLevels.append(row);});}
  }
  return {get,label,fileCode,applyProvinceContext};
})();
