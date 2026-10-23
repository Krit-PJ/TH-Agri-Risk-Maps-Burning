'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const builder = require('../tools/build-public-data.cjs');

function featureCollection(features = []) {
  return { type: 'FeatureCollection', features };
}

test('catalog contains 77 canonical boundary packages and activates only provinces with valid hotspots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-public-data-'));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  const provinces = Array.from({ length: 77 }, (_, i) => ({
    provinceCode: String(i + 10).padStart(2, '0'),
    provinceNameTH: `จังหวัด ${i + 1}`
  }));

  for (const province of provinces) {
    const dir = path.join(source, 'boundary', province.provinceCode);
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['province.geojson', 'districts.geojson', 'subdistricts.geojson']) {
      fs.writeFileSync(path.join(dir, name), JSON.stringify(featureCollection()));
    }
  }
  fs.mkdirSync(path.join(source, 'hotspot'), { recursive: true });
  fs.writeFileSync(path.join(source, 'hotspot', 'hotspot_2569.geojson'), JSON.stringify(featureCollection([
    { type: 'Feature', geometry: { type: 'Point', coordinates: [100, 15] }, properties: { provinceCode: provinces[0].provinceCode } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [999, 15] }, properties: { provinceCode: provinces[1].provinceCode } }
  ])));

  const catalog = builder.build({ sourceRoot: source, outputRoot: output, provinces });

  assert.equal(catalog.provinceCodes.length, 77);
  assert.deepEqual(catalog.activeProvinceCodes, [provinces[0].provinceCode]);
  assert.equal(catalog.invalidHotspots, 1);
  assert.ok(fs.existsSync(path.join(output, 'boundary', provinces[76].provinceCode, 'subdistricts.geojson')));
});

test('province without hotspot rows remains installed but inactive', () => {
  const catalog = builder.catalogFromCounts(
    [{ provinceCode: '62', provinceNameTH: 'กำแพงเพชร' }, { provinceCode: '63', provinceNameTH: 'ตาก' }],
    new Map([['62', 5]])
  );
  assert.deepEqual(catalog.provinceCodes, ['62', '63']);
  assert.deepEqual(catalog.activeProvinceCodes, ['62']);
});

test('public hotspot packaging excludes private rows and unknown properties', () => {
  assert.equal(builder.isPublished({ properties: {} }), true);
  assert.equal(builder.isPublished({ properties: { published: false } }), false);
  assert.equal(builder.isPublished({ properties: { published: 'false' } }), false);
  assert.deepEqual(
    builder.publicProperties({ hotspotId: 'H1', date: '2026-01-01', phone: 'private', fullName: 'private' }, '62'),
    { hotspotId: 'H1', date: '2026-01-01', provinceCode: '62', __provinceCode: '62' }
  );
});
