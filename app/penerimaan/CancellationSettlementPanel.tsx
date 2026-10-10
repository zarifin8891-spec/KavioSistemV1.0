'use client';

import { saveSalesCancellationSettlement } from './actions';
import KavioActionGate from '../components/KavioActionGate';
import { formatKavioMoney } from '../lib/number-format';

type CanceledSale={id_sales:string;id_kavling:string;nama_konsumen:string;jenis_pembayaran:string;total_diterima:number|string};
type Settlement={id_sales:string;keputusan:string;nominal_dikembalikan:number|string;nominal_ditahan:number|string;alasan:string;status_pengembalian:string;tanggal_pengembalian:string|null};
const DECISIONS:Record<string,string>={BOOKING_FEE_DIKEMBALIKAN:'Booking Fee dikembalikan',BOOKING_FEE_DIHANGUSKAN:'Booking Fee dihanguskan',DIKEMBALIKAN_SEBAGIAN:'Pengembalian sebagian',TANPA_PENGEMBALIAN:'Tanpa pengembalian'};

export default function CancellationSettlementPanel({sales,settlements}:{sales:CanceledSale[];settlements:Settlement[]}){
  const completed=new Map(settlements.map((row)=>[row.id_sales,row]));
  return <section className="kavio-panel">
    <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PENYELESAIAN SALES BATAL</h2><div className="kavio-panel-note">Keputusan refund dan dana yang ditahan dicatat per kasus; kuitansi penerimaan tetap tersimpan sebagai histori.</div></div><span className="kavio-badge">{sales.length} SALES BATAL</span></div>
    {sales.length===0?<p className="collection-note">Belum ada Sales batal yang memerlukan penyelesaian.</p>:<div className="cancellation-list">{sales.map((sale)=>{const saved=completed.get(sale.id_sales);return <details className="collection-details" key={sale.id_sales}><summary>{sale.id_kavling} · {sale.nama_konsumen} · Diterima {formatKavioMoney(sale.total_diterima)}{saved?' · PENYELESAIAN TERCATAT':''}</summary>
      <KavioActionGate action="PAYMENT_RECEIPT_WRITE"><form action={saveSalesCancellationSettlement} className="kavio-form collection-form">
        <input type="hidden" name="id_sales" value={sale.id_sales}/>
        <label className="kavio-field"><span>KEPUTUSAN KASUS</span><select name="keputusan" defaultValue={saved?.keputusan??'DIKEMBALIKAN_SEBAGIAN'}>{Object.entries(DECISIONS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="kavio-field"><span>NILAI DIKEMBALIKAN</span><input name="nominal_dikembalikan" type="number" min="0" step="1" defaultValue={saved?.nominal_dikembalikan??0} required/></label>
        <label className="kavio-field"><span>NILAI DITAHAN</span><input name="nominal_ditahan" type="number" min="0" step="1" defaultValue={saved?.nominal_ditahan??0} required/></label>
        <label className="kavio-field"><span>STATUS PENGEMBALIAN</span><select name="status_pengembalian" defaultValue={saved?.status_pengembalian??'BELUM_DIBAYAR'}><option value="BELUM_DIBAYAR">BELUM DIBAYAR</option><option value="SUDAH_DIBAYAR">SUDAH DIBAYAR</option><option value="TIDAK_ADA">TIDAK ADA</option></select></label>
        <label className="kavio-field"><span>TANGGAL PENGEMBALIAN (JIKA SUDAH DIBAYAR)</span><input name="tanggal_pengembalian" type="date" defaultValue={saved?.tanggal_pengembalian??''}/></label>
        <label className="kavio-field collection-wide"><span>ALASAN / CATATAN KASUS</span><textarea id="settlement_reason" name="alasan" rows={2} defaultValue={saved?.alasan??''} required/></label>
        <button className="kavio-button" type="submit">SIMPAN PENYELESAIAN</button>
      </form></KavioActionGate>
    </details>})}</div>}
  </section>;
}
