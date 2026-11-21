/*
 * KPP_ID — ตัวตนกลาง (SSO) ใช้ร่วมกัน 4 ระบบบน krit-pj.github.io
 *   Agri-Risk Map (ARM) · Green Gain Hub (GGH) · KPP Smart Agri-Materials (SAM)
 *   · ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร (ABM, 3.12.3 — ส่วนเจ้าหน้าที่ที่แยกจาก Green Gain Hub)
 *   3.12.4: เกษตรกรและผู้รับซื้อ (ลงทะเบียนผ่าน Green Gain Hub) ใช้ได้เฉพาะ Green Gain Hub — ข้อความยินยอมบอกไว้
 *
 * ผู้ใช้ทุกกลุ่มเข้าด้วยเบอร์โทรอย่างเดียว ลงทะเบียนครั้งเดียว ทุกระบบที่เชื่อมโยงใช้ด้วยกัน
 * (Mini Super Admin / Super Admin ใช้ชื่อผู้ใช้ + รหัสผ่านของแต่ละระบบ ไม่ผ่านไฟล์นี้)
 *
 * ใช้งาน:
 *   <script src="https://krit-pj.github.io/TH-Agri-Risk-Maps-Burning/js/kpp-id.js"></script>
 *   KPP_ID.open({ system: 'GGH', remember: true, onSignedIn: r => { ... } })   // กล่องเข้าสู่ระบบ/ลงทะเบียน
 *   const { ticket } = await KPP_ID.ticket('GGH')   // ส่งตั๋วให้ Apps Script ของระบบ แล้วเรียก id_redeem ฝั่งเซิร์ฟเวอร์
 *   KPP_ID.logout()                                  // ออกจากทุกระบบในเครื่องนี้
 *
 * เก็บใน localStorage 'kpp_id' เฉพาะ token ตัวตนและข้อมูลสรุป ไม่เก็บข้อมูลอื่น
 */
(function () {
  'use strict';
  const IDP_URL = window.KPP_ID_URL || 'https://script.google.com/macros/s/AKfycbzAgSOxgQsaOx9bqBYM53KXFzk1QKsop46HZeINgtUzLXkaZTYYaZH3RZu0l-HDlN8TKA/exec';
  const KEY = 'kpp_id';
  const SYSTEMS = { ARM: 'Agri-Risk Map', GGH: 'Green Gain Hub', SAM: 'KPP Smart Agri-Materials', ABM: 'ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร' };
  const PROVINCES = { '10': 'กรุงเทพมหานคร', '11': 'สมุทรปราการ', '12': 'นนทบุรี', '13': 'ปทุมธานี', '14': 'พระนครศรีอยุธยา', '15': 'อ่างทอง', '16': 'ลพบุรี', '17': 'สิงห์บุรี', '18': 'ชัยนาท', '19': 'สระบุรี', '20': 'ชลบุรี', '21': 'ระยอง', '22': 'จันทบุรี', '23': 'ตราด', '24': 'ฉะเชิงเทรา', '25': 'ปราจีนบุรี', '26': 'นครนายก', '27': 'สระแก้ว', '30': 'นครราชสีมา', '31': 'บุรีรัมย์', '32': 'สุรินทร์', '33': 'ศรีสะเกษ', '34': 'อุบลราชธานี', '35': 'ยโสธร', '36': 'ชัยภูมิ', '37': 'อำนาจเจริญ', '38': 'บึงกาฬ', '39': 'หนองบัวลำภู', '40': 'ขอนแก่น', '41': 'อุดรธานี', '42': 'เลย', '43': 'หนองคาย', '44': 'มหาสารคาม', '45': 'ร้อยเอ็ด', '46': 'กาฬสินธุ์', '47': 'สกลนคร', '48': 'นครพนม', '49': 'มุกดาหาร', '50': 'เชียงใหม่', '51': 'ลำพูน', '52': 'ลำปาง', '53': 'อุตรดิตถ์', '54': 'แพร่', '55': 'น่าน', '56': 'พะเยา', '57': 'เชียงราย', '58': 'แม่ฮ่องสอน', '60': 'นครสวรรค์', '61': 'อุทัยธานี', '62': 'กำแพงเพชร', '63': 'ตาก', '64': 'สุโขทัย', '65': 'พิษณุโลก', '66': 'พิจิตร', '67': 'เพชรบูรณ์', '70': 'ราชบุรี', '71': 'กาญจนบุรี', '72': 'สุพรรณบุรี', '73': 'นครปฐม', '74': 'สมุทรสาคร', '75': 'สมุทรสงคราม', '76': 'เพชรบุรี', '77': 'ประจวบคีรีขันธ์', '80': 'นครศรีธรรมราช', '81': 'กระบี่', '82': 'พังงา', '83': 'ภูเก็ต', '84': 'สุราษฎร์ธานี', '85': 'ระนอง', '86': 'ชุมพร', '90': 'สงขลา', '91': 'สตูล', '92': 'ตรัง', '93': 'พัทลุง', '94': 'ปัตตานี', '95': 'ยะลา', '96': 'นราธิวาส' };
  const CONSENT = 'ข้าพเจ้ายินยอมให้ใช้เบอร์โทร ชื่อ ตำแหน่ง หน่วยงาน และจังหวัดของข้าพเจ้า เพื่อยืนยันตัวตนและตรวจสอบการเข้าใช้งานระบบที่เชื่อมโยงกันตามสิทธิ์ของข้าพเจ้า (Agri-Risk Map, Green Gain Hub, KPP Smart Agri-Materials, ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร — เกษตรกรและผู้รับซื้อใช้ได้เฉพาะ Green Gain Hub) เท่านั้น ข้าพเจ้าในฐานะเจ้าของข้อมูลรับผิดชอบความถูกต้องของข้อมูลที่ให้ไว้ ระบบปกป้องข้อมูลตามขอบเขตที่กระทำได้ และขอแก้ไขหรือระงับได้ที่เจ้าหน้าที่';

  /* ---------------- เก็บตัวตนในเครื่อง ---------------- */
  function current() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!s || !s.token || !s.exp || Date.now() > s.exp) { if (s) localStorage.removeItem(KEY); return null; }
      return s;
    } catch (e) { return null; }
  }
  function save(r) {
    if (!r || !r.token) return null;
    const s = { token: r.token, exp: r.exp, person: r.person, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
    fire(); return s;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { } fire(); }
  function fire() { document.dispatchEvent(new CustomEvent('kpp-id:change', { detail: current() })); }
  window.addEventListener('storage', e => { if (e.key === KEY) fire(); });   // อีกแท็บเข้า/ออก

  /* ---------------- เรียก Agri-Risk ---------------- */
  async function post(action, body) {
    const res = await fetch(IDP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action }, body || {})) });
    if (!res.ok) throw new Error('เชื่อมต่อระบบตัวตนกลางไม่สำเร็จ (HTTP ' + res.status + ')');
    const data = await res.json();
    if (!data.ok) {
      const msg = String(data.error || 'เกิดข้อผิดพลาด');
      if (msg.startsWith('AUTH:')) clear();
      const err = new Error(msg.replace(/^AUTH:\s*/, '')); err.code = data.code || ''; throw err;
    }
    return data;
  }
  const phone = v => { let s = String(v == null ? '' : v).replace(/\D/g, ''); if (s.startsWith('66') && s.length === 11) s = '0' + s.slice(2); if (s.length === 9 && s[0] !== '0') s = '0' + s; return s; };
  function device() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'อื่น ๆ';
    const br = /Edg\//.test(ua) ? 'Edge' : /Line\//.test(ua) ? 'LINE' : /FBAN|FBAV/.test(ua) ? 'Facebook' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return br + ' / ' + os;
  }
  // 3.12.2: o.aud = ระบบที่จะเข้าต่อ → คำตอบมี r.ticket มาด้วย (ไม่ต้องเรียก ticket() อีกรอบ) ตั๋วไม่ถูกเก็บในเครื่อง
  async function login(p, o) { o = o || {}; const r = await post('id_login', { phone: phone(p), system: o.system || 'ARM', remember: !!o.remember, device: device(), aud: o.aud || '' }); save(r); return r; }
  async function register(d, o) { o = o || {}; const r = await post('id_register', Object.assign({}, d, { phone: phone(d.phone), system: o.system || 'ARM', remember: !!o.remember, device: device(), aud: o.aud || '' })); save(r); return r; }
  /** ตั๋วจากคำตอบ login/register ถ้ามี (ใช้ได้ครั้งเดียว) ไม่มีก็ขอใหม่ */
  async function ticketFrom(r, aud) {
    if (r && r.ticket) { const t = { ok: true, ticket: r.ticket, expiresIn: r.expiresIn }; delete r.ticket; return t; }
    return ticket(aud);
  }
  /** ปลุก Apps Script ของ Agri-Risk ล่วงหน้า (เช่น ตอนเปิดกล่องเข้าสู่ระบบ) ลดเวลารอครั้งแรก — ครั้งเดียวต่อ 5 นาที */
  let warmAt = 0;
  function warm() {
    if (Date.now() - warmAt < 300000) return; warmAt = Date.now();
    try { fetch(IDP_URL + '?action=ping', { cache: 'no-store' }).catch(() => { }); } catch (e) { }
  }
  async function ticket(aud) { const s = current(); if (!s) throw new Error('กรุณาเข้าสู่ระบบ'); return post('id_ticket', { idToken: s.token, aud }); }
  async function me() { const s = current(); if (!s) return null; const r = await post('id_me', { idToken: s.token }); save({ token: s.token, exp: s.exp, person: r.person }); return r; }
  async function notMe() { const s = current(); if (!s) return; try { await post('id_not_me', { idToken: s.token }); } finally { clear(); } }
  async function logoutAll() { const s = current(); if (s) { try { await post('id_logout_all', { idToken: s.token }); } catch (e) { } } clear(); }
  function logout() { clear(); }

  /* ---------------- กล่องเข้าสู่ระบบ / ลงทะเบียน ---------------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = v => { const d = new Date(String(v)); return isNaN(d) ? String(v) : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); };
  function css() {
    if (document.getElementById('kppid-css')) return;
    const st = document.createElement('style'); st.id = 'kppid-css';
    st.textContent = `
.kppid-back{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,20,.5);display:flex;align-items:flex-end;justify-content:center;padding:0}
@media(min-width:640px){.kppid-back{align-items:center;padding:1rem}}
.kppid-box{background:#fff;color:#1f2a22;width:100%;max-width:28rem;max-height:94dvh;overflow:auto;border-radius:16px 16px 0 0;font:15px/1.5 'Sarabun','Noto Sans Thai',system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.25)}
@media(min-width:640px){.kppid-box{border-radius:16px}}
.kppid-head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;padding:1rem 1.25rem .75rem;border-bottom:1px solid #dde6df}
.kppid-head h2{margin:0;font-size:1.15rem;font-weight:700;color:#0f4d24}.kppid-head p{margin:.15rem 0 0;font-size:.85rem;color:#5b6b60}
.kppid-x{border:0;background:none;font-size:1.25rem;line-height:1;width:44px;height:44px;margin:-.5rem -.75rem 0 0;border-radius:10px;cursor:pointer;color:#5b6b60}
.kppid-x:hover{background:#eef2ef}
.kppid-body{padding:1rem 1.25rem 1.25rem;display:grid;gap:.6rem}
.kppid-body[hidden]{display:none!important}
.kppid-body label{font-size:.85rem;font-weight:600;color:#1f2a22;display:grid;gap:.25rem}
.kppid-body input,.kppid-body select{font:inherit;font-size:16px;min-height:44px;border:1px solid #cfd8d2;border-radius:10px;padding:0 .75rem;background:#fff;color:#1f2a22;width:100%;box-sizing:border-box}
.kppid-body input:focus,.kppid-body select:focus{outline:3px solid rgba(26,127,55,.25);border-color:#1a7f37}
.kppid-tel{font-size:1.2rem!important;letter-spacing:.04em}
.kppid-row{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
.kppid-btn{font:inherit;font-weight:700;min-height:46px;border-radius:10px;border:1px solid #1a7f37;background:#1a7f37;color:#fff;cursor:pointer;padding:0 1rem}
.kppid-btn:hover{background:#0f4d24}.kppid-btn[disabled]{opacity:.6;cursor:wait}
.kppid-link{font:inherit;border:0;background:none;color:#0f4d24;font-weight:600;text-decoration:underline;cursor:pointer;padding:.25rem}
.kppid-msg{min-height:1.25rem;font-size:.88rem;margin:0}.kppid-msg.is-err{color:#a12a1f}.kppid-msg.is-ok{color:#1a7f37}
.kppid-note{font-size:.8rem;color:#5b6b60;margin:0}
.kppid-consent{display:flex!important;grid-template-columns:none!important;gap:.55rem!important;align-items:flex-start;font-weight:400!important;font-size:.82rem!important;line-height:1.55;background:#f6f8f5;border:1px solid #dde6df;border-radius:10px;padding:.6rem .7rem}
.kppid-consent input{width:18px!important;min-height:18px!important;height:18px;margin-top:.15rem;flex:none}
.kppid-check{display:flex!important;align-items:center;gap:.5rem;font-weight:400!important}
.kppid-check input{width:18px!important;min-height:18px!important;height:18px}
.kppid-prev{border:1px solid #e6d6a8;background:#fffaf0;border-radius:10px;padding:.65rem .75rem;font-size:.88rem;display:grid;gap:.4rem}
.kppid-prev b{color:#7a5a12}.kppid-prev .kppid-actions{display:flex;gap:.5rem;flex-wrap:wrap}
.kppid-ghost{font:inherit;font-weight:600;min-height:40px;border-radius:10px;border:1px solid #cfd8d2;background:#fff;color:#1f2a22;cursor:pointer;padding:0 .9rem}
.kppid-danger{border-color:#a12a1f;color:#a12a1f}`;
    document.head.appendChild(st);
  }
  function provinceOptions(sel) {
    return '<option value="">เลือกจังหวัด</option>' + Object.keys(PROVINCES).sort((a, b) => PROVINCES[a].localeCompare(PROVINCES[b], 'th'))
      .map(c => `<option value="${c}"${c === sel ? ' selected' : ''}>${PROVINCES[c]}</option>`).join('');
  }
  /** แจ้ง "เข้าครั้งก่อน" พร้อมปุ่ม "ไม่ใช่ฉัน" — คืน HTML (ผูกเหตุการณ์ด้วย bindPrev) */
  function prevHtml(prev) {
    if (!prev || !prev.at) return '';
    return `<div class="kppid-prev" role="note"><span><b>เข้าใช้ครั้งก่อน:</b> ${esc(when(prev.at))}${prev.device ? ' · ' + esc(prev.device) : ''}${prev.system && SYSTEMS[prev.system] ? ' · ' + esc(SYSTEMS[prev.system]) : ''}</span>
      <span class="kppid-note">ถ้าครั้งก่อนไม่ใช่ท่าน กด "ไม่ใช่ฉัน" ระบบจะระงับหมายเลขนี้ทุกระบบทันที แล้วติดต่อเจ้าหน้าที่เพื่อเปิดใช้ใหม่</span>
      <span class="kppid-actions"><button type="button" class="kppid-ghost" data-kppid-ok>ใช่ ฉันเอง</button><button type="button" class="kppid-ghost kppid-danger" data-kppid-notme>ไม่ใช่ฉัน</button></span></div>`;
  }
  function bindPrev(root, onDone) {
    const box = root.querySelector('.kppid-prev'); if (!box) return;
    box.querySelector('[data-kppid-ok]').addEventListener('click', () => { box.remove(); if (onDone) onDone(false); });
    box.querySelector('[data-kppid-notme]').addEventListener('click', async () => {
      if (!window.confirm('ยืนยัน: การเข้าครั้งก่อนไม่ใช่ท่าน ระบบจะระงับหมายเลขนี้ทุกระบบทันที')) return;
      try { await notMe(); } catch (e) { }
      box.innerHTML = '<b>ระงับหมายเลขนี้แล้ว</b><span class="kppid-note">กรุณาติดต่อเจ้าหน้าที่อำเภอหรือจังหวัดเพื่อตรวจสอบและเปิดใช้ใหม่</span>';
      if (onDone) onDone(true);
    });
  }

  /**
   * open({ system, title, subtitle, remember, askPosition, defaultProvince, phone, onSignedIn, onClose })
   *   remember: แสดงช่อง "จดจำเครื่องนี้ 30 วัน" (สำหรับเกษตรกร/ผู้รับซื้อ)
   *   askPosition: แสดงช่องตำแหน่ง/หน่วยงาน (เจ้าหน้าที่)
   */
  function open(o) {
    warm();
    o = o || {}; css();
    const system = SYSTEMS[String(o.system || '').toUpperCase()] ? String(o.system).toUpperCase() : 'ARM';
    const opener = document.activeElement;
    const back = document.createElement('div'); back.className = 'kppid-back';
    back.innerHTML = `<div class="kppid-box" role="dialog" aria-modal="true" aria-labelledby="kppid-title">
      <div class="kppid-head"><div><h2 id="kppid-title">${esc(o.title || 'เข้าสู่ระบบด้วยเบอร์โทร')}</h2><p>${esc(o.subtitle || 'ใช้เบอร์เดียวกันได้ทั้ง Agri-Risk Map, Green Gain Hub และ Smart Agri')}</p></div>
        <button type="button" class="kppid-x" aria-label="ปิดหน้าต่าง">✕</button></div>
      <form class="kppid-body" data-step="phone" novalidate>
        <label>เบอร์โทรศัพท์<input class="kppid-tel" name="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="12" placeholder="08x-xxx-xxxx" value="${esc(o.phone || '')}" required></label>
        ${o.remember ? '<label class="kppid-check"><input type="checkbox" name="remember" checked> จดจำเครื่องนี้ 30 วัน (ไม่ควรเลือกบนเครื่องสาธารณะ)</label>' : ''}
        <button class="kppid-btn" type="submit">เข้าสู่ระบบ</button>
        <p class="kppid-msg" role="status" aria-live="polite"></p>
        <p class="kppid-note">ยังไม่เคยลงทะเบียน? กรอกเบอร์แล้วกดเข้าสู่ระบบ ระบบจะพาไปลงทะเบียน</p>
      </form>
      <form class="kppid-body" data-step="register" hidden novalidate>
        <p class="kppid-note">หมายเลข <b data-show-phone></b> ยังไม่มีในระบบ ลงทะเบียนครั้งเดียว ใช้ได้ทุกระบบที่เชื่อมโยงกัน</p>
        <label>ชื่อ-นามสกุล<input name="fullName" autocomplete="name" maxlength="120" required></label>
        ${o.askPosition ? '<div class="kppid-row"><label>ตำแหน่ง<input name="position" maxlength="120"></label><label>หน่วยงาน<input name="affiliation" maxlength="160"></label></div>' : ''}
        <div class="kppid-row"><label>จังหวัด<select name="provinceCode" required>${provinceOptions(o.defaultProvince || '')}</select></label><label>อำเภอ<input name="districtName" maxlength="80" placeholder="เช่น เมือง"></label></div>
        <label class="kppid-consent"><input type="checkbox" name="consent"><span>${esc(CONSENT)}</span></label>
        <button class="kppid-btn" type="submit">ลงทะเบียนและเข้าสู่ระบบ</button>
        <button class="kppid-link" type="button" data-back>ย้อนกลับไปแก้เบอร์</button>
        <p class="kppid-msg" role="status" aria-live="polite"></p>
      </form>
      <div class="kppid-body" data-step="done" hidden></div>
    </div>`;
    document.body.appendChild(back);
    const box = back.querySelector('.kppid-box');
    const fPhone = back.querySelector('[data-step="phone"]'), fReg = back.querySelector('[data-step="register"]'), done = back.querySelector('[data-step="done"]');
    const msg = (f, t, cls) => { const m = f.querySelector('.kppid-msg'); m.textContent = t || ''; m.className = 'kppid-msg' + (cls ? ' ' + cls : ''); };
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus(); if (o.onClose) o.onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', e => { if (e.target === back) close(); });
    back.querySelector('.kppid-x').addEventListener('click', close);
    const show = step => { [fPhone, fReg, done].forEach(x => { x.hidden = x.dataset.step !== step; }); const f = back.querySelector(`[data-step="${step}"] input:not([type=checkbox]), [data-step="${step}"] button`); if (f) setTimeout(() => f.focus(), 30); };
    const remember = () => !!(fPhone.remember && fPhone.remember.checked);
    const finish = r => {
      const signedIn = () => { close(); if (o.onSignedIn) o.onSignedIn(r); };
      if (!r.prevLogin) return signedIn();
      done.innerHTML = `<p class="kppid-msg is-ok">เข้าสู่ระบบแล้ว: ${esc(r.person.fullName)}</p>${prevHtml(r.prevLogin)}`;
      show('done');
      bindPrev(done, suspended => { if (suspended) { done.insertAdjacentHTML('beforeend', '<button type="button" class="kppid-btn" data-kppid-close>ปิด</button>'); done.querySelector('[data-kppid-close]').addEventListener('click', close); } else signedIn(); });
    };
    fPhone.addEventListener('submit', async e => {
      e.preventDefault();
      const p = phone(fPhone.phone.value);
      if (!/^0\d{8,9}$/.test(p)) return msg(fPhone, 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก เช่น 0812345678', 'is-err');
      const btn = fPhone.querySelector('.kppid-btn'); btn.disabled = true; msg(fPhone, 'กำลังตรวจสอบ…');
      try { finish(await login(p, { system, remember: remember(), aud: o.aud })); }
      catch (err) {
        if (err.code === 'not_found') { fReg.querySelector('[data-show-phone]').textContent = p; msg(fPhone, ''); show('register'); }
        else msg(fPhone, err.message, 'is-err');
      } finally { btn.disabled = false; }
    });
    fReg.querySelector('[data-back]').addEventListener('click', () => show('phone'));
    fReg.addEventListener('submit', async e => {
      e.preventDefault();
      const d = { phone: fPhone.phone.value, fullName: fReg.fullName.value.trim(), provinceCode: fReg.provinceCode.value, districtName: fReg.districtName.value.trim(),
        position: fReg.position ? fReg.position.value.trim() : '', affiliation: fReg.affiliation ? fReg.affiliation.value.trim() : '', consent: fReg.consent.checked };
      if (d.fullName.length < 3) return msg(fReg, 'กรุณากรอกชื่อ-นามสกุล', 'is-err');
      if (!d.provinceCode) return msg(fReg, 'กรุณาเลือกจังหวัด', 'is-err');
      if (!d.consent) return msg(fReg, 'กรุณาอ่านและยอมรับเงื่อนไขการใช้ข้อมูล', 'is-err');
      const btn = fReg.querySelector('.kppid-btn'); btn.disabled = true; msg(fReg, 'กำลังลงทะเบียน…');
      try { finish(await register(d, { system, remember: remember(), aud: o.aud })); } catch (err) { msg(fReg, err.message, 'is-err'); } finally { btn.disabled = false; }
    });
    box.focus && setTimeout(() => fPhone.phone.focus(), 30);
    return { close };
  }

  window.KPP_ID = { url: IDP_URL, systems: SYSTEMS, provinces: PROVINCES, consent: CONSENT, current, save, clear, login, register, ticket, ticketFrom, warm, me, notMe, logout, logoutAll, open, prevHtml, bindPrev, device, phone };
})();
