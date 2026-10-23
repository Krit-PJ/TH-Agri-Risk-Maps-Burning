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
  assert.equal(core.normalizePhone_('๐๘๑-๒๓๔-๕๖๗๘'), '0812345678');
  assert.throws(() => core.normalizePhone_('021234567'), /หมายเลขโทรศัพท์/);
});

test('registration requires current notice and is idempotent', () => {
  const core = loadCore();
  const payload = {
    idempotencyKey: 'request-1234567890', noticeVersion: '2026-10-21.1', acknowledged: true,
    fullName: 'ผู้ทดสอบ ระบบ', phone: '0812345678', position: 'นักวิชาการเกษตร',
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

test('publication state accepts booleans only and defaults to private', () => {
  const core = loadCore();
  assert.equal(core.strictBoolean_(true, false), true);
  assert.equal(core.strictBoolean_(false, true), false);
  assert.equal(core.strictBoolean_(undefined, false), false);
  assert.throws(() => core.strictBoolean_('false', false), /true หรือ false/);
});

test('hotspot mutation checks both the proposed and existing province', () => {
  const core = loadCore();
  const admin = { role: 'admin', provinceCode: '62', status: 'approved' };
  assert.doesNotThrow(() => core.assertMutationScope_(admin, { provinceCode: '62' }, { provinceCode: '62' }));
  assert.throws(() => core.assertMutationScope_(admin, { provinceCode: '62' }, { provinceCode: '63' }), /นอกสิทธิ์/);
  assert.throws(() => core.assertMutationScope_(admin, { provinceCode: '63' }, { provinceCode: '62' }), /นอกสิทธิ์/);
});

test('cached session authority is rejected after account changes', () => {
  const core = loadCore();
  const session = { revision: 2, provinceCode: '62', deviceTokenHash: 'device-a' };
  assert.equal(core.sessionAuthorityMatches_(session, { status: 'approved', role: 'admin', revision: 2, provinceCode: '62', deviceTokenHash: 'device-a' }), true);
  assert.equal(core.sessionAuthorityMatches_(session, { status: 'disabled', role: 'admin', revision: 2, provinceCode: '62', deviceTokenHash: 'device-a' }), false);
  assert.equal(core.sessionAuthorityMatches_(session, { status: 'approved', role: 'admin', revision: 3, provinceCode: '62', deviceTokenHash: 'device-a' }), false);
  assert.equal(core.sessionAuthorityMatches_(session, { status: 'approved', role: 'admin', revision: 2, provinceCode: '63', deviceTokenHash: 'device-a' }), false);
});

test('province data plane publishes only explicit published non-deleted rows', () => {
  const core = loadCore();
  core.provinceRows_ = () => [
    { hotspotId: 'draft', workflowStatus: 'draft', deletedAt: '' },
    { hotspotId: 'approved', workflowStatus: 'approved', deletedAt: '' },
    { hotspotId: 'public', workflowStatus: 'published', deletedAt: '' },
    { hotspotId: 'deleted', workflowStatus: 'published', deletedAt: '2026-10-24T00:00:00Z' }
  ];
  assert.deepEqual(Array.from(core.publicRows_('62'), row => row.hotspotId), ['public']);
});

test('public catalog activates only ready provinces with published rows', () => {
  const core = loadCore();
  core.rows_ = () => [
    { provinceCode: '62', status: 'pilot', publishedCount: 10, dataSpreadsheetId: 'sheet-62' },
    { provinceCode: '63', status: 'installed', publishedCount: 10, dataSpreadsheetId: 'sheet-63' },
    { provinceCode: '64', status: 'active', publishedCount: 0, dataSpreadsheetId: 'sheet-64' },
    { provinceCode: '65', status: 'active', publishedCount: 10, dataSpreadsheetId: '' }
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(core.publicCatalog_())), { ok: true, schemaVersion: 2, activeProvinceCodes: ['62'] });
});
