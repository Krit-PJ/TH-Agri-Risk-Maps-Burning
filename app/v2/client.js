/* Installed edition bridge. Cloud credentials never enter browser storage. */
const V2=(()=>{
  let state=null,csrf='',busy=false,lastPreview=null,cloudPreview=null,cloudInbox=null,sheetFormOwner='';
  const key='agri-risk-admin-session-v2';
  async function request(path,body){
    const response=await (typeof AccessContext!=='undefined'?((url,options)=>AccessContext.fetchApi(url.replace('/api/v2/',''),options)):fetch)('/api/v2/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let result;try{result=await response.json();}catch{const error=new Error('ตัวเปิดระบบไม่ตอบกลับข้อมูลที่ถูกต้อง');error.httpStatus=response.status;throw error;}if(!response.ok){const error=new Error(typeof result.error==='string'?result.error:result.error?.message||'ทำรายการไม่สำเร็จ');error.httpStatus=response.status;throw error;}return result;
  }
  async function status(){const result=await request('status');if(result.version!==2)throw new Error('ไม่พบตัวเปิดระบบรุ่น 2');state=result;csrf=state.csrfToken||'';return state;}
  function localSession(session){if(session)sessionStorage.setItem(key,JSON.stringify({id:session.id,username:session.username,role:session.role,expiresAt:Date.now()+30*60000}));else sessionStorage.removeItem(key);}
  async function login(username,password){const result=await request('login',{username,password});await status();localSession(state.session);return result.session||state.session;}
  async function logout(){await request('logout',{});discardCloud();cloudInbox=null;localSession(null);await status();}
  async function init(){
    try{await status();}catch(error){
      if(typeof AccessContext!=='undefined'){document.getElementById('province-data-status').textContent='ต้องเปิดผ่านบริการที่ติดตั้งด้วย Start.cmd ไม่สามารถตรวจสิทธิ์จากไฟล์ Static เพียงอย่างเดียว';return false;}
      if(error.httpStatus&&error.httpStatus!==404)throw error;
      let deployment;try{const response=await fetch('config/deployment.json');if(!response.ok)return true;deployment=await response.json();}catch{return true;}
      const wanted=deployment.provinceCodes||[];
      if(!wanted.length)return true;
      if(JSON.stringify([...BoundaryStore.codes].sort())!==JSON.stringify([...wanted].sort())){
        const files=[];for(const code of wanted)for(const [level,name] of Object.entries({province:'province',district:'districts',subdistrict:'subdistricts'})){
          const response=await fetch('data/boundary/'+code+'/'+name+'.geojson');if(!response.ok)throw new Error('ชุดเผยแพร่ขาดแผนที่ '+code+'/'+name);
          files.push(new File([await response.text()],name+'.geojson',{type:'application/geo+json'}));
        }
        await BoundaryStore.commit(await BoundaryStore.readFiles(files),wanted,wanted.length===1?'admin':'superadmin',deployment.mode|| (wanted.length===1?'single':'subset'));
      }
      document.getElementById('btn-admin-login')?.remove();document.getElementById('btn-admin-logout')?.remove();
      return true;
    } // Published Pages reads only a sanitized deployment manifest.
    localSession(state.session);
    if(state.accessEdition&&typeof AccessContext!=='undefined')return AccessContext.init(state);
    if(!state.setup?.completed){location.replace('setup.html');return false;}
    const wanted=state.setup.provinceCodes||[];
    const revision=state.setup.boundaryRevision||'round1';let cachedRevision='';try{cachedRevision=localStorage.getItem('agri-v2-boundary-revision')||'';}catch{}
    if(cachedRevision!==revision||JSON.stringify([...BoundaryStore.codes].sort())!==JSON.stringify([...wanted].sort())){
      const files=[];
      for(const code of wanted){const p=await request('boundaries?provinceCode='+encodeURIComponent(code));for(const [level,data] of Object.entries(p.layers)){if(!data)continue;const name={province:'province',district:'districts',subdistrict:'subdistricts',village:'villages'}[level];if(name)files.push(new File([JSON.stringify(data)],name+'.geojson',{type:'application/geo+json'}));}}
      const prepared=await BoundaryStore.readFiles(files);
      // Server validated this installed scope; commit still validates area hierarchy.
      await BoundaryStore.commit(prepared,wanted,wanted.length===1?'admin':'superadmin',state.setup.mode);
      try{localStorage.setItem('agri-v2-boundary-revision',revision);}catch{}
    }
    return true;
  }
  async function restore(){
    if(!state)return;if(typeof AccessContext!=='undefined'&&!AccessContext.current?.provinceCode)return;
    const result=await request('hotspots');let points=0,years=0;
    for(const [year,fc] of Object.entries(result.datasets||{})){
      const codes=(fc.metadata?.persistedProvinceCodes||[]).filter(c=>state.setup.provinceCodes.includes(c));
      if(!codes.length)continue;
      const visible=MapModule.importHotspots(Number(year),fc,codes);
      Dashboard.setYearData(Number(year),visible);points+=fc.features.length;years++;
    }
    message(years?'โหลด HS ที่บันทึกในเครื่องแล้ว '+years+' ปี '+points.toLocaleString('th-TH')+' จุด':'ยังไม่มี HS ที่นำเข้าบันทึกในเครื่อง ใช้ข้อมูลเริ่มต้นตามชุดจังหวัด');
  }
  async function savePlan(plan,provinceCodes,cloudReceipt){if(state){const result=await request('hotspots',{datasets:plan.datasets,provinceCodes,...(cloudReceipt?{cloudReceipt}:{})});message('บันทึก HS ในเครื่องแล้ว '+result.updatedYears.length+' ปี');return result;}}
  function message(text,error=false){const el=document.getElementById('v2-status');if(el){el.textContent=text;el.style.color=error?'#991b1b':'#166534';}}
  function cloudTargets(){return [...document.querySelectorAll('#hotspot-import-provinces option:checked')].map(o=>o.value).sort();}
  function sourceFingerprint(){return JSON.stringify([state.setup.googleClientId,state.setup.driveFolderId,state.setup.sheetId,state.setup.sheetRange,state.setup.provinceCodes,state.setup.boundaryRevision]);}
  function discardCloud(){cloudPreview=null;const b=document.getElementById('v2-cloud-save');if(b)b.disabled=true;}
  function displayInbox(data){
    discardCloud();cloudInbox=data;
    const select=document.getElementById('v2-cloud-source');select.replaceChildren();
    if(data.sheets)select.add(new Option('Google Sheets · '+(state.setup.sheetRange||'AllData'),'sheets'));
    for(const file of data.driveFiles||[])if(/\.xlsx$/i.test(file.name))select.add(new Option(file.name,file.id));
    const label=document.getElementById('v2-cloud-summary');if(label)label.textContent='ตรวจล่าสุด: '+(data.syncedAt||'ยังไม่มี')+' · '+select.options.length+' แหล่งข้อมูลให้เลือก';
    message(select.options.length?'เลือกแหล่งข้อมูลและจังหวัด HS แล้วกดตรวจข้อมูลก่อนนำเข้า':'ไม่พบ Sheets หรือ Excel .xlsx ในโฟลเดอร์ที่ตั้งค่า');
  }
  async function prepareCloud(){
    discardCloud();const data=cloudInbox;if(!data)throw new Error('กดตรวจแหล่งข้อมูล Google ก่อน');
    if(!window.XLSX)throw new Error('โหลดเครื่องมืออ่าน Excel ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ต');
    const source=document.getElementById('v2-cloud-source').value;
    const targets=cloudTargets();
    if(!targets.length)throw new Error('เลือกจังหวัด HS ก่อน');
    const tables=[];
    if(source==='sheets'&&data.sheets){
      if(data.sheets.rows.length>300000||data.sheets.rows.reduce((n,row)=>n+row.length,0)>6000000)throw new Error('Sheets เกิน 300,000 แถวหรือ 6 ล้านช่อง กรุณาจำกัดช่วงข้อมูล');
      const name='AllData',wb={SheetNames:[name],Sheets:{[name]:XLSX.utils.aoa_to_sheet([data.sheets.headers,...data.sheets.rows])}};
      for(const table of App.findDetailTables(wb))tables.push({...table,fileName:'Google Sheets'});
    }
    for(const file of data.driveFiles||[]){
      if(file.id!==source||!/\.xlsx$/i.test(file.name))continue;
      const r=await fetch('/api/v2/google/file?id='+encodeURIComponent(file.id),{credentials:'same-origin'});if(!r.ok)throw new Error('ดาวน์โหลด '+file.name+' ไม่สำเร็จ');
      const wb=App.readHotspotWorkbook(await r.arrayBuffer());for(const t of App.findDetailTables(wb))tables.push({...t,fileName:file.name});
    }
    if(!tables.length)throw new Error('ไม่พบรายละเอียด HS ใน Sheets หรือไฟล์ Excel ในโฟลเดอร์ที่ตั้งค่า');
    if(tables.reduce((n,t)=>n+t.rows.length,0)>300000||tables.reduce((n,t)=>n+t.rows.reduce((s,row)=>s+row.length,0),0)>6000000)throw new Error('ข้อมูลเกิน 300,000 แถวหรือ 6 ล้านช่อง กรุณาแบ่งไฟล์หรือช่วง Sheets');
    const plan=App.prepareHotspotImport(tables,'multi',0,targets);if(!plan.years.length)throw new Error('ไม่มี HS ที่ผ่านเงื่อนไข config');
    if(new TextEncoder().encode(JSON.stringify({datasets:plan.datasets,provinceCodes:targets})).length>10*1024*1024)throw new Error('HS หลังกรองเกิน 10 MiB กรุณาแยกจังหวัดหรือปี');
    if(!data.receipt)throw new Error('รายการ Google เก่า กรุณาตรวจแหล่งข้อมูลใหม่');
    cloudPreview={plan,targets,scope:JSON.stringify(state.setup.provinceCodes),source,fingerprint:sourceFingerprint(),inboxSnapshot:JSON.stringify(data),receipt:data.receipt,createdAt:Date.now()};
    const qa=document.getElementById('v2-cloud-qa');if(qa)qa.textContent=JSON.stringify({provinceCodes:targets,years:plan.years,totalPoints:plan.geojson.features.length,qa:plan.qa},null,2);
    document.getElementById('v2-cloud-save').disabled=false;
    message('ตรวจแล้ว '+plan.years.length+' ปี '+plan.geojson.features.length.toLocaleString('th-TH')+' จุด · ตรวจ QA ก่อนยืนยันบันทึก (แทน HS เดิมของจังหวัดในปีที่แสดง)');
  }
  async function commitCloud(){
    await status();
    const preview=cloudPreview;
    if(!preview||!state.session||Date.now()-preview.createdAt>10*60000||sourceFingerprint()!==preview.fingerprint||JSON.stringify(cloudTargets())!==JSON.stringify(preview.targets)||JSON.stringify(state.setup.provinceCodes)!==preview.scope||document.getElementById('v2-cloud-source').value!==preview.source||JSON.stringify(await request('inbox'))!==preview.inboxSnapshot){discardCloud();throw new Error('จังหวัดหรือแหล่งข้อมูลเปลี่ยน หรือ QA หมดอายุ กรุณาตรวจข้อมูลใหม่');}
    if(!confirm('ยืนยันแทนข้อมูล HS ของจังหวัด '+preview.targets.join(', ')+' เฉพาะปี '+preview.plan.years.join(', ')+' ตาม QA ที่ตรวจแล้ว?'))return;
    const {plan,targets}=preview;await savePlan(plan,targets,preview.receipt);discardCloud();
    for(const year of plan.years){const visible=MapModule.importHotspots(year,plan.datasets[year],targets);Dashboard.setYearData(year,visible);}
    document.dispatchEvent(new CustomEvent('agri-risk:years-changed',{detail:{years:MapModule.activeYears()}}));
    document.getElementById('btn-latest-period')?.click();
    const qa=document.getElementById('import-qa');if(qa)qa.textContent=JSON.stringify(plan.qa,null,2);
    message('นำเข้าจาก Google และบันทึกในเครื่องแล้ว '+plan.geojson.features.length.toLocaleString('th-TH')+' จุด');
  }
  async function action(fn){if(busy)return;busy=true;document.querySelectorAll('#v2-controls button').forEach(b=>b.disabled=true);message('กำลังดำเนินการ…');try{await status();if(!state.session)throw new Error('กรุณา Login ใหม่');await fn();}catch(e){message(e.message,true);}finally{busy=false;document.querySelectorAll('#v2-controls button').forEach(b=>b.disabled=false);const save=document.getElementById('v2-cloud-save');if(save)save.disabled=!cloudPreview;}}
  function fillSheetSource(){
    const input=document.getElementById('v2-sheet-url'),range=document.getElementById('v2-sheet-range'),label=document.getElementById('v2-sheet-status');
    if(input)input.value=state.setup.sheetId?'https://docs.google.com/spreadsheets/d/'+encodeURIComponent(state.setup.sheetId)+'/edit':'';
    if(range)range.value=state.setup.sheetRange||'AllData!A:AZ';
    if(label)label.textContent=state.setup.sheetId?'แหล่งข้อมูลที่บันทึกไว้ · '+(state.connections?.google?'Google เชื่อมแล้ว':'ยังต้องเชื่อม Google เพื่ออ่านข้อมูล'):'ยังไม่ได้กำหนด Google Sheets';
  }
  async function saveSheetSource(){
    const input=document.getElementById('v2-sheet-url'),range=document.getElementById('v2-sheet-range');
    if(!input.value.trim()||!input.checkValidity())throw new Error('กรุณาระบุ URL ของ Google Sheets ให้ถูกต้อง');
    await request('google/source',{sheetUrl:input.value.trim(),sheetRange:range.value.trim()});
    discardCloud();cloudInbox=null;document.getElementById('v2-cloud-source')?.replaceChildren();
    const qa=document.getElementById('v2-cloud-qa');if(qa)qa.textContent='';
    await status();fillSheetSource();message('บันทึก URL ของ Google Sheets แล้ว · กดเชื่อม Google หรือกดตรวจแหล่งข้อมูลเมื่อเชื่อมแล้ว');
  }
  function roleChanged(auth){document.getElementById('v2-controls')?.classList.toggle('hidden',!auth||!state);document.getElementById('v2-publish')?.classList.toggle('hidden',state?.session?.role!=='superadmin');document.getElementById('v2-preview')?.classList.toggle('hidden',state?.session?.role!=='superadmin');if(auth&&state?.session&&sheetFormOwner!==state.session.username){fillSheetSource();sheetFormOwner=state.session.username;}if(!auth)sheetFormOwner='';}
  function bind(){
    if(!state)return;
    document.getElementById('v2-sheet-save')?.addEventListener('click',()=>action(saveSheetSource));
    for(const id of ['v2-preview','v2-publish']){const button=document.getElementById(id);if(button){button.disabled=true;button.hidden=true;}}
    document.getElementById('v2-google-connect')?.addEventListener('click',()=>action(async()=>{const result=await request('google/start',{});location.assign(result.url);}));
    document.getElementById('v2-google-disconnect')?.addEventListener('click',()=>action(async()=>{await request('google/disconnect',{});discardCloud();cloudInbox=null;document.getElementById('v2-cloud-source').replaceChildren();message('ตัดการเชื่อมต่อในเครื่องแล้ว HS เดิมยังคงอยู่; ถอนสิทธิ์ Google ได้ที่หน้าบัญชี Google');}));
    document.getElementById('v2-sync')?.addEventListener('click',()=>action(async()=>displayInbox(await request('google/sync',{}))));
    document.getElementById('v2-inbox')?.addEventListener('click',()=>action(async()=>displayInbox(await request('inbox'))));
    document.getElementById('v2-cloud-prepare')?.addEventListener('click',()=>action(prepareCloud));
    document.getElementById('v2-cloud-save')?.addEventListener('click',()=>action(commitCloud));
    document.getElementById('v2-cloud-source')?.addEventListener('change',discardCloud);
    document.getElementById('hotspot-import-provinces')?.addEventListener('change',discardCloud);
    document.getElementById('v2-cloud-status')?.addEventListener('click',()=>action(async()=>message('Google: '+(state.connections.google?'เชื่อมแล้ว':'ยังไม่เชื่อม')+' · '+(state.googleSync?.lastError||state.googleSync?.state||'idle')+' · ตรวจสำเร็จล่าสุด '+(state.googleSync?.lastSuccessAt||'ยังไม่มี'))));
    document.getElementById('v2-preview')?.addEventListener('click',()=>action(async()=>{lastPreview=await request('github/preview',{});document.getElementById('v2-preview-output').textContent=JSON.stringify(lastPreview,null,2);message('ตรวจรายการไฟล์และขอบเขตข้อมูลก่อนกดเผยแพร่');}));
    document.getElementById('v2-publish')?.addEventListener('click',()=>action(async()=>{if(!lastPreview)throw new Error('กดตรวจชุดเผยแพร่ก่อน');if(!confirm('เผยแพร่ไฟล์ตามรายการที่ตรวจแล้วไปยัง GitHub และเปิด GitHub Pages?'))return;const result=await request('github/publish',{confirm:true,previewHash:lastPreview.previewHash});message('เผยแพร่แล้ว '+(result.url||result.pagesUrl||result.commitSHA));lastPreview=null;}));
    roleChanged(Boolean(state.session));if(state.accessEdition&&typeof AccessContext!=='undefined')AccessContext.bind(state);
  }
  return{request,status,init,restore,savePlan,login,logout,bind,roleChanged,displayInbox,prepareCloud,commitCloud,get enabled(){return Boolean(state);},get state(){return state;}};
})();
