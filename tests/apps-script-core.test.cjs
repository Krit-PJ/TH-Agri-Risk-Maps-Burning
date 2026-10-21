'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadCore() {
  const context = {
    console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest(_algorithm, text) {
        return [...Buffer.from(`digest:${text}`)].map(value => value > 127 ? value - 256 : value);
      },
      base64EncodeWebSafe(bytes) { return Buffer.from(bytes.map(value => value < 0 ? value + 256 : value)).toString('base64url'); }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/cloud/apps-script/Code.gs'), 'utf8'), context);
  return context;
}

test('normalizes a Thai mobile phone without exposing it as an authority', () => {
  const core = loadCore();
  assert.equal(core.normalizePhone_('๐๘๔-๑๑๕-๗๖๖๖'), '0841157666');
  assert.throws(() => core.normalizePhone_('021234567'), /หมายเลขโทรศัพท์/);
});

test('registration requires current notice and is idempotent', () => {
  const core = loadCore();
  const payload = {
    idempotencyKey: 'request-1234567890', noticeVersion: '2026-10-21.1', acknowledged: true,
    fullName: 'ผู้ทดสอบ ระบบ', phone: '0841157666', position: 'นักวิชาการเกษตร',
    affiliation: 'สำนักงานเกษตรจังหวัด', provinceCode: '62'
  };
  const first = core.validateRegistration_(payload, '2026-10-21.1', new Set());
  assert.equal(first.duplicate, false);
  const duplicate = core.validateRegistration_(payload, '2026-10-21.1', new Set([payload.idempotencyKey]));
  assert.equal(duplicate.duplicate, true);
  assert.throws(() => core.validateRegistration_({ ...payload, noticeVersion: 'old' }, '2026-10-21.1', new Set()), /ประกาศ/);
});

test('admin scope rejects another province while super admin can access all provinces', () => {
  const core = loadCore();
  assert.equal(core.scopeAllows_({ role: 'admin', provinceCode: '62', status: 'approved' }, '62'), true);
  assert.equal(core.scopeAllows_({ role: 'admin', provinceCode: '62', status: 'approved' }, '63'), false);
  assert.equal(core.scopeAllows_({ role: 'superadmin', status: 'approved' }, '96'), true);
});

test('expired session and public account serialization fail closed', () => {
  const core = loadCore();
  assert.equal(core.sessionValid_({ expiresAt: 1000 }, 1000), false);
  assert.equal(core.sessionValid_({ expiresAt: 1001 }, 1000), true);
  const value = core.publicAccount_({ accountId: 'A1', fullName: 'คนหนึ่ง', role: 'admin', provinceCode: '62', phoneHash: 'secret', deviceTokenHash: 'secret2', googleEmail: 'private@example.com' });
  assert.deepEqual(JSON.parse(JSON.stringify(value)), { accountId: 'A1', fullName: 'คนหนึ่ง', role: 'admin', provinceCode: '62' });
});
