'use client';
import {useState} from 'react';
import KavioMaterialLines from '../components/KavioMaterialLines';
import KavioFormActions from '../components/KavioFormActions';
import KavioTransactionModal from '../components/KavioTransactionModal';
import KavioActionGate from '../components/KavioActionGate';
import {saveMaterialPurchase,amendMaterialPurchase} from './actions';
export type MaterialOptions={id_material:string;nama_material:string;satuan:string;jenis_item:string}[];
export type SupplierOptions={id_pemasok:string;nama_pemasok:string}[];
export type LocationOptions={id_lokasi:string;kode_lokasi:string;nama_lokasi:string}[];
export type SpkOptions={id_spk:string;jenis_spk:string;id_kavling:string|null;nama_objek:string|null}[];
export type Purchase={id_transaksi:string;no_transaksi:string;tanggal:string;status:string;id_pemasok:string;nama_pemasok:string;no_nota:string;keterangan:string|null;tujuan:string;nama_tujuan:string;id_lokasi_tujuan:string|null;id_spk:string|null;total:number;items:{id_material:string;nama_material:string;satuan:string;jumlah:number;harga_satuan:number}[]};
export type PurchaseOptions={materials:MaterialOptions;suppliers:SupplierOptions;locations:LocationOptions;spks:SpkOptions};
export function PurchaseForm({options,initial}:{options:PurchaseOptions;initial?:Purchase}) {
 const [target,setTarget]=useState(initial?.tujuan??'GUDANG');
 return <form action={initial?amendMaterialPurchase:saveMaterialPurchase} className="kavio-form material-form">
 {initial&&<input type="hidden" name="id_transaksi" value={initial.id_transaksi}/>}
 <label className="kavio-field"><span>PEMASOK</span><select name="id_pemasok" required defaultValue={initial?.id_pemasok??''}><option value="" disabled>PILIH PEMASOK</option>{options.suppliers.map(s=><option key={s.id_pemasok} value={s.id_pemasok}>{s.nama_pemasok}</option>)}</select></label>
 <label className="kavio-field"><span>NOMOR NOTA</span><input name="no_nota" required defaultValue={initial?.no_nota}/></label>
 <label className="kavio-field"><span>MASUK KE</span><select name="tujuan" value={target} onChange={e=>setTarget(e.target.value)}><option value="GUDANG">GUDANG</option><option value="SPK">STOK SPK</option></select></label>
 {target==='GUDANG'?<label className="kavio-field material-wide"><span>GUDANG TUJUAN</span><select name="id_lokasi" required defaultValue={initial?.id_lokasi_tujuan??''}><option value="" disabled>PILIH GUDANG</option>{options.locations.map(l=><option key={l.id_lokasi} value={l.id_lokasi}>{l.kode_lokasi} · {l.nama_lokasi}</option>)}</select></label>:<label className="kavio-field material-wide"><span>SPK TUJUAN</span><select name="id_spk" required defaultValue={initial?.id_spk??''}><option value="" disabled>PILIH SPK</option>{options.spks.map(s=><option key={s.id_spk} value={s.id_spk}>{s.jenis_spk} · {s.id_kavling??s.nama_objek}</option>)}</select></label>}
 <div className="material-wide"><p className="kavio-panel-note">Tanggal mengikuti hari input. Pembelian membentuk stok di lokasi tujuan.</p></div>
 <KavioMaterialLines materials={options.materials} initial={initial?.items} withPrice/>
 <label className="kavio-field material-wide"><span>KETERANGAN</span><input name="keterangan" defaultValue={initial?.keterangan??''}/></label>
 {initial&&<label className="kavio-field material-wide"><span>ALASAN KOREKSI</span><input name="alasan" required/></label>}
 <KavioFormActions><button type="submit" className="kavio-button">SIMPAN</button></KavioFormActions>
 </form>;
}
export default function PurchaseEntry({options}:{options:PurchaseOptions}) {return <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioTransactionModal title="Tambah Pembelian" focusIds={['purchase_entry']}><PurchaseForm options={options}/></KavioTransactionModal></KavioActionGate>;}
export function PurchaseActions({purchase,options}:{purchase:Purchase;options:PurchaseOptions}) {
 if(purchase.status!=='POSTED') return null;
 return <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><div className="kavio-master-row-actions"><KavioTransactionModal title="Edit" focusIds={[`purchase_edit:${purchase.id_transaksi}`]}><PurchaseForm options={options} initial={purchase}/></KavioTransactionModal><KavioTransactionModal title="Hapus" focusIds={[`purchase_delete:${purchase.id_transaksi}`]}><form action={amendMaterialPurchase} className="kavio-form material-form"><input type="hidden" name="id_transaksi" value={purchase.id_transaksi}/><input type="hidden" name="hapus" value="true"/><p className="material-wide">Batalkan pembelian {purchase.no_transaksi}. Stok dan nilai pembelian akan dibalik; riwayat tetap tersimpan.</p><label className="kavio-field material-wide"><span>ALASAN PEMBATALAN</span><input name="alasan" required/></label><KavioFormActions><button type="submit" className="kavio-button">HAPUS PEMBELIAN</button></KavioFormActions></form></KavioTransactionModal></div></KavioActionGate>;
}
