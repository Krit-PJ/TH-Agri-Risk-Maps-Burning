'use strict';
// For a fresh server only. Configure password through a host secret/environment,
// never through public JSON or client code. Existing state is never overwritten.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
async function main(){
 const dir=path.resolve(process.env.AGRI_STATE_DIR||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'AgriRiskMapBurning','state'));
 const username=process.env.AGRI_OWNER_USERNAME,password=process.env.AGRI_OWNER_PASSWORD;
 if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username||'')||!password||password.length<12||password.length>128)throw new Error('Set AGRI_OWNER_USERNAME and AGRI_OWNER_PASSWORD (12–128 characters) in the private process environment.');
 await fs.mkdir(dir,{recursive:true,mode:0o700});
 for(const file of ['access-state.json','accounts.json']){try{await fs.access(path.join(dir,file));throw new Error('Existing account state found; bootstrap refused. Use the existing Super Admin.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');
 await fs.writeFile(path.join(dir,'accounts.json'),JSON.stringify([{username,role:'superadmin',status:'approved',passwordHash:{salt,hash}}],null,2),{flag:'wx',mode:0o600});
 delete process.env.AGRI_OWNER_PASSWORD;console.log('Owner account prepared. Start the server with the same AGRI_STATE_DIR.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
