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

  function jsonp(url,action,params={},timeout=10000){
    return new Promise(resolve=>{
      if(!url)return resolve(null);
      const callback='agriPublic_'+crypto.randomUUID().replace(/-/g,''),script=document.createElement('script');
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();resolve(value&&value.ok!==false?value:null)};
      const timer=setTimeout(()=>finish(null),timeout);
      window[callback]=finish;script.onerror=()=>finish(null);
      script.src=url+'?'+new URLSearchParams({action,callback,...params});document.head.append(script);
    });
  }

  function initMap(boundary,active,provinceByCode,onSelect){
    if(typeof L==='undefined')throw new Error('Leaflet unavailable');
    const map=L.map('national-map',{zoomControl:true,minZoom:5,maxZoom:12,zoomSnap:.25,scrollWheelZoom:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,opacity:.88,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const layer=L.geoJSON(boundary,{
      style:feature=>{const code=String(feature.properties.provinceCode||feature.properties.areaCode||''),enabled=active.has(code);return{color:enabled?'#2563eb':'#64748b',weight:enabled?1.8:1,fillColor:enabled?'#60a5fa':'#cbd5e1',fillOpacity:enabled?.24:.11,opacity:enabled?.95:.68};},
      onEachFeature:(feature,shape)=>{
        const code=String(feature.properties.provinceCode||feature.properties.areaCode||''),province=provinceByCode.get(code),name=province?.provinceNameTH||feature.properties.nameTH||code,enabled=active.has(code);
        shape.bindTooltip(`${name}${enabled?' · มีข้อมูล HS':' · ยังไม่มีข้อมูล HS'}`,{sticky:true,direction:'top'});
        if(!enabled)return;
        shape.on({click:()=>onSelect(code),mouseover:event=>event.target.setStyle({weight:3,fillOpacity:.38,color:'#1d4ed8'}),mouseout:event=>layer.resetStyle(event.target)});
      }
    }).addTo(map);
    map.fitBounds(layer.getBounds(),{padding:[20,20]});
    L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
    return map;
  }

  async function start(){
    document.querySelectorAll('[data-font-size]').forEach(button=>button.addEventListener('click',()=>setFontSize(button.dataset.fontSize)));
    let saved='medium';try{saved=localStorage.getItem('agri-font-size')||saved}catch(_error){}setFontSize(saved);
    $('copyright-year').textContent=String(new Date().getFullYear()+543);
    const [catalog,provinces,boundary,runtime]=await Promise.all(Object.values(paths).map(path=>fetch(path).then(response=>{if(!response.ok)throw new Error(path);return response.json()})));
    const dynamic=await jsonp(runtime.appsScriptWebAppUrl,'catalog'),active=new Set((catalog.activeProvinceCodes||[]).map(String));
    (dynamic&&dynamic.activeProvinceCodes||[]).forEach(code=>active.add(String(code)));
    const provinceByCode=new Map(provinces.map(province=>[String(province.provinceCode),province])),select=$('province-select'),open=$('open-map'),status=$('province-status');
    select.replaceChildren(new Option('เลือกจังหวัดที่มีข้อมูล HS',''));
    [...active].sort((a,b)=>(provinceByCode.get(a)?.provinceNameTH||a).localeCompare(provinceByCode.get(b)?.provinceNameTH||b,'th')).forEach(code=>{const province=provinceByCode.get(code);if(province)select.add(new Option(province.provinceNameTH,code))});
    const counts={...(catalog.hotspotCounts||{}),...((dynamic&&dynamic.hotspotCounts)||{})};
    const selectProvince=code=>{code=String(code);if(!active.has(code))return;select.value=code;open.href='app/?province='+encodeURIComponent(code);open.setAttribute('aria-disabled','false');const province=provinceByCode.get(code);status.textContent=`จังหวัด${province?.provinceNameTH||code} · ข้อมูล HS ${formatNumber(counts[code])} จุด · พร้อมเปิดผลประเมินและรายงาน`;};
    select.disabled=active.size===0;select.addEventListener('change',()=>select.value?selectProvince(select.value):(open.setAttribute('aria-disabled','true'),status.textContent='กรุณาเลือกจังหวัดที่ต้องการดูข้อมูล'));
    $('active-count').textContent=formatNumber(active.size);$('hs-count').textContent=formatNumber(Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0));
    status.textContent=active.size?`พร้อมใช้งาน ${formatNumber(active.size)} จังหวัด · รายการจะแสดงเฉพาะจังหวัดที่มีข้อมูล HS`:'ยังไม่มีจังหวัดที่มีข้อมูล HS ผ่านการเผยแพร่';
    const staff=$('staff-app');if(runtime.appsScriptWebAppUrl){staff.href=runtime.appsScriptWebAppUrl+'#login';staff.target='_blank';staff.rel='noopener noreferrer';staff.setAttribute('aria-disabled','false')}
    initMap(boundary,active,provinceByCode,selectProvince);
    const counter=await jsonp(runtime.appsScriptWebAppUrl,'visit',{page:'public-home'});
    $('visitor-count').textContent=counter&&Number.isFinite(Number(counter.count))?formatNumber(counter.count):'ไม่สามารถเชื่อมต่อตัวนับ';
  }
  start().catch(error=>{console.error(error);$('province-status').textContent='ไม่สามารถโหลดข้อมูลแผนที่ได้ กรุณาลองใหม่อีกครั้ง';$('province-select').disabled=true;$('visitor-count').textContent='ไม่สามารถเชื่อมต่อตัวนับ';});
})();
