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
  fetch('config/public-runtime.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).then(value=>{runtime=value||{};}).catch(()=>{});
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
