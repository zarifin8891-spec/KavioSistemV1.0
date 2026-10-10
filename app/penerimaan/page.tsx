import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';
import { formatKavioMoney } from '../lib/number-format';
import ReceiptEntryPanel from './ReceiptEntryPanel';
import BankGuaranteePanel from './BankGuaranteePanel';
import CancellationSettlementPanel from './CancellationSettlementPanel';

type SearchParams=Promise<{error?:string;success?:string}>;
type FinancialRow={id_sales:string;id_kavling:string;nama_konsumen:string;status_sales:string;status_aktif:boolean;jenis_pembayaran:string;total_tagihan:number|string;total_diterima:number|string;saldo_piutang:number|string;persentase_terbayar:number|string};
type Receipt={id_penerimaan:string;no_kuitansi:string;nilai_barcode:string;id_sales:string;jenis_penerimaan:string;tanggal_penerimaan:string;nominal:number|string;metode_penerimaan:string;nama_konsumen?:string|null;id_kavling?:string|null};
type Guarantee={id_jaminan:string;id_sales:string;jenis_item:string;nominal_tagihan:number|string;status:string};
type ProgressAlert={id_sales:string;id_kavling:string;nama_konsumen:string;progress_bangunan:number|string;persentase_terbayar:number|string;nominal_ketertinggal:number|string};
type Cancellation={id_sales:string;keputusan:string;nominal_dikembalikan:number|string;nominal_ditahan:number|string;alasan:string;status_pengembalian:string;tanggal_pengembalian:string|null};

export default async function PenerimaanPage({searchParams}:{searchParams:SearchParams}){
  const params=await searchParams;
  const supabase=await createClient();
  const [{data:financial,error:financialError},{data:receiptData,error:receiptError},{data:guaranteeData,error:guaranteeError},{data:alertData,error:alertError},{data:canceledData,error:canceledError},{data:settlementData,error:settlementError}]=await Promise.all([
    supabase.from('v_sales_financial_position').select('id_sales,id_kavling,nama_konsumen,status_sales,status_aktif,jenis_pembayaran,total_tagihan,total_diterima,saldo_piutang,persentase_terbayar').eq('status_aktif',true).order('saldo_piutang',{ascending:false}),
    supabase.from('sales_receipt').select('id_penerimaan,no_kuitansi,nilai_barcode,id_sales,jenis_penerimaan,tanggal_penerimaan,nominal,metode_penerimaan').order('dibuat_pada',{ascending:false}).limit(30),
    supabase.from('sales_bank_guarantee_item').select('id_jaminan,id_sales,jenis_item,nominal_tagihan,status').in('status',['BELUM_DIAJUKAN','DIAJUKAN_KE_BANK']),
    supabase.from('v_cash_bertahap_progress_payment_alert').select('id_sales,id_kavling,nama_konsumen,progress_bangunan,persentase_terbayar,nominal_ketertinggal').order('nominal_ketertinggal',{ascending:false}),
    supabase.from('v_sales_financial_position').select('id_sales,id_kavling,nama_konsumen,jenis_pembayaran,total_diterima').eq('status_sales','BATAL').order('nama_konsumen'),
    supabase.from('sales_cancellation_settlement').select('id_sales,keputusan,nominal_dikembalikan,nominal_ditahan,alasan,status_pengembalian,tanggal_pengembalian'),
  ]);
  const sales=(financial??[]) as FinancialRow[];
  const receipts=(receiptData??[]) as Receipt[];
  const guarantees=(guaranteeData??[]) as Guarantee[];
  const alerts=(alertData??[]) as ProgressAlert[];
  const canceled=(canceledData??[]) as {id_sales:string;id_kavling:string;nama_konsumen:string;jenis_pembayaran:string;total_diterima:number|string}[];
  const settlements=(settlementData??[]) as Cancellation[];
  const dbError=financialError?.message??receiptError?.message??guaranteeError?.message??alertError?.message??canceledError?.message??settlementError?.message;
  const due=sales.reduce((sum,row)=>sum+Number(row.saldo_piutang||0),0);
  const received=sales.reduce((sum,row)=>sum+Number(row.total_diterima||0),0);
  return <main className="collection-page">
    {(params.error||dbError)&&<div className="kavio-alert error">{params.error??`Data Piutang & Penerimaan belum tersedia. Terapkan migrasi V2 pada database proyek. Detail: ${dbError}`}</div>}
    {params.success&&<div className="kavio-alert success">{params.success}</div>}
    <section className="collection-summary">
      <Summary label="TOTAL PIUTANG AKTIF" value={formatKavioMoney(due)} />
      <Summary label="TOTAL PENERIMAAN TERCATAT" value={formatKavioMoney(received)} />
      <Summary label="PENERIMAAN TERBARU" value={`${receipts.length} KUITANSI`} />
    </section>
    <ReceiptEntryPanel sales={sales} guarantees={guarantees} />
    <BankGuaranteePanel sales={sales} items={guarantees} />
    {alerts.length>0&&<section className="kavio-panel collection-alert"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PERHATIAN CASH BERTAHAP</h2><div className="kavio-panel-note">Progress bangunan sudah melampaui persentase pembayaran harga jual.</div></div><span className="kavio-badge">{alerts.length} PERLU DITINJAU</span></div><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KAVLING</th><th>KONSUMEN</th><th>PROGRESS</th><th>TERBAYAR</th><th>SELISIH NILAI</th></tr></thead><tbody>{alerts.map((row)=><tr key={row.id_sales}><td>{row.id_kavling}</td><td>{row.nama_konsumen}</td><td>{(Number(row.progress_bangunan)*100).toFixed(1)}%</td><td>{(Number(row.persentase_terbayar)*100).toFixed(1)}%</td><td className="text-right">{formatKavioMoney(row.nominal_ketertinggal)}</td></tr>)}</tbody></table></div></section>}
    <CancellationSettlementPanel sales={canceled} settlements={settlements} />
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">POSISI PIUTANG</h2><div className="kavio-panel-note">Biaya bangunan, kelebihan tanah, dan hook menjadi harga jual; biaya notaris, akad, dan biaya lain ditampilkan terpisah dalam total tagihan.</div></div><span className="kavio-badge">{sales.length} SALES AKTIF</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KAVLING</th><th>KONSUMEN</th><th>PEMBAYARAN</th><th>TOTAL TAGIHAN</th><th>DITERIMA</th><th>SALDO PIUTANG</th><th>TERBAYAR</th></tr></thead><tbody>{sales.map((row)=><tr key={row.id_sales}><td>{row.id_kavling}</td><td>{row.nama_konsumen}</td><td>{row.jenis_pembayaran}</td><td className="text-right">{formatKavioMoney(row.total_tagihan)}</td><td className="text-right">{formatKavioMoney(row.total_diterima)}</td><td className="collection-due text-right">{formatKavioMoney(row.saldo_piutang)}</td><td>{(Number(row.persentase_terbayar)*100).toFixed(1)}%</td></tr>)}{!sales.length&&<tr><td colSpan={7} className="kavio-empty">BELUM ADA SALES AKTIF. BUAT SALES TERLEBIH DAHULU UNTUK MENCATAT PENERIMAAN.</td></tr>}</tbody></table></div>
    </section>
    <section className="kavio-panel">
      <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">KUITANSI TERBIT</h2><div className="kavio-panel-note">Nomor kuitansi dan nilai barcode disimpan bersama setiap penerimaan.</div></div><span className="kavio-badge">{receipts.length} TERBARU</span></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>TANGGAL</th><th>KUITANSI</th><th>KAVLING</th><th>JENIS</th><th>NOMINAL</th><th>BARCODE</th></tr></thead><tbody>{receipts.map((row)=><tr key={row.id_penerimaan}><td>{formatKavioDate(row.tanggal_penerimaan)}</td><td><Link href={`/penerimaan/kuitansi?id=${encodeURIComponent(row.id_penerimaan)}`}>{row.no_kuitansi}</Link></td><td>{sales.find((s)=>s.id_sales===row.id_sales)?.id_kavling??'—'}</td><td>{row.jenis_penerimaan.replaceAll('_',' ')}</td><td className="text-right">{formatKavioMoney(row.nominal)}</td><td><code>{row.nilai_barcode}</code></td></tr>)}{!receipts.length&&<tr><td colSpan={6} className="kavio-empty">BELUM ADA KUITANSI.</td></tr>}</tbody></table></div>
    </section>
  </main>;
}

function Summary({label,value}:{label:string;value:string}){return <div className="kavio-kpi collection-kpi"><div className="kavio-kpi-label">{label}</div><div className="kavio-kpi-value">{value}</div></div>;}
