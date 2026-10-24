'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),config=path.join(root,'app','config');
const read=name=>JSON.parse(fs.readFileSync(path.join(config,name),'utf8'));
const snapshot={system:read('system.json'),provinces:read('provinces.json'),active:read('active-province.json'),risk:read('risk-model.default.json'),importRules:read('import-rules.default.json')};
const output='// Generated recovery config snapshot; run node tools/sync-config-fallback.cjs after config changes.\nwindow.AGRI_CONFIG_FALLBACK = '+JSON.stringify(snapshot,null,2)+';\n';
fs.writeFileSync(path.join(config,'fallback.js'),output);
console.log('Updated app/config/fallback.js');
