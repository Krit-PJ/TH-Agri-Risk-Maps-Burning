(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ImportContract=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=value=>String(value??'').trim();
  const lower=value=>clean(value).toLocaleLowerCase('th');
  function selectProfile(sheetNames,rules){
    for(const profile of rules.detailProfiles||[]){
      const sheet=(profile.sheetNames||[]).map(lower).map(name=>sheetNames.find(value=>lower(value)===name)).find(Boolean);
      if(sheet)return{...profile,sheet};
    }
    return null;
  }
  function validateHeaders(headers,profile){
    const available=new Set(headers.map(clean));
    const missing=(profile?.requiredFields||[]).filter(field=>!available.has(field));
    return{valid:missing.length===0,missing};
  }
  function parseMaps(value){
    const match=clean(value).match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
    if(!match)return null;
    const latitude=Number(match[1]),longitude=Number(match[2]);
    return Number.isFinite(latitude)&&Number.isFinite(longitude)?[longitude,latitude]:null;
  }
  function recordIdentity(properties,coordinates){
    const provinceCode=clean(properties.provinceCode),hsID=clean(properties.hsID??properties.hs_id);
    if(hsID)return`id:${provinceCode}:${hsID}`;
    return`point:${clean(properties.acq_date??properties.Date)}|${clean(properties.Time??properties.time)}|${(coordinates||[]).join(',')}`;
  }
  return{selectProfile,validateHeaders,parseMaps,recordIdentity};
});
