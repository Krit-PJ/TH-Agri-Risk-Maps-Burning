const MapModule = (() => {
  const sessionImports={};
  let map, polygonRenderer, currentBasemap = 'satellite';
  const base = {};
  const raw = {
    province:null, district:null, subdistrict:null, hotspot:{}, crop:null, burnscar:null,
    risk:null, riskDistrict:null, riskSubdistrict:null
  };
  const shown = { province:null, district:null, subdistrict:null, hotspot:{}, crop:null, burnscar:null, risk:null };
  let state = { district:'', subdistrict:'', landType:'พื้นที่เกษตร', crop:'', months:[], month:'', day:'', startYM:null, endYM:null, startYear:null, startMonth:null, endYear:null, endMonth:null };

  const clean = HSNormalizer.normalizeDistrictName;
  const districtOf = DataLoader.districtName;
  const subdistrictOf = DataLoader.tambonName;
  const normalizeCrop = v => HSNormalizer.normalizePlantType(v) || ConfigLoader.bundle.risk.emptyCropType;
  const cropOf = p => normalizeCrop(p?.__plant_type || p?.plant_type || p?.PlantType || p?.crop_type_raw || p?.__crop || p?.crop_type || p?.crop || p?.LU_HP_Name);
  const landOf = p => HSNormalizer.normalizeLandType(p?.__land_type || p?.land_type || p?.LandType || '');
  const provinceOf = DataLoader.provinceName;
  function excelSerialToDate(value){
    const n=Number(value); if(!Number.isFinite(n)||n<1)return null;
    const d=new Date(Math.round((n-25569)*86400*1000));
    return Number.isNaN(d.getTime())?null:d;
  }
  function parseHotspotDate(properties,fallbackYearBE){
    const p=properties||{};
    for(const value of [p.__date,p.acq_date,p.ACQ_DATE,p.Date,p.date,p.th_date]){
      if(value===null||value===undefined||value==='')continue;
      if(typeof value==='number'||/^\d{5}(?:\.\d+)?$/.test(String(value).trim())){const d=excelSerialToDate(value);if(d)return d;}
      const text=String(value).trim();
      let m=text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)$/);
      if(m){let y=Number(m[1]);if(y>2400)y-=543;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[3])));if(!Number.isNaN(d.getTime()))return d;}
      m=text.match(/^([0-3]?\d)[-\/]([01]?\d)[-\/](\d{4})$/);
      if(m){let y=Number(m[3]);if(y>2400)y-=543;const d=new Date(Date.UTC(y,Number(m[2])-1,Number(m[1])));if(!Number.isNaN(d.getTime()))return d;}
      const d=new Date(text);if(!Number.isNaN(d.getTime()))return d;
    }
    const y=Number(fallbackYearBE||p.year_be||p.season_be);return Number.isFinite(y)?new Date(Date.UTC(y-543,0,1)):null;
  }
  function datePartsOf(feature){
    const p=feature?.properties||{};
    if(Number.isFinite(Number(p.__month))&&Number.isFinite(Number(p.__day)))return{month:Number(p.__month),day:Number(p.__day),date:p.__date||''};
    const d=parseHotspotDate(p,p.year_be);return d?{month:d.getUTCMonth()+1,day:d.getUTCDate(),date:d.toISOString().slice(0,10)}:{month:0,day:0,date:''};
  }
  function selectedMonths(){return Array.isArray(state.months)?state.months.map(Number).filter(Number.isFinite):(state.month?[Number(state.month)]:[]);}
  function ymIndex(year,month){return Number(year)*12+Number(month);}
  function featureYM(feature){const p=feature?.properties||{},parts=datePartsOf(feature),year=Number(p.year_be||p.season_be||0);return year&&parts.month?ymIndex(year,parts.month):null;}
  function rangePeriodText(){const short=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];if(state.startYear&&state.startMonth&&state.endYear&&state.endMonth){const a=`${short[state.startMonth]} ${state.startYear}`,b=`${short[state.endMonth]} ${state.endYear}`;return Number(state.startYM)===Number(state.endYM)?a:`${a} ถึง ${b}`;}return selectedMonths().length?`เดือน ${selectedMonths().join(',')}`:'สะสมทั้งปี';}
  function matchesDate(feature){
    const parts=datePartsOf(feature),months=selectedMonths(),day=Number(state.day||0),idx=featureYM(feature);
    if(Number.isFinite(Number(state.startYM))&&Number.isFinite(Number(state.endYM))&&idx!==null){
      return idx>=Number(state.startYM)&&idx<=Number(state.endYM)&&(!day||parts.day===day);
    }
    return(!months.length||months.includes(parts.month))&&(!day||parts.day===day);
  }
  async function fetchJSON(url){ const r=await fetch(url); if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); }
  function remove(layer){ if(layer && map.hasLayer(layer)) map.removeLayer(layer); }
  function hotspotEnabled(){ return document.getElementById('lyr-hotspot')?.checked !== false; }
  function activeYears(){
    if(!hotspotEnabled()) return [];
    const keys=Object.keys(raw.hotspot).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    // When the month/year range selector is active, choose the dataset file(s)
    // that actually contain features in the selected period. This is important
    // for fiscal-year datasets such as HS2026, where Oct-Dec 2025 are stored in
    // the 2569 dataset file but their calendar year is 2568.
    if(Number.isFinite(Number(state.startYM)) && Number.isFinite(Number(state.endYM)) && keys.length){
      const matched=keys.filter(y=>(raw.hotspot[y]?.features||[]).some(f=>matchesDate(f)));
      if(matched.length) return matched;
    }
    return [...document.querySelectorAll('.hs-layer:checked')]
      .map(el => Number(el.dataset.year)).filter(Number.isFinite).sort((a,b)=>a-b);
  }

  function asPointFeature(feature){
    if(!feature?.geometry) return feature;
    if(feature.geometry.type==='Point') return feature;
    if(feature.geometry.type==='MultiPoint' && Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length===1){
      return {...feature,geometry:{type:'Point',coordinates:feature.geometry.coordinates[0]}};
    }
    return feature;
  }

  // Default operational model, not a national standard. Preserve the legacy annual gate.
  const annualEvidenceScore = (count,cropScore,areaScore) => RiskModule.annualEvidenceScore(count,cropScore,areaScore);

  async function init(){
    map = L.map('map',{ center:CONFIG.MAP_CENTER, zoom:CONFIG.MAP_ZOOM, minZoom:CONFIG.MAP_MIN_ZOOM, maxZoom:CONFIG.MAP_MAX_ZOOM, zoomControl:false,preferCanvas:true });
    // Keep administrative/risk polygons as vectors. Canvas remains the fast
    // default for thousands of hotspot points, while SVG avoids bitmap
    // distortion when the browser changes the map to A4 print dimensions.
    polygonRenderer=L.svg({padding:.5});
    L.control.zoom({position:'bottomright'}).addTo(map);
    Object.entries(CONFIG.BASEMAPS).forEach(([k,u]) => base[k] = L.tileLayer(u,{ maxZoom:19, attribution:k==='satellite'?'Tiles © Esri':k==='topo'?'© OpenTopoMap':'© OpenStreetMap contributors' }));
    base.satellite.addTo(map);

    document.querySelectorAll('input[name="basemap"]').forEach(el => el.addEventListener('change',()=>{ remove(base[currentBasemap]); currentBasemap=el.value; base[currentBasemap].addTo(map); }));
    ['lyr-district','lyr-subdistrict','lyr-province','lyr-village'].forEach(id => document.getElementById(id)?.addEventListener('change',renderBoundaries));
    document.getElementById('lyr-crop')?.addEventListener('change',renderCrop);
    document.getElementById('lyr-burnscar')?.addEventListener('change',()=>renderAux('burnscar'));
    document.getElementById('lyr-risk')?.addEventListener('change',()=>renderAux('risk'));
    document.addEventListener('change',e=>{
      const isYear=e.target?.classList?.contains('hs-layer');
      const isMaster=e.target?.id==='lyr-hotspot';
      if(!isYear&&!isMaster) return;
      computeDynamicRisk();
      renderHotspots();
      renderAux('risk');
      document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:activeYears(),hotspotEnabled:hotspotEnabled()}}));
    });

    return reloadData();
  }
  async function reloadData(){
    raw.hotspot={};raw.crop=null;raw.burnscar=null;raw.village=BoundaryStore.getLayer('village');
    DataLoader.status.length=0;
    [raw.province,raw.district,raw.subdistrict] = await Promise.all([DataLoader.loadProvinceBoundary(),DataLoader.loadDistrictBoundary(),DataLoader.loadTambonBoundary()]);
    DataLoader.linkBoundaries(raw.district,raw.subdistrict);
    await Promise.all([...new Set([...Object.keys(CONFIG.DATA.hotspot),...Object.keys(sessionImports)])].map(async y=>{
      try {
        const fc=CONFIG.DATA.hotspot[y]?await DataLoader.loadHotspotByProvince(y):{type:'FeatureCollection',features:[]};
        const stored=sessionImports[y];if(stored){fc.features=fc.features.filter(f=>!stored.codes.includes(DataLoader.areaCodes(f.properties).provinceCode)&&!stored.codes.some(c=>ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c)?.provinceNameTH===DataLoader.provinceName(f.properties))).concat(stored.features.filter(f=>BoundaryStore.accepts(f.properties)));}
        raw.hotspot[y]={...fc,features:(fc.features||[]).map(asPointFeature)};
      }
      catch(err){ console.warn(err.message); raw.hotspot[y]={type:'FeatureCollection',features:[]}; }
    }));
    enrichHotspots();
    computeDynamicRisk();
    renderBoundaries(); renderHotspots(); renderAux('risk'); zoomToProvince();
    DataLoader.updateStatus();
    return { province:raw.province, district:raw.district, subdistrict:raw.subdistrict, hotspot:raw.hotspot, risk:raw.risk };
  }

  function enrichFeature(input,fallbackYearBE){
    const f=asPointFeature(input);
    const p=f.properties||(f.properties={});
    // Use the source-table administrative hierarchy first:
    // Province -> Amphoe -> Tambon -> BaanN. Spatial matching is only a fallback
    // for missing names, not an override. This keeps HS totals aligned with the
    // Excel pivot/filter logic.
    let d=districtOf(p), t=subdistrictOf(p), prov=provinceOf(p);
    if((!d || !t || !prov) && window.turf && f.geometry?.type==='Point'){
      const hit=(raw.subdistrict?.features||[]).find(poly=>{ try{return turf.booleanPointInPolygon(f,poly);}catch{return false;} });
      if(hit){ d=d||districtOf(hit.properties); t=t||subdistrictOf(hit.properties); prov=prov||ConfigLoader.bundle.provinces.find(x=>x.provinceCode===DataLoader.areaCodes(hit.properties).provinceCode)?.provinceNameTH; }
    }
    p.__district=d;
    p.__subdistrict=t;
    p.__village=clean(p.__village || p.village || p.BaanN || p.Village || p.Moo || '');
    p.__plant_type=cropOf(p);
    p.__crop=p.__plant_type;
    p.__land_type=landOf(p);
    p.__province=prov||(DataLoader.areaCodes(p).provinceCode===ProvinceContext.get().provinceCode?ProvinceContext.get().provinceNameTH:'');
    DataLoader.attachAreaCodes(f,raw.subdistrict);
    const identifiedDistrict=raw.district?.features.find(b=>b.properties.districtCode&&b.properties.districtCode===p.__districtCode),identifiedTambon=raw.subdistrict?.features.find(b=>b.properties.subdistrictCode&&b.properties.subdistrictCode===p.__tambonCode);
    if(identifiedDistrict)p.__district=districtOf(identifiedDistrict.properties);if(identifiedTambon)p.__subdistrict=subdistrictOf(identifiedTambon.properties);
    p.__district=districtOf(p);
    const dt=parseHotspotDate(p,fallbackYearBE||p.year_be);
    if(dt){
      p.__date=dt.toISOString().slice(0,10);
      p.__month=dt.getUTCMonth()+1;
      p.__day=dt.getUTCDate();
      // Calendar Buddhist year is used by the month/year range selector.
      p.year_be=Number(p.year_be)||dt.getUTCFullYear()+543;
    }else{
      p.year_be=Number(p.year_be||fallbackYearBE)||fallbackYearBE;
    }
    p.dataset_year_be=Number(p.dataset_year_be||p.season_be||fallbackYearBE)||fallbackYearBE;
    return f;
  }
  function enrichHotspots(){ Object.entries(raw.hotspot).forEach(([year,fc])=>{fc.features=(fc.features||[]).map(f=>enrichFeature(f,Number(year))).filter(f=>BoundaryStore.accepts(f.properties||{}));}); }

  function selectedYearWeights(years){
    if(!years.length) return {};
    const configured=CONFIG.RISK_MODEL.yearWeights||{};
    const vals=years.map((y,i)=>Number(configured[y] ?? (i+1)));
    const total=vals.reduce((a,b)=>a+b,0)||1;
    return Object.fromEntries(years.map((y,i)=>[y,vals[i]/total]));
  }

  function hotspotRowsFor(level, years, yearWeights){
    const boundaries = level==='district' ? (raw.district?.features||[]) : (raw.subdistrict?.features||[]);
    const areaByDistrict = {};
    (raw.subdistrict?.features||[]).forEach(f=>{
      const d=districtOf(f.properties), a=Number(f.properties?.AREA_RAI||f.properties?.area_rai||0);
      areaByDistrict[d]=(areaByDistrict[d]||0)+a;
    });
    return boundaries.map(feature=>{
      const p=feature.properties||{}, d=districtOf(p), t=level==='subdistrict'?subdistrictOf(p):'';
      const counts={}; let cropSum=0,cropN=0;
      years.forEach(y=>{
        const fs=(raw.hotspot[y]?.features||[]).filter(h=>{
          const hp=h.properties||{};
          return BoundaryStore.accepts(hp) && DataLoader.sameArea(hp,p,level) && (!state.landType||hp.__land_type===state.landType) && (!state.crop||hp.__crop===state.crop) && matchesDate(h);
        });
        counts[y]=fs.length;
        fs.forEach(h=>{cropSum+=CONFIG.CROP_RISK[h.properties.__crop]??50;cropN++;});
      });
      const weighted=years.reduce((s,y)=>s+(counts[y]||0)*(yearWeights[y]||0),0);
      let trend=0;
      if(years.length>=2){
        const prev=counts[years[years.length-2]]||0, cur=counts[years[years.length-1]]||0;
        trend=prev===0?(cur>0?100:0):Math.max(0,Math.min(100,50+((cur-prev)/prev)*100));
      }
      const area=level==='district' ? (areaByDistrict[d]||0) : Number(p.AREA_RAI||p.area_rai||0);
      return {feature,d,t,counts,weighted,trend,crop:cropN?cropSum/cropN:0,area};
    });
  }

  function scopeBoundaries(level){
    const source = level==='district' ? (raw.district?.features||[]) : (raw.subdistrict?.features||[]);
    return source.filter(feature=>{
      const d=districtOf(feature.properties), t=subdistrictOf(feature.properties);
      if(level==='district') return !state.district || d===state.district;
      return (!state.district || d===state.district) && (!state.subdistrict || t===state.subdistrict);
    });
  }

  function historicalReferenceMax(level,provinceCode){
    const boundaries=scopeBoundaries(level).filter(f=>!provinceCode||DataLoader.areaCodes(f.properties).provinceCode===provinceCode);
    const allYears=Object.keys(raw.hotspot).map(Number).filter(Number.isFinite);
    let maxCount=1;
    boundaries.forEach(feature=>{
      const d=districtOf(feature.properties), t=level==='subdistrict'?subdistrictOf(feature.properties):'';
      allYears.forEach(y=>{
        const count=(raw.hotspot[y]?.features||[]).filter(h=>{
          const hp=h.properties||{};
          return BoundaryStore.accepts(hp) && DataLoader.sameArea(hp,feature.properties,level) && (!state.landType||hp.__land_type===state.landType) && (!state.crop||hp.__crop===state.crop) && matchesDate(h);
        }).length;
        if(count>maxCount) maxCount=count;
      });
    });
    return maxCount;
  }

  function buildRiskCollection(level, years, yearWeights){
    const factors=CONFIG.RISK_MODEL.weights;
    const allowed=new Set(scopeBoundaries(level).map(f=>{
      const d=districtOf(f.properties),t=level==='subdistrict'?subdistrictOf(f.properties):'';
      return `${d}||${t}`;
    }));
    const rows=hotspotRowsFor(level,years,yearWeights).filter(r=>allowed.has(`${r.d}||${r.t}`));
    // Default operational model: normalize within each province, also in national view.
    const domains=new Map();rows.forEach(r=>{const pc=DataLoader.areaCodes(r.feature.properties).provinceCode;if(!domains.has(pc)){const own=rows.filter(x=>DataLoader.areaCodes(x.feature.properties).provinceCode===pc),logs=own.map(x=>Math.log1p(x.area));domains.set(pc,{referenceMax:historicalReferenceMax(level,pc),minL:Math.min(...logs),maxL:Math.max(...logs),count:own.length});}});

    return {
      type:'FeatureCollection', name:`risk_${level}_${years.join('_')||'none'}`,
      features:rows.map((r,i)=>{
        const {referenceMax,minL,maxL,count}=domains.get(DataLoader.areaCodes(r.feature.properties).provinceCode);
        const hs=years.length?Math.max(0,Math.min(100,r.weighted/referenceMax*100)):0;
        const trend=years.length>=2?r.trend:0;
        const area=maxL===minL?(count===1?50:0):(Math.log1p(r.area)-minL)/(maxL-minL)*100;
        const selectedCount=years.reduce((sum,y)=>sum+(r.counts[y]||0),0);
        let score=0, method='No hotspot year selected';
        if(years.length===1){
          // One common annual method for every year and every administrative level.
          score=annualEvidenceScore(selectedCount,r.crop,area);
          method='Unified annual evidence-gate model';
        }else if(years.length>=2){
          score=hs*factors.hotspot+trend*factors.trend+r.crop*factors.crop+area*factors.area;
          method='Multi-year Model A';
        }
        const hsFields=Object.fromEntries(years.map(y=>[`hs_${y}`,r.counts[y]||0]));
        return {
          type:'Feature', geometry:r.feature.geometry,
          properties:{
            ...r.feature.properties,
            district:r.d,subdistrict:r.t,risk_level_scope:level,
            risk_score:+score.toFixed(2),
            risk_raw_score:+score.toFixed(2),
            hotspot_score:+hs.toFixed(2),trend_score:+trend.toFixed(2),
            crop_score:+r.crop.toFixed(2),area_score:+area.toFixed(2),
            risk_years:years.join(','),
            risk_months:selectedMonths().join(','),risk_day:state.day||'',
            risk_period:rangePeriodText(),
            risk_method:method,
            selected_hotspot_count:selectedCount,
            risk_reference_max:referenceMax,
            ...hsFields
          }
        };
      })
    };
  }

  function computeDynamicRisk(){
    const years=activeYears();
    const yw=selectedYearWeights(years);
    raw.riskDistrict=buildRiskCollection('district',years,yw);
    raw.riskSubdistrict=buildRiskCollection('subdistrict',years,yw);
    raw.risk=state.district?raw.riskSubdistrict:raw.riskDistrict;
    return raw.risk;
  }

  function matchesFeature(f){ const p=f.properties||{}; return BoundaryStore.accepts(p)&&(!state.district||p.__district===state.district)&&(!state.subdistrict||p.__subdistrict===state.subdistrict)&&(!state.landType||p.__land_type===state.landType)&&(!state.crop||p.__crop===state.crop)&&matchesDate(f); }
  function matchesBoundary(f,level){ const d=districtOf(f.properties),t=subdistrictOf(f.properties); return(!state.district||d===state.district)&&(!state.subdistrict||level!=='subdistrict'||t===state.subdistrict); }

  function renderBoundaries(){
    remove(shown.village);if(document.getElementById('lyr-village')?.checked&&raw.village)shown.village=L.geoJSON(raw.village,{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:3,color:'#fbbf24'}),onEachFeature:(f,l)=>l.bindTooltip(document.createTextNode(f.properties.nameTH))}).addTo(map);
    remove(shown.province); remove(shown.district); remove(shown.subdistrict);
    const showProv=document.getElementById('lyr-province')?.checked, showDist=document.getElementById('lyr-district')?.checked||!!state.district, showSub=document.getElementById('lyr-subdistrict')?.checked||!!state.subdistrict;
    if(showProv&&raw.district){
      // Province geometry is constant during this page's province context. Cache the
      // legacy district dissolve so changing filters does not recompute a large union.
      if(typeof AccessContext==='undefined'&&!raw.province?.features?.length&&window.turf?.dissolve){try{raw.province=turf.dissolve(raw.district);}catch{}}
      const fc=raw.province?.features?.length?raw.province:raw.district;
      shown.province=L.geoJSON(fc,{renderer:polygonRenderer,style:{color:'#f8fafc',weight:3,fillOpacity:0,opacity:1},interactive:false}).addTo(map);
    }
    if(showDist&&raw.district) shown.district=L.geoJSON({type:'FeatureCollection',features:raw.district.features.filter(f=>matchesBoundary(f,'district'))},{renderer:polygonRenderer,style:{color:'#22d3ee',weight:2.2,fillOpacity:.03},onEachFeature:(f,l)=>l.bindTooltip(`อ.${districtOf(f.properties)}`)}).addTo(map);
    if(showSub&&raw.subdistrict) shown.subdistrict=L.geoJSON({type:'FeatureCollection',features:raw.subdistrict.features.filter(f=>matchesBoundary(f,'subdistrict'))},{renderer:polygonRenderer,style:{color:'#e2e8f0',weight:1.1,fillOpacity:.02},onEachFeature:(f,l)=>l.bindTooltip(`ต.${subdistrictOf(f.properties)}`)}).addTo(map);
  }

  function highlightPointArea(feature){
    remove(shown.selectedArea);shown.selectedArea=null;
    const codes=DataLoader.areaCodes(feature.properties||{});
    const related=(raw.district?.features||[]).filter(f=>{const c=DataLoader.areaCodes(f.properties||{});return codes.districtCode&&c.districtCode===codes.districtCode&&c.provinceCode===codes.provinceCode;});
    if(related.length)shown.selectedArea=L.geoJSON({type:'FeatureCollection',features:related},{renderer:polygonRenderer,interactive:false,style:{color:'#f59e0b',weight:4,fillOpacity:.08}}).addTo(map);
  }
  function renderHotspots(){
    remove(shown.selectedArea);shown.selectedArea=null;
    Object.values(shown.hotspot).forEach(remove); shown.hotspot={};
    if(!hotspotEnabled()) return;
    const active=new Set(activeYears().map(String));
    Object.entries(raw.hotspot).forEach(([year,fc])=>{
      if(active.size && !active.has(String(year)))return;
      const filtered=(fc.features||[]).filter(matchesFeature), group=L.markerClusterGroup({disableClusteringAtZoom:11,chunkedLoading:true,chunkInterval:35,chunkDelay:30});
      L.geoJSON({type:'FeatureCollection',features:filtered},{pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5.5,fillColor:CONFIG.YEAR_COLORS[year]||'#ef4444',color:'#ffffff',weight:1.4,fillOpacity:.96}),onEachFeature:(f,l)=>{const popup=document.createElement('div');popup.style.whiteSpace='pre-line';popup.textContent=`Hotspot ปี ${year}\nวันที่ ${f.properties.__date||'-'}\nอ.${f.properties.__district||'-'} ต.${f.properties.__subdistrict||'-'}\nประเภทพื้นที่: ${f.properties.__land_type||'-'}\nชนิดพืช: ${f.properties.__crop||'-'}`;l.bindPopup(popup);l.on('click',()=>highlightPointArea(f));}}).addTo(group);
      group.addTo(map); shown.hotspot[year]=group;
    });
  }

  async function ensureAux(type){ if(raw[type])return; raw[type]=await (type==='crop'?DataLoader.loadCropByProvince():DataLoader.loadBurnscarByProvince());DataLoader.updateStatus(); }
  async function renderCrop(){ remove(shown.crop); if(!document.getElementById('lyr-crop')?.checked)return; await ensureAux('crop'); const fs=(raw.crop.features||[]).filter(f=>{const p=f.properties||{};return(!state.district||districtOf(p)===state.district)&&(!state.subdistrict||subdistrictOf(p)===state.subdistrict)&&(!state.crop||cropOf(p)===state.crop);}); shown.crop=L.geoJSON({type:'FeatureCollection',features:fs},{style:{color:'#16a34a',fillColor:'#22c55e',weight:.6,fillOpacity:.35},onEachFeature:(f,l)=>l.bindTooltip(cropOf(f.properties))}).addTo(map); }
  async function renderAux(type){
    remove(shown[type]);
    const checked=document.getElementById(type==='burnscar'?'lyr-burnscar':'lyr-risk')?.checked; if(!checked)return;
    if(type==='burnscar')await ensureAux(type);
    let collection, level='subdistrict';
    if(type==='risk'){
      level=state.district?'subdistrict':'district';
      collection=level==='district'?raw.riskDistrict:raw.riskSubdistrict;
    }else collection=raw[type];
    const fs=(collection?.features||[]).filter(f=>matchesBoundary(f,level));
    shown[type]=L.geoJSON({type:'FeatureCollection',features:fs},{
      renderer:polygonRenderer,
      style:type==='burnscar'?{color:'#dc2626',fillColor:'#ef4444',weight:.8,fillOpacity:.4}:f=>{const l=getRiskLevel(Number(f.properties?.risk_score||0));return{color:l.color,fillColor:l.color,weight:1.4,fillOpacity:.62};},
      onEachFeature:type==='risk'?(f,l)=>{
        const p=f.properties||{}, score=Number(p.risk_score||0), name=level==='district'?`อ.${districtOf(p)}`:`ต.${subdistrictOf(p)}`;
        l.bindTooltip(`${name}<br>คะแนน ${score.toFixed(1)} (${getRiskLevel(score).label})<br>ปี ${p.risk_years||'-'} | ${p.risk_period||'สะสมทั้งปี'}`);
      }:undefined
    }).addTo(map);
  }

  function applyFilter(next){
    state={district:clean(next.district),subdistrict:clean(next.subdistrict),landType:HSNormalizer.normalizeLandType(next.landType||'พื้นที่เกษตร'),crop:next.crop||'',months:Array.isArray(next.months)?next.months.map(Number).filter(Number.isFinite):(next.month?[Number(next.month)]:[]),month:String(next.month||''),day:String(next.day||''),startYM:Number(next.startYM)||null,endYM:Number(next.endYM)||null,startYear:Number(next.startYear)||null,startMonth:Number(next.startMonth)||null,endYear:Number(next.endYear)||null,endMonth:Number(next.endMonth)||null};
    computeDynamicRisk();
    raw.risk=state.district?raw.riskSubdistrict:raw.riskDistrict;
    renderBoundaries();renderHotspots();renderCrop();renderAux('burnscar');renderAux('risk');focusSelection();
  }
  function focusSelection(options={}){
    let src=null;
    if(state.subdistrict) src=raw.subdistrict.features.filter(f=>districtOf(f.properties)===state.district&&subdistrictOf(f.properties)===state.subdistrict);
    else if(state.district) src=raw.district.features.filter(f=>districtOf(f.properties)===state.district);
    const fitOptions={padding:options.padding||[20,20],animate:false};
    if(Number.isFinite(options.maxZoom)) fitOptions.maxZoom=options.maxZoom;
    if(src?.length) map.fitBounds(L.geoJSON({type:'FeatureCollection',features:src}).getBounds(),fitOptions);
    else zoomToProvince(options);
  }
  function zoomToProvince(options={}){
    const fitOptions={padding:options.padding||[20,20],animate:false};
    if(Number.isFinite(options.maxZoom)) fitOptions.maxZoom=options.maxZoom;
    if(raw.district?.features?.length) map.fitBounds(L.geoJSON(raw.district).getBounds(),fitOptions);
    else if(raw.province?.features?.length)map.fitBounds(L.geoJSON(raw.province).getBounds(),fitOptions);
    else map.setView(CONFIG.MAP_CENTER,CONFIG.MAP_ZOOM,{animate:false});
  }
  function getRiskLevel(score){ return CONFIG.RISK_LEVELS.find(x=>score>=x.min&&score<x.max)||CONFIG.RISK_LEVELS[0]; }
  function getRiskForScope(level){ return level==='district'?raw.riskDistrict:raw.riskSubdistrict; }

  function importHotspots(year,fc,provinceCodes=BoundaryStore.selectedCodes()){
    const y=String(year);
    const codes=[...new Set(provinceCodes)];if(!codes.length||codes.some(c=>!BoundaryStore.codes.includes(c)))throw new Error('จังหวัด HS ต้องมีชุดแผนที่นำเข้าแล้ว');
    const incoming=(fc?.features||[]).map(asPointFeature).map(f=>enrichFeature(f,Number(year)));if(incoming.some(f=>!codes.includes(DataLoader.areaCodes(f.properties).provinceCode)))throw new Error('ข้อมูล HS มีจังหวัดนอกขอบเขตนำเข้า');
    const previous=sessionImports[y]||{codes:[],features:[]};sessionImports[y]={codes:[...new Set([...previous.codes,...codes])],features:previous.features.filter(f=>!codes.includes(DataLoader.areaCodes(f.properties).provinceCode)).concat(incoming)};
    raw.hotspot[y]={type:'FeatureCollection',features:(raw.hotspot[y]?.features||[]).filter(f=>!codes.includes(DataLoader.areaCodes(f.properties).provinceCode)).concat(incoming.filter(f=>BoundaryStore.accepts(f.properties||{})))};
    DataLoader.recordHotspotImport(year,raw.hotspot[y].features.length);
    computeDynamicRisk(); renderHotspots(); renderAux('risk');
    return raw.hotspot[y];
  }

  function availableMonths(years=activeYears()){
    const set=new Set();years.forEach(y=>(raw.hotspot[y]?.features||[]).forEach(f=>{const m=datePartsOf(f).month;if(m)set.add(m);}));return[...set].sort((a,b)=>a-b);
  }
  function availableDays(years=activeYears(),months=selectedMonths()){
    const wanted=Array.isArray(months)?months.map(Number).filter(Number.isFinite):(months?[Number(months)]:[]),set=new Set();if(!wanted.length)return[];years.forEach(y=>(raw.hotspot[y]?.features||[]).forEach(f=>{const d=datePartsOf(f);if(wanted.includes(d.month)&&d.day)set.add(d.day);}));return[...set].sort((a,b)=>a-b);
  }
  function temporalState(){return{months:selectedMonths(),month:selectedMonths().join(','),day:String(state.day||''),startYM:state.startYM,endYM:state.endYM,startYear:state.startYear,startMonth:state.startMonth,endYear:state.endYear,endMonth:state.endMonth};}
    function importCustomGeoJSON(type, fc){
    if(!fc || !Array.isArray(fc.features)) throw new Error('ไฟล์ GeoJSON ไม่ถูกต้อง (ต้องมี FeatureCollection)');
    if(type === 'district'){
      raw.district = fc;
      if(raw.subdistrict) DataLoader.linkBoundaries(raw.district, raw.subdistrict);
      renderBoundaries(); zoomToProvince();
    } else if(type === 'subdistrict'){
      raw.subdistrict = fc;
      if(raw.district) DataLoader.linkBoundaries(raw.district, raw.subdistrict);
      renderBoundaries(); zoomToProvince();
    } else if(type === 'crop'){
      raw.crop = fc; renderAux('crop');
    } else if(type === 'burnscar'){
      raw.burnscar = fc; renderAux('burnscar');
    }
    computeDynamicRisk(); renderAux('risk');
    return { type, count: fc.features.length };
  }

  return { init,reloadData,applyFilter,focusSelection,zoomToProvince,zoomToKPT:zoomToProvince,getRiskLevel,getRiskForScope,getData:()=>raw,map:()=>map,activeYears,computeDynamicRisk,importHotspots,importCustomGeoJSON,availableMonths,availableDays,temporalState,helpers:{districtOf,subdistrictOf,cropOf,landOf,provinceOf,clean,normalizeCrop,annualEvidenceScore,datePartsOf,matchesDate} };
})();
