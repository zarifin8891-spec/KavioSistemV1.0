const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const vm=require('node:vm');
const source=ts.transpileModule(fs.readFileSync('app/lib/report-data.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
const context={exports:{}};vm.runInNewContext(source,context);const {readAllReportRows,readAllQueryResult,reportCsv,escapeReportHtml}=context.exports;
(async()=>{
 const sourceRows=Array.from({length:1251},(_,id)=>({id,amount:10}));const calls=[];
 const rows=await readAllReportRows({range:async(from,to)=>{calls.push([from,to]);return {data:sourceRows.slice(from,to+1),error:null};}});
 assert.equal(rows.length,1251);assert.equal(rows.reduce((sum,r)=>sum+r.amount,0),12510);assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
 await assert.rejects(()=>readAllReportRows({range:async()=>({data:null,error:{message:'Read denied'}})}),/Read denied/);
 const operational=await readAllQueryResult({range:async(from,to)=>({data:sourceRows.slice(from,to+1),error:null})});
 assert.equal(operational.error,null);assert.equal(operational.data.length,1251);
 const failure=await readAllQueryResult({range:async(from,to)=>from===0?{data:sourceRows.slice(from,to+1),error:null}:{data:null,error:{message:'Page read denied'}}});
 assert.equal(failure.data,null);assert.equal(failure.error.message,'Page read denied');
 const csv=reportCsv(['Nama','Nominal'],[['A;B "C"\nD',1250.5],['=HYPERLINK("evil")',-25],[' @SUM(1)',0]]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"A;B ""C""\nD";"1250.5"'));assert.ok(csv.includes('"\'=HYPERLINK'));assert.ok(csv.includes(';"-25"'));assert.ok(csv.includes('"\' @SUM(1)"'));
 assert.equal(escapeReportHtml('<script>"x" & y</script>'),'&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;');
 console.log('PASS: 1251-row totals/export, paging, read errors, CSV escaping and HTML escaping');
})().catch(e=>{console.error(e);process.exitCode=1;});
