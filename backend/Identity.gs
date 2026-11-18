/**
 * v3.12 ตัวตนกลาง (SSO) สำหรับ 3 ระบบ: Agri-Risk Map (ARM), Green Gain Hub (GGH), KPP Smart Agri-Materials (SAM)
 *
 * หลักการ
 *  - ผู้ใช้ทุกกลุ่ม (เกษตรกร ผู้รับซื้อ เจ้าหน้าที่) ยืนยันตัวตนด้วยเบอร์โทรอย่างเดียว ลงทะเบียนครั้งเดียวใช้ได้ทุกระบบ
 *  - Mini Super Admin / Super Admin ใช้ชื่อผู้ใช้ + รหัสผ่านของแต่ละระบบ ไม่ผ่านตัวตนกลาง
 *  - ตัวตนกลางตอบเพียง "คนนี้คือเจ้าของเบอร์นี้" สิทธิ์ในแต่ละระบบยังตัดสินจากชีตบัญชีของระบบนั้น
 *  - ระบบปลายทางรับ "ตั๋ว" อายุ 2 นาที ใช้ได้ครั้งเดียว แล้วถามกลับมาที่ id_redeem (ไม่ต้องแลกกุญแจลับระหว่างระบบ)
 *  - ข้อมูลใช้เพื่อการยืนยันและตรวจสอบการเข้าใช้งานเท่านั้น
 *
 * ชีต People = ตัวตนกลาง · ชีต LoginAttempts (เดิม) บันทึกการเข้า role = 'sso'
 * Script Property SSO_MODE = off | optional (ค่าเริ่มต้น) | required — off = ปิด endpoint ตัวตนกลางทั้งหมด
 */
const ID_SYSTEMS = { ARM: 'Agri-Risk Map', GGH: 'Green Gain Hub', SAM: 'KPP Smart Agri-Materials' };
const ID_TTL_HOURS = 8;              // ค่าเริ่มต้น
const ID_REMEMBER_DAYS = 30;         // "จดจำเครื่องนี้" (เฉพาะผู้ที่ไม่มีบัญชีผู้ดูแล Agri-Risk)
const ID_TICKET_SECONDS = 120;
const ID_FAIL_LIMIT = 10;            // เบอร์ที่ไม่มีในระบบ: ต่อเบอร์ ต่อ 15 นาที
const ID_UNKNOWN_GLOBAL_LIMIT = 120; // เบอร์ที่ไม่มีในระบบ: รวมทุกเบอร์ ต่อ 15 นาที (กันการไล่เดาเบอร์)
const ID_STATUS = { active: 'ใช้งาน', suspended: 'ระงับ' };

function ssoMode_() {
  const m = String(PropertiesService.getScriptProperties().getProperty('SSO_MODE') || 'optional').toLowerCase();
  return ['off', 'optional', 'required'].indexOf(m) >= 0 ? m : 'optional';
}
function requireSsoOn_() { if (ssoMode_() === 'off') throw new Error('ระบบตัวตนกลางปิดใช้งานชั่วคราว กรุณาเข้าสู่ระบบด้วยวิธีเดิม'); }

/* ---------------------------- token ตัวตน ---------------------------- */
/** รูปแบบ: personId.tokenVer.exp.sig — ลายเซ็นแยก prefix จาก token ของ Agri-Risk */
function idSign_(person, remember) {
  const hours = remember ? ID_REMEMBER_DAYS * 24 : ID_TTL_HOURS;
  const exp = Date.now() + hours * 3600 * 1000;
  const body = [person.personId, Number(person.tokenVer) || 0, exp].join('.');
  return { token: body + '.' + hmac_('ID|' + body), exp: exp };
}
function idVerify_(token) {
  const p = String(token || '').split('.');
  if (p.length !== 4) throw new Error('AUTH: กรุณาเข้าสู่ระบบ');
  const body = p[0] + '.' + p[1] + '.' + p[2];
  if (hmac_('ID|' + body) !== p[3]) throw new Error('AUTH: การเข้าสู่ระบบไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
  if (Number(p[2]) < Date.now()) throw new Error('AUTH: หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
  const person = findRow_('People', r => String(r.personId) === p[0]);
  if (!person) throw new Error('AUTH: ไม่พบตัวตน กรุณาเข้าสู่ระบบใหม่');
  if (String(person.status) !== 'active') throw new Error('AUTH: บัญชีถูกระงับ กรุณาติดต่อเจ้าหน้าที่');
  if ((Number(person.tokenVer) || 0) !== Number(p[1])) throw new Error('AUTH: การเข้าสู่ระบบถูกยกเลิก กรุณาเข้าสู่ระบบใหม่');
  return person;
}

/* ---------------------------- ข้อมูลบุคคล ---------------------------- */
function idPublic_(p) {
  const systems = String(p.systems || '').split(',').filter(Boolean);
  return { personId: String(p.personId), phone: normalizePhone_(p.phone), fullName: p.fullName, position: p.position, affiliation: p.affiliation,
    provinceCode: String(p.provinceCode || ''), provinceName: p.provinceName || '', districtName: p.districtName || '', systems: systems };
}
function idPrevLogin_(p) {
  return p.prevLoginAt ? { at: p.prevLoginAt, device: p.prevDevice || '', system: p.prevSystem || '' } : null;
}
function idByPhone_(phone) { return findRow_('People', r => normalizePhone_(r.phone) === phone); }
function idNewId_() { return 'P-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMdd') + '-' + Utilities.getUuid().slice(0, 8); }
function idMarkSystem_(p, system) {
  const s = String(p.systems || '').split(',').filter(Boolean);
  if (system && ID_SYSTEMS[system] && s.indexOf(system) < 0) s.push(system);
  return s.join(',');
}
/** สร้างตัวตนจากบัญชีผู้ดูแล Agri-Risk (ย้ายบัญชีเดิมอัตโนมัติ — จับคู่ด้วยเบอร์โทร) */
function idFromAccount_(acc) {
  const phone = normalizePhone_(acc.phone);
  const ex = idByPhone_(phone);
  if (ex) return ex;
  const prov = String(acc.provinceCode || '').padStart(2, '0');
  appendObj_('People', { personId: idNewId_(), phone: phone, fullName: clean_(acc.fullName), position: clean_(acc.position), affiliation: clean_(acc.affiliation),
    provinceCode: prov, provinceName: PROVINCES[prov] || '', districtName: '', status: 'active', statusNote: '', tokenVer: 0, consentAt: '',
    createdAt: now_(), createdVia: 'ARM', lastLoginAt: '', lastDevice: '', lastSystem: '', prevLoginAt: '', prevDevice: '', prevSystem: '', systems: 'ARM' });
  return idByPhone_(phone);
}
/** บันทึกการเข้า: เลื่อนครั้งล่าสุดไปเป็น "ครั้งก่อน" เพื่อให้เจ้าของเห็นและกด "ไม่ใช่ฉัน" ได้ */
function idTouch_(p, system, device) {
  updateRow_('People', p._row, { prevLoginAt: p.lastLoginAt || '', prevDevice: p.lastDevice || '', prevSystem: p.lastSystem || '',
    lastLoginAt: now_(), lastDevice: device || '', lastSystem: system || '', systems: idMarkSystem_(p, system) });
}
function idSystem_(v) { const s = String(v || '').toUpperCase(); return ID_SYSTEMS[s] ? s : 'ARM'; }
function idDevice_(v) { return String(v || '').slice(0, 120); }

/* ---------------------------- กันการไล่เดาเบอร์ ---------------------------- */
function idThrottle_(phone) {
  const c = CacheService.getScriptCache();
  if (Number(c.get('idf:' + phone) || 0) >= ID_FAIL_LIMIT) throw new Error('พยายามเข้าสู่ระบบด้วยหมายเลขนี้หลายครั้งเกินไป กรุณารอ 15 นาที');
}
function idUnknownGate_() {
  if (Number(CacheService.getScriptCache().get('idf:*') || 0) >= ID_UNKNOWN_GLOBAL_LIMIT) throw new Error('ระบบได้รับคำขอด้วยหมายเลขที่ไม่รู้จักจำนวนมาก กรุณาลองใหม่ในอีก 15 นาที');
}
function idFailed_(phone) {
  const c = CacheService.getScriptCache();
  c.put('idf:' + phone, String(Number(c.get('idf:' + phone) || 0) + 1), 900);
  c.put('idf:*', String(Number(c.get('idf:*') || 0) + 1), 900);
  Utilities.sleep(400);   // ชะลอการไล่เดาด้วยสคริปต์
}

/* ---------------------------- endpoint สาธารณะ ---------------------------- */
/** id_login { phone, system, device, remember } → { token, exp, person, prevLogin } | error code not_found */
function idLogin_(b) {
  requireSsoOn_();
  const phone = normalizePhone_(b.phone), system = idSystem_(b.system), device = idDevice_(b.device);
  if (!validPhone_(phone)) { logAttempt_('sso', String(b.phone || '').slice(0, 20), 'invalid', null, device); throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678)'); }
  idThrottle_(phone);
  let p = idByPhone_(phone);
  if (!p) {
    const acc = findRow_('Accounts', r => normalizePhone_(r.phone) === phone && r.status === 'approved' && r.role !== 'minisuper');
    if (acc) p = idFromAccount_(acc);
  }
  if (!p) {
    idUnknownGate_();
    idFailed_(phone);
    logAttempt_('sso', phone, 'not_found', null, device + ' · ' + system);
    return { ok: false, code: 'not_found', error: 'ยังไม่มีหมายเลขนี้ในระบบ กรุณาลงทะเบียน' };
  }
  if (String(p.status) !== 'active') {
    logAttempt_('sso', phone, 'disabled', { accountId: p.personId, fullName: p.fullName, provinceCode: p.provinceCode }, device + ' · ' + system);
    throw new Error('หมายเลขนี้ถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่อำเภอหรือจังหวัด');   // ไม่แสดงเหตุผล/ข้อมูลการเข้าแก่ผู้กรอกเบอร์
  }
  return idIssue_(p, system, device, !!b.remember);
}

/** id_register { phone, fullName, position, affiliation, provinceCode, districtName, consent, system, device, remember } */
function idRegister_(b) {
  requireSsoOn_();
  const phone = normalizePhone_(b.phone), system = idSystem_(b.system), device = idDevice_(b.device);
  const prov = String(b.provinceCode || '').padStart(2, '0');
  if (!validPhone_(phone)) throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678)');
  if (clean_(b.fullName).length < 3) throw new Error('กรุณากรอกชื่อ-นามสกุล');
  if (!PROVINCES[prov]) throw new Error('กรุณาเลือกจังหวัด');
  if (b.consent !== true && b.consent !== 'true') throw new Error('กรุณายอมรับเงื่อนไขการใช้ข้อมูลก่อนลงทะเบียน');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (idByPhone_(phone)) throw new Error('หมายเลขนี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ');
    appendObj_('People', { personId: idNewId_(), phone: phone, fullName: clean_(b.fullName), position: clean_(b.position), affiliation: clean_(b.affiliation),
      provinceCode: prov, provinceName: PROVINCES[prov], districtName: clean_(b.districtName), status: 'active', statusNote: '', tokenVer: 0, consentAt: now_(),
      createdAt: now_(), createdVia: system, lastLoginAt: '', lastDevice: '', lastSystem: '', prevLoginAt: '', prevDevice: '', prevSystem: '', systems: '' });
  } finally { lock.releaseLock(); }
  const p = idByPhone_(phone);
  audit_({ sub: p.personId, name: p.fullName, role: 'public', prov: prov }, 'id_register', p.personId + ' ผ่าน ' + ID_SYSTEMS[system], prov);
  return idIssue_(p, system, device, !!b.remember);
}

function idIssue_(p, system, device, remember) {
  // "จดจำเครื่องนี้" ไม่ใช้กับผู้ที่มีบัญชีผู้ดูแล Agri-Risk (เห็นข้อมูลระดับจังหวัด)
  const isAdmin = !!findRow_('Accounts', r => normalizePhone_(r.phone) === normalizePhone_(p.phone) && r.status === 'approved');
  const prev = p.lastLoginAt ? { at: p.lastLoginAt, device: p.lastDevice || '', system: p.lastSystem || '' } : null;
  idTouch_(p, system, device);
  logAttempt_('sso', normalizePhone_(p.phone), 'success', { accountId: p.personId, fullName: p.fullName, provinceCode: p.provinceCode }, device + ' · ' + system);
  const t = idSign_(p, remember && !isAdmin);
  const fresh = findRow_('People', r => r.personId === p.personId) || p;
  return { ok: true, token: t.token, exp: t.exp, person: idPublic_(fresh), prevLogin: prev };
}

/** id_me { idToken } */
function idMe_(b) { requireSsoOn_(); const p = idVerify_(b.idToken); return { ok: true, person: idPublic_(p), prevLogin: idPrevLogin_(p) }; }

/** id_ticket { idToken, aud } → ตั๋วใช้ครั้งเดียว อายุ 2 นาที สำหรับระบบปลายทาง */
function idTicket_(b) {
  requireSsoOn_();
  const p = idVerify_(b.idToken), aud = String(b.aud || '').toUpperCase();
  if (!ID_SYSTEMS[aud]) throw new Error('ไม่รู้จักระบบปลายทาง');
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({ pid: p.personId, aud: aud, exp: Date.now() + ID_TICKET_SECONDS * 1000, jti: Utilities.getUuid() }));
  return { ok: true, ticket: payload + '.' + hmac_('TK|' + payload), expiresIn: ID_TICKET_SECONDS };
}

/** id_redeem { ticket, aud, device } — เรียกโดย Apps Script ของระบบปลายทาง (ฝั่งเซิร์ฟเวอร์) */
function idRedeem_(b) {
  requireSsoOn_();
  const parts = String(b.ticket || '').split('.'), aud = String(b.aud || '').toUpperCase();
  if (parts.length !== 2 || hmac_('TK|' + parts[0]) !== parts[1]) throw new Error('ตั๋วไม่ถูกต้อง');
  let t; try { t = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { throw new Error('ตั๋วไม่ถูกต้อง'); }
  if (!t.exp || Date.now() > t.exp) throw new Error('ตั๋วหมดอายุ กรุณาลองใหม่');
  if (t.aud !== aud || !ID_SYSTEMS[aud]) throw new Error('ตั๋วนี้ไม่ได้ออกให้ระบบนี้');
  const c = CacheService.getScriptCache();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (c.get('jti:' + t.jti)) throw new Error('ตั๋วนี้ถูกใช้แล้ว');
    c.put('jti:' + t.jti, '1', 600);
  } finally { lock.releaseLock(); }
  const p = findRow_('People', r => r.personId === t.pid);
  if (!p || String(p.status) !== 'active') throw new Error('บัญชีถูกระงับหรือไม่พบตัวตน');
  updateRow_('People', p._row, { systems: idMarkSystem_(p, aud) });
  return { ok: true, person: idPublic_(p) };
}

/** id_not_me { idToken } — เจ้าของเบอร์แจ้งว่าการเข้าครั้งก่อนไม่ใช่ตน → ระงับทุกระบบทันที */
function idNotMe_(b) {
  requireSsoOn_();
  const p = idVerify_(b.idToken);
  const note = 'เจ้าของแจ้ง "ไม่ใช่ฉัน" ' + now_() + (p.prevLoginAt ? ' (การเข้า ' + p.prevLoginAt + ' ' + (p.prevDevice || '') + ')' : '');
  updateRow_('People', p._row, { status: 'suspended', statusNote: note, tokenVer: (Number(p.tokenVer) || 0) + 1 });
  audit_({ sub: p.personId, name: p.fullName, role: 'public', prov: String(p.provinceCode || '') }, 'id_not_me', note, String(p.provinceCode || ''));
  return { ok: true };
}

/** id_logout_all { idToken } — ออกจากระบบทุกเครื่อง */
function idLogoutAll_(b) {
  requireSsoOn_();
  const p = idVerify_(b.idToken);
  updateRow_('People', p._row, { tokenVer: (Number(p.tokenVer) || 0) + 1 });
  return { ok: true };
}

/* ---------------------------- Agri-Risk: เข้าด้วยตัวตนกลาง ---------------------------- */
/** login_sso { idToken, device } → token ของ Agri-Risk สำหรับผู้มีบัญชี Admin */
function loginSso_(b) {
  requireSsoOn_();
  const p = idVerify_(b.idToken), phone = normalizePhone_(p.phone), device = idDevice_(b.device);
  const acc = findRow_('Accounts', r => normalizePhone_(r.phone) === phone);
  if (!acc) return { ok: false, code: 'no_account', error: 'ท่านยังไม่มีสิทธิ์ผู้ดูแลใน Agri-Risk Map' };
  if (acc.role === 'minisuper') return { ok: false, code: 'use_password', error: 'Mini Super Admin เข้าด้วยชื่อผู้ใช้และรหัสผ่าน' };
  if (acc.status !== 'approved') { logAttempt_('admin', phone, 'disabled', acc, device); throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'); }
  logAttempt_('admin', phone, 'success', acc, device + ' · SSO');
  updateRow_('Accounts', acc._row, { lastLoginAt: now_() });
  updateRow_('People', p._row, { systems: idMarkSystem_(p, 'ARM') });
  const user = accountUser_(acc);
  audit_(user, 'login', user.role + ' login (SSO)', '');
  return { ok: true, token: signToken_(user), user: user };
}

/* ---------------------------- Mini Super Admin: ชื่อผู้ใช้ + รหัสผ่าน ---------------------------- */
function miniHash_(salt, password) {
  let h = sha256_(salt + ':' + String(password));
  for (let i = 0; i < 499; i++) h = sha256_(salt + h);   // ทำซ้ำ 500 รอบ ให้การเดารหัสช้าลง
  return h;
}
function normUser_(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, ''); }
function validPassword_(pw) { return String(pw || '').length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw); }

/** login_mini { username, password, device } */
function loginMini_(b) {
  const un = normUser_(b.username), device = idDevice_(b.device), c = CacheService.getScriptCache();
  if (!un || !b.password) throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  if (Number(c.get('mf:' + un) || 0) >= 5) throw new Error('ใส่รหัสผ่านผิดหลายครั้ง กรุณารอ 15 นาที');
  const acc = findRow_('Accounts', r => r.role === 'minisuper' && normUser_(r.username) === un && r.passHash);
  if (!acc || miniHash_(String(acc.passSalt), b.password) !== String(acc.passHash)) {
    c.put('mf:' + un, String(Number(c.get('mf:' + un) || 0) + 1), 900);
    logAttempt_('minisuper', un, 'wrong_credentials', null, device);
    Utilities.sleep(400);
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (acc.status !== 'approved') { logAttempt_('minisuper', un, 'disabled', acc, device); throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ Super Admin'); }
  c.remove('mf:' + un);
  logAttempt_('minisuper', un, 'success', acc, device);
  updateRow_('Accounts', acc._row, { lastLoginAt: now_() });
  const user = accountUser_(acc);
  audit_(user, 'login', 'minisuper login', '');
  return { ok: true, token: signToken_(user), user: user };
}
/** ตั้ง/เปลี่ยนชื่อผู้ใช้และรหัสผ่านของ Mini (Super Admin ทำให้ผู้อื่น) — คืน patch สำหรับ updateRow_ */
function miniCredentials_(acc, username, password) {
  const un = normUser_(username);
  if (un.length < 4) throw new Error('ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัว (a-z 0-9 . _ -)');
  const dup = findRow_('Accounts', r => normUser_(r.username) === un && (!acc || r.accountId !== acc.accountId));
  if (dup) throw new Error('ชื่อผู้ใช้นี้มีผู้ใช้แล้ว');
  const patch = { username: un };
  if (password) {
    if (!validPassword_(password)) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข');
    const salt = Utilities.getUuid();
    patch.passSalt = salt; patch.passHash = miniHash_(salt, password);
  } else if (!acc || !acc.passHash) throw new Error('กรุณากำหนดรหัสผ่านเริ่มต้นของ Mini Super Admin');
  return patch;
}
/** account_password { current, password } — Mini เปลี่ยนรหัสผ่านของตนเอง */
function accountPassword_(user, b) {
  if (user.role !== 'minisuper') throw new Error('เฉพาะ Mini Super Admin');
  const acc = findRow_('Accounts', r => r.accountId === user.sub);
  if (!acc) throw new Error('ไม่พบบัญชี');
  if (acc.passHash && miniHash_(String(acc.passSalt), b.current) !== String(acc.passHash)) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  if (!validPassword_(b.password)) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข');
  const salt = Utilities.getUuid();
  updateRow_('Accounts', acc._row, { passSalt: salt, passHash: miniHash_(salt, b.password) });
  audit_(user, 'account_password', acc.accountId, '');
  return { ok: true };
}

/* ---------------------------- ผู้ดูแล: จัดการตัวตนกลาง ---------------------------- */
/** id_people_list — Super/Mini เห็นทุกคน, Admin เห็นเฉพาะจังหวัดตน; เบอร์ปกปิดเว้นแต่ขอดูเต็ม (บันทึกการดู) */
function idPeopleList_(user, b) {
  const full = !!b.full && isNational_(user);
  const rows = readAll_('People').filter(r => inScope_(user, String(r.provinceCode || '')));
  if (full) audit_(user, 'id_people_view_full', rows.length + ' รายการ', '');
  const mask = s => { s = normalizePhone_(s); return s.length >= 10 ? s.slice(0, 3) + '-xxx-' + s.slice(-4) : s; };
  return { ok: true, mode: ssoMode_(), people: rows.map(r => ({ personId: String(r.personId), phone: full ? normalizePhone_(r.phone) : mask(r.phone), fullName: r.fullName,
    position: r.position, affiliation: r.affiliation, provinceName: r.provinceName, districtName: r.districtName, status: r.status, statusNote: r.statusNote,
    systems: String(r.systems || '').split(',').filter(Boolean), createdVia: r.createdVia, createdAt: r.createdAt, lastLoginAt: r.lastLoginAt, lastSystem: r.lastSystem })) };
}
/** id_person_status { personId, status: active|suspended, note } — ระงับ = ออกจากทุกระบบทันที */
function idPersonStatus_(user, b) {
  const p = findRow_('People', r => r.personId === b.personId);
  if (!p) throw new Error('ไม่พบตัวตน');
  requireProvince_(user, String(p.provinceCode || ''));
  const status = b.status === 'suspended' ? 'suspended' : 'active';
  updateRow_('People', p._row, { status: status, statusNote: status === 'suspended' ? clean_(b.note) || ('ระงับโดย ' + user.name) : '', tokenVer: (Number(p.tokenVer) || 0) + 1 });
  audit_(user, status === 'suspended' ? 'id_suspend' : 'id_activate', p.personId + ' ' + p.fullName, String(p.provinceCode || ''));
  return { ok: true };
}
/** sso_mode_save { mode } — Super Admin */
function ssoModeSave_(user, b) {
  requireSuper_(user);
  const m = String(b.mode || '').toLowerCase();
  if (['off', 'optional', 'required'].indexOf(m) < 0) throw new Error('ค่าไม่ถูกต้อง');
  PropertiesService.getScriptProperties().setProperty('SSO_MODE', m);
  audit_(user, 'settings_save', 'SSO_MODE = ' + m, '');
  return { ok: true, mode: m };
}
