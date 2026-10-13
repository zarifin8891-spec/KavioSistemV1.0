const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const context={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/wage-payment-groups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,context);
const {groupWageDebts,allocateWageGroup}=context.exports;
const row=(id,amount,options={})=>({id_progress_detail:id,tanggal_update:'2026-10-13',id_mandor:'M1',nama_mandor:'Mandor 1',nama_pekerjaan:id,id_spk:'SPK1',jenis_spk:'KAVLING',id_kavling:'C-01',nama_objek:null,sisa_upah:amount,retensi_tersedia:amount,retensi_layak:true,...options});
const groups=groupWageDebts([row('a',100),row('b',200),row('c',300),row('d',50,{id_mandor:'M2'}),row('e',25,{tanggal_update:'2026-10-12'}),row('f',75,{id_spk:'SPK2',jenis_spk:'FASUM',id_kavling:null,nama_objek:'Drainase'})],'UPAH');
assert.equal(groups.length,4);const group=groups.find(g=>g.details.length===3);assert.equal(group.amount,600);assert.equal(group.label,'KAVLING · C-01');
const full=allocateWageGroup(group,600,'UPAH');assert.deepEqual(Array.from(full,r=>r.nominal),[100,200,300]);
const partial=allocateWageGroup(group,100,'UPAH');assert.deepEqual(Array.from(partial,r=>r.nominal),[16.67,33.33,50]);
assert.throws(()=>allocateWageGroup(group,600.01,'UPAH'),/melebihi/);
const blocked=groupWageDebts([row('a',50,{retensi_layak:false}),row('b',50)],'RETENSI')[0];assert.equal(blocked.eligible,false);assert.throws(()=>allocateWageGroup(blocked,50,'RETENSI'),/belum layak/);
const tiny=groupWageDebts([row('a',.01),row('b',.01),row('c',.01)],'UPAH')[0];assert.equal(allocateWageGroup(tiny,.01,'UPAH')[0].id_progress_detail,'a');
// Many partial payments conserve cents, never overpay an item, and tolerate input ordering.
for(let i=1;i<=250;i++){const details=Array.from({length:1+i%19},(_,j)=>row('item'+j,((i*53+j*31)%10000+1)/100));const g=groupWageDebts(details,'UPAH')[0];const cents=Math.max(1,Math.floor(Math.round(g.amount*100)*((i%99+1)/100)));const allocation=allocateWageGroup(g,cents/100,'UPAH');assert.equal(allocation.reduce((n,r)=>n+Math.round(r.nominal*100),0),cents);for(const r of allocation)assert.ok(r.nominal<=details.find(d=>d.id_progress_detail===r.id_progress_detail).sisa_upah);assert.deepEqual(Array.from(allocateWageGroup(groupWageDebts([...details].reverse(),'UPAH')[0],cents/100,'UPAH'),x=>[x.id_progress_detail,x.nominal]),Array.from(allocation,x=>[x.id_progress_detail,x.nominal]));}
console.log('PASS: recap per SPK/date/mandor, Fasum, full/partial payments, proportional cent allocation, caps, retention eligibility and stable ordering');
