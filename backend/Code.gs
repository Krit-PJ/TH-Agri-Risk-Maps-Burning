/**
 * TH Agri-Risk Map Burning — Backend (Google Apps Script Web App)
 * ----------------------------------------------------------------
 * ฐานข้อมูล : Google Sheet "TH Agri-Risk Map Burning V3 - Database"
 * บทบาท    : public (ผู้ใช้ทั่วไป) | admin (ระดับจังหวัด) | minisuper (ทั้งระบบ ยกเว้นจัดการสิทธิ์ Mini Super Admin) | superadmin (สิทธิ์เต็ม)
 *
 * วิธีติดตั้ง (สรุป — ดูรายละเอียดใน README.md)
 *   1) เปิด Google Sheet ฐานข้อมูล > ส่วนขยาย > Apps Script แล้ววางไฟล์นี้
 *   2) สร้างไฟล์ Secrets.gs จาก Secrets.example.gs (Admin เริ่มต้น + Super Admin) — ระบบติดตั้งชีตให้อัตโนมัติ
 *   3) ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป
 *      ดำเนินการในฐานะ: ฉัน  |  ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 *   4) นำ URL ที่ลงท้าย /exec ไปใส่ใน js/config.js (API_URL)
 */

/* ============================== CONFIG ============================== */
const DB_ID = '178jFMiZLLsq4f1Juq2FADERx_mYs8bAB2yzdYa5cp-A';
const TOKEN_HOURS = 8;
// ค่าเริ่มต้นที่เป็นความลับอยู่ในไฟล์ Secrets.gs (มีเฉพาะใน Apps Script ไม่อยู่ใน GitHub) — ดู Secrets.example.gs
function initSecrets_() {
  return {
    adminPhone: typeof INIT_ADMIN_PHONE !== 'undefined' ? String(INIT_ADMIN_PHONE) : '',
    adminProvince: typeof INIT_ADMIN_PROVINCE !== 'undefined' ? String(INIT_ADMIN_PROVINCE) : '62',
    superUser: typeof INIT_SUPER_USER !== 'undefined' ? String(INIT_SUPER_USER) : '',
    superPassword: typeof INIT_SUPER_PASSWORD !== 'undefined' ? String(INIT_SUPER_PASSWORD) : ''
  };
}
const PLANT_TYPES = ['นาข้าว', 'อ้อย', 'ข้าวโพดและไร่หมุนเวียน', 'เกษตรอื่น ๆ', 'อื่น ๆ'];

const PROVINCES = {"10":"กรุงเทพมหานคร","11":"สมุทรปราการ","12":"นนทบุรี","13":"ปทุมธานี","14":"พระนครศรีอยุธยา","15":"อ่างทอง","16":"ลพบุรี","17":"สิงห์บุรี","18":"ชัยนาท","19":"สระบุรี","20":"ชลบุรี","21":"ระยอง","22":"จันทบุรี","23":"ตราด","24":"ฉะเชิงเทรา","25":"ปราจีนบุรี","26":"นครนายก","27":"สระแก้ว","30":"นครราชสีมา","31":"บุรีรัมย์","32":"สุรินทร์","33":"ศรีสะเกษ","34":"อุบลราชธานี","35":"ยโสธร","36":"ชัยภูมิ","37":"อำนาจเจริญ","38":"บึงกาฬ","39":"หนองบัวลำภู","40":"ขอนแก่น","41":"อุดรธานี","42":"เลย","43":"หนองคาย","44":"มหาสารคาม","45":"ร้อยเอ็ด","46":"กาฬสินธุ์","47":"สกลนคร","48":"นครพนม","49":"มุกดาหาร","50":"เชียงใหม่","51":"ลำพูน","52":"ลำปาง","53":"อุตรดิตถ์","54":"แพร่","55":"น่าน","56":"พะเยา","57":"เชียงราย","58":"แม่ฮ่องสอน","60":"นครสวรรค์","61":"อุทัยธานี","62":"กำแพงเพชร","63":"ตาก","64":"สุโขทัย","65":"พิษณุโลก","66":"พิจิตร","67":"เพชรบูรณ์","70":"ราชบุรี","71":"กาญจนบุรี","72":"สุพรรณบุรี","73":"นครปฐม","74":"สมุทรสาคร","75":"สมุทรสงคราม","76":"เพชรบุรี","77":"ประจวบคีรีขันธ์","80":"นครศรีธรรมราช","81":"กระบี่","82":"พังงา","83":"ภูเก็ต","84":"สุราษฎร์ธานี","85":"ระนอง","86":"ชุมพร","90":"สงขลา","91":"สตูล","92":"ตรัง","93":"พัทลุง","94":"ปัตตานี","95":"ยะลา","96":"นราธิวาส"};

const SHEETS = {
  Accounts: ['accountId', 'phone', 'fullName', 'position', 'affiliation', 'provinceCode', 'provinceName', 'role', 'status', 'createdAt', 'approvedAt', 'approvedBy', 'lastLoginAt'],
  Requests: ['requestId', 'phone', 'fullName', 'position', 'affiliation', 'provinceCode', 'provinceName', 'note', 'status', 'createdAt', 'decidedAt', 'decidedBy', 'reason'],
  ProvinceSummary: ['provinceCode', 'provinceName', 'hsCount', 'firstDate', 'lastDate', 'updatedAt'],
  Batches: ['batchId', 'provinceCode', 'fileName', 'accepted', 'duplicates', 'firstDate', 'lastDate', 'importedBy', 'importedAt', 'note'],
  Counter: ['date', 'hits'],
  Settings: ['key', 'value'],
  AuditLog: ['time', 'actor', 'role', 'provinceCode', 'action', 'detail'],
  LoginAttempts: ['time', 'role', 'identifier', 'result', 'accountId', 'fullName', 'provinceCode', 'provinceName', 'device']
};
// คอลัมน์ข้อความที่ต้องคงเลข 0 นำหน้า (กัน Google Sheet ตัดเลข 0)
const TEXT_COLUMNS = {
  Accounts: ['accountId', 'phone', 'provinceCode'],
  Requests: ['requestId', 'phone', 'provinceCode'],
  ProvinceSummary: ['provinceCode', 'firstDate', 'lastDate'],
  Batches: ['batchId', 'provinceCode', 'firstDate', 'lastDate'],
  Counter: ['date'],
  Settings: ['key', 'value'],
  LoginAttempts: ['identifier', 'accountId', 'provinceCode']
};
const SETUP_VERSION = '3.1';
const ACCOUNT_ROLES = { admin: 'Admin', minisuper: 'Mini Super Admin' };
const LOGIN_RESULTS = { success: 'สำเร็จ', not_found: 'ไม่มีหมายเลขในระบบ', pending: 'รออนุมัติ', disabled: 'บัญชีถูกระงับ', invalid: 'รูปแบบไม่ถูกต้อง', wrong_credentials: 'ชื่อผู้ใช้/รหัสผ่านไม่ถูกต้อง' };
const HS_HEADERS = ['hotspotId', 'date', 'time', 'districtCode', 'subdistrictCode', 'districtName', 'subdistrictName', 'village', 'plantType', 'lat', 'lng', 'batchId', 'importedAt'];
const HS_TEXT = ['hotspotId', 'date', 'time', 'districtCode', 'subdistrictCode', 'batchId'];

/* ============================== SETUP ============================== */
function setup() {
  const ss = db_();
  Object.keys(SHEETS).forEach(name => ensureSheet_(ss, name, SHEETS[name], TEXT_COLUMNS[name] || []));
  const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่น1') || ss.getSheetByName('ชีต1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const sec = initSecrets_();
  if (!props.getProperty('SUPER_HASH') && sec.superUser && sec.superPassword) setSuperAdmin(sec.superUser, sec.superPassword);

  const phone = normalizePhone_(sec.adminPhone), prov = sec.adminProvince;
  if (validPhone_(phone) && PROVINCES[prov] && !findRow_('Accounts', r => normalizePhone_(r.phone) === phone)) {
    appendObj_('Accounts', {
      accountId: 'A-' + prov + '-001', phone: phone, fullName: 'ผู้ดูแลระบบจังหวัด' + PROVINCES[prov],
      position: 'ผู้ดูแลระบบ', affiliation: 'สำนักงานเกษตรจังหวัด' + PROVINCES[prov],
      provinceCode: prov, provinceName: PROVINCES[prov],
      role: 'admin', status: 'approved', createdAt: now_(), approvedAt: now_(), approvedBy: 'SETUP', lastLoginAt: ''
    });
  }
  if (!findRow_('Settings', r => r.key === 'counter_total')) appendObj_('Settings', { key: 'counter_total', value: '0' });
  if (!findRow_('Settings', r => r.key === 'guide_url')) appendObj_('Settings', { key: 'guide_url', value: '' });
  props.setProperty('SETUP_VERSION', SETUP_VERSION);
  audit_({ sub: 'SETUP', role: 'system', prov: '' }, 'setup', 'initialized v' + SETUP_VERSION);
  Logger.log('Setup complete');
}

/** เปลี่ยนชื่อผู้ใช้/รหัสผ่าน Super Admin (เรียกจาก Editor เท่านั้น) */
function setSuperAdmin(username, password) {
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid();
  props.setProperties({ SUPER_USER: String(username), SUPER_SALT: salt, SUPER_HASH: sha256_(salt + ':' + String(password)) });
}

/** ติดตั้ง/อัปเกรดฐานข้อมูลอัตโนมัติเมื่อมีการเรียกครั้งแรกหลัง Deploy */
function ensureSetup_() {
  if (PropertiesService.getScriptProperties().getProperty('SETUP_VERSION') === SETUP_VERSION) return;
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { if (PropertiesService.getScriptProperties().getProperty('SETUP_VERSION') !== SETUP_VERSION) setup(); }
  finally { lock.releaseLock(); }
}

/* ============================== ROUTER ============================== */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    ensureSetup_();
    switch (p.action) {
      case 'provinces': return json_({ ok: true, provinces: publicProvinces_() });
      case 'hotspots': return json_(publicHotspots_(String(p.province || '')));
      case 'hit': return json_({ ok: true, counter: counter_(true) });
      case 'counter': return json_({ ok: true, counter: counter_(false) });
      case 'settings': return json_({ ok: true, settings: { guideUrl: setting_('guide_url') } });
      case 'ping': return json_({ ok: true, time: now_() });
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (_) { return json_({ ok: false, error: 'invalid JSON' }); }
  try {
    ensureSetup_();
    const a = body.action;
    if (a === 'login_admin') return json_(loginAdmin_(body));
    if (a === 'login_super') return json_(loginSuper_(body));
    if (a === 'register') return json_(register_(body));

    const user = verifyToken_(body.token);
    switch (a) {
      case 'me': return json_({ ok: true, user: user });
      case 'requests_list': return json_(requestsList_(user, body));
      case 'request_decide': return json_(requestDecide_(user, body));
      case 'accounts_list': return json_(accountsList_(user));
      case 'account_save': return json_(accountSave_(user, body));
      case 'account_status': return json_(accountStatus_(user, body));
      case 'account_delete': return json_(accountDelete_(user, body));
      case 'hs_import': return json_(hsImport_(user, body));
      case 'hs_batches': return json_(hsBatches_(user, body));
      case 'hs_delete_batch': return json_(hsDeleteBatch_(user, body));
      case 'hs_clear': return json_(hsClear_(user, body));
      case 'settings_save': return json_(settingsSave_(user, body));
      case 'audit_list': return json_(auditList_(user, body));
      case 'login_report': return json_(loginReport_(user, body));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

/* ============================== AUTH ============================== */
function loginAdmin_(b) {
  const phone = normalizePhone_(b.phone);
  const device = String(b.device || '').slice(0, 120);
  if (!validPhone_(phone)) { logAttempt_('admin', String(b.phone || '').slice(0, 20), 'invalid', null, device); throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง'); }
  const acc = findRow_('Accounts', r => normalizePhone_(r.phone) === phone);
  if (!acc) {
    const pending = findRow_('Requests', r => normalizePhone_(r.phone) === phone && r.status === 'pending');
    logAttempt_('admin', phone, pending ? 'pending' : 'not_found', pending ? { fullName: pending.fullName, provinceCode: pending.provinceCode } : null, device);
    throw new Error(pending ? 'คำขอของท่านอยู่ระหว่างรอการอนุมัติ' : 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณายื่นคำขอใช้งาน');
  }
  const lrole = acc.role === 'minisuper' ? 'minisuper' : 'admin';
  if (acc.status !== 'approved') { logAttempt_(lrole, phone, 'disabled', acc, device); throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'); }
  logAttempt_(lrole, phone, 'success', acc, device);
  updateRow_('Accounts', acc._row, { lastLoginAt: now_() });
  const user = accountUser_(acc);
  audit_(user, 'login', user.role + ' login', user.role === 'minisuper' ? String(acc.provinceCode) : '');
  return { ok: true, token: signToken_(user), user: user };
}

function loginSuper_(b) {
  const props = PropertiesService.getScriptProperties();
  const u = String(b.username || '').trim();
  const ok = !!props.getProperty('SUPER_HASH') && u.toLowerCase() === String(props.getProperty('SUPER_USER') || '').toLowerCase()
    && sha256_(props.getProperty('SUPER_SALT') + ':' + String(b.password || '')) === props.getProperty('SUPER_HASH');
  logAttempt_('superadmin', u.slice(0, 40), ok ? 'success' : 'wrong_credentials', ok ? { accountId: 'SUPER', fullName: 'Super Admin' } : null, String(b.device || '').slice(0, 120));
  if (!ok) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  const user = { sub: 'SUPER:' + props.getProperty('SUPER_USER'), name: 'Super Admin (' + props.getProperty('SUPER_USER') + ')', role: 'superadmin', prov: '*', provName: 'ทุกจังหวัด' };
  audit_(user, 'login', 'superadmin login');
  return { ok: true, token: signToken_(user), user: user };
}

function register_(b) {
  const phone = normalizePhone_(b.phone);
  const prov = String(b.provinceCode || '').padStart(2, '0');
  if (!validPhone_(phone)) throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ตัวอย่าง 0812345678)');
  if (!PROVINCES[prov]) throw new Error('กรุณาเลือกจังหวัด');
  if (!clean_(b.fullName)) throw new Error('กรุณากรอกชื่อ-นามสกุล');
  if (findRow_('Accounts', r => normalizePhone_(r.phone) === phone)) throw new Error('เบอร์โทรศัพท์นี้มีสิทธิ์ใช้งานแล้ว สามารถเข้าสู่ระบบได้ทันที');
  if (findRow_('Requests', r => normalizePhone_(r.phone) === phone && r.status === 'pending')) throw new Error('มีคำขอของเบอร์นี้รอการอนุมัติอยู่แล้ว');
  const id = 'R-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendObj_('Requests', {
    requestId: id, phone: phone, fullName: clean_(b.fullName), position: clean_(b.position), affiliation: clean_(b.affiliation),
    provinceCode: prov, provinceName: PROVINCES[prov], note: clean_(b.note), status: 'pending', createdAt: now_(), decidedAt: '', decidedBy: '', reason: ''
  });
  audit_({ sub: phone, role: 'public', prov: prov }, 'register', id);
  return { ok: true, requestId: id };
}

/** แปลงบัญชีในชีตเป็นผู้ใช้ในระบบ: minisuper มีขอบเขตทุกจังหวัด */
function accountUser_(acc) {
  const role = acc.role === 'minisuper' ? 'minisuper' : 'admin';
  const home = String(acc.provinceCode);
  return { sub: acc.accountId, name: acc.fullName, phone: normalizePhone_(acc.phone), role: role,
    prov: role === 'minisuper' ? '*' : home, provName: role === 'minisuper' ? 'ทุกจังหวัด' : (PROVINCES[home] || ''), homeProv: home };
}

function signToken_(user) {
  const payload = Object.assign({}, user, { exp: Date.now() + TOKEN_HOURS * 3600 * 1000 });
  const p = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return p + '.' + hmac_(p);
}

function verifyToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || hmac_(parts[0]) !== parts[1]) throw new Error('AUTH: กรุณาเข้าสู่ระบบ');
  const user = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!user.exp || Date.now() > user.exp) throw new Error('AUTH: หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่');
  if (user.role === 'admin' || user.role === 'minisuper') { // ตรวจสถานะและบทบาทล่าสุดทุกครั้ง (ระงับ/ปรับสิทธิ์มีผลทันที)
    const acc = findRow_('Accounts', r => r.accountId === user.sub);
    if (!acc || acc.status !== 'approved') throw new Error('AUTH: บัญชีถูกระงับหรือถูกลบ');
    return Object.assign(user, accountUser_(acc));
  }
  return user;
}

function isNational_(user) { return user.role === 'superadmin' || user.role === 'minisuper'; }
function requireNational_(user) { if (!isNational_(user)) throw new Error('เฉพาะ Super Admin / Mini Super Admin เท่านั้น'); }
function requireProvince_(user, prov) {
  prov = String(prov || '');
  if (isNational_(user)) { if (!PROVINCES[prov]) throw new Error('รหัสจังหวัดไม่ถูกต้อง'); return prov; }
  if (user.role === 'admin' && user.prov === prov) return prov;
  throw new Error('ไม่มีสิทธิ์จัดการข้อมูลจังหวัดนี้');
}
function requireSuper_(user) { if (user.role !== 'superadmin') throw new Error('เฉพาะ Super Admin เท่านั้น'); }
function inScope_(user, prov) { return isNational_(user) || String(prov) === user.prov; }
/** บัญชี Mini Super Admin จัดการได้โดย Super Admin เท่านั้น */
function requireRoleManager_(user, role) { if (role === 'minisuper' && user.role !== 'superadmin') throw new Error('การเพิ่ม/แก้ไข/ระงับ/ลบ Mini Super Admin ทำได้เฉพาะ Super Admin'); }

/* ====================== REQUESTS / ACCOUNTS ====================== */
function requestsList_(user, b) {
  const status = b.status || 'pending';
  const rows = readAll_('Requests').filter(r => inScope_(user, r.provinceCode) && (status === 'all' || r.status === status));
  rows.sort((a, c) => String(c.createdAt).localeCompare(String(a.createdAt)));
  return { ok: true, requests: rows.map(stripRow_).map(r => Object.assign(r, { phone: normalizePhone_(r.phone) })) };
}

function requestDecide_(user, b) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const req = findRow_('Requests', r => r.requestId === b.requestId);
    if (!req) throw new Error('ไม่พบคำขอ');
    requireProvince_(user, req.provinceCode);
    if (req.status !== 'pending') throw new Error('คำขอนี้ได้รับการพิจารณาแล้ว');
    const approve = b.decision === 'approve';
    updateRow_('Requests', req._row, { status: approve ? 'approved' : 'rejected', decidedAt: now_(), decidedBy: user.name, reason: clean_(b.reason) });
    if (approve) {
      const phone = normalizePhone_(req.phone);
      if (!findRow_('Accounts', r => normalizePhone_(r.phone) === phone)) {
        appendObj_('Accounts', {
          accountId: nextAccountId_(req.provinceCode), phone: phone, fullName: req.fullName, position: req.position, affiliation: req.affiliation,
          provinceCode: String(req.provinceCode), provinceName: PROVINCES[String(req.provinceCode)], role: 'admin', status: 'approved',
          createdAt: req.createdAt, approvedAt: now_(), approvedBy: user.name, lastLoginAt: ''
        });
      }
    }
    audit_(user, approve ? 'request_approve' : 'request_reject', req.requestId + ' ' + req.fullName, req.provinceCode);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function accountsList_(user) {
  const rows = readAll_('Accounts').filter(r => inScope_(user, r.provinceCode));
  return { ok: true, accounts: rows.map(stripRow_).map(r => Object.assign(r, { phone: normalizePhone_(r.phone) })) };
}

function accountSave_(user, b) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const phone = normalizePhone_(b.phone);
    if (!validPhone_(phone)) throw new Error('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
    const prov = requireProvince_(user, String(b.provinceCode || '').padStart(2, '0'));
    if (!clean_(b.fullName)) throw new Error('กรุณากรอกชื่อ-นามสกุล');
    const dup = findRow_('Accounts', r => normalizePhone_(r.phone) === phone && r.accountId !== b.accountId);
    if (dup) throw new Error('เบอร์โทรศัพท์นี้มีในระบบแล้ว');
    const role = b.role === 'minisuper' ? 'minisuper' : 'admin';
    requireRoleManager_(user, role);
    const data = { phone: phone, fullName: clean_(b.fullName), position: clean_(b.position), affiliation: clean_(b.affiliation), provinceCode: prov, provinceName: PROVINCES[prov], role: role };
    if (b.accountId) {
      const acc = findRow_('Accounts', r => r.accountId === b.accountId);
      if (!acc) throw new Error('ไม่พบบัญชี');
      requireProvince_(user, acc.provinceCode);
      requireRoleManager_(user, acc.role);
      if (acc.accountId === user.sub && role !== acc.role) throw new Error('ไม่สามารถเปลี่ยนบทบาทของตนเองได้');
      updateRow_('Accounts', acc._row, data);
      audit_(user, 'account_update', b.accountId + ' (' + ACCOUNT_ROLES[role] + ')', prov);
    } else {
      const id = nextAccountId_(prov);
      appendObj_('Accounts', Object.assign(data, { accountId: id, status: 'approved', createdAt: now_(), approvedAt: now_(), approvedBy: user.name, lastLoginAt: '' }));
      audit_(user, 'account_create', id + ' (' + ACCOUNT_ROLES[role] + ')', prov);
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function accountStatus_(user, b) {
  const acc = findRow_('Accounts', r => r.accountId === b.accountId);
  if (!acc) throw new Error('ไม่พบบัญชี');
  requireProvince_(user, acc.provinceCode);
  requireRoleManager_(user, acc.role);
  if (acc.accountId === user.sub) throw new Error('ไม่สามารถระงับบัญชีของตนเองได้');
  const status = b.status === 'approved' ? 'approved' : 'disabled';
  updateRow_('Accounts', acc._row, { status: status });
  audit_(user, 'account_' + status, acc.accountId, acc.provinceCode);
  return { ok: true };
}

function accountDelete_(user, b) {
  const acc = findRow_('Accounts', r => r.accountId === b.accountId);
  if (!acc) throw new Error('ไม่พบบัญชี');
  requireProvince_(user, acc.provinceCode);
  requireRoleManager_(user, acc.role);
  if (acc.accountId === user.sub) throw new Error('ไม่สามารถลบบัญชีของตนเองได้');
  sheet_('Accounts').deleteRow(acc._row);
  audit_(user, 'account_delete', acc.accountId + ' ' + acc.fullName, acc.provinceCode);
  return { ok: true };
}

function nextAccountId_(prov) {
  const nums = readAll_('Accounts').filter(r => String(r.provinceCode) === String(prov))
    .map(r => Number(String(r.accountId).split('-').pop()) || 0);
  return 'A-' + prov + '-' + String((nums.length ? Math.max.apply(null, nums) : 0) + 1).padStart(3, '0');
}

/* ============================== HOTSPOTS ============================== */
function hsSheet_(prov, create) {
  const ss = db_();
  const name = 'HS_' + prov;
  let sh = ss.getSheetByName(name);
  if (!sh && create) sh = ensureSheet_(ss, name, HS_HEADERS, HS_TEXT);
  return sh;
}

function hsImport_(user, b) {
  const prov = requireProvince_(user, b.provinceCode);
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (rows.length > 5000) throw new Error('ส่งข้อมูลได้ไม่เกิน 5,000 แถวต่อครั้ง');
  const batchId = String(b.batchId || '').replace(/[^\w-]/g, '') || ('B-' + prov + '-' + Date.now());
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = hsSheet_(prov, true);
    const last = sh.getLastRow();
    const existing = new Set(last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : []);
    const at = now_();
    let dup = 0;
    const out = [];
    rows.forEach(r => {
      const id = String(r.id || '').trim() || [r.date, r.time, r.lat, r.lng].join('_');
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) || !isFinite(lat) || !isFinite(lng)) return;
      if (existing.has(id)) { dup++; return; }
      existing.add(id);
      out.push([id, String(r.date), String(r.time || ''), String(r.dCode || ''), String(r.sCode || ''), clean_(r.dName), clean_(r.sName),
        clean_(r.village), PLANT_TYPES.indexOf(r.plant) >= 0 ? r.plant : 'อื่น ๆ', lat, lng, batchId, at]);
    });
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, HS_HEADERS.length).setValues(out);

    const dates = out.map(r => r[1]).sort();
    const bt = findRow_('Batches', r => r.batchId === batchId);
    if (bt) {
      updateRow_('Batches', bt._row, {
        accepted: Number(bt.accepted || 0) + out.length, duplicates: Number(bt.duplicates || 0) + dup,
        firstDate: [bt.firstDate, dates[0]].filter(Boolean).sort()[0] || '', lastDate: [bt.lastDate, dates[dates.length - 1]].filter(Boolean).sort().pop() || ''
      });
    } else {
      appendObj_('Batches', { batchId: batchId, provinceCode: prov, fileName: clean_(b.fileName), accepted: out.length, duplicates: dup,
        firstDate: dates[0] || '', lastDate: dates[dates.length - 1] || '', importedBy: user.name, importedAt: at, note: clean_(b.note) });
    }
    if (b.final !== false) { refreshSummary_(prov); bumpCache_(prov); audit_(user, 'hs_import', batchId + ' ' + (b.fileName || ''), prov); }
    return { ok: true, batchId: batchId, accepted: out.length, duplicates: dup };
  } finally { lock.releaseLock(); }
}

function hsBatches_(user, b) {
  const rows = readAll_('Batches').filter(r => inScope_(user, r.provinceCode) && (!b.provinceCode || String(r.provinceCode) === String(b.provinceCode)));
  rows.sort((a, c) => String(c.importedAt).localeCompare(String(a.importedAt)));
  return { ok: true, batches: rows.map(stripRow_) };
}

function hsDeleteBatch_(user, b) {
  const bt = findRow_('Batches', r => r.batchId === b.batchId);
  if (!bt) throw new Error('ไม่พบชุดข้อมูล');
  const prov = requireProvince_(user, bt.provinceCode);
  const removed = rewriteHs_(prov, r => String(r[11]) !== String(b.batchId));
  sheet_('Batches').deleteRow(bt._row);
  refreshSummary_(prov); bumpCache_(prov);
  audit_(user, 'hs_delete_batch', b.batchId + ' (' + removed + ' จุด)', prov);
  return { ok: true, removed: removed };
}

function hsClear_(user, b) {
  const prov = requireProvince_(user, b.provinceCode);
  const from = String(b.from || ''), to = String(b.to || '');
  const keep = (from || to) ? (r => (from && String(r[1]) < from) || (to && String(r[1]) > to)) : (() => false);
  const removed = rewriteHs_(prov, keep);
  if (!from && !to) {
    readAll_('Batches').filter(r => String(r.provinceCode) === prov).reverse().forEach(r => sheet_('Batches').deleteRow(r._row));
  }
  refreshSummary_(prov); bumpCache_(prov);
  audit_(user, 'hs_clear', prov + ' ' + (from || '*') + '..' + (to || '*') + ' (' + removed + ' จุด)', prov);
  return { ok: true, removed: removed };
}

function rewriteHs_(prov, keepFn) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = hsSheet_(prov, false);
    if (!sh || sh.getLastRow() < 2) return 0;
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, HS_HEADERS.length).getValues();
    const kept = data.filter(keepFn);
    sh.getRange(2, 1, data.length, HS_HEADERS.length).clearContent();
    if (kept.length) sh.getRange(2, 1, kept.length, HS_HEADERS.length).setValues(kept);
    return data.length - kept.length;
  } finally { lock.releaseLock(); }
}

function refreshSummary_(prov) {
  const sh = hsSheet_(prov, false);
  let count = 0, first = '', last = '';
  if (sh && sh.getLastRow() > 1) {
    const dates = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])).filter(Boolean).sort();
    count = dates.length; first = dates[0] || ''; last = dates[dates.length - 1] || '';
  }
  const row = findRow_('ProvinceSummary', r => String(r.provinceCode) === prov);
  const data = { provinceCode: prov, provinceName: PROVINCES[prov], hsCount: count, firstDate: first, lastDate: last, updatedAt: now_() };
  if (row) updateRow_('ProvinceSummary', row._row, data); else appendObj_('ProvinceSummary', data);
}

function publicProvinces_() {
  return readAll_('ProvinceSummary').filter(r => Number(r.hsCount) > 0).map(r => ({
    code: String(r.provinceCode).padStart(2, '0'), name: r.provinceName, count: Number(r.hsCount), first: String(r.firstDate), last: String(r.lastDate), updatedAt: String(r.updatedAt)
  }));
}

/** คืนข้อมูลแบบกระชับ: [date,time,dCode,sCode,dName,sName,village,plant,lat,lng] */
function publicHotspots_(prov) {
  prov = String(prov).padStart(2, '0');
  if (!PROVINCES[prov]) return { ok: false, error: 'invalid province' };
  const cache = CacheService.getScriptCache();
  const ver = cache.get('ver:' + prov) || '0';
  const key = 'hs:' + prov + ':' + ver;
  const cached = cacheGet_(cache, key);
  if (cached) return JSON.parse(cached);
  const sh = hsSheet_(prov, false);
  const rows = (sh && sh.getLastRow() > 1) ? sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues() : [];
  const out = { ok: true, province: prov, cols: ['date', 'time', 'dCode', 'sCode', 'dName', 'sName', 'village', 'plant', 'lat', 'lng'],
    rows: rows.filter(r => r[0]).map(r => [String(r[1]), String(r[2]), String(r[3]), String(r[4]), r[5], r[6], r[7], r[8], Number(r[9]), Number(r[10])]) };
  cachePut_(cache, key, JSON.stringify(out));
  return out;
}

function bumpCache_(prov) { CacheService.getScriptCache().put('ver:' + prov, String(Date.now()), 21600); }
function cachePut_(cache, key, text) {
  const size = 90000, n = Math.ceil(text.length / size);
  if (n > 200) return;
  const obj = { [key]: String(n) };
  for (let i = 0; i < n; i++) obj[key + ':' + i] = text.substr(i * size, size);
  try { cache.putAll(obj, 21600); } catch (_) { /* ข้ามเมื่อแคชเต็ม */ }
}
function cacheGet_(cache, key) {
  const n = Number(cache.get(key) || 0);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  const parts = cache.getAll(keys);
  if (Object.keys(parts).length !== n) return null;
  return keys.map(k => parts[k]).join('');
}

/* ============================== COUNTER ============================== */
function counter_(increment) {
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const lock = LockService.getScriptLock();
  if (increment) lock.waitLock(10000);
  try {
    const totalRow = findRow_('Settings', r => r.key === 'counter_total');
    let total = Number(totalRow ? totalRow.value : 0) || 0;
    const dayRow = findRow_('Counter', r => String(r.date) === today);
    let todayHits = Number(dayRow ? dayRow.hits : 0) || 0;
    if (increment) {
      total++; todayHits++;
      if (totalRow) updateRow_('Settings', totalRow._row, { value: String(total) }); else appendObj_('Settings', { key: 'counter_total', value: String(total) });
      if (dayRow) updateRow_('Counter', dayRow._row, { hits: todayHits }); else appendObj_('Counter', { date: today, hits: todayHits });
    }
    return { total: total, today: todayHits };
  } finally { if (increment) lock.releaseLock(); }
}

/* ============================== LOGIN ATTEMPTS ============================== */
/** บันทึกทุกการพยายามเข้าใช้ (รวมหมายเลขที่ไม่มีในระบบ) — ไม่บันทึกรหัสผ่าน */
function logAttempt_(role, identifier, result, acc, device) {
  try {
    const prov = acc && acc.provinceCode ? String(acc.provinceCode).padStart(2, '0') : '';
    appendObj_('LoginAttempts', { time: now_(), role: role, identifier: String(identifier || ''), result: result,
      accountId: acc ? (acc.accountId || '') : '', fullName: acc ? (acc.fullName || '') : '', provinceCode: prov, provinceName: PROVINCES[prov] || '', device: device || '' });
  } catch (_) { }
}

/** รายงานการเข้าใช้: Super Admin เห็นทั้งหมด, Admin เห็นเฉพาะจังหวัดของตน */
function loginReport_(user, b) {
  const days = Math.min(Math.max(Number(b.days) || 30, 1), 365);
  const since = Utilities.formatDate(new Date(Date.now() - days * 864e5), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss");
  const all = readAll_('LoginAttempts').filter(r => String(r.time) >= since).map(stripRow_);
  const rows = all.filter(r => user.role === 'superadmin' || (user.role === 'minisuper' && r.role !== 'superadmin') || (r.role === 'admin' && String(r.provinceCode) === user.prov))
    .map(r => Object.assign(r, { identifier: r.role !== 'superadmin' ? normalizePhone_(r.identifier) || r.identifier : r.identifier, resultLabel: LOGIN_RESULTS[r.result] || r.result }));
  const unknownMap = {};
  if (isNational_(user)) {
    all.filter(r => r.result === 'not_found').forEach(r => {
      const k = normalizePhone_(r.identifier) || String(r.identifier);
      const u = unknownMap[k] || (unknownMap[k] = { phone: k, attempts: 0, firstAt: r.time, lastAt: r.time });
      u.attempts++; if (String(r.time) < String(u.firstAt)) u.firstAt = r.time; if (String(r.time) > String(u.lastAt)) u.lastAt = r.time;
    });
    // ตัดหมายเลขที่ภายหลังได้รับสิทธิ์แล้ว
    const known = new Set(readAll_('Accounts').map(r => normalizePhone_(r.phone)));
    Object.keys(unknownMap).forEach(k => { if (known.has(k)) delete unknownMap[k]; });
  }
  const summary = {};
  rows.forEach(r => { summary[r.result] = (summary[r.result] || 0) + 1; });
  rows.sort((a, c) => String(c.time).localeCompare(String(a.time)));
  return { ok: true, days: days, summary: summary, attempts: rows.slice(0, 1000),
    unknown: Object.keys(unknownMap).map(k => unknownMap[k]).sort((a, c) => c.attempts - a.attempts || String(c.lastAt).localeCompare(String(a.lastAt))) };
}

/* ============================== SETTINGS / AUDIT ============================== */
function setting_(key) { const r = findRow_('Settings', x => x.key === key); return r ? String(r.value || '') : ''; }
function settingsSave_(user, b) {
  requireNational_(user);
  const url = String(b.guideUrl || '').trim();
  if (url && !/^https:\/\//.test(url)) throw new Error('ลิงก์ต้องขึ้นต้นด้วย https://');
  const r = findRow_('Settings', x => x.key === 'guide_url');
  if (r) updateRow_('Settings', r._row, { value: url }); else appendObj_('Settings', { key: 'guide_url', value: url });
  audit_(user, 'settings_save', 'guide_url');
  return { ok: true };
}
function auditList_(user, b) {
  const limit = Math.min(Number(b.limit) || 200, 1000);
  const rows = readAll_('AuditLog').filter(r => inScope_(user, r.provinceCode) || (user.role === 'admin' && r.actor === user.name));
  return { ok: true, logs: rows.slice(-limit).reverse().map(stripRow_) };
}
function audit_(user, action, detail, prov) {
  try { appendObj_('AuditLog', { time: now_(), actor: user.name || user.sub, role: user.role, provinceCode: prov || (user.prov === '*' ? '' : (user.prov || '')), action: action, detail: String(detail || '').slice(0, 500) }); } catch (_) { }
}

/* ============================== HELPERS ============================== */
function db_() { return DB_ID ? SpreadsheetApp.openById(DB_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { const s = db_().getSheetByName(name); if (!s) throw new Error('ไม่พบชีต ' + name + ' (เรียก setup ก่อน)'); return s; }
function ensureSheet_(ss, name, headers, textCols) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#14532d').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  (textCols || []).forEach(c => { const i = headers.indexOf(c); if (i >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@'); });
  return sh;
}
function readAll_(name) {
  const sh = sheet_(name); const last = sh.getLastRow();
  if (last < 2) return [];
  const headers = SHEETS[name];
  return sh.getRange(2, 1, last - 1, headers.length).getValues().map((r, i) => {
    const o = { _row: i + 2 }; headers.forEach((h, j) => { o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss") : r[j]; }); return o;
  }).filter(o => headers.some(h => o[h] !== ''));
}
function findRow_(name, fn) { return readAll_(name).find(fn) || null; }
function appendObj_(name, obj) {
  const headers = SHEETS[name], sh = sheet_(name);
  const text = TEXT_COLUMNS[name] || [];
  const row = headers.map(h => obj[h] === undefined || obj[h] === null ? '' : (text.indexOf(h) >= 0 ? String(obj[h]) : obj[h]));
  sh.getRange(sh.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}
function updateRow_(name, rowNum, patch) {
  const headers = SHEETS[name], sh = sheet_(name);
  Object.keys(patch).forEach(k => { const i = headers.indexOf(k); if (i >= 0) sh.getRange(rowNum, i + 1).setValue(patch[k]); });
}
function stripRow_(r) { const o = Object.assign({}, r); delete o._row; return o; }
/** ปรับเบอร์โทรให้เป็นรูปแบบเดียว — คืนเลข 0 ที่ Google Sheet อาจตัดทิ้ง */
function normalizePhone_(v) {
  let s = String(v === undefined || v === null ? '' : v).replace(/\D/g, '');
  if (s.indexOf('66') === 0 && s.length === 11) s = '0' + s.slice(2);
  if (s.length === 9 && s.charAt(0) !== '0') s = '0' + s;
  return s;
}
function validPhone_(s) { return /^0\d{8,9}$/.test(s); }
function clean_(v) { return String(v === undefined || v === null ? '' : v).replace(/[<>]/g, '').replace(/^[=+\-@]+/, '').trim().slice(0, 200); }
function now_() { return Utilities.formatDate(new Date(), 'Asia/Bangkok', "yyyy-MM-dd'T'HH:mm:ss"); }
function sha256_(text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function hmac_(text) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET'))); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
