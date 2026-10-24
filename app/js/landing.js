(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const paths={catalog:'app/data/catalog.json',provinces:'app/config/provinces.json',boundary:'app/data/boundary/provinces.geojson',runtime:'app/config/public-runtime.json'};
  const formatNumber=value=>new Intl.NumberFormat('th-TH').format(Number(value)||0);

  function setFontSize(size){
    const scales={small:.9,medium:1,large:1.15};
    if(!scales[size])size='medium';
    document.documentElement.style.setProperty('--font-scale',scales[size]);
    document.querySelectorAll('[data-font-size]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.fontSize===size)));
    try{localStorage.setItem('agri-font-size',size)}catch(_error){}
  }

  function loadDynamicCatalog(url){
    return new Promise(resolve=>{
      if(!url)return resolve(null);
      const callback='agriCatalog_'+Math.random().toString(36).slice(2),script=document.createElement('script');
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();resolve(value&&value.ok?value:null)};
      const timer=setTimeout(()=>finish(null),8000);
      window[callback]=finish;script.onerror=()=>finish(null);
      script.src=url+'?'+new URLSearchParams({action:'catalog',callback});document.head.append(script);
    });
  }

  function initMap(boundary,active,provinceByCode,onSelect){
    const host=$('national-map'),width=720,height=700,padding=20,coordinates=[];
    const collect=value=>{if(typeof value?.[0]==='number')coordinates.push(value);else(value||[]).forEach(collect)};boundary.features.forEach(feature=>collect(feature.geometry.coordinates));
    const longitudes=coordinates.map(point=>point[0]),latitudes=coordinates.map(point=>point[1]),minLon=Math.min(...longitudes),maxLon=Math.max(...longitudes),minLat=Math.min(...latitudes),maxLat=Math.max(...latitudes),cos=Math.cos((minLat+maxLat)/2*Math.PI/180),scale=Math.min((width-padding*2)/((maxLon-minLon)*cos),(height-padding*2)/(maxLat-minLat)),offsetX=(width-(maxLon-minLon)*cos*scale)/2,offsetY=(height-(maxLat-minLat)*scale)/2;
    const project=point=>[offsetX+(point[0]-minLon)*cos*scale,offsetY+(maxLat-point[1])*scale],ringPath=ring=>ring.map((point,index)=>`${index?'L':'M'}${project(point).map(value=>value.toFixed(1)).join(' ')}`).join('')+'Z',geometryPath=geometry=>geometry.type==='Polygon'?geometry.coordinates.map(ringPath).join(''):geometry.coordinates.flatMap(polygon=>polygon.map(ringPath)).join('');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','ขอบเขต 77 จังหวัดของประเทศไทย');
    boundary.features.forEach(feature=>{const code=String(feature.properties.provinceCode||feature.properties.areaCode||''),province=provinceByCode.get(code),name=province?.provinceNameTH||feature.properties.nameTH||code,enabled=active.has(code),shape=document.createElementNS(svg.namespaceURI,'path'),title=document.createElementNS(svg.namespaceURI,'title');shape.setAttribute('d',geometryPath(feature.geometry));shape.setAttribute('class','province-shape'+(enabled?' is-active':''));shape.dataset.provinceCode=code;title.textContent=name;shape.append(title);if(enabled){shape.setAttribute('tabindex','0');shape.setAttribute('role','button');shape.setAttribute('aria-label',`เปิดข้อมูลจังหวัด${name}`);shape.addEventListener('click',()=>onSelect(code));shape.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(code)}})}svg.append(shape)});
    host.replaceChildren(svg);
  }

  async function start(){
    document.querySelectorAll('[data-font-size]').forEach(button=>button.addEventListener('click',()=>setFontSize(button.dataset.fontSize)));
    let saved='medium';try{saved=localStorage.getItem('agri-font-size')||saved}catch(_error){}setFontSize(saved);
    const [catalog,provinces,boundary,runtime]=await Promise.all(Object.values(paths).map(path=>fetch(path).then(response=>{if(!response.ok)throw new Error(path);return response.json()})));
    const dynamic=await loadDynamicCatalog(runtime.appsScriptWebAppUrl),active=new Set((catalog.activeProvinceCodes||[]).map(String));
    (dynamic&&dynamic.activeProvinceCodes||[]).forEach(code=>active.add(String(code)));
    const provinceByCode=new Map(provinces.map(province=>[String(province.provinceCode),province])),select=$('province-select'),open=$('open-map'),status=$('province-status');
    select.replaceChildren(new Option('เลือกจังหวัด',''));
    [...active].sort((a,b)=>(provinceByCode.get(a)?.provinceNameTH||a).localeCompare(provinceByCode.get(b)?.provinceNameTH||b,'th')).forEach(code=>{const province=provinceByCode.get(code);if(province)select.add(new Option(province.provinceNameTH,code))});
    const counts={...(catalog.hotspotCounts||{}),...((dynamic&&dynamic.hotspotCounts)||{})};
    const selectProvince=code=>{if(!active.has(String(code)))return;select.value=String(code);open.href='app/?province='+encodeURIComponent(code);open.setAttribute('aria-disabled','false');const province=provinceByCode.get(String(code));status.textContent=`เลือก ${province?.provinceNameTH||code} · มีข้อมูล ${formatNumber(counts[code])} จุด`;select.focus()};
    select.disabled=active.size===0;select.addEventListener('change',()=>select.value?selectProvince(select.value):(open.setAttribute('aria-disabled','true'),status.textContent='กรุณาเลือกจังหวัดที่ต้องการดูข้อมูล'));
    $('active-count').textContent=formatNumber(active.size);$('hs-count').textContent=formatNumber(Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0));
    status.textContent=active.size?`พร้อมใช้งาน ${formatNumber(active.size)} จังหวัด · จังหวัดอื่นจะเปิดเมื่อมีข้อมูลผ่านการเผยแพร่`:'ยังไม่มีจังหวัดที่มีข้อมูลผ่านการเผยแพร่';
    const staff=$('staff-app');if(runtime.appsScriptWebAppUrl){staff.href=runtime.appsScriptWebAppUrl;staff.target='_blank';staff.rel='noopener noreferrer';staff.setAttribute('aria-disabled','false')}
    initMap(boundary,active,provinceByCode,selectProvince);
  }
  start().catch(error=>{console.error(error);$('province-status').textContent='ไม่สามารถโหลดข้อมูลแผนที่ได้ กรุณาลองใหม่อีกครั้ง';$('province-select').disabled=true});
})();
