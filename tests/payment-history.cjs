const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=ts.transpileModule(fs.readFileSync('app/lib/payment-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
const context={exports:{}};vm.runInNewContext(source,context);const {paymentHistoryRows}=context.exports;
const r=(id,date,amount,type='CICILAN_CASH_BERTAHAP',status='AKTIF',credit=amount)=>({id_penerimaan:id,no_kuitansi:id,tanggal_penerimaan:date,dibuat_pada:'2026-10-13T01:00:00Z',jenis_penerimaan:type,status,nominal:String(amount),pelunasan_konsumen:String(credit),id_bank_penerimaan:'B01',no_referensi:null,keterangan:null,alasan_pembatalan:null});
const rows=[r('4','2026-10-04',20),r('3','2026-10-03',25,'CICILAN_CASH_BERTAHAP','BATAL'),r('2','2026-10-02',35,'UANG_MUKA'),r('1','2026-10-01',5,'BOOKING_FEE')];
const cash=paymentHistoryRows(rows,100,'DP');
assert.deepEqual(Array.from(cash.rows,x=>x.no_kuitansi),['1','2','3','4']);
assert.deepEqual(Array.from(cash.rows,x=>x.saldo),[95,60,60,40]);
assert.equal(cash.totalPelunasan,60);assert.equal(cash.totalKasBank,60);assert.equal(cash.saldo,40);assert.equal(rows[0].no_kuitansi,'4');
// Existing correction remains in history, but replacement alone contributes.
const corrected=paymentHistoryRows([...rows,r('5','2026-10-03',30)],100,'DP');assert.equal(corrected.saldo,10);
// Net cash / gross consumer settlement / guarantee draw must not double-clear KPR.
const kpr=paymentHistoryRows([r('1','2026-10-01',40,'UANG_MUKA'),r('2','2026-10-02',50,'PENCAIRAN_KPR','AKTIF',60),r('3','2026-10-03',10,'PENCAIRAN_DANA_JAMINAN','AKTIF',0)],100,'AKAD');
assert.deepEqual(Array.from(kpr.rows,x=>x.saldo),[60,0,0]);assert.equal(kpr.totalPelunasan,100);assert.equal(kpr.totalKasBank,100);
const cancel=paymentHistoryRows(rows,100,'BATAL');assert.equal(cancel.saldo,0);assert.ok(cancel.rows.every(x=>x.saldo===null));
const empty=paymentHistoryRows([],100,'BOOKING');assert.equal(empty.saldo,100);assert.equal(empty.totalPelunasan,0);
const lots=paymentHistoryRows(Array.from({length:1251},(_,i)=>r(String(i),'2026-10-01',1)),2000,'DP');assert.equal(lots.rows.length,1251);assert.equal(lots.saldo,749);
assert.throws(()=>paymentHistoryRows([r('x','2026-10-01','NaN')],100,'DP'),/tidak valid/);
console.log('PASS: Cash Bertahap balance, void/correction history, business-date ordering, KPR gross/net and guarantees, cancellation, empty and 1251 receipts');

const consumer=context.exports.consumerPaymentHistoryRows([r('1','2026-10-01',40,'UANG_MUKA'),r('2','2026-10-02',50,'PENCAIRAN_KPR','AKTIF',60),r('3','2026-10-03',10,'PENCAIRAN_DANA_JAMINAN','AKTIF',0)],100,'AKAD');
assert.equal(consumer.rows.length,2);assert.equal(consumer.totalKasBank,90);assert.equal(consumer.totalPelunasan,100);assert.equal(consumer.saldo,0);
console.log('PASS: consumer history excludes guarantee draw without changing consumer settlement');
