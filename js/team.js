/* หน้า "ทีมผู้พัฒนาและที่ปรึกษา" — แสดงผลสาธารณะ / จัดการโดย Super Admin และ Mini Super Admin */
const Team = (() => {
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ROLES = ['ผู้พัฒนาระบบ', 'ที่ปรึกษา', 'อื่น ๆ'];
  const ROLE_STYLE = { 'ผู้พัฒนาระบบ': 'bg-brand-50 text-brand-700', 'ที่ปรึกษา': 'bg-amber-50 text-amber-800', 'อื่น ๆ': 'bg-slate-100 text-slate-700' };
  let members = [], filterRole = '', photoData = '', provinces = [];

  const user = () => Api.session()?.user || null;
  const canManage = () => ['superadmin', 'minisuper'].includes(user()?.role);
  function toast(text, error = false) {
    const t = el('toast'); t.textContent = text; t.classList.toggle('bg-red-700', error); t.classList.toggle('bg-brand-700', !error);
    t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 3200);
  }
  function setMsg(node, text, type = '') { node.textContent = text; node.className = node.className.replace(/\btext-(red|brand|ink)-\S+/g, '') + ' ' + ({ error: 'text-red-700', success: 'text-brand-700', working: 'text-ink-soft' }[type] || 'text-ink-soft'); }
  const initials = name => String(name || '?').replace(/^(นาย|นางสาว|นาง|ดร\.|ผศ\.|รศ\.|ศ\.)\s*/g, '').trim().charAt(0) || '?';
  const roleText = m => m.role === 'อื่น ๆ' ? (m.roleOther || 'อื่น ๆ') : m.role;
  const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : '';

  /* ---------------- init ---------------- */
  async function init() {
    el('footer-year').textContent = new Date().getFullYear() + 543;
    renderLinks(); renderRoleFilter(); bindLogin(); bindForm();
    el('team-search').addEventListener('input', render);
    el('btn-add').addEventListener('click', () => openForm());
    document.addEventListener('agri-risk:auth-changed', updateAuthUI);
    updateAuthUI();
    initCounter();
    try {
      const fc = await Geo.provinces();
      provinces = fc.features.map(f => ({ code: f.properties.pro_code, name: f.properties.pro_th })).sort((a, b) => a.name.localeCompare(b.name, 'th'));
      el('m-province').innerHTML = '<option value="">ไม่ระบุ</option>' + provinces.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
    } catch { }
    await load();
  }

  function renderLinks() {
    const ext = '<svg class="h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>';
    el('ext-links').innerHTML = CONFIG.LINKS.map(l => l.internal
      ? `<a class="hdr-link bg-white/10 text-white" href="${l.url}" aria-current="page" title="${l.title}">${l.label}</a>`
      : `<a class="hdr-link" href="${l.url}" target="_blank" rel="noopener noreferrer" title="${l.title}">${l.label}${ext}</a>`).join('');
  }
  function renderRoleFilter() {
    el('role-filter').innerHTML = [['', 'ทั้งหมด'], ...ROLES.map(r => [r, r])].map(([v, t]) =>
      `<button type="button" role="radio" aria-checked="${v === filterRole}" data-role="${v}" class="rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${v === filterRole ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink-soft ring-line hover:bg-brand-50'}">${t}<span class="ml-1 tabular-nums opacity-70" data-count="${v}"></span></button>`).join('');
    el('role-filter').querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { filterRole = b.dataset.role; renderRoleFilter(); render(); }));
    updateCounts();
  }
  function updateCounts() {
    el('role-filter').querySelectorAll('[data-count]').forEach(s => { const v = s.dataset.count; s.textContent = members.length ? `(${members.filter(m => !v || m.role === v).length})` : ''; });
  }

  async function initCounter() {
    if (!Api.configured()) return;
    let action = 'counter';
    try { if (!sessionStorage.getItem('agri-risk-visited')) { action = 'hit'; sessionStorage.setItem('agri-risk-visited', '1'); } } catch { }
    try { const r = await Api.get(action); el('counter-total').textContent = r.counter.total.toLocaleString('th-TH'); el('counter-today').textContent = r.counter.today.toLocaleString('th-TH'); } catch { }
  }

  /* ---------------- data ---------------- */
  async function load() {
    const st = el('team-status');
    if (!Api.configured()) { st.textContent = 'ยังไม่ได้เชื่อมต่อฐานข้อมูล'; return; }
    st.innerHTML = '<span class="inline-flex items-center gap-2"><span class="spinner"></span>กำลังโหลดข้อมูลทีม…</span>';
    try { members = (await Api.get('team')).members || []; st.textContent = ''; }
    catch (err) { st.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + err.message; members = []; }
    updateCounts(); render();
  }

  function render() {
    const q = el('team-search').value.trim().toLowerCase();
    const list = members.filter(m => (!filterRole || m.role === filterRole) && (!q || [m.fullName, m.position, m.affiliation, m.provinceName, m.expertise, m.education, roleText(m)].join(' ').toLowerCase().includes(q)));
    const grid = el('team-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center sm:col-span-2 lg:col-span-3">
        <p class="font-semibold text-ink">${members.length ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีข้อมูลทีมผู้พัฒนาและที่ปรึกษา'}</p>
        <p class="mt-1 text-sm text-ink-soft">${members.length ? 'ลองเปลี่ยนคำค้นหรือบทบาท' : canManage() ? 'กด "เพิ่มข้อมูล" เพื่อเพิ่มรายชื่อแรก' : 'Super Admin หรือ Mini Super Admin เข้าสู่ระบบเพื่อเพิ่มข้อมูล'}</p></div>`;
      return;
    }
    grid.innerHTML = list.map(card).join('');
    grid.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(members.find(m => m.id === b.dataset.edit))));
    grid.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', () => removeMember(members.find(m => m.id === b.dataset.delete))));
  }

  function card(m) {
    const photo = m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.fullName)}" class="h-full w-full object-cover" loading="lazy"/>` : `<span>${esc(initials(m.fullName))}</span>`;
    const place = [m.affiliation, m.provinceName ? `จังหวัด${m.provinceName}` : ''].filter(Boolean).map(esc).join(' · ');
    const detail = (label, text) => text ? `<div><dt class="text-xs font-semibold text-ink-mute">${label}</dt><dd class="mt-0.5 whitespace-pre-line text-sm leading-relaxed">${esc(text)}</dd></div>` : '';
    const links = (m.links || []).filter(l => safeUrl(l.url)).map(l => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded-md bg-paper px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-line hover:bg-brand-50">${esc(l.label || 'ลิงก์')}<svg class="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg></a>`).join('');
    return `<article class="flex flex-col rounded-2xl bg-white p-5 shadow-panel">
      <div class="flex items-start gap-4">
        <div class="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 text-2xl font-bold text-brand-700 ring-4 ring-brand-50">${photo}</div>
        <div class="min-w-0">
          <span class="status-pill ${ROLE_STYLE[m.role] || ROLE_STYLE['อื่น ๆ']}">${esc(roleText(m))}</span>
          <h3 class="mt-1.5 text-base font-bold leading-snug text-ink">${esc(m.fullName)}</h3>
          ${m.position ? `<p class="text-sm text-ink-soft">${esc(m.position)}</p>` : ''}
          ${place ? `<p class="mt-0.5 text-xs text-ink-mute">${place}</p>` : ''}
        </div>
      </div>
      ${(m.education || m.expertise) ? `<dl class="mt-4 space-y-2.5 border-t border-line pt-3">${detail('ความเชี่ยวชาญ', m.expertise)}${detail('ประวัติการศึกษา', m.education)}</dl>` : ''}
      ${links ? `<div class="mt-4 flex flex-wrap gap-1.5">${links}</div>` : ''}
      ${canManage() ? `<div class="mt-auto flex justify-end gap-1.5 border-t border-line pt-3 ${links || m.education || m.expertise ? '' : 'mt-4'}">
        <button type="button" class="btn-ghost btn-sm" data-edit="${esc(m.id)}">แก้ไข</button>
        <button type="button" class="btn-ghost btn-sm text-red-700" data-delete="${esc(m.id)}">ลบ</button></div>` : ''}
    </article>`;
  }

  /* ---------------- form ---------------- */
  function bindForm() {
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });
    el('m-role').addEventListener('change', syncRoleOther);
    el('photo-file').addEventListener('change', onPhoto);
    el('btn-photo-remove').addEventListener('click', () => { photoData = ''; renderPhoto(); });
    el('btn-link-add').addEventListener('click', () => addLinkRow());
    el('member-form').addEventListener('submit', save);
    el('btn-member-delete').addEventListener('click', () => removeMember(members.find(m => m.id === el('m-id').value), true));
  }
  function syncRoleOther() { el('m-role-other-wrap').classList.toggle('hidden', el('m-role').value !== 'อื่น ๆ'); }
  function renderPhoto() {
    el('photo-preview').innerHTML = photoData ? `<img src="${esc(photoData)}" alt="" class="h-full w-full object-cover"/>` : `<span>${esc(initials(el('m-name').value))}</span>`;
    el('btn-photo-remove').classList.toggle('hidden', !photoData);
  }
  function addLinkRow(l = { label: '', url: '' }) {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[1fr_1.6fr_auto] gap-2';
    row.innerHTML = `<input class="field" data-link-label maxlength="60" placeholder="ชื่อลิงก์ เช่น E-Portfolio" value="${esc(l.label)}"/>
      <input class="field" data-link-url type="url" placeholder="https://" value="${esc(l.url)}"/>
      <button type="button" class="icon-btn text-red-700" aria-label="ลบลิงก์">✕</button>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    el('m-links').appendChild(row);
  }
  function openForm(m = null) {
    if (!canManage()) return openLogin();
    const f = el('member-form'); f.reset();
    el('m-id').value = m?.id || '';
    el('member-title').textContent = m ? 'แก้ไขข้อมูลทีม' : 'เพิ่มข้อมูลทีม';
    el('m-name').value = m?.fullName || ''; el('m-role').value = ROLES.includes(m?.role) ? m.role : 'ผู้พัฒนาระบบ';
    el('m-role-other').value = m?.roleOther || ''; el('m-position').value = m?.position || ''; el('m-affiliation').value = m?.affiliation || '';
    el('m-province').value = m?.provinceCode || ''; el('m-education').value = m?.education || ''; el('m-expertise').value = m?.expertise || '';
    el('m-order').value = m?.sortOrder || '';
    el('m-links').innerHTML = ''; (m?.links?.length ? m.links : [{ label: 'E-Portfolio', url: '' }]).forEach(addLinkRow);
    photoData = m?.photo || ''; renderPhoto(); syncRoleOther();
    el('btn-member-delete').classList.toggle('hidden', !m);
    setMsg(el('member-status'), '');
    el('member-modal').classList.remove('hidden'); setTimeout(() => el('m-name').focus(), 0);
  }

  /** ย่อรูปเป็นจัตุรัส 320px JPEG ให้ขนาดพอดีกับเซลล์ Google Sheet (< 45,000 ตัวอักษร) */
  function onPhoto(e) {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return setMsg(el('member-status'), 'กรุณาเลือกไฟล์รูปภาพ', 'error');
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 3;
      let size = 320, q = 0.85, data = '';
      for (let i = 0; i < 12; i++) {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, Math.max(0, sy), side, side, 0, 0, size, size);
        data = c.toDataURL('image/jpeg', q);
        if (data.length < 45000) break;
        if (q > 0.55) q -= 0.1; else size = Math.round(size * 0.85);
      }
      if (data.length >= 45000) return setMsg(el('member-status'), 'รูปภาพมีรายละเอียดมากเกินไป กรุณาเลือกรูปอื่น', 'error');
      photoData = data; renderPhoto(); setMsg(el('member-status'), 'เพิ่มรูปภาพแล้ว (บันทึกเมื่อกด "บันทึกข้อมูล")', 'success');
    };
    img.onerror = () => { URL.revokeObjectURL(url); setMsg(el('member-status'), 'อ่านไฟล์รูปภาพไม่สำเร็จ', 'error'); };
    img.src = url;
  }

  async function save(e) {
    e.preventDefault();
    const st = el('member-status');
    const links = [...el('m-links').children].map(r => ({ label: r.querySelector('[data-link-label]').value.trim(), url: r.querySelector('[data-link-url]').value.trim() })).filter(l => l.url);
    const bad = links.find(l => !/^https?:\/\/\S+$/i.test(l.url));
    if (!el('m-name').value.trim()) { setMsg(st, 'กรุณากรอกชื่อ - สกุล', 'error'); return el('m-name').focus(); }
    if (bad) return setMsg(st, `ลิงก์ต้องขึ้นต้นด้วย https:// (${bad.url})`, 'error');
    const body = { id: el('m-id').value, fullName: el('m-name').value, role: el('m-role').value, roleOther: el('m-role-other').value, position: el('m-position').value,
      affiliation: el('m-affiliation').value, provinceCode: el('m-province').value, education: el('m-education').value, expertise: el('m-expertise').value,
      links: links.map(l => ({ label: l.label || 'ลิงก์', url: l.url })), sortOrder: el('m-order').value, photo: photoData };
    const btn = el('btn-member-save'); btn.disabled = true; setMsg(st, 'กำลังบันทึก…', 'working');
    try {
      await Api.post('team_save', body);
      el('member-modal').classList.add('hidden');
      toast(body.id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มข้อมูลแล้ว');
      await load();
    } catch (err) { setMsg(st, err.message, 'error'); if (!canManage()) { el('member-modal').classList.add('hidden'); openLogin(); } }
    finally { btn.disabled = false; }
  }

  function removeMember(m) {
    if (!m) return;
    el('confirm-text').textContent = `ลบข้อมูลของ ${m.fullName} ออกจากหน้าทีมผู้พัฒนาและที่ปรึกษา?`;
    el('confirm-modal').classList.remove('hidden');
    el('confirm-no').onclick = () => el('confirm-modal').classList.add('hidden');
    el('confirm-yes').onclick = async () => {
      el('confirm-yes').disabled = true;
      try { await Api.post('team_delete', { id: m.id }); el('confirm-modal').classList.add('hidden'); el('member-modal').classList.add('hidden'); toast('ลบข้อมูลแล้ว'); await load(); }
      catch (err) { el('confirm-modal').classList.add('hidden'); toast(err.message, true); }
      finally { el('confirm-yes').disabled = false; }
    };
  }

  /* ---------------- login (shares session with main page) ---------------- */
  function openLogin() { el('login-modal').classList.remove('hidden'); setMsg(el('login-status'), ''); setTimeout(() => el('login-phone').focus(), 0); }
  function bindLogin() {
    el('btn-login').addEventListener('click', openLogin);
    el('btn-logout').addEventListener('click', () => { Api.clearSession(); updateAuthUI(); toast('ออกจากระบบแล้ว'); });
    document.querySelectorAll('[data-login-tab]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('[data-login-tab]').forEach(x => x.classList.toggle('is-active', x === b));
      document.querySelectorAll('[data-login-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.loginPane !== b.dataset.loginTab));
    }));
    const device = () => { const ua = navigator.userAgent; return `${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'} / ${/Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : 'อื่น ๆ'}`; };
    const done = r => {
      Api.saveSession(r.token, r.user); el('login-modal').classList.add('hidden');
      toast(canManage() ? `เข้าสู่ระบบแล้ว: ${r.user.name}` : 'เข้าสู่ระบบแล้ว แต่บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลทีม', !canManage());
    };
    el('form-phone').addEventListener('submit', async e => {
      e.preventDefault(); const phone = Api.normalizePhone(el('login-phone').value);
      if (!/^0\d{8,9}$/.test(phone)) return setMsg(el('login-status'), 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก', 'error');
      setMsg(el('login-status'), 'กำลังตรวจสอบ…', 'working');
      try { done(await Api.post('login_admin', { phone, device: device() }, false)); } catch (err) { setMsg(el('login-status'), err.message, 'error'); }
    });
    el('form-super').addEventListener('submit', async e => {
      e.preventDefault(); setMsg(el('login-status'), 'กำลังตรวจสอบ…', 'working');
      try { done(await Api.post('login_super', { username: el('login-user').value.trim(), password: el('login-pass').value, device: device() }, false)); el('form-super').reset(); }
      catch (err) { setMsg(el('login-status'), err.message, 'error'); }
    });
  }
  function updateAuthUI() {
    const u = user();
    el('btn-login').classList.toggle('hidden', !!u);
    el('user-chip').classList.toggle('hidden', !u); el('user-chip').classList.toggle('flex', !!u);
    el('user-label').textContent = u ? u.name : '';
    el('btn-add').classList.toggle('hidden', !canManage());
    el('manage-hint').textContent = canManage() ? 'โหมดจัดการ: เพิ่ม แก้ไข หรือลบรายการได้จากปุ่มบนการ์ดแต่ละใบ' : u ? 'บัญชีของท่านดูข้อมูลได้ การจัดการข้อมูลทีมทำได้เฉพาะ Super Admin และ Mini Super Admin' : '';
    render();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Team.init());
