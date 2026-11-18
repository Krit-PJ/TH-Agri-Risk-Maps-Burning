/* v3.12 ตัวตนกลาง (SSO) + Mini Super Admin ชื่อผู้ใช้/รหัสผ่าน — run: node tests/identity.test.js */
const { load } = require('./gas-mock');
let n = 0;
function ok(cond, msg) { n++; if (!cond) throw new Error('FAIL ' + n + ': ' + msg); }
function throws(fn, re, msg) { let e = null; try { fn(); } catch (x) { e = x; } ok(e && re.test(e.message), msg + ' (got: ' + (e ? e.message : 'no error') + ')'); }
const err = (r, re) => r.ok === false && re.test(r.error || '');

const env = load({ adminPhone: '0811111111' });
const { post, props, sheets } = env;
post({ action: 'ping' });
ok(sheets.People && sheets.People.rows[0].includes('personId'), 'setup creates People sheet');
ok(sheets.Accounts.rows[0].slice(-3).join() === 'username,passHash,passSalt', 'Accounts gains credential columns at the end');
ok(props.SSO_MODE === 'optional', 'SSO_MODE defaults to optional');

/* 1. Admin phone login also issues the central identity (existing account migrated by phone) */
let r = post({ action: 'login_admin', phone: '081-111-1111', device: 'Chrome / Windows' });
ok(r.ok && r.token && r.id && r.id.token && r.id.person.systems.includes('ARM'), 'admin login returns ARM token + identity');
ok(r.id.prevLogin === null, 'first login has no previous login');
const adminId = r.id.token;
ok(env.readAll_('People').length === 1 && env.readAll_('People')[0].createdVia === 'ARM', 'People row created from Accounts');
r = post({ action: 'login_admin', phone: '0811111111', device: 'Safari / iOS' });
ok(r.id.prevLogin && r.id.prevLogin.device === 'Chrome / Windows', 'second login shows the previous login for "not me"');
ok(adminId.split('.').length === 4 && Number(adminId.split('.')[2]) - Date.now() <= 8 * 3600e3 + 1000, 'admin identity lasts 8 hours');

/* 2. Unknown number → not_found (then registration); throttled per number */
r = post({ action: 'id_login', phone: '0899999999', system: 'GGH' });
ok(r.ok === false && r.code === 'not_found', 'unknown number returns not_found');
for (let i = 0; i < 9; i++) post({ action: 'id_login', phone: '0899999999', system: 'GGH' });
ok(err(post({ action: 'id_login', phone: '0899999999', system: 'GGH' }), /หลายครั้งเกินไป/), 'unknown number throttled after 10 tries');
ok(err(post({ action: 'id_login', phone: '12', system: 'GGH' }), /รูปแบบ/), 'invalid number rejected');

/* 3. Register (farmer from GGH), remember device 30 days */
ok(err(post({ action: 'id_register', phone: '0822222222', fullName: 'สมชาย ใจดี', provinceCode: '62', system: 'GGH' }), /ยอมรับเงื่อนไข/), 'consent required');
r = post({ action: 'id_register', phone: '0822222222', fullName: 'สมชาย ใจดี', provinceCode: '62', districtName: 'เมืองกำแพงเพชร', consent: true, system: 'GGH', remember: true, device: 'LINE / Android' });
ok(r.ok && r.person.fullName === 'สมชาย ใจดี' && r.person.systems.includes('GGH'), 'farmer registered and signed in');
ok(r.exp - Date.now() > 29 * 864e5, 'farmer may stay signed in 30 days');
const farmerId = r.token;
ok(err(post({ action: 'id_register', phone: '0822222222', fullName: 'ซ้ำ ซ้ำ', provinceCode: '62', consent: true }), /ลงทะเบียนแล้ว/), 'duplicate registration rejected');
r = post({ action: 'id_login', phone: '0822222222', system: 'SAM', remember: true });
ok(r.ok && r.prevLogin && r.prevLogin.system === 'GGH', 'same number signs into another system');
r = post({ action: 'login_admin', phone: '0811111111', device: 'x' });
r = post({ action: 'id_login', phone: '0811111111', system: 'GGH', remember: true });
ok(r.exp - Date.now() <= 8 * 3600e3 + 1000, 'remember is ignored for Agri-Risk admins (8 hours)');

/* 4. Tickets: one use, bound to the target system, short-lived, tamper-proof */
r = post({ action: 'id_ticket', idToken: farmerId, aud: 'GGH' });
ok(r.ok && r.ticket && r.expiresIn === 120, 'ticket issued for GGH');
const t1 = r.ticket;
ok(err(post({ action: 'id_redeem', ticket: t1, aud: 'SAM' }), /ไม่ได้ออกให้ระบบนี้/), 'ticket for GGH rejected by SAM');
r = post({ action: 'id_redeem', ticket: t1, aud: 'GGH' });
ok(r.ok && r.person.phone === '0822222222' && r.person.provinceCode === '62', 'GGH redeems ticket → person');
ok(err(post({ action: 'id_redeem', ticket: t1, aud: 'GGH' }), /ถูกใช้แล้ว/), 'ticket cannot be used twice');
const [pl, sig] = post({ action: 'id_ticket', idToken: farmerId, aud: 'GGH' }).ticket.split('.');
const forged = Buffer.from(JSON.stringify({ pid: 'P-x', aud: 'GGH', exp: Date.now() + 1e5, jti: 'z' })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_') + '.' + sig;
ok(err(post({ action: 'id_redeem', ticket: forged, aud: 'GGH' }), /ไม่ถูกต้อง/), 'forged ticket rejected');
ok(err(post({ action: 'id_redeem', ticket: pl + '.' + sig.slice(1) + 'A', aud: 'GGH' }), /ไม่ถูกต้อง/), 'tampered signature rejected');
ok(err(post({ action: 'id_ticket', idToken: farmerId + 'x', aud: 'GGH' }), /เข้าสู่ระบบ/), 'bad identity token rejected');
ok(err(post({ action: 'id_ticket', idToken: farmerId, aud: 'XYZ' }), /ไม่รู้จัก/), 'unknown system rejected');
r = post({ action: 'id_me', idToken: farmerId });
ok(r.ok && r.person.systems.join() === 'GGH,SAM', 'id_me lists systems used');

/* 5. Agri-Risk sign-in from the central identity */
ok(post({ action: 'login_sso', idToken: farmerId }).code === 'no_account', 'farmer has no Agri-Risk admin rights');
r = post({ action: 'login_sso', idToken: adminId });
ok(r.ok === false || r.token, 'admin token from an older login may be invalidated or valid');
const freshAdmin = post({ action: 'id_login', phone: '0811111111', system: 'ARM' }).token;
r = post({ action: 'login_sso', idToken: freshAdmin });
ok(r.ok && r.token && r.user.role === 'admin' && r.user.prov === '62', 'admin enters Agri-Risk through the central identity');

/* 6. "Not me" suspends everywhere at once */
const t2 = post({ action: 'id_ticket', idToken: farmerId, aud: 'SAM' }).ticket;
ok(post({ action: 'id_not_me', idToken: farmerId }).ok, 'owner reports a login that was not theirs');
ok(err(post({ action: 'id_login', phone: '0822222222', system: 'GGH' }), /ถูกระงับ/), 'suspended number cannot sign in');
ok(err(post({ action: 'id_redeem', ticket: t2, aud: 'SAM' }), /ระงับ/), 'tickets of a suspended person are refused');
ok(err(post({ action: 'id_me', idToken: farmerId }), /ระงับ/), 'existing identity token stops working');

/* 7. Super Admin: people list (masked by default), reactivate, SSO mode */
const sup = post({ action: 'login_super', username: 'root', password: 'Root12345' });
ok(sup.ok, 'super admin logs in with username/password (unchanged)');
r = post({ action: 'id_people_list', token: sup.token });
const farmer = r.people.find(p => p.fullName === 'สมชาย ใจดี');
ok(r.ok && farmer.phone === '082-xxx-2222' && farmer.status === 'suspended' && /ไม่ใช่ฉัน/.test(farmer.statusNote), 'people list masks phones and shows the reason');
r = post({ action: 'id_people_list', token: sup.token, full: true });
ok(r.people.find(p => p.personId === farmer.personId).phone === '0822222222', 'full phone view for national roles');
ok(env.readAll_('AuditLog').some(a => a.action === 'id_people_view_full'), 'full phone view is audited');
ok(post({ action: 'id_person_status', token: sup.token, personId: farmer.personId, status: 'active' }).ok, 'super admin reactivates');
ok(post({ action: 'id_login', phone: '0822222222', system: 'GGH' }).ok, 'reactivated person signs in again');
const adminTok = post({ action: 'login_admin', phone: '0811111111' }).token;
ok(post({ action: 'id_people_list', token: adminTok }).people.every(p => p.provinceName === 'กำแพงเพชร'), 'province admin sees own province only');
ok(err(post({ action: 'sso_mode_save', token: adminTok, mode: 'off' }), /Super Admin/), 'only super admin changes SSO mode');

/* 8. Mini Super Admin = username + password */
ok(err(post({ action: 'account_save', token: sup.token, phone: '0833333333', fullName: 'มินิ ทดสอบ', provinceCode: '62', role: 'minisuper', username: 'mini.kpp', password: 'short' }), /8 ตัว/), 'weak password rejected');
ok(err(post({ action: 'account_save', token: sup.token, phone: '0833333333', fullName: 'มินิ ทดสอบ', provinceCode: '62', role: 'minisuper', username: 'mini.kpp' }), /รหัสผ่านเริ่มต้น/), 'new mini needs a password');
ok(post({ action: 'account_save', token: sup.token, phone: '0833333333', fullName: 'มินิ ทดสอบ', provinceCode: '62', role: 'minisuper', username: 'Mini.KPP', password: 'Kpp2026ok' }).ok, 'super admin creates mini with username/password');
r = post({ action: 'accounts_list', token: sup.token });
const mini = r.accounts.find(a => a.role === 'minisuper');
ok(mini.username === 'mini.kpp' && mini.hasPassword === true && !('passHash' in mini) && !('passSalt' in mini), 'account list never exposes password hashes');
ok(err(post({ action: 'login_admin', phone: '0833333333' }), /ชื่อผู้ใช้และรหัสผ่าน/), 'mini cannot sign in with phone only');
ok(post({ action: 'id_login', phone: '0833333333', system: 'GGH' }).code === 'not_found', 'mini is not auto-enrolled in the central identity');
const miniLogin = post({ action: 'login_mini', username: 'MINI.kpp', password: 'Kpp2026ok', device: 'Edge / Windows' });
ok(miniLogin.ok && miniLogin.user.role === 'minisuper' && miniLogin.user.prov === '*', 'mini signs in with username/password');
for (let i = 0; i < 5; i++) post({ action: 'login_mini', username: 'mini.kpp', password: 'wrong' + i });
ok(err(post({ action: 'login_mini', username: 'mini.kpp', password: 'Kpp2026ok' }), /รอ 15 นาที/), 'mini locked 15 minutes after 5 wrong passwords');
env.cache.delete('mf:mini.kpp');
ok(err(post({ action: 'account_password', token: miniLogin.token, current: 'nope', password: 'NewPass2026' }), /ปัจจุบัน/), 'password change needs the current password');
ok(post({ action: 'account_password', token: miniLogin.token, current: 'Kpp2026ok', password: '12345678' }).ok, 'digits-only password of 8 is accepted');
ok(post({ action: 'account_password', token: miniLogin.token, current: '12345678', password: 'abcdefgh' }).ok, 'letters-only password of 8 is accepted');
ok(err(post({ action: 'account_password', token: miniLogin.token, current: 'abcdefgh', password: '1234567' }), /8 ตัว/), '7 characters rejected');
ok(post({ action: 'account_password', token: miniLogin.token, current: 'abcdefgh', password: 'NewPass2026' }).ok, 'mini changes own password');
ok(post({ action: 'login_mini', username: 'mini.kpp', password: 'NewPass2026' }).ok, 'new password works');
ok(!JSON.stringify(env.readAll_('LoginAttempts')).includes('NewPass2026'), 'passwords never logged');
ok(post({ action: 'account_save', token: sup.token, accountId: mini.accountId, phone: '0833333333', fullName: 'มินิ แก้ชื่อ', provinceCode: '62', role: 'minisuper' }).ok, 'editing a mini without a new password keeps the password');
ok(post({ action: 'login_mini', username: 'mini.kpp', password: 'NewPass2026' }).ok, 'password kept after edit');

/* 9. Legacy mini (no password yet) can still use phone until super admin sets credentials */
env.sheets.Accounts.rows.push(['A-62-099', '0844444444', 'มินิ เดิม', '', '', '62', 'กำแพงเพชร', 'minisuper', 'approved', '', '', '', '', '', '', '']);
r = post({ action: 'login_admin', phone: '0844444444' });
ok(r.ok && r.user.needCredentials === true && !r.id, 'legacy mini signs in by phone with a reminder and no central identity');

/* 10. SSO off: identity endpoints close, Agri-Risk keeps working */
ok(post({ action: 'sso_mode_save', token: sup.token, mode: 'off' }).mode === 'off', 'super admin turns SSO off');
ok(err(post({ action: 'id_login', phone: '0822222222', system: 'GGH' }), /ปิดใช้งาน/), 'identity endpoints closed when off');
r = post({ action: 'login_admin', phone: '0811111111' });
ok(r.ok && !r.id, 'Agri-Risk admin login still works without identity when off');
post({ action: 'sso_mode_save', token: sup.token, mode: 'optional' });

/* 11. Login report labels */
const rep = post({ action: 'login_report', token: sup.token, days: 1 });
ok(rep.attempts.some(a => a.role === 'sso' && a.result === 'success') && rep.attempts.some(a => a.role === 'minisuper' && a.identifier === 'mini.kpp'), 'SSO and mini logins appear in the login report');

console.log('PASS: ' + n + ' checks — central identity (SSO), tickets, not-me, Mini username/password');
