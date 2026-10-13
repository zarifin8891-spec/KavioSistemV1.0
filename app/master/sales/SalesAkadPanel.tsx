'use client';
import KavioActionGate from '../../components/KavioActionGate';
import KavioTransactionModal from '../../components/KavioTransactionModal';
import KavioFormActions from '../../components/KavioFormActions';
import {recordSalesAkad} from './actions';
export default function SalesAkadPanel({id,payment,notaries}:{id:string;payment:string;notaries:{id_notaris:string;nama_notaris:string}[]}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <KavioActionGate action="SALES_WRITE"><KavioTransactionModal title="Catat Akad" focusIds={['akad_date:'+id]}><form action={recordSalesAkad} className="kavio-form kavio-panel-body"><input type="hidden" name="id_sales" value={id}/><p className="kavio-panel-note kavio-field-wide">{payment==='KPR'?'Catat akad setelah Booking Fee dan Uang Muka diterima, sebelum pencairan KPR.':'Catat akad setelah harga jual lunas, sebelum serah terima.'} Status Sales menjadi AKAD dan tetap aktif untuk penerimaan berikutnya.</p><label className="kavio-field"><span>TANGGAL AKAD</span><input id={'akad_date:'+id} name="tanggal" type="date" max={today} required defaultValue={today}/></label><label className="kavio-field"><span>NOTARIS</span><select name="id_notaris" required defaultValue=""><option value="" disabled>PILIH NOTARIS</option>{notaries.map(n=><option key={n.id_notaris} value={n.id_notaris}>{n.nama_notaris}</option>)}</select></label><KavioFormActions><button className="kavio-button" disabled={!notaries.length}>SIMPAN AKAD</button></KavioFormActions></form></KavioTransactionModal></KavioActionGate>;
}
