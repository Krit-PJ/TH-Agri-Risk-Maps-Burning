/* เข้าสู่ระบบ (Admin ด้วยเบอร์โทร / Super Admin), ขออนุญาตใช้งาน, แผงผู้ดูแล, นำเข้า HS */
const Admin = (() => {
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('th-TH');
  let provinces = [];       // [{code,name}]
  let hooks = {};

  /* ======================= helpers ======================= */
  function user() { return Api.session()?.user || null; }
  function isSuper() { return user()?.role === 'superadmin'; }
  /** Super Admin และ Mini Super Admin: ขอบเขตทุกจังหวัด */
  function isNational() { return ['superadmin', 'minisuper'].includes(user()?.role); }
  const ROLE_LABEL = { superadmin: 'Super Admin', minisuper: 'Mini Super Admin', admin: 'Admin' };
  function setMsg(node, text, type = '') {
    if (!node) return;
    node.textContent = text;
    node.className = node.className.replace(/\btext-(red|brand|amber|ink)-\S+/g, '').trim() + ' ' + ({ error: 'text-red-700', success: 'text-brand-700', warn: 'text-amber-700', working: 'text-ink-soft' }[type] || 'text-ink-soft');
  }
  function toast(text, type = 'success') {
    const t = el('toast'); t.textContent = text;
    t.className = t.className.replace(/\bbg-\S+/g, '') + (type === 'error' ? ' bg-red-700' : ' bg-brand-700');
    t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }
  function confirmBox(text, { requireText = '', yes = 'ยืนยัน' } = {}) {
    return new Promise(resolve => {
      const m = el('confirm-modal'), input = el('confirm-input');
      el('confirm-text').textContent = text; el('confirm-yes').textContent = yes;
      input.value = ''; input.classList.toggle('hidden', !requireText); input.placeholder = requireText ? `พิมพ์ "${requireText}" เพื่อยืนยัน` : '';
      m.classList.remove('hidden'); (requireText ? input : el('confirm-no')).focus();
      const done = v => { m.classList.add('hidden'); el('confirm-yes').onclick = el('confirm-no').onclick = null; resolve(v); };
      el('confirm-yes').onclick = () => { if (requireText && input.value.trim() !== requireText) { input.focus(); return; } done(true); };
      el('confirm-no').onclick = () => done(false);
    });
  }
  const provName = code => provinces.find(p => p.code === code)?.name || code;
  const statusPill = s => ({ approved: '<span class="status-pill bg-brand-50 text-brand-700">ใช้งาน</span>', disabled: '<span class="status-pill bg-red-50 text-red-700">ระงับ</span>', pending: '<span class="status-pill bg-amber-50 text-amber-700">รออนุมัติ</span>', rejected: '<span class="status-pill bg-paper text-ink-soft">ไม่อนุมัติ</span>' }[s] || esc(s));
  const dt = v => v ? new Date(String(v)).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  /* ======================= init ======================= */
  async function init(h = {}) {
    hooks = h;
    const fc = await Geo.provinces();
    provinces = fc.features.map(f => ({ code: f.properties.pro_code, name: f.properties.pro_th })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    const opts = '<option value="">เลือกจังหวัด</option>' + provinces.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
    ['reg-province', 'acc-province', 'batches-province'].forEach(id => { el(id).innerHTML = opts; });
    el('batches-province').addEventListener('change', loadBatches);

    el('btn-login').addEventListener('click', openLogin);
    document.querySelectorAll('[data-login-tab]').forEach(b => b.addEventListener('click', () => loginTab(b.dataset.loginTab)));
    el('btn-show-register').addEventListener('click', () => { setMsg(el('login-status'), ''); showPane('register'); });
    el('btn-hide-register').addEventListener('click', () => showPane('admin'));
    el('form-admin').addEventListener('submit', loginAdmin);
    el('form-super').addEventListener('submit', loginSuper);
    el('form-register').addEventListener('submit', register);
    ['admin-phone', 'reg-phone', 'acc-phone'].forEach(id => el(id).addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d-]/g, ''); }));

    el('btn-user').addEventListener('click', e => { e.stopPropagation(); toggleDrop(el('user-dropdown'), el('btn-user')); });
    el('btn-logout').addEventListener('click', logout);
    el('btn-open-console').addEventListener('click', () => { el('user-dropdown').classList.add('hidden'); openConsole(); });
    document.addEventListener('click', () => { el('user-dropdown').classList.add('hidden'); el('btn-user').setAttribute('aria-expanded', 'false'); });

    document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
    document.querySelectorAll('.modal').forEach(m => m.addEventListener('mousedown', e => { if (e.target === m && m.id !== 'confirm-modal') m.classList.add('hidden'); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach(m => { if (m.id !== 'confirm-modal') m.classList.add('hidden'); }); });

    document.querySelectorAll('#console-tabs [data-tab]').forEach(b => b.addEventListener('click', () => consoleTab(b.dataset.tab)));
    el('btn-import-save').addEventListener('click', saveImport);
    el('import-file').addEventListener('change', readImportFile);
    el('logins-days').addEventListener('change', loadLogins);
    el('logins-result').addEventListener('change', renderLogins);
    el('requests-filter').addEventListener('change', loadRequests);
    el('form-account').addEventListener('submit', saveAccount);
    el('btn-acc-cancel').addEventListener('click', resetAccountForm);
    el('btn-clear-province').addEventListener('click', clearProvince);
    el('form-settings').addEventListener('submit', saveSettings);
    document.addEventListener('agri-risk:auth-changed', updateUI);
    updateUI();
  }
  function toggleDrop(menu, btn) { const open = menu.classList.toggle('hidden') === false; btn.setAttribute('aria-expanded', String(open)); }

  /* ======================= login ======================= */
  function openLogin() {
    el('login-modal').classList.remove('hidden'); setMsg(el('login-status'), '');
    loginTab('admin');
    if (!Api.configured()) setMsg(el('login-status'), 'ยังไม่ได้เชื่อมต่อฐานข้อมูล (ตั้งค่า API_URL ใน js/config.js)', 'warn');
  }
  function loginTab(tab) {
    document.querySelectorAll('[data-login-tab]').forEach(b => { const on = b.dataset.loginTab === tab; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
    showPane(tab);
  }
  function showPane(p) {
    document.querySelectorAll('[data-login-pane]').forEach(f => f.classList.toggle('hidden', f.dataset.loginPane !== p));
    setTimeout(() => ({ admin: el('admin-phone'), super: el('super-user'), register: el('reg-phone') }[p])?.focus(), 0);
  }
  async function loginAdmin(e) {
    e.preventDefault();
    const phone = Api.normalizePhone(el('admin-phone').value);
    if (!/^0\d{8,9}$/.test(phone)) return setMsg(el('login-status'), 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก เช่น 0812345678', 'error');
    setMsg(el('login-status'), 'กำลังตรวจสอบ…', 'working');
    try {
      const r = await Api.post('login_admin', { phone, device: deviceLabel() }, false);
      Api.saveSession(r.token, r.user); el('form-admin').reset(); afterLogin();
    } catch (err) { setMsg(el('login-status'), err.message, 'error'); }
  }
  async function loginSuper(e) {
    e.preventDefault();
    setMsg(el('login-status'), 'กำลังตรวจสอบ…', 'working');
    try {
      const r = await Api.post('login_super', { username: el('super-user').value.trim(), password: el('super-pass').value, device: deviceLabel() }, false);
      Api.saveSession(r.token, r.user); el('form-super').reset(); afterLogin();
    } catch (err) { setMsg(el('login-status'), err.message, 'error'); }
  }
  function afterLogin() {
    el('login-modal').classList.add('hidden');
    toast(`เข้าสู่ระบบแล้ว: ${user().name}`);
    openConsole();
  }
  async function register(e) {
    e.preventDefault();
    const body = { phone: Api.normalizePhone(el('reg-phone').value), fullName: el('reg-name').value, position: el('reg-position').value, affiliation: el('reg-affiliation').value, provinceCode: el('reg-province').value };
    if (!/^0\d{8,9}$/.test(body.phone)) return setMsg(el('login-status'), 'เบอร์โทรศัพท์ไม่ถูกต้อง', 'error');
    if (!body.provinceCode) return setMsg(el('login-status'), 'กรุณาเลือกจังหวัด', 'error');
    setMsg(el('login-status'), 'กำลังส่งคำขอ…', 'working');
    try {
      await Api.post('register', body, false);
      el('form-register').reset(); showPane('admin');
      setMsg(el('login-status'), 'ส่งคำขอแล้ว ระบบจะเปิดสิทธิ์เมื่อผู้ดูแลอนุมัติ จากนั้นเข้าสู่ระบบด้วยเบอร์โทรศัพท์นี้', 'success');
    } catch (err) { setMsg(el('login-status'), err.message, 'error'); }
  }
  function logout() { Api.clearSession(); el('console').classList.add('hidden'); updateUI(); toast('ออกจากระบบแล้ว'); }

  function updateUI() {
    const u = user();
    el('btn-login').classList.toggle('hidden', !!u);
    el('user-menu').classList.toggle('hidden', !u);
    document.querySelectorAll('.national-only').forEach(n => n.classList.toggle('hidden', !isNational()));
    document.querySelectorAll('.super-only').forEach(n => n.classList.toggle('hidden', !isSuper()));
    if (!u) return;
    el('user-initial').textContent = { superadmin: 'S', minisuper: 'M', admin: 'A' }[u.role] || 'A';
    el('user-label').textContent = u.name;
    el('user-name').textContent = u.name;
    const scope = { superadmin: 'สิทธิ์เต็ม จัดการได้ทั้งระบบ รวมถึง Mini Super Admin', minisuper: 'จัดการได้ทุกจังหวัด (ยกเว้นการจัดการ Mini Super Admin)', admin: `จัดการได้เฉพาะจังหวัด${u.provName}` }[u.role];
    el('user-scope').textContent = `${ROLE_LABEL[u.role]} · ${scope}`;
    el('console-scope').textContent = `${ROLE_LABEL[u.role]} — ${scope}`;
    const s = el('acc-province'); s.disabled = !isNational(); if (!isNational()) s.value = u.prov;
    renderImportScope();
  }

  /* ======================= console ======================= */
  function openConsole(tab = 'import') {
    if (!user()) return openLogin();
    updateUI(); el('console').classList.remove('hidden'); consoleTab(tab); refreshBadge();
    if (isNational() && !el('batches-province').value && hooks.currentProvince?.()) el('batches-province').value = hooks.currentProvince();
  }
  function consoleTab(tab) {
    document.querySelectorAll('#console-tabs [data-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('#console [data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== tab));
    setMsg(el('console-status'), '');
    ({ batches: loadBatches, requests: loadRequests, accounts: loadAccounts, audit: loadAudit, logins: loadLogins, settings: loadSettings }[tab])?.();
  }
  async function refreshBadge() {
    try { const r = await Api.post('requests_list', { status: 'pending' }); const b = el('badge-requests'); b.textContent = r.requests.length; b.classList.toggle('hidden', !r.requests.length); } catch { }
  }
  async function run(fn, okText) {
    const loader = okText === undefined;   // โหลดรายการ: ไม่ทับข้อความผลการดำเนินการ
    if (!loader) setMsg(el('console-status'), 'กำลังดำเนินการ…', 'working');
    try { const r = await fn(); if (!loader) setMsg(el('console-status'), okText, 'success'); return r; }
    catch (err) { setMsg(el('console-status'), err.message, 'error'); if (!user()) el('console').classList.add('hidden'); return null; }
  }
  const empty = text => `<p class="rounded-xl bg-paper px-4 py-6 text-center text-sm text-ink-soft">${text}</p>`;

  /* ---------- requests ---------- */
  async function loadRequests() {
    const box = el('requests-list'); box.innerHTML = '<span class="spinner"></span>';
    const r = await run(() => Api.post('requests_list', { status: el('requests-filter').value }));
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = r.requests.length ? r.requests.map(q => `<div class="list-row">
        <div class="min-w-[12rem] flex-1"><p class="font-semibold">${esc(q.fullName)} ${statusPill(q.status)}</p>
        <p class="text-ink-soft">${esc(q.phone)} · ${esc(q.position || '-')} · ${esc(q.affiliation || '-')}</p>
        <p class="text-xs text-ink-mute">จังหวัด${esc(q.provinceName)} · ยื่นเมื่อ ${dt(q.createdAt)}${q.decidedBy ? ` · พิจารณาโดย ${esc(q.decidedBy)}` : ''}</p></div>
        ${q.status === 'pending' ? `<div class="flex gap-2"><button class="btn-primary btn-sm" data-decide="approve" data-id="${esc(q.requestId)}">อนุมัติ</button><button class="btn-ghost btn-sm" data-decide="reject" data-id="${esc(q.requestId)}">ไม่อนุมัติ</button></div>` : ''}
      </div>`).join('') : empty('ไม่มีคำขอในสถานะนี้');
    box.querySelectorAll('[data-decide]').forEach(b => b.addEventListener('click', async () => {
      const approve = b.dataset.decide === 'approve';
      if (!await confirmBox(approve ? 'อนุมัติคำขอนี้? ผู้ขอจะเข้าสู่ระบบด้วยเบอร์โทรศัพท์ได้ทันที' : 'ไม่อนุมัติคำขอนี้?', { yes: approve ? 'อนุมัติ' : 'ไม่อนุมัติ' })) return;
      if (await run(() => Api.post('request_decide', { requestId: b.dataset.id, decision: b.dataset.decide }), approve ? 'อนุมัติแล้ว' : 'บันทึกผลไม่อนุมัติแล้ว')) { loadRequests(); refreshBadge(); }
    }));
  }

  /* ---------- accounts ---------- */
  let accounts = [];
  async function loadAccounts() {
    const box = el('accounts-list'); box.innerHTML = '<span class="spinner"></span>';
    const r = await run(() => Api.post('accounts_list'));
    if (!r) { box.innerHTML = ''; return; }
    accounts = r.accounts.sort((a, b) => (a.role === 'minisuper' ? 0 : 1) - (b.role === 'minisuper' ? 0 : 1) || String(a.provinceName).localeCompare(String(b.provinceName), 'th') || String(a.accountId).localeCompare(String(b.accountId)));
    box.innerHTML = accounts.length ? `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ชื่อ</th><th>บทบาท</th><th>เบอร์โทร</th><th>จังหวัด</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>${accounts.map(a => `<tr>
      <td><p class="font-semibold">${esc(a.fullName)}</p><p class="text-xs text-ink-soft">${esc(a.position || '')} ${esc(a.affiliation || '')}</p></td>
      <td>${a.role === 'minisuper' ? '<span class="status-pill bg-indigo-50 text-indigo-700">Mini Super Admin</span>' : '<span class="status-pill bg-paper text-ink-soft">Admin</span>'}</td>
      <td class="tabular-nums">${esc(a.phone)}</td><td>${esc(a.provinceName)}</td><td>${statusPill(a.status)}</td><td class="text-xs">${dt(a.lastLoginAt)}</td>
      <td class="whitespace-nowrap text-right">${a.accountId === user().sub ? '<span class="text-xs text-ink-mute">บัญชีของท่าน</span>' : (a.role === 'minisuper' && !isSuper()) ? '<span class="text-xs text-ink-mute">จัดการได้เฉพาะ Super Admin</span>' : `
        <button class="btn-ghost btn-sm" data-acc-edit="${esc(a.accountId)}">แก้ไข</button>
        <button class="btn-ghost btn-sm" data-acc-status="${esc(a.accountId)}" data-to="${a.status === 'approved' ? 'disabled' : 'approved'}">${a.status === 'approved' ? 'ระงับ' : 'เปิดใช้'}</button>
        <button class="btn-ghost btn-sm text-red-700" data-acc-del="${esc(a.accountId)}">ลบ</button>`}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีผู้ดูแลในขอบเขตของท่าน');
    box.querySelectorAll('[data-acc-edit]').forEach(b => b.addEventListener('click', () => editAccount(b.dataset.accEdit)));
    box.querySelectorAll('[data-acc-status]').forEach(b => b.addEventListener('click', async () => {
      if (await run(() => Api.post('account_status', { accountId: b.dataset.accStatus, status: b.dataset.to }), 'บันทึกสถานะแล้ว')) loadAccounts();
    }));
    box.querySelectorAll('[data-acc-del]').forEach(b => b.addEventListener('click', async () => {
      const a = accounts.find(x => x.accountId === b.dataset.accDel);
      if (!await confirmBox(`ลบสิทธิ์ของ ${a.fullName} (${a.phone})?`, { yes: 'ลบสิทธิ์' })) return;
      if (await run(() => Api.post('account_delete', { accountId: a.accountId }), 'ลบสิทธิ์แล้ว')) loadAccounts();
    }));
  }
  function editAccount(id) {
    const a = accounts.find(x => x.accountId === id); if (!a) return;
    el('acc-id').value = a.accountId; el('acc-phone').value = a.phone; el('acc-name').value = a.fullName; el('acc-position').value = a.position || '';
    el('acc-affiliation').value = a.affiliation || ''; el('acc-province').value = a.provinceCode; el('acc-role').value = a.role === 'minisuper' ? 'minisuper' : 'admin';
    el('btn-acc-save').textContent = 'บันทึกการแก้ไข'; el('btn-acc-cancel').classList.remove('hidden'); el('acc-phone').focus();
  }
  function resetAccountForm() {
    el('form-account').reset(); el('acc-id').value = ''; el('btn-acc-save').textContent = 'เพิ่มผู้ดูแล'; el('btn-acc-cancel').classList.add('hidden');
    if (!isNational()) el('acc-province').value = user().prov;
  }
  async function saveAccount(e) {
    e.preventDefault();
    const body = { accountId: el('acc-id').value, phone: Api.normalizePhone(el('acc-phone').value), fullName: el('acc-name').value, position: el('acc-position').value, affiliation: el('acc-affiliation').value, provinceCode: isNational() ? el('acc-province').value : user().prov, role: isSuper() ? el('acc-role').value : 'admin' };
    if (!/^0\d{8,9}$/.test(body.phone)) return setMsg(el('console-status'), 'เบอร์โทรศัพท์ไม่ถูกต้อง', 'error');
    if (!body.provinceCode) return setMsg(el('console-status'), 'กรุณาเลือกจังหวัด', 'error');
    if (await run(() => Api.post('account_save', body), body.accountId ? 'บันทึกการแก้ไขแล้ว' : `เพิ่ม ${ROLE_LABEL[body.role]} แล้ว`)) { resetAccountForm(); loadAccounts(); }
  }

  /* ---------- batches ---------- */
  async function loadBatches() {
    const box = el('batches-list'); box.innerHTML = '<span class="spinner"></span>';
    const bp = el('batches-province');
    if (isNational() && bp.options[0]?.value === '') bp.options[0].textContent = 'ทุกจังหวัด';
    el('btn-clear-province').textContent = isNational() ? (bp.value ? `ล้างข้อมูล HS จังหวัด${provName(bp.value)}` : 'ล้างข้อมูล HS ทั้งจังหวัด') : `ล้างข้อมูล HS ทั้งจังหวัด${user().provName}`;
    el('btn-clear-province').disabled = isNational() && !bp.value;
    const r = await run(() => Api.post('hs_batches', isNational() && bp.value ? { provinceCode: bp.value } : {}));
    if (!r) { box.innerHTML = ''; return; }
    box.innerHTML = r.batches.length ? `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>ไฟล์</th><th>จังหวัด</th><th class="num">นำเข้า</th><th class="num">ซ้ำ</th><th>ช่วงวันที่</th><th>ผู้นำเข้า</th><th></th></tr></thead><tbody>${r.batches.map(b => `<tr>
      <td><p class="font-semibold">${esc(b.fileName || b.batchId)}</p><p class="text-xs text-ink-mute">${dt(b.importedAt)}</p></td><td>${esc(provName(String(b.provinceCode)))}</td>
      <td class="num">${fmt(b.accepted)}</td><td class="num">${fmt(b.duplicates)}</td><td class="text-xs">${Geo.thaiDate(b.firstDate)} – ${Geo.thaiDate(b.lastDate)}</td><td class="text-xs">${esc(b.importedBy)}</td>
      <td class="text-right"><button class="btn-ghost btn-sm text-red-700" data-batch-del="${esc(b.batchId)}" data-n="${b.accepted}">ลบชุดนี้</button></td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีชุดข้อมูลที่นำเข้า');
    box.querySelectorAll('[data-batch-del]').forEach(b => b.addEventListener('click', async () => {
      if (!await confirmBox(`ลบชุดข้อมูลนี้ (${fmt(b.dataset.n)} จุด) ออกจากฐานข้อมูล? การลบไม่สามารถย้อนกลับได้`, { yes: 'ลบชุดข้อมูล' })) return;
      const res = await run(() => Api.post('hs_delete_batch', { batchId: b.dataset.batchDel }), 'ลบชุดข้อมูลแล้ว');
      if (res) { loadBatches(); hooks.onDataChanged?.(); }
    }));
  }
  async function clearProvince() {
    const code = isNational() ? el('batches-province').value : user().prov;
    if (!code) return setMsg(el('console-status'), 'Super Admin: เลือกจังหวัดจากรายการก่อนล้างข้อมูล', 'warn');
    const name = provName(code);
    if (!await confirmBox(`ลบจุดความร้อนทั้งหมดของจังหวัด${name} และประวัติชุดข้อมูล การลบไม่สามารถย้อนกลับได้`, { requireText: name, yes: 'ล้างข้อมูล' })) return;
    const r = await run(() => Api.post('hs_clear', { provinceCode: code }), '');
    if (r) { setMsg(el('console-status'), `ลบแล้ว ${fmt(r.removed)} จุด`, 'success'); loadBatches(); hooks.onDataChanged?.(); }
  }

  /* ---------- audit / settings ---------- */
  async function loadAudit() {
    const box = el('audit-list'); box.innerHTML = '<span class="spinner"></span>';
    const r = await run(() => Api.post('audit_list', { limit: 300 }));
    if (!r) { box.innerHTML = ''; return; }
    const label = { login: 'เข้าสู่ระบบ', register: 'ยื่นคำขอ', request_approve: 'อนุมัติคำขอ', request_reject: 'ไม่อนุมัติคำขอ', account_create: 'เพิ่มผู้ดูแล', account_update: 'แก้ไขผู้ดูแล', account_disabled: 'ระงับสิทธิ์', account_approved: 'เปิดสิทธิ์', account_delete: 'ลบสิทธิ์', hs_import: 'นำเข้า HS', hs_delete_batch: 'ลบชุดข้อมูล', hs_clear: 'ล้างข้อมูล HS', settings_save: 'ตั้งค่าระบบ', setup: 'ติดตั้งระบบ' };
    box.innerHTML = r.logs.length ? `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>เวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th><th>จังหวัด</th><th>รายละเอียด</th></tr></thead><tbody>${r.logs.map(l => `<tr><td class="whitespace-nowrap text-xs">${dt(l.time)}</td><td>${esc(l.actor)}</td><td>${esc(label[l.action] || l.action)}</td><td>${esc(l.provinceCode ? provName(String(l.provinceCode).padStart(2, '0')) : '-')}</td><td class="text-xs text-ink-soft">${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีประวัติ');
  }
  async function loadSettings() { try { const r = await Api.get('settings'); el('set-guide').value = r.settings.guideUrl || ''; } catch (err) { setMsg(el('console-status'), err.message, 'error'); } }
  async function saveSettings(e) { e.preventDefault(); if (await run(() => Api.post('settings_save', { guideUrl: el('set-guide').value.trim() }), 'บันทึกการตั้งค่าแล้ว')) hooks.onSettingsChanged?.(); }

  /* ======================= Excel import (ต้นแบบ: hsID/Date/Province/LandType/PlantType) ======================= */
  const ALLOWED = new Set(CONFIG.PLANT_TYPES);
  const provinceAlias = s => Geo.clean(s).replace(/^กรุงเทพฯ?$/, 'กรุงเทพมหานคร').replace(/^กทม\.?$/, 'กรุงเทพมหานคร');

  function findDetailTable(wb) {
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true });
      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const headers = (rows[i] || []).map(v => String(v ?? '').trim());
        const hasDate = headers.includes('Date') || headers.includes('YYYY-MM-DD');
        if (['hsID', 'Province', 'LandType', 'PlantType'].every(k => headers.includes(k)) && hasDate) return { sheet: name, headers, rows: rows.slice(i + 1) };
      }
    }
    return null;
  }
  function readHsPlantReference(wb, provinceName) {
    const sheetName = wb.SheetNames.find(n => /^hsplant\d*$/i.test(String(n).trim()));
    if (!sheetName) return null;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const compact = v => String(v ?? '').replace(/\s+/g, '').trim();
    const hi = rows.findIndex(r => compact(r?.[0]) === 'จังหวัด' && r.some(v => compact(v) === 'นาข้าว'));
    if (hi < 0) return null;
    const headers = rows[hi].map(compact);
    const row = rows.slice(hi + 1).find(r => provinceAlias(r?.[0]) === provinceAlias(provinceName));
    if (!row) return null;
    const byPlant = {};
    headers.forEach((h, i) => { if (i === 0 || !h || /รวม|total/i.test(h)) return; const p = Geo.normalizeCrop(h); if (ALLOWED.has(p)) byPlant[p] = (byPlant[p] || 0) + (Number(row[i]) || 0); });
    return { sheet: sheetName, byPlant, total: Object.values(byPlant).reduce((a, b) => a + b, 0) };
  }
  function parseExcelDate(v) {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
    if (typeof v === 'number' && window.XLSX?.SSF) { const p = XLSX.SSF.parse_date_code(v); if (p) return { y: p.y, m: p.m, d: p.d }; }
    const s = String(v ?? '').trim(); let m;
    if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return { y: +m[1] > 2400 ? +m[1] - 543 : +m[1], m: +m[2], d: +m[3] };
    if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) return { y: +m[3] > 2400 ? +m[3] - 543 : +m[3], m: +m[2], d: +m[1] };
    return null;
  }
  function extractCoordinates(get, bundle) {
    const maps = String(get('Maps') ?? '');
    let m = maps.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i) || maps.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (m) return [Number(m[2]), Number(m[1])];
    const lat = Number(get('Latitude') ?? get('LATITUDE') ?? get('Lat') ?? get('lat')), lng = Number(get('Longitude') ?? get('LONGITUDE') ?? get('Lon') ?? get('Long') ?? get('lng'));
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat > 4 && lat < 22 && lng > 96 && lng < 107) return [lng, lat];
    const east = Number(get('X')), north = Number(get('Y'));
    if (Number.isFinite(east) && Number.isFinite(north) && east > 1000 && window.proj4) {
      const zoneCol = Number(get('Zone') ?? get('ZONE'));
      const zones = Number.isFinite(zoneCol) && zoneCol >= 46 && zoneCol <= 48 ? [zoneCol] : [47, 48];
      for (const z of zones) {
        try { const c = proj4(`+proj=utm +zone=${z} +datum=WGS84 +units=m +no_defs`, 'EPSG:4326', [east, north]); if (zones.length === 1 || Geo.insideProvince(bundle, c[0], c[1])) return c; } catch { }
      }
      try { return proj4('+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs', 'EPSG:4326', [east, north]); } catch { }
    }
    return null;
  }

  /* ---------- นำเข้าอัตโนมัติ: ผูกกับจังหวัดตามสิทธิ์ ---------- */
  let imp = null;   // { fileName, detail, idx, wb, found:[{code,name,rows,ag}], unknown:{}, selected:Set, results:{} }
  let procTimer = null;
  const provinceCodeByName = name => { const n = provinceAlias(name); return n ? (provinces.find(p => provinceAlias(p.name) === n)?.code || '') : ''; };

  function renderImportScope() {
    const box = el('import-scope'), u = user(); if (!u || !box) return;
    box.innerHTML = isNational()
      ? '<b>Super Admin</b> — เลือกไฟล์แล้วระบบแยกจังหวัดจากคอลัมน์ Province ให้อัตโนมัติ เลือกนำเข้าได้ 1 จังหวัด หลายจังหวัด หรือทุกจังหวัด'
      : `<b>จังหวัด${esc(u.provName)}</b> — ระบบผูกการนำเข้ากับจังหวัดตามสิทธิ์ของท่านโดยอัตโนมัติ และนำเข้าเฉพาะแถวที่ Province = ${esc(u.provName)} แถวของจังหวัดอื่นจะถูกข้าม`;
  }
  function resetImport() {
    imp = null; el('btn-import-save').disabled = true; el('btn-import-save').textContent = 'บันทึกเข้าฐานข้อมูล';
    el('import-preview').innerHTML = ''; el('import-provinces').innerHTML = ''; el('import-provinces').classList.add('hidden');
    setMsg(el('import-status'), '');
  }

  async function readImportFile() {
    resetImport();
    const file = el('import-file').files?.[0], status = el('import-status');
    if (!file) return;
    if (!window.XLSX) return setMsg(status, 'โหลดไลบรารีอ่าน Excel ไม่สำเร็จ กรุณารีเฟรชหน้า', 'error');
    setMsg(status, 'กำลังอ่านไฟล์และแยกข้อมูลรายจังหวัด…', 'working');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const detail = findDetailTable(wb);
      if (!detail) throw new Error('ไม่พบตารางที่มีคอลัมน์ hsID, Date (หรือ YYYY-MM-DD), Province, LandType และ PlantType');
      const idx = Object.fromEntries(detail.headers.map((h, i) => [h, i]));
      const counts = {}, unknown = {};
      detail.rows.forEach(row => {
        if (!row || row.every(v => v === null || v === '')) return;
        const name = row[idx.Province], code = provinceCodeByName(name);
        if (!code) { const k = String(name ?? '').trim() || '(ว่าง)'; unknown[k] = (unknown[k] || 0) + 1; return; }
        const c = counts[code] || (counts[code] = { code, name: provName(code), rows: 0, ag: 0 });
        c.rows++; if (String(row[idx.LandType] ?? '').trim() === 'พื้นที่เกษตร') c.ag++;
      });
      const found = Object.values(counts).sort((a, b) => b.ag - a.ag || a.name.localeCompare(b.name, 'th'));
      imp = { fileName: file.name, wb, detail, idx, found, unknown, selected: new Set(), results: {} };
      if (!found.length) throw new Error('ไม่พบชื่อจังหวัดที่ระบบรู้จักในคอลัมน์ Province');
      if (!isNational()) {
        const mine = counts[user().prov];
        if (!mine) throw new Error(`ไม่พบข้อมูลจังหวัด${user().provName}ในไฟล์นี้ (ไฟล์มีข้อมูล: ${found.slice(0, 8).map(f => f.name).join(', ')}${found.length > 8 ? ' …' : ''})`);
        imp.selected.add(user().prov);
        const others = found.filter(f => f.code !== user().prov).reduce((a, f) => a + f.rows, 0);
        if (others) imp.otherNote = `ข้ามแถวของจังหวัดอื่น ${fmt(others)} แถว (${found.filter(f => f.code !== user().prov).length} จังหวัด) ตามสิทธิ์ของท่าน`;
      } else {
        found.forEach(f => { if (f.ag) imp.selected.add(f.code); });
        renderProvincePicker();
      }
      await processSelected();
    } catch (err) { console.error(err); imp = null; setMsg(status, `อ่านไฟล์ไม่สำเร็จ: ${err.message}`, 'error'); }
  }

  function renderProvincePicker() {
    const box = el('import-provinces'); box.classList.remove('hidden');
    const unk = Object.entries(imp.unknown);
    box.innerHTML = `<div class="rounded-xl border border-line p-3">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold">พบข้อมูล ${imp.found.length} จังหวัดในไฟล์ <span class="font-normal text-ink-soft">(จำนวนจุดในพื้นที่เกษตร)</span></p>
        <div class="flex gap-1.5"><button type="button" class="btn-ghost btn-sm" data-pick="all">เลือกทุกจังหวัด</button><button type="button" class="btn-ghost btn-sm" data-pick="none">ล้างการเลือก</button></div>
      </div>
      <div class="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">${imp.found.map(f => `<label class="chip ${f.ag ? '' : 'opacity-50'}"><input type="checkbox" value="${f.code}" ${imp.selected.has(f.code) ? 'checked' : ''} ${f.ag ? '' : 'disabled'}/> <span class="truncate">${esc(f.name)}</span><span class="ml-auto tabular-nums text-ink-soft">${fmt(f.ag)}</span></label>`).join('')}</div>
      ${unk.length ? `<p class="mt-2 text-xs text-amber-700">ชื่อจังหวัดที่ไม่รู้จัก (ข้าม): ${unk.map(([k, v]) => `${esc(k)} ${fmt(v)} แถว`).join(', ')}</p>` : ''}
    </div>`;
    box.querySelectorAll('input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => { cb.checked ? imp.selected.add(cb.value) : imp.selected.delete(cb.value); queueProcess(); }));
    box.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      imp.selected = new Set(b.dataset.pick === 'all' ? imp.found.filter(f => f.ag).map(f => f.code) : []);
      box.querySelectorAll('input[type=checkbox]:not(:disabled)').forEach(cb => { cb.checked = imp.selected.has(cb.value); });
      queueProcess();
    }));
  }
  function queueProcess() { clearTimeout(procTimer); el('btn-import-save').disabled = true; procTimer = setTimeout(processSelected, 450); }

  async function processSelected() {
    if (!imp) return;
    const status = el('import-status'), codes = [...imp.selected];
    el('btn-import-save').disabled = true;
    if (!codes.length) { el('import-preview').innerHTML = ''; el('btn-import-save').textContent = 'บันทึกเข้าฐานข้อมูล'; return setMsg(status, 'เลือกอย่างน้อย 1 จังหวัด', 'warn'); }
    let i = 0;
    for (const code of codes) {
      i++;
      if (imp.results[code]) continue;
      setMsg(status, `กำลังตรวจสอบจังหวัด${provName(code)} (${i}/${codes.length})…`, 'working');
      try { imp.results[code] = await processProvince(code); }
      catch (err) { imp.results[code] = { code, name: provName(code), records: [], error: err.message }; }
    }
    if (!imp) return;
    renderImportPreview(codes.filter(c => imp.selected.has(c)));
  }

  async function processProvince(code) {
    const { detail, idx, wb } = imp;
    const provinceName = provName(code), bundle = await Geo.provinceBundle(code);
    const seen = new Set();
    const qa = { input: 0, accepted: 0, wrongLand: 0, wrongPlant: 0, wrongDate: 0, duplicates: 0, noCoordinates: 0, outside: 0 };
    const records = [], byPlant = {}, byMonth = {}, byDistrict = {};
    for (const row of detail.rows) {
      if (!row || row.every(v => v === null || v === '')) continue;
      const get = k => (idx[k] === undefined ? undefined : row[idx[k]]);
      if (provinceCodeByName(get('Province')) !== code) continue;
      qa.input++;
      if (String(get('LandType') ?? '').trim() !== 'พื้นที่เกษตร') { qa.wrongLand++; continue; }
      const plantRaw = String(get('PlantType') ?? '').trim(), plant = plantRaw ? Geo.normalizeCrop(plantRaw) : '';
      if (!ALLOWED.has(plant)) { qa.wrongPlant++; continue; }
      const d = parseExcelDate(get('Date') ?? get('YYYY-MM-DD'));
      if (!d || d.y < 2000 || d.y > 2100) { qa.wrongDate++; continue; }
      const id = String(get('hsID') ?? '').trim();
      if (id && seen.has(id)) { qa.duplicates++; continue; } if (id) seen.add(id);
      const c = extractCoordinates(get, bundle);
      if (!c) { qa.noCoordinates++; continue; }
      if (!Geo.insideProvince(bundle, c[0], c[1])) qa.outside++;
      const dName = String(get('Amphoe') ?? '').trim(), sName = String(get('Tambon') ?? '').trim();
      const codes = Geo.resolveCodes(bundle, c[0], c[1], dName, sName);
      const date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`, time = String(get('Time') ?? '').trim();
      records.push({ id: id || `${date}_${time}_${c[1].toFixed(5)}_${c[0].toFixed(5)}`, date, time, dCode: codes.dCode, sCode: codes.sCode, dName, sName, village: String(get('BaanN') ?? '').trim(), plant, lat: +c[1].toFixed(6), lng: +c[0].toFixed(6) });
      byPlant[plant] = (byPlant[plant] || 0) + 1;
      const ym = `${d.y}-${String(d.m).padStart(2, '0')}`; byMonth[ym] = (byMonth[ym] || 0) + 1;
      const dn = bundle.district.features.find(f => f.properties.amp_code === codes.dCode)?.properties.amp_th || dName || 'ไม่ระบุ';
      byDistrict[dn] = (byDistrict[dn] || 0) + 1;
    }
    qa.accepted = records.length;
    const ref = readHsPlantReference(wb, provinceName);
    const refMatch = ref ? records.length === ref.total && Object.keys(ref.byPlant).every(p => (byPlant[p] || 0) === ref.byPlant[p]) : null;
    const dates = records.map(r => r.date).sort();
    let error = '';
    if (!records.length) error = 'ไม่มีจุดที่ผ่านเกณฑ์ (พื้นที่เกษตร/ชนิดพืช/วันที่/พิกัด)';
    else if (refMatch === false) error = `ยอด ${fmt(records.length)} จุด ไม่ตรงกับชีต ${ref.sheet} (${fmt(ref.total)} จุด)`;
    return { code, name: provinceName, records, qa, byPlant, byMonth, byDistrict, ref, refMatch, first: dates[0], last: dates[dates.length - 1], error };
  }

  function provinceDetail(r) {
    return `<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        ${[[fmt(r.qa.accepted), 'จุดที่ผ่านเกณฑ์'], [fmt(r.qa.duplicates), 'hsID ซ้ำ (ตัดออก)'], [fmt(r.qa.noCoordinates), 'ไม่มีพิกัด'], [fmt(r.qa.outside), 'อยู่นอกขอบเขตจังหวัด']].map(([v, l]) => `<div class="rounded-lg bg-paper p-2.5"><div class="text-lg font-bold">${v}</div><div class="text-xs text-ink-soft">${l}</div></div>`).join('')}
      </div>
      <p>ช่วงวันที่ ${Geo.thaiDate(r.first)} – ${Geo.thaiDate(r.last)} · แถวของจังหวัดนี้ ${fmt(r.qa.input)} แถว (ไม่ใช่พื้นที่เกษตร ${fmt(r.qa.wrongLand)} · ชนิดพืชไม่อยู่ในเกณฑ์ ${fmt(r.qa.wrongPlant)} · วันที่ไม่ถูกต้อง ${fmt(r.qa.wrongDate)})</p>
      <p><b>ชนิดพืช:</b> ${Object.entries(r.byPlant).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')}</p>
      <p><b>รายเดือน:</b> ${Object.entries(r.byMonth).sort().map(([k, v]) => `${CONFIG.MONTH_SHORT[+k.slice(5)]} ${+k.slice(0, 4) + 543} ${fmt(v)}`).join(' · ')}</p>
      <p><b>รายอำเภอ:</b> ${Object.entries(r.byDistrict).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${fmt(v)}`).join(' · ')}</p>
      ${r.ref ? `<p class="${r.refMatch ? 'text-brand-700' : 'text-red-700'} font-semibold">ตรวจยอดกับชีต ${esc(r.ref.sheet)}: ${r.refMatch ? 'ตรงกัน' : 'ไม่ตรงกัน'} (อ้างอิง ${fmt(r.ref.total)} จุด)</p>` : '<p class="text-ink-soft">ไม่พบชีต hsPlant สำหรับตรวจยอด</p>'}`;
  }

  function renderImportPreview(codes) {
    const results = codes.map(c => imp.results[c]).filter(Boolean);
    const valid = results.filter(r => !r.error), blocked = results.filter(r => r.error);
    const total = valid.reduce((a, r) => a + r.records.length, 0);
    const box = el('import-preview');
    if (results.length === 1) {
      const r = results[0];
      box.innerHTML = `<div class="space-y-3 rounded-xl border border-line p-4 text-sm"><p class="font-bold text-brand-800">จังหวัด${esc(r.name)}</p>${r.records.length ? provinceDetail(r) : ''}${r.error ? `<p class="font-semibold text-red-700">${esc(r.error)}</p>` : ''}${imp.otherNote ? `<p class="text-ink-soft">${esc(imp.otherNote)}</p>` : ''}</div>`;
    } else {
      box.innerHTML = `<div class="overflow-x-auto rounded-xl border border-line"><table class="data-table"><thead><tr><th>จังหวัด</th><th class="num">ผ่านเกณฑ์</th><th class="num">ซ้ำ</th><th class="num">ไม่มีพิกัด</th><th>ช่วงวันที่</th><th>ตรวจยอด hsPlant</th><th>สถานะ</th></tr></thead><tbody>${results.map(r => `<tr>
          <td class="font-semibold">${esc(r.name)}</td><td class="num">${fmt(r.records.length)}</td><td class="num">${fmt(r.qa?.duplicates)}</td><td class="num">${fmt(r.qa?.noCoordinates)}</td>
          <td class="whitespace-nowrap text-xs">${r.first ? `${Geo.thaiDate(r.first)} – ${Geo.thaiDate(r.last)}` : '-'}</td>
          <td class="text-xs">${r.ref ? (r.refMatch ? '<span class="text-brand-700">ตรงกัน</span>' : '<span class="text-red-700">ไม่ตรงกัน</span>') : '<span class="text-ink-mute">ไม่มีชีตอ้างอิง</span>'}</td>
          <td class="text-xs">${r.error ? `<span class="text-red-700">${esc(r.error)}</span>` : '<span class="status-pill bg-brand-50 text-brand-700">พร้อมนำเข้า</span>'}</td></tr>`).join('')}</tbody>
          <tfoot><tr><th>รวม ${valid.length} จังหวัดที่พร้อม</th><th class="num">${fmt(total)}</th><th colspan="5"></th></tr></tfoot></table></div>
        ${results.filter(r => r.records.length).map(r => `<details class="rounded-xl border border-line text-sm"><summary class="cursor-pointer px-4 py-2.5 font-semibold">รายละเอียดจังหวัด${esc(r.name)}</summary><div class="space-y-3 px-4 pb-4">${provinceDetail(r)}</div></details>`).join('')}`;
    }
    const btn = el('btn-import-save');
    btn.disabled = !valid.length;
    btn.textContent = valid.length > 1 ? `บันทึก ${valid.length} จังหวัด (${fmt(total)} จุด)` : valid.length ? `บันทึกจังหวัด${valid[0].name} (${fmt(total)} จุด)` : 'บันทึกเข้าฐานข้อมูล';
    if (!valid.length) setMsg(el('import-status'), 'ไม่มีจังหวัดที่ผ่านการตรวจสอบ จึงยังบันทึกไม่ได้', 'error');
    else setMsg(el('import-status'), `ตรวจสอบอัตโนมัติแล้ว พร้อมนำเข้า ${fmt(total)} จุด${blocked.length ? ` · ข้าม ${blocked.length} จังหวัดที่ไม่ผ่าน (${blocked.map(b => b.name).join(', ')})` : ''} ระบบไม่บันทึกจุดที่มีอยู่แล้วซ้ำ`, blocked.length ? 'warn' : 'success');
  }

  async function saveImport() {
    if (!imp) return;
    const valid = [...imp.selected].map(c => imp.results[c]).filter(r => r && !r.error);
    if (!valid.length) return;
    const btn = el('btn-import-save'), bar = el('import-progress'), fill = bar.firstElementChild, status = el('import-status');
    btn.disabled = true; bar.classList.remove('hidden'); fill.style.width = '0%';
    const grand = valid.reduce((a, r) => a + r.records.length, 0), size = 2000, stamp = Date.now();
    let sent = 0; const done = [];
    try {
      for (const r of valid) {
        const batchId = `B-${r.code}-${stamp}`; let accepted = 0, duplicates = 0;
        for (let i = 0; i < r.records.length; i += size) {
          const chunk = r.records.slice(i, i + size);
          setMsg(status, `กำลังบันทึกจังหวัด${r.name} ${fmt(Math.min(i + size, r.records.length))}/${fmt(r.records.length)} จุด (${done.length + 1}/${valid.length} จังหวัด)…`, 'working');
          const res = await Api.post('hs_import', { provinceCode: r.code, batchId, fileName: imp.fileName, rows: chunk, final: i + size >= r.records.length });
          accepted += res.accepted; duplicates += res.duplicates; sent += chunk.length;
          fill.style.width = `${Math.round(sent * 100 / grand)}%`;
        }
        done.push({ name: r.name, accepted, duplicates });
      }
      const acc = done.reduce((a, d) => a + d.accepted, 0), dup = done.reduce((a, d) => a + d.duplicates, 0);
      setMsg(status, `นำเข้าสำเร็จ ${fmt(acc)} จุด จาก ${done.length} จังหวัด${dup ? ` (มีอยู่แล้ว ${fmt(dup)} จุด จึงไม่บันทึกซ้ำ)` : ''}: ${done.map(d => `${d.name} ${fmt(d.accepted)}`).join(', ')}`, 'success');
      toast(`นำเข้า HS ${done.length} จังหวัด รวม ${fmt(acc)} จุด`);
      imp = null; el('import-file').value = ''; btn.textContent = 'บันทึกเข้าฐานข้อมูล';
      hooks.onDataChanged?.(done.length === 1 ? valid[0].code : '');
    } catch (err) {
      setMsg(status, `บันทึกไม่สำเร็จ: ${err.message}${done.length ? ` (บันทึกแล้ว: ${done.map(d => d.name).join(', ')})` : ''} — กดบันทึกใหม่ได้ ระบบไม่บันทึกจุดซ้ำ`, 'error'); btn.disabled = false;
    } finally { setTimeout(() => bar.classList.add('hidden'), 1200); }
  }

  /* ---------- รายงานการพยายามเข้าใช้ ---------- */
  let logins = null;
  function deviceLabel() {
    const ua = navigator.userAgent;
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'อื่น ๆ';
    const br = /Edg\//.test(ua) ? 'Edge' : /Line\//.test(ua) ? 'LINE' : /FBAN|FBAV/.test(ua) ? 'Facebook' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return `${br} / ${os}`;
  }
  async function loadLogins() {
    el('logins-list').innerHTML = '<span class="spinner"></span>';
    el('logins-scope').textContent = isNational() ? 'บันทึกทุกครั้งที่มีการกดเข้าสู่ระบบ รวมหมายเลขที่ไม่มีในระบบ (ไม่บันทึกรหัสผ่าน)' : `การเข้าใช้ของผู้ดูแลจังหวัด${user().provName} (ไม่บันทึกรหัสผ่าน)`;
    const r = await run(() => Api.post('login_report', { days: Number(el('logins-days').value) }));
    if (!r) { el('logins-list').innerHTML = ''; return; }
    logins = r; renderLogins();
  }
  function renderLogins() {
    if (!logins) return;
    const L = { success: ['สำเร็จ', 'bg-brand-50 text-brand-700'], not_found: ['ไม่มีหมายเลขในระบบ', 'bg-red-50 text-red-700'], pending: ['รออนุมัติ', 'bg-amber-50 text-amber-700'], disabled: ['บัญชีถูกระงับ', 'bg-red-50 text-red-700'], wrong_credentials: ['รหัสผ่านไม่ถูกต้อง', 'bg-red-50 text-red-700'], invalid: ['รูปแบบไม่ถูกต้อง', 'bg-paper text-ink-soft'] };
    const sum = logins.summary || {}, total = Object.values(sum).reduce((a, b) => a + b, 0);
    el('logins-summary').innerHTML = [[fmt(total), `ครั้งใน ${logins.days} วัน`], [fmt(sum.success), 'เข้าใช้สำเร็จ'], [fmt(sum.not_found), 'หมายเลขไม่มีในระบบ'], [fmt((sum.pending || 0) + (sum.disabled || 0) + (sum.wrong_credentials || 0) + (sum.invalid || 0)), 'ไม่สำเร็จด้วยเหตุอื่น']]
      .map(([v, l]) => `<div class="rounded-lg bg-paper p-2.5"><div class="text-lg font-bold">${v}</div><div class="text-xs text-ink-soft">${l}</div></div>`).join('');
    const unk = el('logins-unknown');
    if (isNational()) {
      unk.classList.remove('hidden');
      unk.innerHTML = `<h4 class="mb-2 text-sm font-bold">หมายเลขที่ไม่มีในระบบแต่พยายามเข้าใช้ (${fmt(logins.unknown.length)} หมายเลข)</h4>` + (logins.unknown.length ? `<div class="overflow-x-auto"><table class="data-table"><thead><tr><th>เบอร์โทรศัพท์</th><th class="num">จำนวนครั้ง</th><th>ครั้งแรก</th><th>ล่าสุด</th><th></th></tr></thead><tbody>${logins.unknown.map(u => `<tr><td class="tabular-nums font-semibold">${esc(u.phone)}</td><td class="num">${fmt(u.attempts)}</td><td class="text-xs">${dt(u.firstAt)}</td><td class="text-xs">${dt(u.lastAt)}</td><td class="text-right"><button type="button" class="btn-ghost btn-sm" data-add-phone="${esc(u.phone)}">เพิ่มเป็นผู้ดูแล</button></td></tr>`).join('')}</tbody></table></div>` : empty('ไม่มีหมายเลขที่ไม่รู้จักในช่วงนี้'));
      unk.querySelectorAll('[data-add-phone]').forEach(b => b.addEventListener('click', () => { consoleTab('accounts'); resetAccountForm(); el('acc-phone').value = b.dataset.addPhone; el('acc-name').focus(); }));
    } else unk.classList.add('hidden');
    const filter = el('logins-result').value;
    const rows = logins.attempts.filter(a => !filter || a.result === filter);
    el('logins-list').innerHTML = rows.length ? `<h4 class="mb-2 text-sm font-bold">รายการล่าสุด</h4><div class="overflow-x-auto"><table class="data-table"><thead><tr><th>เวลา</th><th>บทบาท</th><th>หมายเลข/ชื่อผู้ใช้</th><th>ผล</th><th>ชื่อ</th><th>จังหวัด</th><th>อุปกรณ์</th></tr></thead><tbody>${rows.map(a => `<tr>
        <td class="whitespace-nowrap text-xs">${dt(a.time)}</td><td class="text-xs">${ROLE_LABEL[a.role] || a.role}</td><td class="tabular-nums">${esc(a.identifier)}</td>
        <td><span class="status-pill ${(L[a.result] || ['', 'bg-paper'])[1]}">${esc((L[a.result] || [a.resultLabel])[0])}</span></td><td>${esc(a.fullName || '-')}</td><td>${esc(a.provinceName || '-')}</td><td class="text-xs text-ink-soft">${esc(a.device || '-')}</td></tr>`).join('')}</tbody></table></div>` : empty('ไม่มีรายการในช่วงนี้');
  }

  return { init, openLogin, openConsole, toast, user };
})();
