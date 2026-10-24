const HSNormalizer = (() => {
  const clean=v=>String(v??'').trim();
  const strip=v=>clean(v).replace(/^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|ตำบล|ต\.|แขวง)\s*/,'').trim();
  const compact=v=>strip(v).toLowerCase().replace(/\s+/g,'');
  function normalizeProvinceName(v){
    const s=strip(v),key=compact(s);
    const p=ConfigLoader.bundle?.provinces.find(p=>[p.provinceCode,p.provinceNameTH,p.provinceNameEN,...(p.aliases||[])].some(n=>compact(n)===key));
    return p?p.provinceNameTH:s;
  }
  const normalizeDistrictName=strip,normalizeTambonName=strip;
  function normalizeLandType(v){const s=clean(v);return ConfigLoader.bundle.importRules.landAliases[s]||s;}
  function normalizePlantType(v){
    const s=clean(v),rules=ConfigLoader.bundle.importRules;
    if(rules.plantAliases[s])return rules.plantAliases[s];
    const match=(rules.plantContains||[]).find(r=>s.includes(r.contains));return match?match.value:s;
  }
  function normalizeDate(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return new Date(Date.UTC(v.getFullYear(),v.getMonth(),v.getDate()));
    if(typeof v==='number'||/^\d{5}(?:\.\d+)?$/.test(clean(v))){const n=Number(v);if(n<1||n>100000)return null;return new Date(Math.floor(n-25569)*86400000);}
    const s=clean(v);let m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T.*)?$/),y,month,day;
    if(m){[,y,month,day]=m;}else{m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(!m)return null;[,day,month,y]=m;}
    y=Number(y);if(y>2400)y-=543;month=Number(month);day=Number(day);
    const d=new Date(Date.UTC(y,month-1,day));return d.getUTCFullYear()===y&&d.getUTCMonth()+1===month&&d.getUTCDate()===day?d:null;
  }
  function rowsToGeoJSON(rows,headers,yearBE,reference=null,sourceSheet='',legacyCoordinates=null,boundaries=null,options={}){
    const idx=Object.fromEntries(headers.map((h,i)=>[clean(h),i])),p=ProvinceContext.get(),rules=ConfigLoader.bundle.importRules;
    const activeScope=options.provinceCodes??(typeof BoundaryStore!=='undefined'?BoundaryStore.selectedCodes():[p.provinceCode]);
    if(options.provinceCodes&&(!activeScope.length||activeScope.some(c=>!BoundaryStore.codes.includes(c))))throw new Error('จังหวัด HS ต้องอยู่ในชุดแผนที่ที่นำเข้าแล้ว');
    const features=[],seen=new Set(),counts={byProvince:{},byPlantType:{},byDistrict:{},byTambon:{},byMonth:{},byYear:{}};
    const qa={inputRows:rows.length,nonEmptyRows:0,afterProvince:0,afterLandType:0,afterPlantType:0,accepted:0,
      duplicates:0,noCoordinates:0,wrongProvince:0,wrongLand:0,wrongDate:0,wrongPlantType:0,areaCodeConflict:0,provinceNameConflict:0,
      coordinateSources:{Maps:0,'Longitude/Latitude':0,'X/Y/Q':0},
      unknownLandTypes:{},unknownPlantTypes:{},unknownDistricts:{},unknownTambons:{}};
    const count=(o,k)=>o[k]=(o[k]||0)+1;
    for(const [rowOffset,row] of rows.entries()){
      if(!row||row.every(v=>v===null||v===undefined||v===''))continue;qa.nonEmptyRows++;
      const get=k=>row[idx[k]],province=normalizeProvinceName(get('Province'));
      const found=ConfigLoader.bundle.provinces.find(x=>x.provinceNameTH===province&&activeScope.includes(x.provinceCode));if(!found){qa.wrongProvince++;continue;}const rowProvince=typeof ConfigLoader.mergeProvince==='function'?ConfigLoader.mergeProvince(found):p;
      const provinceN=normalizeProvinceName(get('ProvinceN'));if(provinceN&&provinceN!==province)qa.provinceNameConflict++;
      qa.afterProvince++;
      const land=normalizeLandType(get('LandType'));
      if(!rowProvince.allowedLandTypes.includes(land)){qa.wrongLand++;count(qa.unknownLandTypes,clean(get('LandType'))||'(ว่าง)');continue;}qa.afterLandType++;
      const plant=normalizePlantType(get('PlantType'));
      if(!rowProvince.enabledPlantTypes.includes(plant)){qa.wrongPlantType++;count(qa.unknownPlantTypes,clean(get('PlantType'))||'(ว่าง)');continue;}qa.afterPlantType++;
      const dt=normalizeDate(rules.dateFields.map(get).find(v=>v!==null&&v!==undefined&&v!==''));
      if(!dt){qa.wrongDate++;continue;}
      let coord=null,coordinateSource='';
      for(const [lonKey,latKey] of rules.coordinateFields.filter(x=>x.length===2&&x[0]!=='X')){
        const lon=get(lonKey),lat=get(latKey);if(lon!==null&&lon!==undefined&&clean(lon)&&lat!==null&&lat!==undefined&&clean(lat))coord=[Number(lon),Number(lat)];
        if(coord){coordinateSource='Longitude/Latitude';break;}
      }
      if(!coord&&legacyCoordinates){coord=legacyCoordinates(get('Maps'),get('X'),get('Y'),get('Q'));if(coord)coordinateSource=ImportContract.parseMaps(get('Maps'))?'Maps':'X/Y/Q';}
      if(!coord||coord.length!==2||!coord.every(Number.isFinite)||coord[0]<90||coord[0]>110||coord[1]<0||coord[1]>25){qa.noCoordinates++;continue;}
      const hsId=clean(get('hsID')??get('hs_id')),iso=dt.toISOString().slice(0,10),time=clean(get('Time')??get('acq_time'));
      const identity=ImportContract.recordIdentity({provinceCode:rowProvince.provinceCode,hsID:hsId,acq_date:iso,Time:time},coord);
      if(rules.deduplicate!=='none'&&seen.has(identity)){qa.duplicates++;continue;}
      const original=Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
      const district=normalizeDistrictName(get('Amphoe')||get('district')),tambon=normalizeTambonName(get('Tambon')||get('subdistrict'));
      const point={type:'Feature',geometry:{type:'Point',coordinates:coord},properties:{...original,
        hs_id:hsId,hsID:hsId,acq_date:iso,Date:iso,'YYYY-MM-DD':iso,time,Time:time,acq_time:time,
        Latitude:coord[1],Longitude:coord[0],year_be:dt.getUTCFullYear()+543,season_be:yearBE,dataset_year_be:yearBE,
        province,Province:province,__province:province,provinceCode:rowProvince.provinceCode,
        district,Amphoe:district,__district:district,subdistrict:tambon,Tambon:tambon,__subdistrict:tambon,
        village:clean(get('BaanN')),BaanN:clean(get('BaanN')),__village:clean(get('BaanN')),
        land_type:land,LandType:land,plant_type:plant,PlantType:plant,crop_type:plant,crop_type_raw:clean(get('PlantType')),__plant_type:plant,__crop:plant,
        source:'NASA FIRMS VIIRS / Excel import',source_sheet:sourceSheet,source_profile:options.sourceProfile||'',source_row:rowOffset+2,coordinate_source:coordinateSource,
        filter_rule:`Province=${province}; LandType=${rowProvince.allowedLandTypes.join(',')}; PlantType=${rowProvince.enabledPlantTypes.join(',')}`}};
      const props=point.properties;
      if((!district||!tambon)&&window.turf){const hit=boundaries?.features.find(f=>{try{return turf.booleanPointInPolygon(point,f);}catch{return false;}});if(hit){props.__district=props.district=props.Amphoe=district||DataLoader.districtName(hit.properties);props.__subdistrict=props.subdistrict=props.Tambon=tambon||DataLoader.tambonName(hit.properties);}}
      const candidates=(boundaries?.features||[]).filter(f=>DataLoader.areaCodes(f.properties).provinceCode===rowProvince.provinceCode&&DataLoader.rawDistrictName(f.properties)===props.__district&&DataLoader.tambonName(f.properties)===props.__subdistrict);
      const rawCodes=DataLoader.areaCodes(original),known=candidates.length===1?DataLoader.areaCodes(candidates[0].properties):{};
      if(rawCodes.districtCode&&rawCodes.districtCode.slice(0,2)!==rowProvince.provinceCode||rawCodes.subdistrictCode&&(rawCodes.subdistrictCode.slice(0,2)!==rowProvince.provinceCode||rawCodes.districtCode&&rawCodes.subdistrictCode.slice(0,4)!==rawCodes.districtCode)){qa.areaCodeConflict++;continue;}
      if(rawCodes.provinceCode&&rawCodes.provinceCode!==rowProvince.provinceCode||known.districtCode&&rawCodes.districtCode&&known.districtCode!==rawCodes.districtCode||known.subdistrictCode&&rawCodes.subdistrictCode&&known.subdistrictCode!==rawCodes.subdistrictCode){qa.areaCodeConflict++;continue;}
      if(boundaries?.features.length){
        if(!boundaries.features.some(f=>DataLoader.areaCodes(f.properties).provinceCode===rowProvince.provinceCode&&DataLoader.rawDistrictName(f.properties)===props.__district))count(qa.unknownDistricts,props.__district||'(ว่าง)');
        if(!candidates.length)count(qa.unknownTambons,`${props.__district}/${props.__subdistrict||'(ว่าง)'}`);
      }
      if(/[<>]/.test(props.__district+props.__subdistrict+props.__village)){qa.areaCodeConflict++;continue;}
      DataLoader.attachAreaCodes(point,boundaries);seen.add(identity);features.push(point);count(qa.coordinateSources,coordinateSource);count(counts.byProvince,province);
      const prefix=activeScope.length>1?province+' / ':'';count(counts.byPlantType,plant);count(counts.byDistrict,prefix+(props.__district||'(ว่าง)'));count(counts.byTambon,`${prefix}${props.__district}/${props.__subdistrict||'(ว่าง)'}`);
      count(counts.byMonth,`${props.year_be}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`);count(counts.byYear,props.year_be);
    }
    qa.accepted=features.length;qa.referenceTotal=reference?.total??null;qa.referenceMatch=reference?features.length===reference.total&&p.enabledPlantTypes.every(k=>(counts.byPlantType[k]||0)===(reference.byPlantType[k]||0)):null;qa.referenceByPlantType=reference?.byPlantType||null;
    const dates=features.map(f=>f.properties.acq_date).sort();
    return {type:'FeatureCollection',name:`hotspot_${options.provinceCodes?activeScope.join('-'):typeof ProvinceContext.fileCode==='function'?ProvinceContext.fileCode():p.provinceCode}_${yearBE}_imported`,metadata:{province:activeScope.length===1?ConfigLoader.bundle.provinces.find(x=>x.provinceCode===activeScope[0])?.provinceNameTH:p.provinceNameTH,provinceCode:activeScope.length===1?activeScope[0]:'',provinceCodes:activeScope,scope:p.allowedLandTypes.join(','),source_sheet:sourceSheet,reference_sheet:reference?.sheet||null,
      filter_order:['Province','LandType','PlantType'],plant_types:p.enabledPlantTypes,period:dates.length?`${dates[0]}/${dates.at(-1)}`:'',counts,qa},features};
  }
  return {normalizeProvinceName,normalizeDistrictName,normalizeTambonName,normalizeLandType,normalizePlantType,normalizeDate,rowsToGeoJSON};
})();
