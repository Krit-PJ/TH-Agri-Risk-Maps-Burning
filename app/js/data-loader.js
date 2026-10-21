/* WGS84 GeoJSON adapter. Code-based joins are preferred; names are a scoped legacy fallback. */
const DataLoader = (() => {
  const status=[];
  const empty=()=>({type:'FeatureCollection',features:[]});
  const clean=v=>String(v??'').replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|ตำบล|ต\.|แขวง)\s*/,'').trim();
  const first=(p,keys)=>keys.map(k=>p?.[k]).find(v=>v!==null&&v!==undefined&&v!=='');
  const code=(v,len)=>{const s=String(v??'').trim();return new RegExp(`^\\d{${len}}$`).test(s)?s:'';};
  function areaCodes(p) {
    const t=code(first(p,['subdistrictCode','__tambonCode','TAMBON_IDN','TAM_CODE','T_CODE','t_code','Code_Tambo']),6)||code(p?.areaCode,6)||code(p?.parentCode,6);
    const d=code(first(p,['districtCode','__districtCode','AMPHOE_IDN','AMP_CODE','A_CODE','a_code']),4)||t.slice(0,4)||code(p?.areaCode,4)||code(p?.parentCode,4);
    const prov=code(first(p,['provinceCode','__provinceCode','PROV_CODE','P_CODE','p_code']),2)||d.slice(0,2)||code(p?.areaCode,2)||code(p?.parentCode,2);
    return {provinceCode:prov,districtCode:d,subdistrictCode:t};
  }
  function provinceName(p){return HSNormalizer.normalizeProvinceName(first(p,['__province','province','Province','ProvinceN','PROV_NAMT','PROV_NAM_T','p_name','Prov','NAME_1']));}
  function rawDistrictName(p){return clean(first(p,['__district','district','Amphoe','AmphoeN','AMP_NAMT','AMP_NAM_T','AMP_NAME_T','A_NAME_T','amp_th','AMPHOE_T','a_name','NAME_2'])).split(' / ').at(-1);}
  function districtName(p){const name=rawDistrictName(p),c=areaCodes(p).provinceCode;if(typeof BoundaryStore!=='undefined'&&BoundaryStore.selectedCodes().length>1){const prov=ConfigLoader.bundle.provinces.find(x=>x.provinceCode===c)?.provinceNameTH;return prov&&name&&!name.startsWith(prov+' / ')?prov+' / '+name:name;}return name;}
  function tambonName(p){return clean(first(p,['__subdistrict','subdistrict','Tambon','TambonN','TAM_NAMT','TAM_NAM_T','T_NAME_T','tam_th','TAMBON_T','t_name','NAME_3']));}
  function inProvince(p,scoped=false){
    const c=areaCodes(p).provinceCode,name=provinceName(p);
    if(c){const expected=ConfigLoader.bundle.provinces.find(x=>x.provinceCode===c)?.provinceNameTH;if(name&&expected&&name!==expected)return false;return typeof BoundaryStore!=='undefined'?BoundaryStore.selectedCodes().includes(c):c===ProvinceContext.get().provinceCode;}
    if(name)return typeof BoundaryStore!=='undefined'?BoundaryStore.accepts({...p,Province:name}):name===ProvinceContext.get().provinceNameTH;
    return scoped;
  }
  function validGeometry(g,kind){
    if(!g||!(kind==='hotspot'?['Point','MultiPoint']:['Polygon','MultiPolygon']).includes(g.type))return false;
    if(kind==='hotspot'&&g.type==='MultiPoint'&&g.coordinates?.length!==1)return false;
    function check(c){return Array.isArray(c)&&c.length>0&&(typeof c[0]==='number'?c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90:c.every(check));}
    return check(g.coordinates);
  }
  async function loadFC(path,kind,scoped=true){
    if(!path)return empty();
    try{
      const response=typeof AccessContext!=='undefined'?{ok:true,json:()=>V2.request('data?path='+encodeURIComponent(path))}:await fetch(ConfigLoader.resolvePath(path));if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const fc=await response.json();if(fc.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new Error('ต้องเป็น GeoJSON FeatureCollection');
      let invalid=0,foreign=0;
      const features=fc.features.filter(f=>{if(f.type!=='Feature'||!validGeometry(f.geometry,kind)){invalid++;return false;}if(!inProvince(f.properties||{},scoped)){foreign++;return false;}return true;});
      status.push({path,kind,state:features.length?'loaded':'empty',count:features.length,invalid,foreign});
      return {...fc,features};
    }catch(err){status.push({path,kind,state:'unavailable',message:err.message,count:0});console.warn('[Data]',path,err.message);return empty();}
  }
  function normalizeBoundaries(fc,level){
    const seen=new Set();let invalid=0,duplicates=0;
    fc.features=fc.features.filter(f=>{
      const p=f.properties||(f.properties={}),codes=areaCodes(p),len=level==='province'?2:level==='district'?4:6;
      const explicit=code(p.areaCode,len),areaCode=explicit||codes[level==='province'?'provinceCode':level==='district'?'districtCode':'subdistrictCode'];
      const name=clean(p.nameTH)||(level==='province'?provinceName(p):level==='district'?districtName(p):tambonName(p));
      const parent=level==='province'?'TH':level==='district'?codes.provinceCode||ProvinceContext.get().provinceCode:codes.districtCode;
      if(!name||areaCode&&areaCode.slice(0,2)!==ProvinceContext.get().provinceCode||areaCode&&p.parentCode&&p.parentCode!==parent){invalid++;return false;}
      if(areaCode&&seen.has(areaCode)){duplicates++;return false;}if(areaCode)seen.add(areaCode);
      Object.assign(p,codes,{areaCode,parentCode:p.parentCode||parent,nameTH:name,provinceCode:codes.provinceCode||ProvinceContext.get().provinceCode});
      if(level==='district')p.districtCode=areaCode;if(level==='subdistrict')p.subdistrictCode=areaCode;
      p.__district=level==='district'?name:districtName(p);p.__subdistrict=level==='subdistrict'?name:tambonName(p);
      return true;
    });
    if(invalid||duplicates)status.push({kind:level,state:'boundary-qa',invalid,duplicates});
    return fc;
  }
  async function boundary(level){
    if(typeof BoundaryStore!=='undefined'){const fc=BoundaryStore.getLayer(level);status.push({kind:'boundary',state:fc.features.length?'loaded':'empty',count:fc.features.length,path:'IndexedDB/'+level});return fc;}
    const p=ProvinceContext.get(),national=ConfigLoader.bundle.system.nationalBoundaryPath?.[level];
    return normalizeBoundaries(await loadFC(national||p.boundaryPath[level],'boundary',!national),level);
  }
  async function loadHotspotByProvince(year){
    if(typeof AccessContext!=='undefined')return AccessContext.current?.provinceCode?loadFC('data/hotspot/hotspot_'+year+'.geojson','hotspot',true):empty();
    const ps=typeof BoundaryStore!=='undefined'?BoundaryStore.selectedCodes().map(c=>ConfigLoader.mergeProvince(ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c))):[ProvinceContext.get()];
    const fs=[];for(const p of ps){const fc=await loadFC(p.hotspotPath[year],'hotspot',false);fs.push(...fc.features.filter(f=>areaCodes(f.properties).provinceCode===p.provinceCode||provinceName(f.properties)===p.provinceNameTH).filter(f=>p.legacyHotspots||p.allowedLandTypes.includes(HSNormalizer.normalizeLandType(f.properties?.LandType||f.properties?.land_type))&&p.enabledPlantTypes.includes(HSNormalizer.normalizePlantType(f.properties?.PlantType||f.properties?.plant_type||f.properties?.crop_type))));}return {type:'FeatureCollection',features:fs};
  }
  function attachAreaCodes(feature,boundaries){
    const p=feature.properties||(feature.properties={});const given=areaCodes(p);
    const d=rawDistrictName(p),t=tambonName(p);const pc=given.provinceCode||ConfigLoader.bundle.provinces.find(x=>x.provinceNameTH===provinceName(p))?.provinceCode;
    const matches=(boundaries?.features||[]).filter(f=>(!pc||areaCodes(f.properties).provinceCode===pc)&&(given.subdistrictCode?areaCodes(f.properties).subdistrictCode===given.subdistrictCode:rawDistrictName(f.properties)===rawDistrictName(p)&&tambonName(f.properties)===t));
    const known=matches.length===1?areaCodes(matches[0].properties):{};
    Object.assign(p,{__provinceCode:given.provinceCode||known.provinceCode||ProvinceContext.get().provinceCode,
      __districtCode:given.districtCode||known.districtCode||'',__tambonCode:given.subdistrictCode||known.subdistrictCode||''});
    return feature;
  }
  function sameArea(h,b,level){
    const hd=h.__districtCode||h.districtCode,bd=b.districtCode;
    if(hd&&bd){if(hd!==bd)return false;if(level==='district')return true;}
    const ht=h.__tambonCode||h.subdistrictCode,bt=b.subdistrictCode;
    if(level==='subdistrict'&&ht&&bt)return ht===bt;
    if(areaCodes(h).provinceCode&&areaCodes(b).provinceCode&&areaCodes(h).provinceCode!==areaCodes(b).provinceCode)return false;
    return districtName(h)===districtName(b)&&(level==='district'||(h.__subdistrict||tambonName(h))===(b.__subdistrict||tambonName(b)));
  }
  function linkBoundaries(districts,tambons){
    const names=new Map(districts.features.filter(f=>f.properties.districtCode).map(f=>[f.properties.districtCode,districtName(f.properties)]));
    let unmapped=0;
    tambons.features=tambons.features.filter(f=>{
      const p=f.properties,name=names.get(p.districtCode);
      if(name){p.__district=name;return true;}
      if(!districtName(p)){unmapped++;return false;}return true;
    });
    if(unmapped)status.push({kind:'subdistrict',state:'boundary-qa',invalid:unmapped,message:'ไม่พบ parent district'});
  }
  function updateStatus(){
    const el=document.getElementById('province-data-status');if(!el)return;
    const p=ProvinceContext.get(),boundaryRows=status.filter(s=>s.kind==='boundary'),hsRows=status.filter(s=>s.kind==='hotspot');
    const count=hsRows.reduce((a,b)=>a+b.count,0),issues=status.filter(s=>s.state==='unavailable'||s.invalid||s.duplicates);
    const noBoundary=!boundaryRows.some(s=>s.count>0);
    const coverage=typeof BoundaryStore!=='undefined'?(BoundaryStore.qa?.coverageWarnings||[]).filter(w=>BoundaryStore.selectedCodes().includes(w.provinceCode)):[];
    const precision=typeof BoundaryStore!=='undefined'?(BoundaryStore.qa?.geometryPrecisionWarnings||[]).filter(w=>BoundaryStore.selectedCodes().includes(w.provinceCode)):[];
    el.textContent=`${typeof BoundaryStore!=='undefined'?ProvinceContext.label():'จังหวัด'+p.provinceNameTH} · ${noBoundary?'ยังไม่มีข้อมูลขอบเขตพื้นที่ — เข้าสู่ระบบแล้วเลือกชุดแผนที่ก่อนประเมิน':'โหลดขอบเขตแล้ว'} · ${count?'Hotspot '+count.toLocaleString('th-TH')+' จุด':'ยังไม่มีข้อมูล Hotspot ของจังหวัดนี้'}${coverage.length?' · ขอบเขตบางส่วนยังพักตรวจ '+coverage.reduce((s,w)=>s+w.withheldCodes.length,0)+' รหัส — ดูผลตรวจนำเข้า':''}${issues.length?' · พบไฟล์ไม่พร้อมใช้หรือข้อมูลต้องตรวจสอบ '+issues.length+' รายการ':''}${ConfigLoader.warnings.length?' · ใช้ config สำรอง/พบคำเตือน':''}`;
    if(precision.length)el.textContent+=` · แนวเขตซ้อน/พื้นที่ยังต้องตรวจ ${precision.length} รายการ — หลีกเลี่ยงวิเคราะห์พื้นที่ละเอียดในบริเวณนี้ และดูผลตรวจนำเข้า`;
    el.classList.toggle('has-warning',noBoundary||!count||!!issues.length||!!coverage.length||!!precision.length||!!ConfigLoader.warnings.length);
    el.title=JSON.stringify({configWarnings:ConfigLoader.warnings,data:status,coverageWarnings:coverage,geometryPrecisionWarnings:precision},null,2);
  }
  function recordHotspotImport(year,count){
    const path=ProvinceContext.get().hotspotPath[year],row=path&&status.find(s=>s.kind==='hotspot'&&s.path===path);
    if(row)Object.assign(row,{state:count?'loaded':'empty',count,invalid:0,foreign:0});
    else status.push({path:`import-${year}`,kind:'hotspot',state:count?'loaded':'empty',count});
    updateStatus();
  }
  async function loadAux(key,kind){const cs=typeof BoundaryStore!=='undefined'?BoundaryStore.selectedCodes():[ProvinceContext.get().provinceCode];const fs=[];for(const c of cs){const p=ConfigLoader.mergeProvince(ConfigLoader.bundle.provinces.find(x=>x.provinceCode===c));fs.push(...(await loadFC(p[key],kind)).features);}return {type:'FeatureCollection',features:fs};}
  return {status,areaCodes,rawDistrictName,inProvince,districtName,tambonName,provinceName,sameArea,linkBoundaries,attachAreaCodes,updateStatus,recordHotspotImport,
    loadProvinceBoundary:()=>boundary('province'),loadDistrictBoundary:()=>boundary('district'),loadTambonBoundary:()=>boundary('subdistrict'),
    loadHotspotByProvince,loadCropByProvince:()=>loadAux('cropPath','crop'),
    loadBurnscarByProvince:()=>loadAux('burnscarPath','burnscar')};
})();
