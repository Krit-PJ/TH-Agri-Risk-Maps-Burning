/* Public Pages adapter: bundled data is read-only; account work lives in Apps Script. */
(() => {
  const originalInit=BoundaryStore.init;
  BoundaryStore.init=async function publicBoundaryInit(){
    const p=ConfigLoader.active;
    if(!p?.provinceCode)return originalInit();
    const read=async path=>{const response=await fetch(ConfigLoader.resolvePath(path));if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);return response.json();};
    const [province,district,subdistrict]=await Promise.all([read(p.boundaryPath.province),read(p.boundaryPath.district),read(p.boundaryPath.subdistrict)]);
    BoundaryStore.setServerContext({provinceCode:p.provinceCode,provinceCodes:[p.provinceCode]},{province,district,subdistrict,village:{type:'FeatureCollection',features:[]}});
  };

  let runtime={};
  const runtimeReady=fetch('config/public-runtime.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).then(value=>(runtime=value||{})).catch(()=>(runtime={}));
  const jsonp=(action,params={})=>runtimeReady.then(()=>new Promise((resolve,reject)=>{
    if(!runtime.appsScriptWebAppUrl)return reject(new Error('ยังไม่ได้ตั้งค่า Public API'));
    const callback='agriJsonp_'+crypto.randomUUID().replace(/-/g,''),script=document.createElement('script'),timer=setTimeout(()=>finish(new Error('Public API timeout')),12000);
    const finish=(error,value)=>{clearTimeout(timer);delete window[callback];script.remove();error?reject(error):resolve(value);};
    window[callback]=value=>finish(null,value);
    script.onerror=()=>finish(new Error('Public API unavailable'));
    const query=new URLSearchParams({...params,action,callback});script.src=runtime.appsScriptWebAppUrl+'?'+query;document.head.append(script);
  }));

  const bundledHotspots=DataLoader.loadHotspotByProvince;
  DataLoader.loadHotspotByProvince=async year=>{
    const bundled=await bundledHotspots(year),code=ConfigLoader.active?.provinceCode;
    if(!code)return bundled;
    try{
      const remote=await jsonp('hotspots',{provinceCode:code});
      if(remote?.type!=='FeatureCollection')return bundled;
      const features=[...(bundled.features||[])],seen=new Set(features.map(f=>`${f.properties?.hotspotId||''}|${f.properties?.date||''}|${f.geometry?.coordinates?.join(',')||''}`));
      for(const feature of remote.features||[]){if(String(feature.properties?.date||'').slice(0,4)!==String(Number(year)-543)&&String(feature.properties?.date||'').slice(0,4)!==String(year))continue;const key=`${feature.properties?.hotspotId||''}|${feature.properties?.date||''}|${feature.geometry?.coordinates?.join(',')||''}`;if(!seen.has(key)){seen.add(key);features.push(feature);}}
      return{type:'FeatureCollection',features};
    }catch(error){console.warn('[Public API fallback]',error.message);return bundled;}
  };
  window.AgriPublicApi={catalog:()=>jsonp('catalog'),hotspots:provinceCode=>jsonp('hotspots',{provinceCode})};
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('#btn-admin-login');
    if(!trigger)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(runtime.appsScriptWebAppUrl)window.open(runtime.appsScriptWebAppUrl,'_blank','noopener');
    else alert('ระบบลงทะเบียนและผู้ดูแลกำลังติดตั้ง กรุณาลองใหม่อีกครั้ง');
  },true);
  document.getElementById('admin-modal')?.remove();
  document.querySelectorAll('.admin-only').forEach(el=>el.remove());
})();
