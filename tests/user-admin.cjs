const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=fs.readFileSync('supabase/functions/kavio-user-admin/index.ts','utf8').replace(/^import .*;\n/gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function run(role,body,profileError=false){
 let handler,created=0,deleted=0,saved;
 const admin={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role,status_aktif:true},error:null})})}),upsert:async p=>{saved=p;return {error:profileError?{message:'profile write failed'}:null};}}),auth:{admin:{createUser:async()=>{created++;return {data:{user:{id:'test-id'}},error:null};},deleteUser:async()=>{deleted++;return {};}}}};
 vm.runInNewContext(compiled,{Deno:{env:{get:()=> 'test-value'},serve:f=>{handler=f;}},Response,createClient:(_url,_key,options)=>options?{auth:{getUser:async()=>({data:{user:{id:'manager'}},error:null})}}:admin});
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer test'}),json:async()=>body});return {status:response.status,body:await response.json(),created,deleted,saved};
}
(async()=>{
 for(const role of ['GUDANG','KEUANGAN']){const r=await run('DIREKTUR',{action:'create',email:'test@example.invalid',password:'mock-only-123',nama:'Test',role});assert.equal(r.status,200);assert.equal(r.created,1);assert.equal(r.saved.role,role);}
 const deny=await run('GUDANG',{action:'create'});assert.equal(deny.status,403);assert.equal(deny.created,0);
 const invalid=await run('ADMIN',{action:'create',email:'x@example.invalid',password:'12345678',role:'INVALID'});assert.equal(invalid.status,400);assert.equal(invalid.created,0);
 const fail=await run('ADMIN',{action:'create',email:'x@example.invalid',password:'12345678',role:'USER'},true);assert.equal(fail.status,400);assert.equal(fail.deleted,1);
 console.log('PASS: Gudang/Keuangan profiles, manager authorization, role validation and cleanup after profile failure (mocked Auth API)');
})().catch(e=>{console.error(e);process.exitCode=1;});
