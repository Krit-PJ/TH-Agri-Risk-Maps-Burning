'use strict';
const zlib=require('node:zlib');
// Validate actual expanded bytes before handing an untrusted cloud ZIP to SheetJS.
function validateXlsx(bytes,{maxCompressed=20*1024*1024,maxExpanded=128*1024*1024,maxEntries=2048}={}){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
 const reject=message=>{throw Object.assign(new Error(message),{status:413,code:'workbook_limit'});};
 if(bytes.length>maxCompressed||bytes.length<22)reject('Excel file size is outside the supported limit');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 if(end<0)reject('Cloud Excel must be a valid .xlsx ZIP');
 const entries=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||entries!==bytes.readUInt16LE(end+8)||entries>maxEntries||offset+size!==end)reject('Unsupported Excel ZIP layout or too many entries');
 let at=offset,total=0;const names=new Set();
 for(let i=0;i<entries;i++){
  if(at+46>end||bytes.readUInt32LE(at)!==0x02014b50)reject('Invalid Excel directory');
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),compressed=bytes.readUInt32LE(at+20),expanded=bytes.readUInt32LE(at+24),nameSize=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42);
  if(at+46+nameSize+extra+comment>end||flags&1||![0,8].includes(method)||local+30>offset)reject('Unsupported encrypted or malformed Excel entry');
  const name=bytes.subarray(at+46,at+46+nameSize).toString('utf8');if(names.has(name))reject('Duplicate Excel ZIP entry');names.add(name);
  if(bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+8)!==method)reject('Invalid Excel local entry');
  const dataAt=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
  if(dataAt+compressed>offset||expanded>maxExpanded-total)reject('Expanded Excel exceeds 128 MiB; split the source workbook');
  const data=bytes.subarray(dataAt,dataAt+compressed);let actual;
  try{actual=method===0?data:zlib.inflateRawSync(data,{maxOutputLength:Math.max(1,maxExpanded-total)});}catch{reject('Excel expansion failed or exceeds the supported limit');}
  if(actual.length!==expanded||actual.length>maxExpanded-total)reject('Excel entry size mismatch');total+=actual.length;at+=46+nameSize+extra+comment;
 }
 if(at!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))reject('Not an Excel .xlsx workbook');
 return{entries,expandedBytes:total};
}
module.exports={validateXlsx};
