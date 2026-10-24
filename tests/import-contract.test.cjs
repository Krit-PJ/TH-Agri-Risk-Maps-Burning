'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test');
const root=path.resolve(__dirname,'..'),rules=JSON.parse(fs.readFileSync(path.join(root,'app/config/import-rules.default.json'),'utf8'));
const contract=require('../app/js/import-contract.js');

test('selects only evidence-backed detail sheets and never summary sheets',()=>{
  assert.equal(contract.selectProfile(['Pivot','AllData','2569'],rules).id,'historical-all-data');
  assert.equal(contract.selectProfile(['Land2026','hsPlant2026','Month','hsAll'],rules).id,'current-hs-all');
  assert.equal(contract.selectProfile(['Pivot','hsPlant2026','Month'],rules),null);
});

test('historical permits absent Time while current hsAll requires it',()=>{
  const common=['hsID','Date','Province','Amphoe','Tambon','LandType','PlantType','Maps'];
  assert.equal(contract.validateHeaders(common,rules.detailProfiles[0]).valid,true);
  assert.deepEqual(contract.validateHeaders(common,rules.detailProfiles[1]).missing,['Time']);
  assert.equal(contract.validateHeaders([...common,'Time'],rules.detailProfiles[1]).valid,true);
});

test('Maps coordinates are parsed as longitude latitude and identities deduplicate across years',()=>{
  assert.deepEqual(contract.parseMaps('https://maps.google.com/?q=16.1234,99.5678'),[99.5678,16.1234]);
  assert.equal(contract.parseMaps('not a coordinate'),null);
  const first=contract.recordIdentity({provinceCode:'62',hsID:'ABC',year_be:2568},[99,16]);
  const second=contract.recordIdentity({provinceCode:'62',hsID:'ABC',year_be:2569},[100,17]);
  assert.equal(first,second);
});

test('unsafe fuzzy plant remapping is disabled',()=>{
  assert.deepEqual(rules.plantContains,[]);
  assert.equal(rules.deduplicateAcrossFiles,true);
  assert.deepEqual(rules.coordinatePriority,['Maps','Longitude/Latitude','X/Y/Q']);
});
