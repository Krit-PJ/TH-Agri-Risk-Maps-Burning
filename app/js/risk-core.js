(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RiskCore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=value=>Math.max(0,Math.min(100,Number(value)));
  const valid=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  function weighted(values,weights){if(values.some(value=>!valid(value)))return null;return clamp(values.reduce((sum,value,index)=>sum+Number(value)*weights[index],0))}
  function hotspotComponent(countScore,densityScore){return weighted([countScore,densityScore],[.6,.4])}
  function trendComponent(trendScore,recurrenceScore,persistenceScore){return weighted([trendScore,recurrenceScore,persistenceScore],[.4,.4,.2])}
  function tambonRisk({H,T,C,A}){return weighted([H,T,C,A],[.4,.2,.2,.2])}
  function upperScore(weightedMean,highRiskCoverage,maxRisk){return weighted([weightedMean,highRiskCoverage,maxRisk],[.6,.25,.15])}
  function level(score,{upper=false,highRiskCoverage=0,veryHighShare=0}={}){
    if(!valid(score))return{key:'insufficient-data',label:'ข้อมูลไม่เพียงพอ'};
    const value=clamp(score);
    if(value<25)return{key:'low',label:'ต่ำ'};
    if(value<50)return{key:'medium',label:'ปานกลาง'};
    if(value<75)return{key:'high',label:'สูง'};
    if(upper&&Number(highRiskCoverage)<50&&Number(veryHighShare)<30)return{key:'high',label:'สูง'};
    return{key:'very-high',label:'สูงมาก'};
  }
  function upperAggregation(children){
    const usable=(children||[]).filter(child=>valid(child.riskScore)&&valid(child.exposureArea)&&Number(child.exposureArea)>0);
    const totalExposure=usable.reduce((sum,child)=>sum+Number(child.exposureArea),0);
    if(!usable.length||!totalExposure)return{riskScore:null,riskLevel:level(null),insufficientData:true};
    const areaWhere=predicate=>usable.filter(predicate).reduce((sum,child)=>sum+Number(child.exposureArea),0);
    const weightedMean=usable.reduce((sum,child)=>sum+Number(child.riskScore)*Number(child.exposureArea),0)/totalExposure;
    const highRiskCoverage=areaWhere(child=>Number(child.riskScore)>=50)/totalExposure*100;
    const veryHighShare=areaWhere(child=>Number(child.riskScore)>=75)/totalExposure*100;
    const maxRisk=Math.max(...usable.map(child=>Number(child.riskScore)));
    const riskScore=upperScore(weightedMean,highRiskCoverage,maxRisk);
    return{weightedMean,highRiskCoverage,veryHighShare,maxRisk,riskScore,riskLevel:level(riskScore,{upper:true,highRiskCoverage,veryHighShare}),totalExposure,unitCount:usable.length,insufficientData:false};
  }
  function baselineScore(value,baseline){if(!valid(value)||!valid(baseline)||Number(baseline)<=0)return null;return clamp(Number(value)/Number(baseline)*100)}
  function areaScore(area,baseline){if(!valid(area)||!valid(baseline)||Number(area)<0||Number(baseline)<=0)return null;return clamp(100*Math.log1p(Number(area))/Math.log1p(Number(baseline)))}
  function registryReadiness(registry,provinceCode){
    const missing=[];
    if(registry?.status!=='active')missing.push('model status is not active');
    const parameters=registry?.provinceParameters?.[String(provinceCode)];
    if(!parameters)return{ready:false,missing:[...missing,'province parameters']};
    for(const key of ['countBaseline','densityBaseline','areaBaseline','baselineVersion','cropRisk'])if(parameters[key]===undefined||parameters[key]===null||parameters[key]==='')missing.push(key);
    for(const key of ['countBaseline','densityBaseline','areaBaseline'])if(parameters&&(!Number.isFinite(Number(parameters[key]))||Number(parameters[key])<=0))missing.push(`${key} must be > 0`);
    return{ready:missing.length===0,missing:[...new Set(missing)]};
  }
  return{clamp,hotspotComponent,trendComponent,tambonRisk,upperScore,upperAggregation,baselineScore,areaScore,level,registryReadiness};
});
