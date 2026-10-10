'use client';

import { saveCashInstallmentTerms, postSalesReceipt } from './actions';
import KavioActionGate from '../components/KavioActionGate';
import KavioTransactionModal from '../components/KavioTransactionModal';

type Sale = { id_sales:string; id_kavling:string; nama_konsumen:string; jenis_pembayaran:string; status_sales:string; total_tagihan:number|string; total_diterima:number|string; saldo_piutang:number|string };
type Guarantee = { id_jaminan:string; id_sales:string; jenis_item:string; nominal_tagihan:number|string; status:string };

export default function ReceiptEntryPanel({sales,guarantees}: {sales:Sale[]; guarantees:Guarantee[]}) {
  const cashInstallments=sales.filter((s)=>s.status_sales!=='BATAL'&&s.jenis_pembayaran==='CASH_BERTAHAP');
  return <section className="kavio-panel collection-actions">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">INPUT PENERIMAAN</h2><div className="kavio-panel-note">Setiap penerimaan membentuk catatan permanen dan nomor kuitansi unik.</div></div><span className="kavio-badge">KEUANGAN</span></div>
    <KavioActionGate action="PAYMENT_RECEIPT_WRITE"><KavioTransactionModal title="Catat penerimaan customer atau pencairan bank" focusIds={["receipt_sales"]}>
      <form action={postSalesReceipt} className="kavio-form collection-form">
        <label className="kavio-field"><span>SALES / KAVLING</span><select id="receipt_sales" name="id_sales" required defaultValue=""><option value="" disabled>PILIH SALES</option>{sales.filter((s)=>Number(s.saldo_piutang)>0).map((s)=><option key={s.id_sales} value={s.id_sales}>{s.id_kavling} · {s.nama_konsumen} · {s.jenis_pembayaran}</option>)}</select></label>
        <label className="kavio-field"><span>JENIS PENERIMAAN</span><select name="jenis_penerimaan" defaultValue="BOOKING_FEE"><option value="BOOKING_FEE">BOOKING FEE</option><option value="UANG_MUKA">UANG MUKA</option><option value="CICILAN_CASH_BERTAHAP">CICILAN CASH BERTAHAP</option><option value="PELUNASAN_CASH">PELUNASAN CASH</option><option value="PENCAIRAN_KPR">PENCAIRAN KPR BANK</option><option value="PENCAIRAN_DANA_JAMINAN">PENCAIRAN DANA JAMINAN</option><option value="BIAYA_NOTARIS">BIAYA NOTARIS</option><option value="BIAYA_AKAD">BIAYA AKAD</option></select></label>
        <label className="kavio-field"><span>TANGGAL DITERIMA</span><input name="tanggal_penerimaan" type="date" required /></label>
        <label className="kavio-field"><span>NOMINAL</span><input name="nominal" type="number" min="1" step="1" required /></label>
        <label className="kavio-field"><span>METODE</span><select name="metode_penerimaan" defaultValue="TRANSFER"><option value="TUNAI">TUNAI</option><option value="TRANSFER">TRANSFER</option><option value="GIRO">GIRO</option><option value="LAINNYA">LAINNYA</option></select></label>
        <label className="kavio-field"><span>ITEM DANA JAMINAN</span><select name="id_jaminan" defaultValue=""><option value="">TIDAK ADA</option>{guarantees.filter((g)=>g.status==='DIAJUKAN_KE_BANK').map((g)=><option key={g.id_jaminan} value={g.id_jaminan}>{g.jenis_item} · {sales.find((s)=>s.id_sales===g.id_sales)?.id_kavling} · tagihan {Number(g.nominal_tagihan).toLocaleString('id-ID')}</option>)}</select></label>
        <label className="kavio-field"><span>NO. REFERENSI / TRANSFER</span><input name="no_referensi" /></label>
        <label className="kavio-field collection-wide"><span>KETERANGAN</span><input name="keterangan" /></label>
        <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!sales.length}>SIMPAN & TERBITKAN KUITANSI</button></div>
      </form>
    </KavioTransactionModal></KavioActionGate>
    <KavioActionGate action="PAYMENT_PLAN_WRITE"><KavioTransactionModal title="Ketentuan Cash Bertahap" focusIds={["terms_sales"]}>
      <form action={saveCashInstallmentTerms} className="kavio-form collection-form">
        <label className="kavio-field"><span>SALES CASH BERTAHAP</span><select id="terms_sales" name="id_sales" required defaultValue=""><option value="" disabled>PILIH SALES</option>{cashInstallments.map((s)=><option key={s.id_sales} value={s.id_sales}>{s.id_kavling} · {s.nama_konsumen}</option>)}</select></label>
        <label className="kavio-field"><span>TENOR PERJANJIAN</span><select name="tenor_bulan" defaultValue="6">{[6,7,8,9,10,11,12].map((n)=><option key={n} value={n}>{n} BULAN</option>)}</select></label>
        <label className="kavio-field"><span>POLA PEMBAYARAN</span><select name="pola_pelunasan" defaultValue="CICILAN_FLEKSIBEL"><option value="CICILAN_FLEKSIBEL">CICILAN FLEKSIBEL</option><option value="LUNAS_DI_AKHIR">LUNAS DI AKHIR PERJANJIAN</option></select></label>
        <div className="kavio-actions"><button className="kavio-button" type="submit" disabled={!cashInstallments.length}>SIMPAN KETENTUAN</button></div>
      </form>
      <p className="collection-note">Pembayaran pertama minimal 40% dari total tagihan termasuk booking fee sebelum SPK pembangunan dapat diaktifkan.</p>
    </KavioTransactionModal></KavioActionGate>
  </section>;
}
