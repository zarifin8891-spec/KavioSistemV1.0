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
export type PurchaseOptions={materials:MaterialOptions;suppliers:SupplierOptions;locations:LocationOptions;spks:SpkOptions;today?:string};
export function PurchaseForm({options,initial}:{options:PurchaseOptions;initial?:Purchase}) {
 const today=options.today??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [destination,setDestination]=useState(initial?`${initial.tujuan}:${initial.id_lokasi_tujuan??initial.id_spk}`:'');
 const [target,targetId]=destination.split(':');
 return <form action={initial?amendMaterialPurchase:saveMaterialPurchase} className="kavio-form kavio-transaction-form">
 {initial&&<input type="hidden" name="id_transaksi" value={initial.id_transaksi}/>}
 <div className="kavio-transaction-header">
 <label className="kavio-field"><span>TANGGAL</span><input type="date" name="tanggal" required max={today} defaultValue={initial?.tanggal??today}/></label>
 <label className="kavio-field"><span>NO. NOTA</span><input name="no_nota" required defaultValue={initial?.no_nota}/></label>
 <label className="kavio-field"><span>PEMASOK</span><select name="id_pemasok" required defaultValue={initial?.id_pemasok??''}><option value="" disabled>PILIH PEMASOK</option>{options.suppliers.map(s=><option key={s.id_pemasok} value={s.id_pemasok}>{s.nama_pemasok}</option>)}</select></label>
 <label className="kavio-field"><span>TUJUAN GUDANG / SPK</span><select name="destination" value={destination} required onChange={e=>setDestination(e.target.value)}><option value="" disabled>PILIH TUJUAN</option><optgroup label="GUDANG">{options.locations.map(l=><option key={l.id_lokasi} value={`GUDANG:${l.id_lokasi}`}>GUDANG · {l.nama_lokasi}</option>)}</optgroup><optgroup label="SPK">{options.spks.map(s=><option key={s.id_spk} value={`SPK:${s.id_spk}`}>SPK · {s.jenis_spk} · {s.id_kavling??s.nama_objek}</option>)}</optgroup></select></label>
 </div>
 <input type="hidden" name="tujuan" value={target??''}/><input type="hidden" name="id_lokasi" value={target==='GUDANG'?targetId:''}/><input type="hidden" name="id_spk" value={target==='SPK'?targetId:''}/>
 <KavioMaterialLines materials={options.materials} initial={initial?.items} withPrice totalLabel="TOTAL NOTA"/>
 <label className="kavio-field kavio-field-wide"><span>KETERANGAN</span><input name="keterangan" defaultValue={initial?.keterangan??''}/></label>
 {initial&&<label className="kavio-field kavio-field-wide"><span>ALASAN KOREKSI</span><input name="alasan" required/></label>}
 <KavioFormActions><button type="submit" className="kavio-button">SIMPAN</button></KavioFormActions>
 </form>;
}
export default function PurchaseEntry({options}:{options:PurchaseOptions}) {return <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioTransactionModal title="Tambah Pembelian" focusIds={['purchase_entry']}><PurchaseForm options={options}/></KavioTransactionModal></KavioActionGate>;}
export function PurchaseActions({purchase,options}:{purchase:Purchase;options:PurchaseOptions}) {
 if(purchase.status!=='POSTED') return null;
 return <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><div className="kavio-master-row-actions"><KavioTransactionModal title="Edit" focusIds={[`purchase_edit:${purchase.id_transaksi}`]}><PurchaseForm options={options} initial={purchase}/></KavioTransactionModal><KavioTransactionModal title="Hapus" focusIds={[`purchase_delete:${purchase.id_transaksi}`]}><form action={amendMaterialPurchase} className="kavio-form kavio-transaction-form"><input type="hidden" name="id_transaksi" value={purchase.id_transaksi}/><input type="hidden" name="hapus" value="true"/><p className="kavio-field-wide">Batalkan pembelian {purchase.no_transaksi}. Stok dan nilai pembelian akan dibalik; riwayat tetap tersimpan.</p><label className="kavio-field kavio-field-wide"><span>ALASAN PEMBATALAN</span><input name="alasan" required/></label><KavioFormActions><button type="submit" className="kavio-button">HAPUS PEMBELIAN</button></KavioFormActions></form></KavioTransactionModal></div></KavioActionGate>;
}
