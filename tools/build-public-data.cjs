'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BOUNDARY_FILES = ['province.geojson', 'districts.geojson', 'subdistricts.geojson'];

function clean(value) {
  return String(value ?? '').trim();
}

function validPoint(feature) {
  const coordinates = feature?.geometry?.coordinates;
  return feature?.type === 'Feature' && feature?.geometry?.type === 'Point' &&
    Array.isArray(coordinates) && coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1])) &&
    Number(coordinates[0]) >= 90 && Number(coordinates[0]) <= 110 &&
    Number(coordinates[1]) >= 0 && Number(coordinates[1]) <= 25;
}

function provinceCode(feature, byName) {
  const p = feature?.properties || {};
  const direct = clean(p.provinceCode || p.__provinceCode || p.PROV_CODE || p.ADM1_PCODE).match(/\d{2}/)?.[0];
  if (direct) return direct;
  return byName.get(clean(p.Province || p.province || p.__province || p.ProvinceN)) || '';
}

function catalogFromCounts(provinces, hotspotCounts, invalidHotspots = 0, years = []) {
  const ordered = provinces.map(p => p.provinceCode);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provinceCodes: ordered,
    activeProvinceCodes: ordered.filter(code => (hotspotCounts.get(code) || 0) > 0),
    hotspotCounts: Object.fromEntries(ordered.map(code => [code, hotspotCounts.get(code) || 0])),
    years: [...years].sort(),
    invalidHotspots
  };
}

function readCollection(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error(`Invalid FeatureCollection: ${file}`);
  }
  return value;
}

function build({ sourceRoot, outputRoot, provinces }) {
  if (!Array.isArray(provinces) || provinces.length !== 77) {
    throw new Error(`Expected 77 provinces, received ${provinces?.length || 0}`);
  }
  const codes = new Set(provinces.map(p => p.provinceCode));
  if (codes.size !== 77 || [...codes].some(code => !/^\d{2}$/.test(code))) {
    throw new Error('Province registry must contain 77 unique two-digit codes');
  }

  const boundaryRoot = path.join(sourceRoot, 'boundary');
  const hotspotRoot = path.join(sourceRoot, 'hotspot');
  const outputBoundary = path.join(outputRoot, 'boundary');
  const outputHotspot = path.join(outputRoot, 'hotspot');
  fs.mkdirSync(outputBoundary, { recursive: true });
  fs.mkdirSync(outputHotspot, { recursive: true });

  for (const province of provinces) {
    const sourceDir = path.join(boundaryRoot, province.provinceCode);
    const targetDir = path.join(outputBoundary, province.provinceCode);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const file of BOUNDARY_FILES) {
      const source = path.join(sourceDir, file);
      if (!fs.existsSync(source)) throw new Error(`Missing boundary ${province.provinceCode}/${file}`);
      readCollection(source);
      fs.copyFileSync(source, path.join(targetDir, file));
    }
  }

  const byName = new Map(provinces.flatMap(p => [p.provinceNameTH, p.provinceNameEN].filter(Boolean).map(name => [clean(name), p.provinceCode])));
  const counts = new Map();
  const years = [];
  let invalidHotspots = 0;
  const files = fs.existsSync(hotspotRoot)
    ? fs.readdirSync(hotspotRoot).filter(name => /^hotspot_\d{4}\.geojson$/.test(name)).sort()
    : [];
  for (const file of files) {
    const year = file.match(/(\d{4})/)[1];
    years.push(year);
    const source = readCollection(path.join(hotspotRoot, file));
    const grouped = new Map();
    for (const feature of source.features) {
      const code = provinceCode(feature, byName);
      if (!validPoint(feature) || !codes.has(code)) { invalidHotspots++; continue; }
      const copy = structuredClone(feature);
      copy.properties = { ...(copy.properties || {}), provinceCode: code, __provinceCode: code };
      if (!grouped.has(code)) grouped.set(code, []);
      grouped.get(code).push(copy);
      counts.set(code, (counts.get(code) || 0) + 1);
    }
    for (const [code, features] of grouped) {
      const dir = path.join(outputHotspot, code);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `hotspot_${year}.geojson`), JSON.stringify({
        type: 'FeatureCollection',
        name: `hotspot_${code}_${year}`,
        metadata: { provinceCode: code, datasetYearBE: Number(year), totalPoints: features.length, public: true },
        features
      }));
    }
  }

  const catalog = catalogFromCounts(provinces, counts, invalidHotspots, years);
  fs.writeFileSync(path.join(outputRoot, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}

function cli(argv) {
  const value = flag => argv[argv.indexOf(flag) + 1];
  const sourceRoot = value('--source');
  const outputRoot = value('--output');
  const provincesFile = value('--provinces');
  if (!sourceRoot || !outputRoot || !provincesFile) {
    throw new Error('Usage: node tools/build-public-data.cjs --source <data> --output <app/data> --provinces <config/provinces.json>');
  }
  const provinces = JSON.parse(fs.readFileSync(provincesFile, 'utf8'));
  const catalog = build({ sourceRoot, outputRoot, provinces });
  process.stdout.write(`${JSON.stringify(catalog)}\n`);
}

if (require.main === module) {
  try { cli(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { build, catalogFromCounts, provinceCode, validPoint };
