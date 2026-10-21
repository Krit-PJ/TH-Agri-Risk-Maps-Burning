'use strict';
// One parser for import and authorization. Contradictory aliases fail closed.
function provinceCodeOf(p={}) {
 const values=['provinceCode','__provinceCode','provCode','P_CODE','PROV_CODE','PRV_CODE','pro_code','areaCode','ADM1_PCODE']
  .filter(k=>p[k]!==undefined&&p[k]!==null&&p[k]!=='')
  .map(k=>String(p[k]).match(/^(?:TH)?(\d{2})(?:\d{2}){0,3}$/)?.[1]||'');
 return values.length&&values.every(v=>v&&v===values[0])?values[0]:'';
}
module.exports={provinceCodeOf};
