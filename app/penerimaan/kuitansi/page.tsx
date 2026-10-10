import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import { formatKavioDate } from '../../lib/date-format';
import { formatKavioMoney } from '../../lib/number-format';
import Barcode from '../Barcode';
import PrintButton from '../PrintButton';

const TYPES: Record<string, string> = {
  BOOKING_FEE: 'Booking Fee', UANG_MUKA: 'Uang Muka', CICILAN_CASH_BERTAHAP: 'Pembayaran Cash Bertahap',
  PELUNASAN_CASH: 'Pelunasan Cash', PENCAIRAN_KPR: 'Pencairan KPR Bank',
  PENCAIRAN_DANA_JAMINAN: 'Pencairan Dana Jaminan', BIAYA_NOTARIS: 'Biaya Notaris', BIAYA_AKAD: 'Biaya Akad',
};

export default async function ReceiptPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  if (!id) notFound();
  const supabase = await createClient();
  const { data: receipt } = await supabase.from('sales_receipt').select('id_penerimaan,no_kuitansi,nilai_barcode,id_sales,id_jaminan,jenis_penerimaan,tanggal_penerimaan,nominal,metode_penerimaan,no_referensi,keterangan,diterima_oleh,status,id_bank_penerimaan,alasan_pembatalan,jaminan_snapshot').eq('id_penerimaan', id).maybeSingle();
  if (!receipt) notFound();
  const { data: sale } = await supabase.from('sales').select('id_sales,id_kavling,nama_konsumen,alamat_konsumen,hp_konsumen,jenis_pembayaran').eq('id_sales', receipt.id_sales).maybeSingle();
  if (!sale) notFound();

  const {data:account}=receipt.id_bank_penerimaan?await supabase.from('master_bank').select('nama_bank,jenis_akun').eq('id_bank',receipt.id_bank_penerimaan).maybeSingle():{data:null};
  return <main className="receipt-page">
    <div className="receipt-toolbar"><Link href="/penerimaan" className="kavio-button secondary">KEMBALI KE PIUTANG</Link><PrintButton /></div>
    <article className="receipt-paper">{receipt.status==='BATAL'&&<div className="receipt-canceled">KUITANSI BATAL · {receipt.alasan_pembatalan}</div>}
      <header className="receipt-header"><div className="receipt-brand">KAVIO</div><div><h1>KUITANSI PEMBAYARAN</h1><p>BUKTI PENERIMAAN RESMI</p></div></header>
      <div className="receipt-number"><span>NO. KUITANSI</span><strong>{receipt.no_kuitansi}</strong><span>TANGGAL {formatKavioDate(receipt.tanggal_penerimaan)}</span></div>
      <dl className="receipt-details">
        <div><dt>DITERIMA DARI</dt><dd>{sale.nama_konsumen}</dd></div>
        <div><dt>ALAMAT</dt><dd>{sale.alamat_konsumen || '—'}</dd></div>
        <div><dt>KAVLING</dt><dd>{sale.id_kavling}</dd></div>
        <div><dt>JENIS PEMBAYARAN</dt><dd>{sale.jenis_pembayaran.replaceAll('_', ' ')}</dd></div>
        {account&&<div><dt>KAS / BANK TUJUAN</dt><dd>{account.jenis_akun} · {account.nama_bank}</dd></div>}
        <div><dt>UNTUK PEMBAYARAN</dt><dd>{TYPES[receipt.jenis_penerimaan] ?? receipt.jenis_penerimaan}</dd></div>
        {receipt.no_referensi && <div><dt>NO. REFERENSI</dt><dd>{receipt.no_referensi}</dd></div>}
        {receipt.keterangan && <div><dt>KETERANGAN</dt><dd>{receipt.keterangan}</dd></div>}
      </dl>
      {receipt.jenis_penerimaan==='PENCAIRAN_KPR'&&Array.isArray(receipt.jaminan_snapshot)&&receipt.jaminan_snapshot.length>0&&<section><h2>DANA JAMINAN DITAHAN BANK</h2><dl className="receipt-details">{receipt.jaminan_snapshot.map((item:{jenis_item:string;nominal_tagihan:number})=><div key={item.jenis_item}><dt>{item.jenis_item.replaceAll('_',' & ')}</dt><dd>{formatKavioMoney(item.nominal_tagihan)}</dd></div>)}</dl></section>}
      <section className="receipt-amount"><span>JUMLAH DITERIMA</span><strong>{formatKavioMoney(receipt.nominal)}</strong><small>Metode: {receipt.metode_penerimaan.replaceAll('_', ' ')}</small></section>
      <div className="receipt-footer"><div><Barcode value={receipt.nilai_barcode} /><small>{receipt.nilai_barcode}</small></div><div className="receipt-signature"><span>Petugas Keuangan</span><strong>{receipt.diterima_oleh.slice(0, 8).toUpperCase()}</strong></div></div>
      <p className="receipt-note">Kuitansi ini diterbitkan oleh sistem KAVIO. Simpan sebagai bukti pembayaran.</p>
    </article>
  </main>;
}
