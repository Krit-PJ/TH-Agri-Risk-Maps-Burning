/* Local, transactional map imports. Static roles are a browser access gate. */
const BoundaryStore=(()=>{
  let database,packages={},codes=[],view='',qa=null;
  const empty=()=>({type:'FeatureCollection',features:[]});
  const copy=x=>JSON.parse(JSON.stringify(x));
  function transaction(mode,run){return new Promise((resolve,reject)=>{const tx=database.transaction('state',mode),store=tx.objectStore('state');let result;run(store,v=>result=v);tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('ยกเลิกการบันทึก'));});}
  async function init(){
    if(typeof AccessContext!=='undefined'){database=null;packages={};codes=[];view='';qa=null;apply();return;}
    try{database=await new Promise((resolve,reject)=>{const request=indexedDB.open('agri-risk-map-import-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const saved=await transaction('readonly',(s,done)=>{const r=s.get('active');r.onsuccess=()=>done(r.result);});
      if(saved&&Array.isArray(saved.codes)&&saved.packages){packages=saved.packages;codes=saved.codes.filter(c=>ConfigLoader.bundle.provinces.some(p=>p.provinceCode===c)&&packages[c]);view=codes.includes(saved.view)?saved.view:'';qa=saved.qa||null;}
      const lastView=await transaction('readonly',(s,done)=>{const r=s.get('view');r.onsuccess=()=>done(r.result);});if(typeof lastView==='string')view=codes.includes(lastView)?lastView:'';
    }catch(error){ConfigLoader.warnings.push('ไม่สามารถเปิดที่เก็บแผนที่: '+error.message);database=null;}
    apply();
  }
  function selectedCodes(){return view?[view]:[...codes];}
  function accepts(p){
    const code=DataLoader.areaCodes(p).provinceCode;
    if(code)return selectedCodes().includes(code);
    const name=HSNormalizer.normalizeProvinceName(p.__province||p.Province||p.province||p.PROV_NAMT);
    return selectedCodes().some(c=>ConfigLoader.bundle.provinces.find(x=>x.provinceCode===c)?.provinceNameTH===name);
  }
  function apply(){
    const chosen=selectedCodes();
    if(chosen.length===1){ConfigLoader.activate(chosen[0]);return;}
    const label=chosen.length===77?'ประเทศไทย':chosen.length?`พื้นที่หลายจังหวัด (${chosen.length} จังหวัด)`:'';
    const contexts=chosen.map(c=>ConfigLoader.mergeProvince(ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c)));
    ConfigLoader.activate('',{provinceNameTH:label,provinceNameEN:chosen.length===77?'Thailand':'',
      dashboardSubtitle:`ระบบประเมินและเฝ้าระวังความเสี่ยงการเผาในพื้นที่เกษตร${label?' — '+label:''}`,
      organizationName:'กรมส่งเสริมการเกษตร',defaultMapCenter:[13.5,101],defaultZoom:6,scopeCodes:chosen,
      ...(contexts.length?{enabledPlantTypes:[...new Set(contexts.flatMap(p=>p.enabledPlantTypes))],allowedLandTypes:[...new Set(contexts.flatMap(p=>p.allowedLandTypes))]}:{})});
  }
  function selectView(code){if(code&&!codes.includes(code))throw new Error('จังหวัดนี้ยังไม่ได้เลือกนำเข้า');view=code;apply();if(database)transaction('readwrite',s=>s.put(code,'view')).catch(e=>ConfigLoader.warnings.push('จำมุมมองจังหวัดไม่ได้: '+e.message));return true;}
  function getLayer(level){return {type:'FeatureCollection',features:selectedCodes().flatMap(c=>copy(packages[c]?.[level]?.features||[]))};}
  function getLayerForCodes(level,wanted){if(!wanted.length||wanted.some(c=>!codes.includes(c)))throw new Error('จังหวัดต้องมีชุดแผนที่นำเข้าแล้ว');return {type:'FeatureCollection',features:[...new Set(wanted)].flatMap(c=>copy(packages[c]?.[level]?.features||[]))};}
  function codeOf(p,level){const c=DataLoader.areaCodes(p);return level==='province'?c.provinceCode:level==='district'?c.districtCode:c.subdistrictCode;}
  function validCoordinates(g){function check(a){return Array.isArray(a)&&a.length>0&&(typeof a[0]==='number'?a.length>=2&&Number.isFinite(a[0])&&Number.isFinite(a[1])&&a[0]>=90&&a[0]<=110&&a[1]>=0&&a[1]<=25:a.every(check));}if(!check(g?.coordinates))return false;if(g.type==='Point')return true;const rings=g.type==='Polygon'?g.coordinates:g.coordinates.flat();return rings.every(r=>r.length>=4&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]);}
  function normalize(fc,level){
    if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features)||(!fc.features.length&&level!=='village'))throw new Error(`${level}: ต้องเป็น FeatureCollection ที่มีข้อมูล`);
    const seen=new Set();return {...fc,type:'FeatureCollection',features:fc.features.map((original,i)=>{
      const f=copy(original),p=f.properties||{},c=DataLoader.areaCodes(p),area=codeOf(p,level);
      let name=String(p.nameTH|| (level==='province'?DataLoader.provinceName(p):level==='district'?DataLoader.rawDistrictName(p):level==='subdistrict'?DataLoader.tambonName(p):p.VillageTha||'')).trim();
      if(f.type!=='Feature'||!(level==='village'?['Point','Polygon','MultiPolygon']:['Polygon','MultiPolygon']).includes(f.geometry?.type)||!validCoordinates(f.geometry))throw new Error(`${level} แถว ${i+1}: geometry ไม่ใช่ WGS84/ชนิดไม่ตรง`);
      if(!name||name.includes('\ufffd')||/[<>]/.test(name))throw new Error(`${level} แถว ${i+1}: ชื่อว่าง อักขระเสีย หรือมี markup`);
      if(!ConfigLoader.bundle.provinces.some(x=>x.provinceCode===c.provinceCode))throw new Error(`${level} แถว ${i+1}: ไม่มีรหัสจังหวัดที่รู้จัก`);
      if(level==='province'){const expected=ConfigLoader.bundle.provinces.find(x=>x.provinceCode===c.provinceCode).provinceNameTH;if(HSNormalizer.normalizeProvinceName(name)!==expected)throw new Error(`${c.provinceCode}: ชื่อจังหวัดไม่ตรงรหัส`);name=expected;}
      if(level!=='village'){
        const width={province:2,district:4,subdistrict:6}[level];if(!new RegExp(`^\\d{${width}}$`).test(area))throw new Error(`${level}: รหัสพื้นที่ไม่ครบ ${width} หลัก`);
        if(seen.has(area))throw new Error(`${level}: รหัส ${area} ซ้ำ ต้องรวมรูปทรงและตรวจตัวตนก่อนนำเข้า`);seen.add(area);
        const parent=level==='province'?'TH':area.slice(0,-2);
        if(p.parentCode&&String(p.parentCode)!==parent)throw new Error(`${area}: parentCode ไม่สอดคล้อง`);
        if(area.slice(0,2)!==c.provinceCode)throw new Error(`${area}: รหัสจังหวัดขัดแย้ง`);
        if(level==='subdistrict'&&c.districtCode!==area.slice(0,4))throw new Error(`${area}: districtCode ขัดแย้ง`);
        if(p.AREA_RAI!==undefined&&(!Number.isFinite(Number(p.AREA_RAI))||Number(p.AREA_RAI)<0))throw new Error(`${area}: AREA_RAI ไม่ถูกต้อง`);
        const raw=p.sourceProperties||{};const rp=String(raw.P_CODE||raw.PROV_CODE||raw.PRV_CODE||raw.pro_code||'').padStart(2,'0');
        if(rp!=='00'&&/^\d{2}$/.test(rp)&&rp!==c.provinceCode&&!p.identityEvidence)throw new Error(`${area}: รหัสจังหวัดขัดกับต้นทาง ต้องตรวจสอบก่อน`);
        Object.assign(p,{...c,areaCode:area,parentCode:parent,nameTH:name});
        if(level==='district'){p.districtCode=area;p.__district=name;}
        if(level==='subdistrict'){p.subdistrictCode=area;p.__subdistrict=name;}
      }else{if(!c.subdistrictCode)throw new Error(`หมู่บ้าน ${name}: ไม่พบรหัสตำบลแม่`);if(c.districtCode!==c.subdistrictCode.slice(0,4)||c.provinceCode!==c.subdistrictCode.slice(0,2)||p.parentCode&&String(p.parentCode)!==c.subdistrictCode)throw new Error(`หมู่บ้าน ${name}: รหัสพื้นที่แม่ขัดแย้ง`);Object.assign(p,c,{nameTH:name});}
      f.properties=p;return f;
    })};
  }
  async function readFiles(files){
    const staging={},sources=[];
    for(const file of files){
      const name=file.name.toLowerCase();if(!name.endsWith('.geojson')&&!name.endsWith('.json'))continue;
      const level=/^(province|provinces)\.(geojson|json)$/.test(name)?'province':/^districts?\.(geojson|json)$/.test(name)?'district':/^(subdistricts?|tambons?)\.(geojson|json)$/.test(name)?'subdistrict':/^villages?\.(geojson|json)$/.test(name)?'village':null;
      if(!level)continue;
      const bytes=await file.arrayBuffer(),fc=JSON.parse(new TextDecoder().decode(bytes));
      if(fc?.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new Error(file.name+': ไม่ใช่ FeatureCollection');
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      sources.push({path:file.webkitRelativePath||file.name,sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),bytes:bytes.byteLength,level,count:fc.features.length});
      for(const f of fc.features){const c=DataLoader.areaCodes(f.properties||{}).provinceCode;if(!ConfigLoader.bundle.provinces.some(p=>p.provinceCode===c))throw new Error(file.name+': ไม่พบรหัสจังหวัด');staging[c]??={};staging[c][level]??=empty();staging[c][level].metadata=fc.metadata||{};staging[c][level].features.push(f);}
    }
    if(!Object.keys(staging).length)throw new Error('ไม่พบไฟล์ province, districts, subdistricts (.geojson หรือ .json) ในชุดที่เลือก');
    return {staging,sources};
  }
  function validatePackage(p,c){
    for(const level of ['province','district','subdistrict']){if(!p[level]?.features.length)throw new Error(`จังหวัด ${c}: ขาดชั้น ${level}`);p[level]=normalize(p[level],level);}
    if(p.province.features.length!==1)throw new Error(`จังหวัด ${c}: ต้องมี province เพียง 1 feature`);
    const districts=new Map(p.district.features.map(f=>[f.properties.areaCode,f.properties.nameTH]));
    const tambons=new Set(p.subdistrict.features.map(f=>f.properties.areaCode));
    for(const f of p.subdistrict.features){const name=districts.get(f.properties.parentCode);if(!name)throw new Error(`${f.properties.areaCode}: ไม่มีอำเภอแม่`);f.properties.__district=name;}
    p.village??=empty();p.village=normalize(p.village,'village');for(const f of p.village.features){if(!tambons.has(f.properties.subdistrictCode))throw new Error(`หมู่บ้าน ${f.properties.nameTH}: ไม่มีตำบลแม่ในชุดนำเข้า`);const t=p.subdistrict.features.find(t=>t.properties.areaCode===f.properties.subdistrictCode);f.properties.__subdistrict=t.properties.nameTH;f.properties.__district=districts.get(t.properties.parentCode);}
  }
  async function commit(prepared,wanted,role,mode){
    if(!['admin','superadmin'].includes(role))throw new Error('กรุณาเข้าสู่ระบบผู้ดูแล');
    const chosen=[...new Set(wanted)].sort();if(!chosen.length)throw new Error('กรุณาเลือกจังหวัด');
    if(role==='admin'&&chosen.length!==1)throw new Error('Admin นำเข้าได้ครั้งละ 1 จังหวัดเท่านั้น');
    if(role==='admin'&&mode!=='single')throw new Error('Admin ใช้โหมด 1 จังหวัดเท่านั้น');
    if(mode==='all'&&(role!=='superadmin'||chosen.length!==77))throw new Error('ทั้งหมดต้องครบ 77 จังหวัด และใช้ Super Admin');
    const next={};for(const c of chosen){if(!prepared.staging[c])throw new Error(`ไม่มีไฟล์จังหวัด ${c}`);next[c]=copy(prepared.staging[c]);validatePackage(next[c],c);}
    if(!database)throw new Error('ที่เก็บข้อมูลไม่พร้อม ต้องอนุญาต IndexedDB ก่อนนำเข้า');
    const nextQA={generatedAt:new Date().toISOString(),role,mode,provinceCodes:chosen,sourceFiles:prepared.sources,coverageWarnings:chosen.flatMap(c=>['district','subdistrict'].filter(l=>next[c][l].metadata?.withheldCodes?.length).map(l=>({provinceCode:c,level:l,withheldCodes:next[c][l].metadata.withheldCodes}))),counts:Object.fromEntries(chosen.map(c=>[c,Object.fromEntries(['province','district','subdistrict','village'].map(l=>[l,next[c][l].features.length]))]))};
    nextQA.geometryPrecisionWarnings=chosen.flatMap(c=>next[c].subdistrict.metadata?.geometryPrecisionWarnings||[]);
    await transaction('readwrite',s=>{s.put({codes:chosen,view:'',packages:next,qa:nextQA},'active');s.put('','view');});
    packages=next;codes=chosen;view='';qa=nextQA;apply();return nextQA;
  }
  async function loadDemo(){
    const code=ConfigLoader.bundle.system.legacyExampleProvinceCode,p=ConfigLoader.bundle.provinces.find(p=>p.provinceCode===code);if(!p)throw new Error('ไม่พบ config ชุดตัวอย่าง');const merged=ConfigLoader.mergeProvince(p),staging={[code]:{}},sources=[];
    for(const level of ['district','subdistrict']){const r=await fetch(ConfigLoader.resolvePath(merged.boundaryPath[level]));if(!r.ok)throw new Error('โหลดข้อมูลตัวอย่างไม่ได้');staging[code][level]=normalize(await r.json(),level);sources.push({path:merged.boundaryPath[level],level,count:staging[code][level].features.length,origin:'bundled-operational-baseline'});}
    const path=ConfigLoader.bundle.system.legacyExampleProvincePath,response=await fetch(ConfigLoader.resolvePath(path));if(!response.ok)throw new Error('ไม่พบขอบเขตจังหวัดชุดตัวอย่าง');staging[code].province=normalize(await response.json(),'province');sources.push({path,level:'province',origin:'union-of-operational-districts'});
    return {staging,sources};
  }
  function setServerContext(context,layers,warnings=[]){database=null;packages={};codes=[...context.provinceCodes];view=context.provinceCode||'';for(const c of codes){packages[c]={};for(const [level,fc] of Object.entries(layers)){packages[c][level]={type:'FeatureCollection',features:(fc.features||[]).filter(f=>(DataLoader.areaCodes(f.properties||{}).provinceCode||context.provinceCode)===c)};}}qa={coverageWarnings:warnings,geometryPrecisionWarnings:[]};apply();}
  return {setServerContext,init,selectedCodes,accepts,apply,selectView,getLayer,getLayerForCodes,readFiles,commit,loadDemo,normalize,validCoordinates,validatePackage,get codes(){return [...codes];},get view(){return view;},get qa(){return qa;}};
})();
