'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('frontend exposes LandType and PlantType filters with agricultural default',()=>{
  const html=read('app/index.html');
  assert.match(html,/id="filter-land-type"/);
  assert.match(html,/<option value="พื้นที่เกษตร" selected>พื้นที่เกษตร<\/option>/);
  assert.match(html,/id="filter-crop"/);
  assert.match(html,/LandType/);
  assert.match(html,/PlantType/);
});

test('map and dashboard apply one shared LandType state to hotspots and summaries',()=>{
  const app=read('app/js/app.js'),map=read('app/js/map.js'),dashboard=read('app/js/dashboard.js');
  assert.match(app,/landType:document\.getElementById\('filter-land-type'\)/);
  assert.match(map,/__land_type===state\.landType/);
  assert.match(dashboard,/H\(\)\.landOf\(p\)===state\.landType/);
  assert.match(map,/ประเภทพื้นที่:/);
});

test('hsAll is the preferred detail source while AllData remains historical fallback',()=>{
  const rules=JSON.parse(read('app/config/import-rules.default.json'));
  assert.equal(rules.preferredDetailSheet,'hsAll');
  assert.equal(rules.detailProfiles[0].sheetNames[0],'hsAll');
  assert.equal(rules.detailProfiles[1].sheetNames[0],'AllData');
});

test('published Kamphaeng Phet hotspots match the agricultural default',()=>{
  const directory=path.join(root,'app/data/hotspot/62'),files=fs.readdirSync(directory).filter(file=>file.endsWith('.geojson'));
  const features=files.flatMap(file=>JSON.parse(fs.readFileSync(path.join(directory,file),'utf8')).features||[]);
  assert.equal(features.length,1755);
  assert.deepEqual([...new Set(features.map(feature=>feature.properties.LandType||feature.properties.land_type))],['พื้นที่เกษตร']);
});

test('generated fallback stays in sync with the primary import config',()=>{
  const source=read('app/config/fallback.js'),payload=source.match(/window\.AGRI_CONFIG_FALLBACK = ([\s\S]+);\s*$/);
  assert.ok(payload);
  const fallback=JSON.parse(payload[1]),primary=JSON.parse(read('app/config/import-rules.default.json'));
  assert.deepEqual(fallback.importRules,primary);
  assert.equal(fallback.system.schemaVersion,1);
});
