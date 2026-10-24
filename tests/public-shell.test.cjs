'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('public landing is map-first, accessible, and exposes only active provinces', () => {
  const html = read('index.html');
  assert.match(html, /id="province-select"/);
  assert.match(html, /id="national-map"/);
  assert.match(html, /app\/js\/landing\.js/);
  assert.match(html, /data-font-size="small"/);
  assert.match(html, /data-font-size="medium"/);
  assert.match(html, /data-font-size="large"/);
  assert.doesNotMatch(html, /โค้ดโครงการ/);
  const catalog = JSON.parse(read('app/data/catalog.json'));
  assert.equal(catalog.provinceCodes.length, 77);
  assert.deepEqual(catalog.activeProvinceCodes, ['62']);
  const national = JSON.parse(read('app/data/boundary/provinces.geojson'));
  assert.equal(national.features.length, 77);
  assert.equal(new Set(national.features.map(f=>f.properties.provinceCode)).size, 77);
});

test('static map does not load the local Node access bridge', () => {
  const html = read('app/index.html');
  assert.doesNotMatch(html, /v2\/context\.js|v2\/client\.js|access-loading/);
  assert.doesNotMatch(html, /free-counters|whomania|acadoo/);
  assert.match(html, /js\/public-shell\.js/);
});

test('public pages merge the approved Apps Script feed with bundled fallback data', () => {
  assert.match(read('app/js/landing.js'), /loadDynamicCatalog/);
  const shell = read('app/js/public-shell.js');
  assert.match(shell, /AgriPublicApi/);
  assert.match(shell, /Public API fallback/);
  assert.match(shell, /bundledHotspots/);
});

test('Kamphaeng Phet uses the canonical national data paths', () => {
  const provinces = JSON.parse(read('app/config/provinces.json'));
  const kpp = provinces.find(value => value.provinceCode === '62');
  assert.equal(kpp.boundaryPath.district, 'data/boundary/62/districts.geojson');
  assert.equal(kpp.hotspotPath['2569'], 'data/hotspot/62/hotspot_2569.geojson');
});

test('deployment workflow publishes the repository with Pages artifact actions', () => {
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /actions\/upload-pages-artifact/);
  assert.match(workflow, /actions\/deploy-pages/);
});

test('tracked source excludes common credential assignments and private handoff files', () => {
  const tracked = require('node:child_process').execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
  assert.equal(tracked.some(file => /(?:^|\/)\.private(?:\/|$)/.test(file)), false);
  for (const file of tracked.filter(Boolean)) {
    const absolute = path.join(root, file);
    if (!fs.statSync(absolute).isFile()) continue;
    const buffer = fs.readFileSync(absolute);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    assert.doesNotMatch(text, /(?:OWNER_PASSWORD|ADMIN_PHONE|activationCode)\s*[:=]\s*['\"][^'\"]+['\"]/i, `${file} may expose a credential assignment`);
  }
});
