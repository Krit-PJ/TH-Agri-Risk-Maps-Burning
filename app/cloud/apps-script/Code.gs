/** Public HS feed only. Private accounts and approvals stay on the Node server.
 * Configure Script Properties: SPREADSHEET_ID, PUBLIC_SHEET_NAME (default PublicHS),
 * PUBLIC_PROVINCE_CODES (comma-separated official two-digit codes).
 * Publish only a dedicated, reviewed sheet; never use a registration/account sheet.
 */
function doGet(e) {
  try {
    var action = String(e && e.parameter && e.parameter.action || 'health');
    if (action === 'health') return json_({ok:true,service:'TH-Agri-Risk-Maps-Burning',mode:'public-read-only',version:1});
    if (action !== 'hotspots') return json_({ok:false,error:'unknown_action'});
    var config = PropertiesService.getScriptProperties();
    var code = String(e.parameter.provinceCode || '');
    var allowed = String(config.getProperty('PUBLIC_PROVINCE_CODES') || '').split(',').map(function(v){return v.trim();});
    if (!/^\d{2}$/.test(code) || allowed.indexOf(code) < 0) return json_({ok:false,error:'province_not_published'});
    var id = config.getProperty('SPREADSHEET_ID');
    if (!id) return json_({ok:false,error:'source_not_configured'});
    var sheet = SpreadsheetApp.openById(id).getSheetByName(config.getProperty('PUBLIC_SHEET_NAME') || 'PublicHS');
    if (!sheet) return json_({ok:false,error:'public_sheet_missing'});
    // Bound work: refuse oversized sources rather than silently truncating a report.
    if (sheet.getLastRow() > 100001) return json_({ok:false,error:'source_too_large_partition_required'});
    var rows = sheet.getDataRange().getValues(), headers = rows.shift().map(String);
    var required = ['provinceCode','districtCode','date','Latitude','Longitude','published'];
    if (required.some(function(k){return headers.indexOf(k)<0;})) return json_({ok:false,error:'invalid_public_schema'});
    var features=[];
    rows.forEach(function(row){
      var get=function(k){return row[headers.indexOf(k)];};
      if (String(get('provinceCode'))!==code || String(get('published')).toLowerCase()!=='true') return;
      var x=Number(get('Longitude')),y=Number(get('Latitude')),district=String(get('districtCode'));
      if (!Number.isFinite(x)||!Number.isFinite(y)||x<90||x>110||y<0||y>25||!/^\d{4}$/.test(district)||district.slice(0,2)!==code) return;
      var date=get('date');date=date instanceof Date?Utilities.formatDate(date,'Asia/Bangkok','yyyy-MM-dd'):String(date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      var p={provinceCode:code,districtCode:district,date:date};
      ['Time','LandType','PlantType','hsID'].forEach(function(k){if(headers.indexOf(k)>=0)p[k]=String(get(k));});
      features.push({type:'Feature',geometry:{type:'Point',coordinates:[x,y]},properties:p});
    });
    return json_({type:'FeatureCollection',features:features,metadata:{provinceCode:code,totalPoints:features.length,public:true}});
  } catch (error) { return json_({ok:false,error:'source_unavailable'}); }
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
