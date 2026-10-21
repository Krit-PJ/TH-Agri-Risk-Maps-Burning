'use strict';
const AccessContext=(()=>{
 let generation=0,current=null,selected='',activeAccount='',timer=null;const pending=new Set();
 const el=id=>document.getElementById(id);
 function clear(){generation++;for(const c of pending)c.abort();pending.clear();sessionStorage.removeItem('agri-risk-admin-session-v2');try{localStorage.removeItem('agri-v2-boundary-revision');}catch{}document.getElementById('app-body')?.setAttribute('hidden','');}
 function navigate(url){clear();location.assign(url);}
 async function fetchApi(route,options={}){
  const revision=generation,controller=new AbortController();pending.add(controller);const timeout=setTimeout(()=>controller.abort(),20000);
  const finish=()=>{clearTimeout(timeout);pending.delete(controller);};let response;
  try{response=await fetch('/api/v2/'+route,{...options,signal:controller.signal,cache:'no-store',headers:{...options.headers,'X-Agri-Province':selected}});if(activeAccount&&[401,428].includes(response.status)){clear();location.replace('/access.html'+(response.status===428?'#password':'#login'));}if(revision!==generation)throw new DOMException('Context changed','AbortError');}catch(e){finish();throw e;}
  const read=method=>async()=>{try{const value=await response[method]();if(revision!==generation)throw new DOMException('Context changed','AbortError');return value;}finally{finish();}};
  return{ok:response.ok,status:response.status,headers:response.headers,json:read('json'),arrayBuffer:read('arrayBuffer')};
 }
 function roleLabel(role){return{admin:'Admin รายจังหวัด',superadmin:'Super Admin',recorder:'ผู้บันทึกข้อมูล'}[role]||'ผู้ใช้ทั่วไป';}
 async function init(state){
  if(state.session?.mustChangePassword){navigate('/access.html#password');return false;}
  const areas=await V2.request('areas'),provinces=areas.provinces;activeAccount=state.session?.id||'';
  const slug=location.pathname.split('/').filter(Boolean).at(-1),pathProvince=provinces.find(p=>p.slug===slug);
  selected=state.session&&state.session.role!=='superadmin'?state.session.provinceCode:(pathProvince?.provinceCode||'');
  const header=document.getElementById('app-header')||document.body,bar=document.createElement('section');bar.id='access-area';bar.className='no-print';
  const label=document.createElement('label');label.textContent='จังหวัดหลัก ';const select=document.createElement('select');select.id='primary-province';select.setAttribute('aria-label','จังหวัดหลัก');
  select.add(new Option(state.session?.role==='superadmin'?'ประเทศไทย — เลือกจังหวัดเพื่อดูรายละเอียด':'-- เลือกจังหวัดก่อนแสดงข้อมูล --',''));
  for(const p of provinces)select.add(new Option(p.provinceNameTH,p.provinceCode));select.value=selected;select.disabled=!!state.session&&state.session.role!=='superadmin';label.append(select);bar.append(label);
  const sessionLabel=document.createElement('span');sessionLabel.textContent=state.session?(state.session.fullName||state.session.username)+' · '+roleLabel(state.session.role):'ผู้ใช้ทั่วไป';bar.append(sessionLabel);
  for(const [text,url] of [['ลงทะเบียน','/access.html#register'],[state.session?'บัญชี / จัดการผู้ใช้งาน':'เข้าใช้งานระบบ','/access.html#login']]){const link=document.createElement('a');link.textContent=text;link.href=state.session&&text==='บัญชี / จัดการผู้ใช้งาน'?'/access.html':url;bar.append(link);}
  const related=document.createElement('nav');related.setAttribute('aria-label','ระบบที่เกี่ยวข้อง');related.id='related-systems';for(const link of document.querySelectorAll('.partner-link'))related.append(link);bar.append(related);
  header.after(bar);const measure=()=>{document.documentElement.style.setProperty('--access-bar-h',bar.getBoundingClientRect().height+'px');if(typeof MapModule!=='undefined')MapModule.map()?.invalidateSize();};measure();if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(bar);
  select.onchange=()=>{const p=provinces.find(p=>p.provinceCode===select.value);navigate(p?'/'+p.slug+'/':'/');};
  el('btn-admin-login').textContent='เข้าใช้งานระบบ';
  if(!state.session&&!selected){el('province-data-status').textContent='กรุณาเลือกจังหวัดหลักก่อนแสดงข้อมูลหรือสรุปผล';document.getElementById('app-body')?.setAttribute('hidden','');for(const id of ['hotspot-timeline'])el(id)?.setAttribute('hidden','');el('btn-admin-login').onclick=()=>navigate('/access.html#login');el('btn-print').disabled=true;const subtitle=document.querySelector('[data-province-field="dashboardSubtitle"]');if(subtitle)subtitle.textContent='ระบบตรวจสอบจุดความร้อน · กรุณาเลือกจังหวัด';return false;}
  current=await V2.request('context');selected=current.provinceCode||'';
  if(current.public&&(!current.published||!current.publishedYears.length))el('lyr-risk').checked=false;
  if(state.session?.role!=='superadmin')state.setup.provinceCodes=[selected];else state.setup.provinceCodes=current.provinceCodes;
  if(state.session?.role==='admin'){const p=provinces.find(p=>p.provinceCode===selected);if(p&&location.pathname!=='/'+p.slug+'/')history.replaceState(null,'','/'+p.slug+'/');}
  const payload=await V2.request('boundaries'+(selected?'?provinceCode='+encodeURIComponent(selected):''));BoundaryStore.setServerContext(current,payload.layers,payload.warnings);
  if(payload.warnings.length){const warning=document.createElement('p');warning.id='access-boundary-status';warning.setAttribute('role','status');warning.textContent=payload.warnings.map(w=>w.provinceCode+' '+w.level+': '+w.message).slice(0,4).join(' · ');bar.after(warning);}
  el('btn-admin-login')?.addEventListener('click',event=>{event.stopImmediatePropagation();navigate('/access.html#login');},true);
  el('btn-admin-logout')?.addEventListener('click',async event=>{event.stopImmediatePropagation();try{await V2.logout();}finally{navigate('/');}},true);
  const verify=async()=>{try{const s=await V2.status();if((s.session?.id||'')!==activeAccount){navigate('/');}}catch{clear();location.replace('/access.html#login');}};
  timer=setInterval(verify,30000);window.addEventListener('storage',event=>{if(event.key==='agri-auth-epoch'){clear();location.replace('/');}});window.addEventListener('pagehide',()=>{clearInterval(timer);clear();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)verify();});return true;
 }
 function bind(state){
  if(!current)return;const role=state.session?.role;
  document.body.classList.remove('access-loading');
  const manager=['admin','superadmin'].includes(role),writer=manager||role==='recorder';
  const topLogin=el('btn-admin-login'),topLogout=el('btn-admin-logout');if(topLogin){topLogin.textContent='เข้าใช้งานระบบ';topLogin.classList.toggle('hidden',!!role);}if(topLogout){topLogout.classList.toggle('hidden',!role);topLogout.textContent=(state.session?.fullName||state.session?.username||'')+' · ออกจากระบบ';}
  for(const id of ['excel-import-section']){const node=el(id);if(node)node.classList.toggle('hidden',!writer);}
  for(const selector of ['#admin-map-group','#guide-visibility-section','#map-import-section']){const node=document.querySelector(selector);if(node)node.hidden=!manager;}
  const mapImport=el('map-import-section');if(mapImport)mapImport.hidden=true; // Installed boundaries are authoritative; local IDB import cannot override server scope.
  const quick=el('quick-province-select');if(quick){quick.disabled=true;quick.title='ใช้ตัวเลือกจังหวัดหลักด้านบน';}
  const oldFirstRun=el('province-setup');if(oldFirstRun)oldFirstRun.remove();
  const importTargets=el('hotspot-import-provinces');if(importTargets&&role!=='superadmin'){importTargets.multiple=false;importTargets.value=current.provinceCode;importTargets.disabled=true;}
  const filter=document.createElement('label');filter.textContent='จังหวัด ';const locked=document.createElement('input');locked.id='filter-province';locked.readOnly=true;locked.value=current.provinceNameTH;filter.append(locked);el('filter-district')?.parentElement.before(filter);
  const google=el('v2-controls');if(google)google.classList.toggle('hidden',role!=='superadmin');
  if(!current.provinceCode){document.body.classList.add('access-no-timeline');document.getElementById('right-panel')?.setAttribute('hidden','');el('hotspot-timeline')?.setAttribute('hidden','');el('province-data-status').textContent='ประเทศไทย · แสดงเฉพาะขอบเขตจังหวัด เลือกจังหวัดหลักเพื่อโหลดข้อมูลรายละเอียดและสรุปผล';}
  if(current.public&&(!current.published||!current.publishedYears.length)){document.body.classList.add('access-no-timeline');document.getElementById('right-panel')?.setAttribute('hidden','');el('hotspot-timeline')?.setAttribute('hidden','');el('province-data-status').textContent=current.provinceNameTH+' · ยังไม่มีชุด HS ที่อนุญาตให้เผยแพร่ ไม่ใช่ผลตรวจว่าพบ 0 จุด';el('lyr-risk').disabled=true;el('btn-print').disabled=true;}
 }
 return{init,bind,fetchApi,clear,navigate,roleLabel,get current(){return current;},get province(){return selected;},get generation(){return generation;}};
})();
