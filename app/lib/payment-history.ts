export type PaymentHistoryReceipt={id_penerimaan:string;no_kuitansi:string;tanggal_penerimaan:string;dibuat_pada:string;jenis_penerimaan:string;status:string;nominal:number|string;pelunasan_konsumen:number|string;id_bank_penerimaan:string|null;no_referensi:string|null;keterangan:string|null;alasan_pembatalan:string|null};
/** Current contract reconciliation in business-date order, not historical contract valuation. */
export function paymentHistoryRows(receipts:PaymentHistoryReceipt[],totalTagihan:number,statusSales:string){
 if(!Number.isFinite(totalTagihan))throw new Error('Total tagihan histori pembayaran tidak valid.');
 let paid=0,cash=0;
 const rows=[...receipts].sort((a,b)=>a.tanggal_penerimaan.localeCompare(b.tanggal_penerimaan)||a.dibuat_pada.localeCompare(b.dibuat_pada)||a.id_penerimaan.localeCompare(b.id_penerimaan)).map(r=>{
  const credit=r.status==='AKTIF'?Number(r.pelunasan_konsumen):0;
  if(!Number.isFinite(credit)||!Number.isFinite(Number(r.nominal)))throw new Error('Nominal histori pembayaran tidak valid.');
  paid+=credit;if(r.status==='AKTIF')cash+=Number(r.nominal);
  return {...r,credit,saldo:statusSales==='BATAL'?null:totalTagihan-paid};
 });
 return {rows,totalPelunasan:paid,totalKasBank:cash,saldo:statusSales==='BATAL'?0:totalTagihan-paid};
}

/** Consumer receivable history excludes collection of bank guarantee receivables. */
export function consumerPaymentHistoryRows(receipts:PaymentHistoryReceipt[],totalTagihan:number,statusSales:string){return paymentHistoryRows(receipts.filter(r=>r.jenis_penerimaan!=='PENCAIRAN_DANA_JAMINAN'),totalTagihan,statusSales);}
