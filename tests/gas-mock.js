/* Minimal Google Apps Script runtime for running backend/*.gs under Node (tests only). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Range {
  constructor(sheet, row, col, nr, nc) { Object.assign(this, { sheet, row, col, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const r = this.sheet.rows[this.row - 1 + i] || [];
      out.push(Array.from({ length: this.nc }, (_, j) => (r[this.col - 1 + j] === undefined ? '' : r[this.col - 1 + j])));
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(v) { v.forEach((r, i) => r.forEach((x, j) => this.sheet.set(this.row + i, this.col + j, x))); return this; }
  setValue(x) { this.sheet.set(this.row, this.col, x); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setNumberFormat() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  set(r, c, x) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return Math.max(1000, this.rows.length); }
  getMaxColumns() { return Math.max(26, ...this.rows.map(r => r.length)); }
  deleteColumns() { }
  setFrozenRows() { }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  getName() { return this.name; }
}
function load(opts = {}) {
  const sheets = {};
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet(n)),
    getSheets: () => Object.values(sheets),
    deleteSheet: s => { delete sheets[s.name]; }
  };
  const props = Object.assign({}, opts.props || {});
  const cache = new Map();
  const signed = b => [...b].map(x => (x > 127 ? x - 256 : x));
  const g = {
    SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
      setProperties: o => Object.keys(o).forEach(k => { props[k] = String(o[k]); }), deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)), remove: k => cache.delete(k),
      getAll: ks => Object.fromEntries(ks.filter(k => cache.has(k)).map(k => [k, cache.get(k)])), putAll: o => Object.keys(o).forEach(k => cache.set(k, o[k])), removeAll: ks => ks.forEach(k => cache.delete(k)) }) },
    LockService: { getScriptLock: () => ({ waitLock() { }, tryLock() { return true; }, releaseLock() { } }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256', MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (a, s) => signed(crypto.createHash(a).update(String(s), 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => signed(crypto.createHmac('sha256', String(k)).update(String(v), 'utf8').digest()),
      base64EncodeWebSafe: b => (typeof b === 'string' ? Buffer.from(b, 'utf8') : Buffer.from(b.map(x => x & 255))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => signed(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(x => x & 255)).toString('utf8') }),
      getUuid: () => crypto.randomUUID(),
      sleep: () => { },
      formatDate: (d, tz, f) => {
        const x = new Date(new Date(d).getTime() + 7 * 3600e3), p = n => String(n).padStart(2, '0');
        const Y = x.getUTCFullYear(), M = p(x.getUTCMonth() + 1), D = p(x.getUTCDate()), h = p(x.getUTCHours()), m = p(x.getUTCMinutes()), s = p(x.getUTCSeconds());
        if (f === 'yyMMdd') return String(Y).slice(2) + M + D;
        if (f === 'yyMMddHHmmss') return String(Y).slice(2) + M + D + h + m + s;
        if (f === 'yyyy-MM-dd') return `${Y}-${M}-${D}`;
        return `${Y}-${M}-${D}T${h}:${m}:${s}`;
      }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ body: t, setMimeType() { return this; } }) },
    Logger: { log() { } }
  };
  const dir = path.join(__dirname, '..', 'backend');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs') && f !== 'Secrets.example.gs');
  const secrets = `var INIT_ADMIN_PHONE = '${opts.adminPhone || '0811111111'}'; var INIT_ADMIN_PROVINCE = '62'; var INIT_SUPER_USER = 'root'; var INIT_SUPER_PASSWORD = 'Root12345';`;
  const src = secrets + '\n' + files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const names = Object.keys(g);
  const api = new Function(...names, src + '\nreturn { doGet, doPost, setup, idFromAccount_, findRow_, readAll_ };')(...names.map(n => g[n]));
  const post = body => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).body);
  return { api, post, sheets, props, cache, readAll_: api.readAll_ };
}
module.exports = { load };
