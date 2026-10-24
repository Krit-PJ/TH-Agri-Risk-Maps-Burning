const App=(()=>{
  let subdistrictFeatures=[];
  let lastImported=null;
  let lastQA=null;
  let lastBoundaryAttempt=null;
  let appliedPeriodRange=null;
  const ADMIN_SESSION_KEY='agri-risk-admin-session-v2';
  const ADMIN_SESSION_MINUTES=30;
  const GUIDE_VISIBLE_KEY='agri-risk-guide-visible';

  async function init(){
    const setup=await ConfigLoader.load();
    await BoundaryStore.init();
    if(typeof V2!=='undefined'&&!await V2.init())return;
    ProvinceContext.applyProvinceContext();
    const loaded=await MapModule.init();
    subdistrictFeatures=loaded.subdistrict?.features||[];
    populateDistricts();
    try{Dashboard.init();Dashboard.setData(loaded.hotspot);}catch(err){console.error('[Dashboard] initialization failed:',err);showRuntimeWarning('กราฟโหลดไม่สำเร็จ แต่แผนที่และตัวกรองยังใช้งานได้');}
    if(typeof V2!=='undefined')await V2.restore();
    bindFilters();bindPrint();initFontSize();initAdminAccess();bindExcelImport();bindGeoJSONImport();initProvincePickers();initDesktopSidebarToggle();initMobilePanels();initTimeline();syncYearSelector();populateDayOptions();syncTimelineUI();applyCurrent();
    if(typeof V2!=='undefined')V2.bind();
    if(typeof AccessContext==='undefined'&&!BoundaryStore.codes.length&&document.getElementById('province-setup')){const d=document.getElementById('province-setup');document.getElementById('first-run-view').onclick=()=>d.close();d.showModal();}
  }
  function initFontSize(){
    const values={small:'14px',medium:'15px',large:'17px'};
    let selected='medium';try{selected=localStorage.getItem('agri-app-font-size')||selected;}catch{}
    const apply=size=>{if(!values[size])size='medium';document.documentElement.style.setProperty('--ui-font-size',values[size]);document.querySelectorAll('[data-app-font]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appFont===size)));try{localStorage.setItem('agri-app-font-size',size);}catch{}};
    document.querySelectorAll('[data-app-font]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.appFont)));apply(selected);
  }
  function showRuntimeWarning(message){let el=document.getElementById('runtime-warning');if(!el){el=document.createElement('div');el.id='runtime-warning';el.style.cssText='position:fixed;left:50%;top:86px;transform:translateX(-50%);z-index:9999;background:#7f1d1d;color:white;padding:8px 14px;border-radius:6px;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,.35)';document.body.appendChild(el);}el.textContent=message;}
  function populateDistricts(){const sel=document.getElementById('filter-district'),current=sel.value;const districts=[...new Set(subdistrictFeatures.map(f=>MapModule.helpers.districtOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML='<option value="">-- ทั้งหมด --</option>'+districts.map(x=>`<option value="${x}">${x}</option>`).join('');sel.value=current;}
  function populateSubdistricts(){const d=document.getElementById('filter-district').value,sel=document.getElementById('filter-subdistrict');const names=[...new Set(subdistrictFeatures.filter(f=>MapModule.helpers.districtOf(f.properties)===d).map(f=>MapModule.helpers.subdistrictOf(f.properties)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));sel.innerHTML=d?'<option value="">-- ทุกตำบล --</option>'+names.map(x=>`<option value="${x}">${x}</option>`).join(''):'<option value="">-- เลือกอำเภอก่อน --</option>';sel.disabled=!d;}
  const MONTH_SHORT=['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const MONTH_FULL=['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const ymIndex=(year,month)=>Number(year)*12+Number(month);
  const ymFromIndex=i=>({year:Math.floor((Number(i)-1)/12),month:((Number(i)-1)%12)+1});
  function availableYears(){
    const fromConfig=(document.getElementById('timeline-year')?.dataset.years||Object.keys(CONFIG.DATA.hotspot).join(',')).split(',').map(x=>Number(x.trim())).filter(Number.isFinite);
    const fromData=Object.keys(MapModule.getData?.().hotspot||{}).map(Number).filter(Number.isFinite);
    return [...new Set([...fromConfig,...fromData])].sort((a,b)=>a-b);
  }
  function fillPeriodSelects(){
    const years=availableYears();
    const months=Array.from({length:12},(_,i)=>i+1);
    ['range-start-month','range-end-month'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.options.length)el.innerHTML=months.map(m=>`<option value="${m}">${MONTH_SHORT[m]}</option>`).join('');});
    ['range-start-year','range-end-year'].forEach(id=>{const el=document.getElementById(id);if(el){const current=el.value,existing=new Set(Array.from(el.options).map(o=>Number(o.value)));if(!el.options.length)el.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');else years.filter(y=>!existing.has(y)).forEach(y=>el.add(new Option(String(y),String(y))));if(current)el.value=current;}});
  }
  function latestYM(){
    let max=-Infinity;
    const raw=MapModule.getData?.().hotspot||{};
    Object.entries(raw).forEach(([year,fc])=>(fc.features||[]).forEach(f=>{const d=MapModule.helpers.datePartsOf(f);const y=Number(f.properties?.year_be||year);if(y&&d.month)max=Math.max(max,ymIndex(y,d.month));}));
    if(Number.isFinite(max))return ymFromIndex(max);
    return {year:Number(CONFIG.CURRENT_YEAR_BE||2569),month:12};
  }
  function setPeriodRange(startYear,startMonth,endYear,endMonth){
    fillPeriodSelects();
    const sm=document.getElementById('range-start-month'),sy=document.getElementById('range-start-year'),em=document.getElementById('range-end-month'),ey=document.getElementById('range-end-year');
    if(sy)sy.value=String(startYear); if(sm)sm.value=String(startMonth); if(ey)ey.value=String(endYear); if(em)em.value=String(endMonth);
    normalizePeriodRange();
    syncYearSelector();syncTimelineUI();
  }
  function setLatestPeriod(){
    const latest=latestYM();
    // Default cumulative HS period: October of the previous year through the latest available data month.
    // Example: latest data May 2569 => default range Oct 2568–May 2569.
    const p=ProvinceContext.get(),month=p.defaultPeriodMode==='calendar-to-latest'?1:p.fiscalYearStartMonth;
    const startYear=Number(latest.year)-(latest.month<month?1:0);
    setPeriodRange(startYear,month,latest.year,latest.month);
  }
  function selectedRange(){
    fillPeriodSelects();
    const sy=Number(document.getElementById('range-start-year')?.value||CONFIG.CURRENT_YEAR_BE||2569);
    const sm=Number(document.getElementById('range-start-month')?.value||1);
    const ey=Number(document.getElementById('range-end-year')?.value||sy);
    const em=Number(document.getElementById('range-end-month')?.value||sm);
    let startYM=ymIndex(sy,sm),endYM=ymIndex(ey,em);
    if(startYM>endYM){const tmp=startYM;startYM=endYM;endYM=tmp;}
    const a=ymFromIndex(startYM),b=ymFromIndex(endYM);
    return {startYear:a.year,startMonth:a.month,endYear:b.year,endMonth:b.month,startYM,endYM};
  }
  function cloneRange(r){return r?{startYear:r.startYear,startMonth:r.startMonth,endYear:r.endYear,endMonth:r.endMonth,startYM:r.startYM,endYM:r.endYM}:null;}
  function activeRange(){return cloneRange(appliedPeriodRange)||selectedRange();}
  function normalizePeriodRange(){
    const r=selectedRange();
    const sy=document.getElementById('range-start-year'),sm=document.getElementById('range-start-month'),ey=document.getElementById('range-end-year'),em=document.getElementById('range-end-month');
    if(sy)sy.value=String(r.startYear);if(sm)sm.value=String(r.startMonth);if(ey)ey.value=String(r.endYear);if(em)em.value=String(r.endMonth);
  }
  function selectedMonths(){
    const r=selectedRange();
    if(r.startYear===r.endYear){const out=[];for(let m=r.startMonth;m<=r.endMonth;m++)out.push(m);return out;}
    return [];
  }
  function current(){const r=activeRange();return{
    district:document.getElementById('filter-district').value,
    subdistrict:document.getElementById('filter-subdistrict').value,
    crop:document.getElementById('filter-crop').value,
    months:selectedMonths(),
    day:document.getElementById('filter-day')?.value||'',
    startYear:r.startYear,startMonth:r.startMonth,endYear:r.endYear,endMonth:r.endMonth,startYM:r.startYM,endYM:r.endYM
  };}
  function selectedYear(){return String(activeRange().endYear||CONFIG.CURRENT_YEAR_BE||2569);}
  function ensureYearDropdown(){fillPeriodSelects();}
  function activeRangeYears(){const r=activeRange(),out=[];for(let y=r.startYear;y<=r.endYear;y++)out.push(y);return out;}
  function syncYearSelector(){
    ensureYearDropdown();
    const r=activeRange();
    const active=new Set(activeRangeYears().map(String));
    const hidden=document.getElementById('filter-year');if(hidden)hidden.value=String(r.endYear);
    const timelineYear=document.getElementById('timeline-year');if(timelineYear)timelineYear.value=String(r.endYear);
    document.querySelectorAll('.hs-layer').forEach(cb=>{cb.checked=active.has(String(cb.dataset.year));});
    const chip=document.getElementById('selected-year-display');if(chip)chip.textContent=`ช่วงข้อมูล ${periodText(r)}`;
  }
  function applyYearSelector(){
    normalizePeriodRange();
    const pending=selectedRange();
    const btn=document.getElementById('btn-latest-period');
    if(btn)btn.classList.add('period-pending');
    const status=document.getElementById('timeline-status');
    if(status)status.textContent=`เลือกช่วง ${periodText(pending)} แล้ว · กดแสดงข้อมูลเพื่อใช้ช่วงนี้`;
  }
  function populateDayOptions(){
    const daySel=document.getElementById('filter-day');if(!daySel)return;
    daySel.innerHTML='<option value="">-- ไม่ใช้ตัวกรองวันที่ --</option>';daySel.disabled=true;daySel.value='';
  }
  function initTimeline(){
    fillPeriodSelects();setLatestPeriod();appliedPeriodRange=selectedRange();syncYearSelector();
    ['range-start-month','range-start-year','range-end-month','range-end-year'].forEach(id=>document.getElementById(id)?.addEventListener('change',applyYearSelector));
    document.getElementById('btn-latest-period')?.addEventListener('click',()=>{normalizePeriodRange();appliedPeriodRange=selectedRange();const btn=document.getElementById('btn-latest-period');if(btn)btn.classList.remove('period-pending');syncYearSelector();populateDayOptions();syncTimelineUI();applyCurrent();document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears(),source:'apply-period-range'}}));});
  }
  function periodText(r=activeRange()){
    const a=`${MONTH_SHORT[r.startMonth]} ${r.startYear}`;
    const b=`${MONTH_SHORT[r.endMonth]} ${r.endYear}`;
    return r.startYM===r.endYM?a:`${a} ถึง ${b}`;
  }
  function monthText(){return periodText();}
  function syncTimelineUI(){
    const r=activeRange();syncYearSelector();
    const status=document.getElementById('timeline-status');if(status)status.textContent=`จุดความร้อนสะสม: ${periodText(r)}`;
    const chip=document.getElementById('selected-year-display');if(chip)chip.textContent=`ช่วงข้อมูล ${periodText(r)}`;
    updatePrintMeta();
  }
  function scopeText(){
    const d=document.getElementById('filter-district')?.value||'';
    const t=document.getElementById('filter-subdistrict')?.value||'';
    if(t&&d)return `ตำบล${t} อำเภอ${d}`;
    if(d)return `อำเภอ${d}`;
    return ProvinceContext.label();
  }
  function updatePrintMeta(){
    const r=activeRange();
    const period=`ช่วงข้อมูลจุดความร้อนสะสม: ${periodText(r)}`;
    const printSummary=document.getElementById('print-filter-summary');if(printSummary)printSummary.textContent=period;
    const printScope=document.getElementById('print-scope');if(printScope)printScope.textContent=`ขอบเขต: ${scopeText()}`;
    const printDate=document.getElementById('print-date');if(printDate)printDate.textContent='วันที่พิมพ์รายงาน: '+new Date().toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'});
    const updated=document.getElementById('last-updated')?.textContent||'';
    const printUpdated=document.getElementById('print-data-updated');if(printUpdated)printUpdated.textContent=updated||'ข้อมูลล่าสุด: -';
  }
  function applyCurrent(){const s=current();syncTimelineUI();MapModule.applyFilter(s);try{Dashboard.applyFilter(s);}catch(err){console.warn('[Dashboard] filter skipped:',err.message);}}
  function bindFilters(){
    const d=document.getElementById('filter-district'),t=document.getElementById('filter-subdistrict'),c=document.getElementById('filter-crop'),cropLayer=document.getElementById('lyr-crop');
    const day=document.getElementById('filter-day');
    d.addEventListener('change',()=>{populateSubdistricts();applyCurrent();});t.addEventListener('change',applyCurrent);c.addEventListener('change',applyCurrent);
    day?.addEventListener('change',()=>{syncTimelineUI();applyCurrent();});
    document.addEventListener('change',e=>{if(e.target?.classList?.contains('hs-layer')){syncYearSelector();populateDayOptions();}});
    cropLayer.addEventListener('change',()=>{c.disabled=!cropLayer.checked;if(!cropLayer.checked)c.value='';applyCurrent();});
    document.getElementById('btn-apply-filter').addEventListener('click',applyCurrent);
    document.getElementById('btn-reset-filter')?.addEventListener('click',()=>resetFilters());
  }
  function resetFilters(){
    const d=document.getElementById('filter-district'),t=document.getElementById('filter-subdistrict'),c=document.getElementById('filter-crop');
    if(d)d.value='';populateSubdistricts();
    if(t){t.value='';t.disabled=true;t.innerHTML='<option value="">-- เลือกอำเภอก่อน --</option>';}
    if(c)c.value='';
    const cropLayer=document.getElementById('lyr-crop');
    if(cropLayer&&!cropLayer.checked&&c)c.disabled=true;
    setLatestPeriod();
    const day=document.getElementById('filter-day');
    if(day){day.value='';day.disabled=true;day.innerHTML='<option value="">-- ไม่ใช้ตัวกรองวันที่ --</option>';}
    syncYearSelector();syncTimelineUI();applyCurrent();
    document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears(),source:'reset'}}));
    document.dispatchEvent(new CustomEvent('agri-risk:filter-change',{detail:{source:'reset'}}));
  }

  function bindPrint(){
    const prepare=()=>{
      updatePrintMeta();
      document.body.classList.add('print-preparing');
      try{Dashboard.setPrintMode?.(true);}catch(err){console.warn('[Print] chart contrast:',err.message);}
      const refit=()=>{
        const map=MapModule.map?.();
        if(!map)return;
        map.invalidateSize({pan:false});
        // Fit the selected province/district/subdistrict after the print-sized map container is applied.
        // Larger padding prevents the selected boundary from being clipped in A4 landscape output.
        MapModule.focusSelection?.({padding:[70,70],maxZoom:10});
      };
      requestAnimationFrame(refit);
      [180,420,850,1200].forEach(ms=>setTimeout(refit,ms));
    };
    const restore=()=>{
      document.body.classList.remove('print-preparing');
      try{Dashboard.setPrintMode?.(false);}catch(err){console.warn('[Print] chart restore:',err.message);}
      setTimeout(()=>{MapModule.map()?.invalidateSize({pan:false});MapModule.focusSelection?.({padding:[20,20]});},180);
    };
    window.addEventListener('beforeprint',prepare);
    window.addEventListener('afterprint',restore);
    document.getElementById('btn-print')?.addEventListener('click',()=>{prepare();setTimeout(()=>{
      try{window.print();}finally{
        // Embedded browsers may not emit afterprint. Recover the dashboard after
        // print() returns, while allowing active print media to retain its layout.
        setTimeout(()=>{if(!window.matchMedia?.('print').matches)restore();},1500);
      }
    },850);});
  }

  function initAdminAccess(){
    const loginBtn=document.getElementById('btn-admin-login');
    const logoutBtn=document.getElementById('btn-admin-logout');
    const modal=document.getElementById('admin-modal');
    const closeBtn=document.getElementById('admin-modal-close');
    const cancelBtn=document.getElementById('admin-cancel');
    const form=document.getElementById('admin-login-form');
    loginBtn?.addEventListener('click',()=>openAdminModal());
    logoutBtn?.addEventListener('click',adminLogout);
    closeBtn?.addEventListener('click',closeAdminModal);
    cancelBtn?.addEventListener('click',closeAdminModal);
    modal?.addEventListener('click',event=>{if(event.target===modal)closeAdminModal();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAdminModal();});
    form?.addEventListener('submit',adminLogin);
    document.getElementById('toggle-risk-guide')?.addEventListener('change',event=>setGuideVisible(Boolean(event.target.checked)));
    updateAdminUI();
  }
  function isAdminAuthenticated(){
    try{
      const raw=sessionStorage.getItem(ADMIN_SESSION_KEY);if(!raw)return false;
      const session=JSON.parse(raw);if(!session?.expiresAt||Date.now()>session.expiresAt){sessionStorage.removeItem(ADMIN_SESSION_KEY);return false;}
      return ['admin','superadmin','recorder'].includes(session.role);
    }catch{return false;}
  }
  function adminRole(){try{return isAdminAuthenticated()?JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY)).role:'';}catch{return '';}}
  function touchAdminSession(){
    if(!isAdminAuthenticated())return;
    const session=JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY));
    sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify({...session,expiresAt:Date.now()+ADMIN_SESSION_MINUTES*60*1000}));
  }
  async function adminLogin(event){
    event.preventDefault();
    const username=String(document.getElementById('admin-username')?.value||'').trim();
    const password=String(document.getElementById('admin-password')?.value||'');
    const status=document.getElementById('admin-login-status');
    if(status){status.textContent='กำลังตรวจสอบ…';status.className='admin-login-status working';}
    let account;
    if(typeof V2!=='undefined'&&V2.enabled){try{account=await V2.login(username,password);}catch(e){if(status)status.textContent=e.message;return;}}
    else{const hash=await sha256(`${username}:${password}`);account=(ConfigLoader.bundle.system.access?.accounts||[]).find(a=>a.credentialHash===hash);}
    const role=account?.role||'';
    if(!role){
      if(status){status.textContent='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';status.className='admin-login-status error';}
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY,JSON.stringify({role,username:account.username,expiresAt:Date.now()+ADMIN_SESSION_MINUTES*60*1000}));
    if(status){status.textContent='เข้าสู่ระบบสำเร็จ';status.className='admin-login-status success';}
    document.getElementById('admin-login-form')?.reset();
    updateAdminUI();
    setTimeout(closeAdminModal,350);
  }
  function adminLogout(){
    if(typeof V2!=='undefined'&&V2.enabled)V2.logout().catch(console.error);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    lastImported=null;
    const dl=document.getElementById('btn-download-import');if(dl)dl.disabled=true;
    updateAdminUI();
  }
  function isGuideVisible(){
    try{return localStorage.getItem(GUIDE_VISIBLE_KEY)==='1';}catch{return false;}
  }
  function setGuideVisible(visible){
    try{localStorage.setItem(GUIDE_VISIBLE_KEY,visible?'1':'0');}catch{}
    updateGuideVisibility();
  }
  function updateGuideVisibility(){
    const visible=isGuideVisible();
    const link=document.getElementById('risk-guide-drive-link');
    const toggle=document.getElementById('toggle-risk-guide');
    link?.classList.toggle('hidden',!visible);
    link?.setAttribute('aria-hidden',String(!visible));
    if(toggle)toggle.checked=visible;
  }
  function updateAdminUI(){
    const authenticated=isAdminAuthenticated();
    if(typeof V2!=='undefined')V2.roleChanged(authenticated);
    const section=document.getElementById('excel-import-section');
    const guideSection=document.getElementById('guide-visibility-section');
    const loginBtn=document.getElementById('btn-admin-login');
    const logoutBtn=document.getElementById('btn-admin-logout');
    document.getElementById('province-admin-section')?.classList.toggle('hidden',!authenticated);
    document.getElementById('map-import-section')?.classList.toggle('hidden',!authenticated);
    ['admin-map-group','admin-hotspot-group'].forEach(id=>{const group=document.getElementById(id);group?.classList.toggle('hidden',!authenticated);group?.setAttribute('aria-hidden',String(!authenticated));});
    const role=adminRole();const badge=document.getElementById('admin-role-badge');if(badge)badge.textContent=role==='superadmin'?'Super Admin':role==='admin'?'Admin':'';
    const sessionName=document.getElementById('admin-session-name');
    if(sessionName){const session=authenticated?JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY)):null;const username=session?.username||(ConfigLoader.bundle.system.access?.accounts||[]).find(a=>a.role===role)?.username||'';sessionName.textContent=authenticated?`${username} · ${role==='superadmin'?'Super Admin':'Admin'}`:'';}
    document.getElementById('boundary-mode')?.querySelectorAll('option').forEach(o=>{o.disabled=role!=='superadmin'&&o.value!=='single';});
    const mode=document.getElementById('boundary-mode');if(mode&&role!=='superadmin')mode.value='single';
    section?.classList.toggle('hidden',!authenticated);
    section?.setAttribute('aria-hidden',String(!authenticated));
    guideSection?.classList.toggle('hidden',!authenticated);
    guideSection?.setAttribute('aria-hidden',String(!authenticated));
    loginBtn?.classList.toggle('hidden',authenticated);
    logoutBtn?.classList.toggle('hidden',!authenticated);
    updateGuideVisibility();
    if(authenticated)touchAdminSession();
  }
  function openAdminModal(message=''){
    const modal=document.getElementById('admin-modal');
    const status=document.getElementById('admin-login-status');
    if(status){status.textContent=message;status.className='admin-login-status';}
    modal?.classList.remove('hidden');
    setTimeout(()=>document.getElementById('admin-username')?.focus(),0);
  }
  function closeAdminModal(){document.getElementById('admin-modal')?.classList.add('hidden');}
  async function sha256(text){
    const data=new TextEncoder().encode(text);
    const digest=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }

  function bindExcelImport(){
    const btn=document.getElementById('btn-import-excel'), dl=document.getElementById('btn-download-import');
    btn?.addEventListener('click',importExcel);
    dl?.addEventListener('click',downloadImportedGeoJSON);
    document.getElementById('btn-download-qa')?.addEventListener('click',downloadQA);
    document.getElementById('hotspot-import-mode')?.addEventListener('change',()=>{const multi=document.getElementById('hotspot-import-mode').value==='multi';const input=document.getElementById('import-excel');input.multiple=multi;input.value='';document.getElementById('import-year-field')?.classList.toggle('hidden',multi);document.getElementById('hotspot-mode-help').textContent=multi?'หลายปี: เลือกไฟล์รวมหลายปีหรือหลายไฟล์ ระบบอ่าน AllData เป็นหลัก หรือชีตรายละเอียดเมื่อไม่มี AllData และแยกปีปฏิทิน พ.ศ. จากวันที่จริง':'ปีเดียว: ใช้ปีชุดข้อมูลที่ระบุตามวิธีเดิม รองรับช่วงวันที่ข้ามปี';});
  }
  async function importExcel(){
    if(!isAdminAuthenticated()){openAdminModal('กรุณาเข้าสู่ระบบผู้ดูแลก่อนนำเข้าข้อมูล');return;}
    if(typeof AccessContext==='undefined'&&!BoundaryStore.codes.length){setStatus('กรุณานำเข้าชุดแผนที่ก่อนนำเข้า Hotspot','error');return;}
    touchAdminSession();
    const files=[...(document.getElementById('import-excel')?.files||[])],mode=document.getElementById('hotspot-import-mode')?.value||'single',yearBE=Number(document.getElementById('import-year')?.value);
    if(!files.length){setStatus('กรุณาเลือกไฟล์ Excel','error');return;}
    if(mode==='single'&&files.length!==1){setStatus('ปีเดียวเลือก Excel หนึ่งไฟล์; หากมีหลายไฟล์ให้เลือกโหมดหลายปี','error');return;}
    if(mode==='single'&&(!Number.isInteger(yearBE)||yearBE<2400||yearBE>2600)){setStatus('กรุณาระบุปี พ.ศ. ให้ถูกต้อง','error');return;}
    if(!window.XLSX){setStatus('ไม่สามารถโหลดไลบรารีอ่าน Excel ได้','error');return;}
    const targets=[...document.getElementById('hotspot-import-provinces').selectedOptions].map(o=>o.value);if(!targets.length||targets.some(c=>!BoundaryStore.codes.includes(c))){setStatus('กรุณาเลือกจังหวัดที่มีชุดแผนที่นำเข้าแล้ว','error');return;}
    const scope=JSON.stringify(BoundaryStore.codes),controls=['btn-import-excel','import-excel','hotspot-import-mode','import-year','hotspot-import-provinces'].map(id=>document.getElementById(id));
    controls.forEach(el=>{if(el)el.disabled=true;});setStatus('กำลังอ่านและตรวจสอบข้อมูลทุกไฟล์…','working');
    try{
      const tables=[];
      for(const file of files){
        const wb=readHotspotWorkbook(await file.arrayBuffer());
        const details=mode==='multi'?findDetailTables(wb):[findDetailTable(wb)].filter(Boolean);
        if(!details.length)throw new Error(file.name+': ไม่พบตาราง Date/ YYYY-MM-DD, Province, LandType และ PlantType');
        for(const detail of details)tables.push({...detail,fileName:file.name,reference:mode==='single'&&targets.length===1&&targets[0]===ProvinceContext.get().provinceCode?readHsPlant2026Reference(wb):null});
      }
      const plan=prepareHotspotImport(tables,mode,yearBE,targets);lastQA=plan.qa;renderImportQA(lastQA);
      if(!plan.years.length)throw new Error('ไม่พบข้อมูลในจังหวัดที่เลือกนำเข้า HS ('+targets.join(', ')+') ที่ตรงเงื่อนไข');
      if(plan.qa.qa?.referenceMatch===false)throw new Error('ยอดหลังกรองไม่ตรงกับตารางอ้างอิง จึงยกเลิกการนำเข้า');
      if(!isAdminAuthenticated()||scope!==JSON.stringify(BoundaryStore.codes))throw new Error('สิทธิ์หรือพื้นที่เปลี่ยนระหว่างอ่านไฟล์ กรุณานำเข้าใหม่');
      if(typeof V2!=='undefined')await V2.savePlan(plan,targets);
      for(const year of plan.years){ensureYearCheckbox(year).checked=true;const visible=MapModule.importHotspots(year,plan.datasets[year],targets);Dashboard.setYearData(year,visible);}
      fillPeriodSelects();syncYearSelector();syncTimelineUI();applyCurrent();
      document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears()}}));
      lastImported=plan;document.getElementById('btn-download-import').disabled=false;
      const exportSelect=document.getElementById('import-export-year');
      if(exportSelect){exportSelect.replaceChildren();exportSelect.add(new Option('ทุกปีรวมไฟล์เดียว','all'));plan.years.forEach(y=>exportSelect.add(new Option(String(y),String(y))));}
      document.getElementById('import-export-year-field')?.classList.toggle('hidden',plan.years.length<2);
      setStatus('นำเข้าสำเร็จ '+plan.geojson.features.length.toLocaleString('th-TH')+' จุด | '+plan.years.map(y=>y+': '+plan.datasets[y].features.length.toLocaleString('th-TH')+' จุด').join(' / ')+(typeof V2!=='undefined'&&V2.enabled?' | บันทึกในเครื่องแล้ว':'')+' | ดูข้อมูลซ้ำและรายการที่ไม่ผ่านใน QA','success');
    }catch(err){console.error(err);setStatus('นำเข้าไม่สำเร็จ: '+err.message,'error');}
    finally{controls.forEach(el=>{if(el)el.disabled=false;});}
  }
  function findDetailTables(wb){
    const profile=ImportContract.selectProfile(wb.SheetNames,ConfigLoader.bundle.importRules);
    if(!profile)throw new Error('ไม่พบชีตรายละเอียด AllData หรือ hsAll (ระบบจะไม่อ่านชีต Pivot/Summary)');
    const detail=findDetailTable(wb,profile);
    if(!detail)throw new Error(profile.sheet+': หัวตารางไม่ครบตามรูปแบบ '+profile.id);
    return [detail];
  }
  function readHotspotWorkbook(bytes){
    const names=XLSX.read(bytes,{type:'array',bookSheets:true}).SheetNames;
    const profile=ImportContract.selectProfile(names,ConfigLoader.bundle.importRules);
    if(!profile)throw new Error('ไม่พบชีตรายละเอียด AllData หรือ hsAll');
    const reference=names.find(name=>name.trim().toLowerCase()===(ConfigLoader.bundle.importRules.referenceSheet||'').toLowerCase());
    // Keep Excel date serials: formatted text and JS Date conversion can shift dates.
    return XLSX.read(bytes,{type:'array',cellDates:false,sheets:[profile.sheet,...(reference?[reference]:[])]});
  }
  function prepareHotspotImport(tables,mode,yearBE,provinceCodes=null){
    const targets=provinceCodes||BoundaryStore.selectedCodes(),boundaries=BoundaryStore.getLayerForCodes('subdistrict',targets),fileCode=targets.join('-');
    if(!['single','multi'].includes(mode))throw new Error('รูปแบบนำเข้าไม่ถูกต้อง');
    if(mode==='single'){
      if(tables.length!==1)throw new Error('ปีเดียวต้องมีตารางรายละเอียดหนึ่งชุด');
      const table=tables[0],fc=rowsToGeoJSON(table.rows,table.headers,yearBE,table.reference,table.sheet,{provinceCodes:targets,boundaries,sourceProfile:table.profileId});
      return{years:fc.features.length?[yearBE]:[],datasets:{[yearBE]:fc},qa:fc.metadata,geojson:fc,fileName:`hotspot_${fileCode}_${yearBE}.geojson`};
    }
    const datasets={},seen=new Set(),qa={mode:'multi',provinceCodes:targets,yearGrouping:'calendar-BE-from-date',sourceFiles:[...new Set(tables.map(t=>t.fileName))],sourceTables:[],inputRows:0,accepted:0,duplicatesAcrossTables:0,normalizationTotals:{},referenceCheck:'not applied: single reference table does not declare comparable year/period'},duplicatesByYear={};
    for(const table of tables){
      const fc=HSNormalizer.rowsToGeoJSON(table.rows,table.headers,0,null,table.sheet,extractCoordinates,boundaries,{provinceCodes:targets,sourceProfile:table.profileId});
      qa.sourceTables.push({file:table.fileName,sheet:table.sheet,...fc.metadata});qa.inputRows+=fc.metadata.qa.inputRows;
      for(const [key,value] of Object.entries(fc.metadata.qa))if(typeof value==='number')qa.normalizationTotals[key]=(qa.normalizationTotals[key]||0)+value;
      for(const f of fc.features){
        const p=f.properties,y=p.year_be;if(!Number.isInteger(y)||y<2400||y>2600)throw new Error('วันที่อยู่นอกช่วงปีที่รองรับ: '+p.acq_date);
        const identity=ImportContract.recordIdentity(p,f.geometry.coordinates);
        if(ConfigLoader.bundle.importRules.deduplicate!=='none'&&seen.has(identity)){qa.duplicatesAcrossTables++;duplicatesByYear[y]=(duplicatesByYear[y]||0)+1;continue;}seen.add(identity);
        p.season_be=p.dataset_year_be=y;p.source_file=table.fileName;
        datasets[y]??={type:'FeatureCollection',name:`hotspot_${fileCode}_${y}_imported`,metadata:{yearBE:y,yearGrouping:qa.yearGrouping},features:[]};datasets[y].features.push(f);
      }
    }
    const years=Object.keys(datasets).map(Number).sort((a,b)=>a-b),features=years.flatMap(y=>datasets[y].features);
    qa.accepted=features.length;qa.byYear={};
    for(const y of years){
      const counts={byProvince:{},byPlantType:{},byDistrict:{},byTambon:{},byMonth:{},byYear:{[y]:datasets[y].features.length}};
      for(const f of datasets[y].features){const p=f.properties,prefix=targets.length>1?p.province+' / ':'';for(const [key,value] of [['byProvince',p.province],['byPlantType',p.PlantType],['byDistrict',prefix+p.__district],['byTambon',prefix+p.__district+'/'+p.__subdistrict],['byMonth',y+'-'+p.acq_date.slice(5,7)]])counts[key][value]=(counts[key][value]||0)+1;}
      qa.byYear[y]={accepted:datasets[y].features.length,duplicatesAcrossTables:duplicatesByYear[y]||0,counts};datasets[y].metadata={...datasets[y].metadata,provinceCodes:targets,counts,qa:qa.byYear[y]};
    }
    qa.duplicates=(qa.normalizationTotals.duplicates||0)+qa.duplicatesAcrossTables;
    const geojson={type:'FeatureCollection',name:'hotspot_multi_year_imported',metadata:qa,features};
    return{years,datasets,qa,geojson,fileName:`hotspot_${fileCode}_${years.join('-')}.geojson`};
  }
  function findDetailTable(wb,selectedProfile=null){
    const profile=selectedProfile||ImportContract.selectProfile(wb.SheetNames,ConfigLoader.bundle.importRules);
    if(!profile)return null;
    for(const name of [profile.sheet]){
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});
      for(let i=0;i<rows.length;i++){
        const headers=(rows[i]||[]).map(v=>String(v??'').trim());
        const validation=ImportContract.validateHeaders(headers,profile);
        if(validation.valid)return{sheet:name,profileId:profile.id,timeRequired:profile.timeRequired,headers,rows:rows.slice(i+1)};
      }
    }
    return null;
  }
  function readHsPlant2026Reference(wb){
    const sheetName=wb.SheetNames.find(name=>String(name).trim().toLowerCase()===ConfigLoader.bundle.importRules.referenceSheet.toLowerCase());
    if(!sheetName)return null;
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
    const compact=v=>String(v??'').replace(/\s+/g,'').trim();
    const headerIndex=rows.findIndex(row=>compact(row?.[0])==='จังหวัด'&&ProvinceContext.get().enabledPlantTypes.some(plant=>row.some(v=>compact(v)===compact(plant))));
    if(headerIndex<0)return null;
    const headers=rows[headerIndex].map(compact);
    const provinceRow=rows.slice(headerIndex+1).find(row=>HSNormalizer.normalizeProvinceName(row?.[0])===ProvinceContext.get().provinceNameTH);
    if(!provinceRow)return null;
    const wanted=ProvinceContext.get().enabledPlantTypes.map(x=>[x,compact(x)]);
    const byPlantType={};
    for(const [plant,header] of wanted){const i=headers.indexOf(header);byPlantType[plant]=i>=0?Number(provinceRow[i]||0):0;}
    return{sheet:sheetName,province:ProvinceContext.get().provinceNameTH,byPlantType,total:Object.values(byPlantType).reduce((sum,n)=>sum+n,0)};
  }
  function rowsToGeoJSON(rows,headers,yearBE,reference=null,sourceSheet='',options={}){
    return HSNormalizer.rowsToGeoJSON(rows,headers,yearBE,reference,sourceSheet,extractCoordinates,options.boundaries||MapModule.getData().subdistrict,options);
  }
  function renderImportQA(metadata){
    const host=document.getElementById('import-qa');if(host)host.textContent=JSON.stringify(metadata,null,2);
    document.getElementById('btn-download-qa').disabled=false;
  }
  function downloadQA(){if(!lastQA)return;downloadJSON(lastQA,`hotspot_${lastQA.provinceCodes?.join('-')||ProvinceContext.fileCode()}_qa.json`,'application/json');}
  function downloadJSON(value,name,type){const blob=new Blob([JSON.stringify(value,null,2)],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function extractCoordinates(maps,x,y,zone){
    const mapsCoordinate=ImportContract.parseMaps(maps);
    if(mapsCoordinate)return mapsCoordinate;
    if(x===null||x===undefined||String(x).trim()===''||y===null||y===undefined||String(y).trim()==='')return null;
    const east=Number(x),north=Number(y),z=Number(zone)||47;
    if(Number.isFinite(east)&&Number.isFinite(north)&&window.proj4){try{return proj4(`+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`,'EPSG:4326',[east,north]);}catch{}}
    return null;
  }
  function ensureYearCheckbox(year){
    let cb=document.querySelector(`.hs-layer[data-year="${year}"]`);if(cb)return cb;
    const yearSelect=document.getElementById('filter-year');if(yearSelect&&!yearSelect.querySelector(`option[value="${year}"]`)){const opt=document.createElement('option');opt.value=String(year);opt.textContent=`${year} (${year-543})`;yearSelect.appendChild(opt);}
    const group=document.querySelector('.hs-layer')?.closest('.layer-group');
    const label=document.createElement('label');label.className=`toggle-row hs-${year}`;label.style.borderLeft=`3px solid ${CONFIG.YEAR_COLORS[year]||'#14b8a6'}`;
    label.innerHTML=`<input type="checkbox" class="hs-layer" data-year="${year}"> ปี ${year} (${year-543})`;
    group?.appendChild(label);cb=label.querySelector('input');
    if(!CONFIG.YEAR_COLORS[year]){const d=Math.max(0,(CONFIG.CURRENT_YEAR_BE||year)-year);CONFIG.YEAR_COLORS[year]=(CONFIG.YEAR_COLOR_FALLBACK||[])[d]||'#14b8a6';label.style.borderLeft=`3px solid ${CONFIG.YEAR_COLORS[year]}`;}
    return cb;
  }
  function downloadImportedGeoJSON(){if(!lastImported)return;const year=document.getElementById('import-export-year')?.value,fc=lastImported.datasets?.[year]||lastImported.geojson,fileName=lastImported.datasets?.[year]?`hotspot_${lastImported.geojson.metadata.provinceCodes?.join('-')||ProvinceContext.fileCode()}_${year}.geojson`:lastImported.fileName;const blob=new Blob([JSON.stringify(fc,null,2)],{type:'application/geo+json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function setStatus(text,type){const el=document.getElementById('import-status');if(!el)return;el.textContent=text;el.className=`import-status ${type||''}`;}




  function initDesktopSidebarToggle(){
    const btn=document.getElementById('sidebar-toggle');
    const left=document.getElementById('left-panel');
    if(!btn||!left)return;
    const key='agri-risk-left-panel-collapsed';
    const apply=(collapsed)=>{
      document.body.classList.toggle('left-panel-collapsed',collapsed);
      btn.setAttribute('aria-expanded',String(!collapsed));
      btn.innerHTML=collapsed?'☰ แสดงเมนู':'☰ ซ่อนเมนู';
      btn.title=collapsed?'แสดงเมนูด้านซ้าย':'ซ่อนเมนูด้านซ้าย';
      try{localStorage.setItem(key,collapsed?'1':'0');}catch{}
      setTimeout(()=>{MapModule.map?.()?.invalidateSize?.({pan:false});MapModule.focusSelection?.({padding:[24,24]});},260);
    };
    let initial=false;
    try{initial=localStorage.getItem(key)==='1';}catch{}
    apply(initial);
    btn.addEventListener('click',()=>apply(!document.body.classList.contains('left-panel-collapsed')));
  }

  function initMobilePanels(){
    const left=document.getElementById('left-panel');
    const right=document.getElementById('right-panel');
    const overlay=document.getElementById('mobile-overlay');
    const btnLeft=document.getElementById('mobile-toggle-layers');
    const btnRight=document.getElementById('mobile-toggle-dashboard');
    if(!left||!right||!overlay||!btnLeft||!btnRight)return;
    const closeAll=()=>{
      left.classList.remove('mobile-open');right.classList.remove('mobile-open');overlay.hidden=true;
      btnLeft.setAttribute('aria-expanded','false');btnRight.setAttribute('aria-expanded','false');
      setTimeout(()=>MapModule.map()?.invalidateSize?.(),260);
    };
    const openPanel=(panel,button)=>{
      const wasOpen=panel.classList.contains('mobile-open');closeAll();
      if(!wasOpen){panel.classList.add('mobile-open');overlay.hidden=false;button.setAttribute('aria-expanded','true');}
    };
    btnLeft.addEventListener('click',()=>openPanel(left,btnLeft));
    btnRight.addEventListener('click',()=>openPanel(right,btnRight));
    overlay.addEventListener('click',closeAll);
    window.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
    window.addEventListener('resize',()=>{if(window.innerWidth>768)closeAll();setTimeout(()=>MapModule.map()?.invalidateSize?.(),120);});
    document.addEventListener('agri-risk:filter-change',()=>{if(window.innerWidth<=768)closeAll();});
  }

  async function initVisitorCounter(){
    const fallback=document.getElementById('visitor-counter-fallback');
    const box=document.getElementById('external-counter-box');
    if(!fallback)return;
    const key='agri-risk-pageviews-fallback';
    let local=1;try{local=Number(localStorage.getItem(key)||0)+1;localStorage.setItem(key,String(local));}catch{}
    const fallbackText=local.toLocaleString('th-TH');
    fallback.textContent=fallbackText;
    fallback.classList.add('is-fallback');
    const checkExternal=()=>{
      const raw=String(box?.textContent||'').replace(String(fallback.textContent||''),'').trim();
      const hasExternal=!!(box?.querySelector('img')) || /\d/.test(raw);
      /* Keep the local fallback visible even when the external script is blocked or renders as an image.
         This avoids an empty counter card in privacy-restricted browsers. */
      if(!hasExternal){fallback.textContent=fallbackText;fallback.classList.add('is-fallback');}
    };
    setTimeout(checkExternal,1200);
    setTimeout(checkExternal,3500);
  }
  
  function initProvincePickers(){
    const hsSelect=document.getElementById('hotspot-import-provinces');if(hsSelect){const old=new Set([...hsSelect.selectedOptions].map(o=>o.value)),hadOptions=hsSelect.options.length>0;hsSelect.replaceChildren();BoundaryStore.codes.forEach(c=>{const o=new Option(ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c).provinceNameTH,c);o.selected=hadOptions&&[...old].some(v=>BoundaryStore.codes.includes(v))?old.has(c):true;hsSelect.add(o);});}
    const select=document.getElementById('quick-province-select');if(select){select.replaceChildren();if(BoundaryStore.codes.length>1)select.add(new Option('ทุกจังหวัดที่นำเข้า',''));if(!BoundaryStore.codes.length)select.add(new Option('ยังไม่เลือกพื้นที่',''));BoundaryStore.codes.forEach(c=>select.add(new Option(ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c).provinceNameTH,c)));select.value=BoundaryStore.view|| (BoundaryStore.codes.length===1?BoundaryStore.codes[0]:'');select.onchange=()=>{if(!isAdminAuthenticated()){select.value=BoundaryStore.view||(BoundaryStore.codes.length===1?BoundaryStore.codes[0]:'');updateAdminUI();return;}BoundaryStore.selectView(select.value);refreshScope();};}
  }
  async function refreshScope(options={}){
    ProvinceContext.applyProvinceContext();document.getElementById('filter-district').value='';document.getElementById('filter-subdistrict').value='';
    const loaded=await MapModule.reloadData();subdistrictFeatures=loaded.subdistrict.features;populateDistricts();populateSubdistricts();Dashboard.setData(loaded.hotspot);if(options.resetPeriod)setLatestPeriod();syncYearSelector();applyCurrent();initProvincePickers();
  }
  function bindGeoJSONImport(){
    let prepared=null,selectionVersion=0;const files=document.getElementById('boundary-files'),select=document.getElementById('boundary-provinces'),status=document.getElementById('map-import-status');
    const tell=(text,error=false)=>{status.textContent=text;status.className='import-status '+(error?'error':'success');if(error)lastBoundaryAttempt={success:false,error:text,generatedAt:new Date().toISOString(),role:adminRole(),sourceFiles:prepared?.sources||[],previousDatasetRetained:true};else if(text.startsWith('นำเข้าแล้ว')||text.startsWith('โหลดชุดตัวอย่าง'))lastBoundaryAttempt={success:true,...BoundaryStore.qa};};
    const readSelection=async input=>{const version=++selectionVersion;prepared=null;lastBoundaryAttempt=null;select.replaceChildren();if(!input.files.length){tell('ยังไม่เลือกไฟล์หรือโฟลเดอร์');return;}tell('กำลังอ่านและตรวจรายการไฟล์…');try{const candidate=await BoundaryStore.readFiles([...input.files]);if(version!==selectionVersion)return;prepared=candidate;const codes=Object.keys(prepared.staging).sort();codes.forEach(c=>select.add(new Option(ConfigLoader.bundle.provinces.find(p=>p.provinceCode===c).provinceNameTH,c)));if(codes.length===1)select.options[0].selected=true;tell(`อ่านไฟล์แผนที่ ${prepared.sources.length} ไฟล์ พบ ${codes.length} จังหวัด — `+(codes.length===1?'กดตรวจสอบและนำเข้าได้เลย':'กรุณาเลือกจังหวัดและนำเข้า'));}catch(e){if(version===selectionVersion)tell(e.message,true);}};
    files?.addEventListener('change',()=>{const other=document.getElementById('boundary-folder');if(other)other.value='';readSelection(files);});
    const folder=document.getElementById('boundary-folder');folder?.addEventListener('change',()=>{if(files)files.value='';readSelection(folder);});
    const method=document.getElementById('boundary-source-method');
    method?.addEventListener('change',()=>{selectionVersion++;prepared=null;lastBoundaryAttempt=null;select.replaceChildren();if(files)files.value='';if(folder)folder.value='';const useFolder=method.value==='folder';document.getElementById('boundary-files-picker')?.classList.toggle('hidden',useFolder);document.getElementById('boundary-folder-picker')?.classList.toggle('hidden',!useFolder);tell('ยังไม่เลือกชุดข้อมูล — '+(useFolder?'เลือกโฟลเดอร์ชุดแผนที่':'เลือกไฟล์แผนที่'));});
    document.getElementById('btn-import-boundaries')?.addEventListener('click',async()=>{if(!isAdminAuthenticated()){openAdminModal();return;}try{if(!prepared)throw new Error('กรุณาเลือกไฟล์หรือโฟลเดอร์ชุดแผนที่ก่อน');const mode=document.getElementById('boundary-mode').value;const chosen=mode==='all'?ConfigLoader.bundle.provinces.map(p=>p.provinceCode):[...select.selectedOptions].map(o=>o.value);if(mode==='single'&&chosen.length!==1)throw new Error('กรุณาเลือกเพียง 1 จังหวัด');await BoundaryStore.commit(prepared,chosen,adminRole(),mode);touchAdminSession();await refreshScope({resetPeriod:true});tell('นำเข้าแล้ว '+chosen.length+' จังหวัด และบันทึกไว้ในเบราว์เซอร์');}catch(e){tell(e.message,true);}});
    document.getElementById('btn-boundary-example')?.addEventListener('click',async()=>{if(!isAdminAuthenticated()){openAdminModal();return;}try{await BoundaryStore.commit(await BoundaryStore.loadDemo(),[ConfigLoader.bundle.system.legacyExampleProvinceCode],adminRole(),'single');await refreshScope({resetPeriod:true});tell('โหลดชุดตัวอย่างจังหวัดเดิมแล้ว');}catch(e){tell(e.message,true);}});
    document.getElementById('btn-boundary-qa')?.addEventListener('click',()=>{const report=lastBoundaryAttempt||BoundaryStore.qa;if(report)downloadJSON(report,'boundary-import-qa.json','application/json');});
    document.getElementById('btn-import-geojson')?.addEventListener('click',async()=>{if(!isAdminAuthenticated()){openAdminModal();return;}try{if(!BoundaryStore.codes.length)throw new Error('ต้องนำเข้าชุดแผนที่ก่อน');const file=document.getElementById('import-geojson-file').files[0];if(!file)throw new Error('กรุณาเลือกไฟล์');const fc=JSON.parse(await file.text());if(fc.type!=='FeatureCollection'||!Array.isArray(fc.features))throw new Error('ต้องเป็น FeatureCollection');for(const f of fc.features){if(!['Polygon','MultiPolygon'].includes(f.geometry?.type)||!BoundaryStore.validCoordinates(f.geometry)||!BoundaryStore.accepts(f.properties||{}))throw new Error('รูปทรงหรือจังหวัดไม่ตรงชุดที่เลือก');}MapModule.importCustomGeoJSON(document.getElementById('import-layer-type').value,fc);tell('นำเข้าชั้นข้อมูลเสริมแล้ว');}catch(e){tell(e.message,true);}});
  }

  return{init,rowsToGeoJSON,findDetailTable,findDetailTables,readHotspotWorkbook,prepareHotspotImport,extractCoordinates};
})();
document.addEventListener('DOMContentLoaded',()=>App.init().catch(err=>{console.error('[App] fatal error:',err);const el=document.createElement('div');el.style.cssText='position:fixed;inset:auto 20px 20px 20px;z-index:10000;background:#991b1b;color:#fff;padding:12px;border-radius:8px;font:14px sans-serif';el.textContent='โหลดระบบไม่สำเร็จ: '+err.message;document.body.appendChild(el);}));
