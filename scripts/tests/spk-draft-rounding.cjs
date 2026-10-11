// Regression: exercise the actual draft server actions with controlled database responses.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const ts=require('typescript'),repo=path.resolve(__dirname,'../..'),original=Module._load;
let weight=.599964,rpcs=[];
const query=table=>{
 const result={data:table==='master_kavling'?{id_kavling:'A01',id_tipe:'T36',status_aktif:true,status_kavling:'AVAILABLE'}:table==='master_kantor_pelaksana'?{id_kantor:'K',status_aktif:true}:table==='master_mandor'?{id_mandor:'M',id_kantor:'K',status_aktif:true}:table==='template_progress_tipe'?[{id_kategori:'KP01',bobot_standar:.4},{id_kategori:'KP02',bobot_standar:weight}]:null,error:null};
 const q={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:()=>Promise.resolve(result),then:cb=>Promise.resolve(result).then(cb)};return q;
};
Module._load=function(request,parent,isMain){
 if(request==='next/navigation')return {redirect:url=>{throw Object.assign(new Error('redirect'),{url})}};
 if(request==='next/cache')return {revalidatePath:()=>{}};
 if(request.endsWith('/lib/supabase/server'))return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'test'}}})},from:query,rpc:async(name,args)=>{rpcs.push({name,args});return {data:name==='create_fasum_spk_atomic'?'test-id':{id_spk:'test-id',status_spk:'DRAFT'},error:null}}})};
 if(request.endsWith('/lib/kavio-permissions-server'))return {requireKavioAction:async()=>{}};
 if(request.endsWith('/lib/kavio-form-feedback'))return {redirectKavioFormError:(url,message)=>{throw Object.assign(new Error(message),{formError:message})}};
 return original.call(this,request,parent,isMain);
};
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {createSpk,createFasumSpk}=require(repo+'/app/master/spk/actions.ts');
const {workTotalPercent}=require(repo+'/app/lib/work-detail.ts');
const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({id_kavling:'A01',jenis_bobot:'STANDAR',tgl_spk:'2026-10-11',tgl_target_selesai:'2026-11-11',id_kantor:'K',id_mandor:'M',nama_objek:'Jalan',items_json:JSON.stringify([{nama_pekerjaan:'Persiapan',bobot:.4},{nama_pekerjaan:'Jalan',bobot:weight}])}))f.set(k,v);return f;};
async function run(action,f){try{await action(f);assert.fail('Action must redirect')}catch(e){return e}}
(async()=>{
 for(const [n,want] of [[.999964,100],[.99995,100],[.999949,99.99],[1.000049,100],[1.00005,100.01]])assert.equal(workTotalPercent([{bobot:n}]),want);
 let result=await run(createSpk,form());assert(result.url?.includes('/konfigurasi'));assert.equal(rpcs.at(-1).args.p_config[1].bobot_final,.599964,'preserve template precision');
 let f=form();f.set('jenis_bobot','CUSTOM');f.set('bobot_KP01','40');f.set('bobot_KP02','59.9964');result=await run(createSpk,f);assert(result.url?.includes('/konfigurasi'));assert.equal(rpcs.at(-1).args.p_config[1].bobot_final,.599964);
 result=await run(createFasumSpk,form());assert(result.url?.includes('/konfigurasi'));assert.equal(rpcs.at(-1).args.p_items[1].bobot,.599964);
 weight=.599949;const before=rpcs.length;for(const action of [createSpk,createFasumSpk]){result=await run(action,form());assert(result.formError?.includes('99,99%'))}assert.equal(rpcs.length,before,'invalid totals must not write');
 console.log('PASS: actual Kavling standard/custom and Fasum draft actions accept 99.9964%, preserve source, reject 99.9949%, and round boundaries consistently');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=original});
