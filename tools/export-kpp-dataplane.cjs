'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const districts = read('app/data/boundary/62/districts.geojson').features;
const subdistricts = read('app/data/boundary/62/subdistricts.geojson').features;
const districtCode = new Map(districts.map(({ properties: p }) => [p.nameTH, String(p.districtCode)]));
const subdistrictCode = new Map(subdistricts.map(({ properties: p }) => [`${p.__district}|${p.nameTH}`, String(p.subdistrictCode)]));
const stamp = '2026-10-24T00:00:00+07:00';
const seen = new Set();
const rows = [];
const errors = [];

for (const year of [2566, 2567, 2568, 2569]) {
  const source = read(`app/data/hotspot/62/hotspot_${year}.geojson`);
  for (const [index, feature] of source.features.entries()) {
    const p = feature.properties || {};
    const id = String(p.hs_id || p.hsID || `62-${year}-${index + 1}`);
    const district = String(p.district || p.Amphoe || p.__district || '');
    const subdistrict = String(p.subdistrict || p.Tambon || p.__subdistrict || '');
    const amphoeCode = districtCode.get(district) || '';
    const tambonCode = subdistrictCode.get(`${district}|${subdistrict}`) || '';
    const coordinates = feature.geometry && feature.geometry.coordinates || [];
    if (seen.has(id) || !amphoeCode || !tambonCode || coordinates.length < 2) {
      errors.push({ year, index: index + 1, id, district, subdistrict, reason: seen.has(id) ? 'duplicate' : 'unmapped' });
      continue;
    }
    seen.add(id);
    rows.push([
      id, String(p.acq_date || p.Date || p.__date || ''), String(p.acq_time || p.Time || ''), '62', amphoeCode, tambonCode,
      String(p.land_type || p.LandType || ''), String(p.plant_type || p.PlantType || ''), Number(coordinates[1]), Number(coordinates[0]),
      String(p.source || 'legacy-public-bundle'), id, 'published', 1, 'legacy-kpp-bundled-v1', stamp, 'MIGRATION', stamp, 'MIGRATION',
      stamp, 'MIGRATION', stamp, 'MIGRATION', stamp, 'MIGRATION', '', '', ''
    ]);
  }
}

const args = new Map(process.argv.slice(2).map(value => value.split('=')));
if (args.has('--summary')) {
  process.stdout.write(JSON.stringify({ rowCount: rows.length, errorCount: errors.length, errors: errors.slice(0, 20) }));
} else {
  const offset = Math.max(0, Number(args.get('--offset') || 0));
  const limit = Math.min(250, Math.max(1, Number(args.get('--limit') || 200)));
  process.stdout.write(JSON.stringify({ offset, rows: rows.slice(offset, offset + limit), total: rows.length, errorCount: errors.length }));
}
