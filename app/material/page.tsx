import './material.css';
import {createClient} from '../../lib/supabase/server';
import MaterialActionPanel from './MaterialActionPanel';
import KavioModuleTabs from '../components/KavioModuleTabs';
import KavioDataTable from '../components/KavioDataTable';
import PurchaseEntry,{type MaterialOptions,type LocationOptions,type SpkOptions,type SupplierOptions} from './PurchaseForm';
import {StockTable,HistoryTable} from './MaterialTables';
import {formatKavioMoney} from '../lib/number-format';
// Master/stock lists are read in pages to avoid Supabase's default 1000-row cap.
type WarehouseStock={id_lokasi:string;id_material:string;nama_lokasi:string;nama_material:string;satuan:string;jumlah:number;harga_rata_rata:number;nilai_persediaan:number};
type SpkStock={id_spk:string;id_material:string;jenis_spk:string;id_kavling:string|null;nama_objek:string;nama_material:string;satuan:string;jumlah:number;harga_rata_rata:number;nilai_stok:number};
type Spk=SpkOptions[number]&{is_active:boolean;status_spk:string};
type Request={id_permintaan:string;no_permintaan:string;id_spk:string;status:string;tanggal:string};
type RequestItem={id_permintaan:string;id_material:string;jumlah_diminta:number;jumlah_dipenuhi:number};
type Supplier=SupplierOptions[number]&{status_aktif:boolean};
async function allRows<T>(query:{range:(from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>}):Promise<T[]> {let rows:T[]=[];for(let page=0;;page++){const {data,error}=await query.range(page*1000,page*1000+999);if(error)throw new Error(error.message);rows.push(...((data??[]) as T[]));if(!data||data.length<1000)return rows;}}
export default async function MaterialPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 const params=await searchParams,supabase=await createClient();
 const [warehouse,spkStock,materials,locations,spks,requests,requestItems,suppliers]=await Promise.all([
  allRows<WarehouseStock>(supabase.from('v_material_stock_location').select('*').gt('jumlah',0).order('id_lokasi').order('id_material')),
  allRows<SpkStock>(supabase.from('v_material_stock_spk').select('*').gt('jumlah',0).order('id_spk').order('id_material')),
  allRows<MaterialOptions[number]&{status_aktif:boolean}>(supabase.from('master_material').select('id_material,nama_material,satuan,jenis_item,status_aktif').neq('jenis_item','UPAH').order('id_material')),
  allRows<LocationOptions[number]>(supabase.from('material_location').select('id_lokasi,kode_lokasi,nama_lokasi').eq('status_aktif',true).eq('jenis_lokasi','GUDANG').order('id_lokasi')),
  allRows<Spk>(supabase.from('spk').select('id_spk,jenis_spk,id_kavling,nama_objek,is_active,status_spk').order('id_spk')),
  allRows<Request>(supabase.from('material_request').select('id_permintaan,no_permintaan,id_spk,status,tanggal').order('id_permintaan')),
  allRows<RequestItem>(supabase.from('material_request_item').select('id_permintaan,id_material,jumlah_diminta,jumlah_dipenuhi').order('id_item_permintaan')),
  allRows<Supplier>(supabase.from('master_pemasok').select('id_pemasok,nama_pemasok,status_aktif').order('id_pemasok')),
 ]);
 materials.sort((a,b)=>a.nama_material.localeCompare(b.nama_material,'id'));suppliers.sort((a,b)=>a.nama_pemasok.localeCompare(b.nama_pemasok,'id'));
 const activeSpks=spks.filter(s=>s.is_active&&s.status_spk==='AKTIF');
 const requestTable=requestItems.flatMap(item=>{const r=requests.find(r=>r.id_permintaan===item.id_permintaan),m=materials.find(m=>m.id_material===item.id_material);return r&&m?[{...r,...item,nama_material:m.nama_material,satuan:m.satuan,sisa:Number(item.jumlah_diminta)-Number(item.jumlah_dipenuhi)}]:[];});
 const requestLines=requestTable.filter(r=>['DIAJUKAN','SEBAGIAN_DIPENUHI'].includes(r.status)&&r.sisa>0);
 const actionProps={materials:materials.filter(m=>m.status_aktif),suppliers:suppliers.filter(s=>s.status_aktif),locations,spks:activeSpks,requestLines,spkStocks:spkStock.map(s=>({...s,jumlah:Number(s.jumlah)}))};
 const historyOptions={materials,suppliers,locations,spks};
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stockRows=[...warehouse.map(s=>({key:`g:${s.id_lokasi}:${s.id_material}`,kind:'GUDANG',holder:s.id_lokasi,location:s.nama_lokasi,material:s.nama_material,unit:s.satuan,qty:Number(s.jumlah),average:Number(s.harga_rata_rata),value:Number(s.nilai_persediaan)})),...spkStock.map(s=>({key:`s:${s.id_spk}:${s.id_material}`,kind:'SPK',holder:s.id_spk,location:s.jenis_spk==='KAVLING'?`Kavling ${s.id_kavling}`:s.nama_objek,material:s.nama_material,unit:s.satuan,qty:Number(s.jumlah),average:Number(s.harga_rata_rata),value:Number(s.nilai_stok)}))];
 return <main className="material-page">{params.error&&<div className="kavio-alert error">{params.error}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}
 <section className="material-summary"><Summary label="PERMINTAAN TERBUKA" value={String(requests.filter(r=>['DIAJUKAN','SEBAGIAN_DIPENUHI'].includes(r.status)).length)} detail="Kebutuhan material belum selesai"/><Summary label="ITEM DI GUDANG" value={String(warehouse.length)} detail={formatKavioMoney(warehouse.reduce((n,s)=>n+Number(s.nilai_persediaan),0))}/><Summary label="ITEM DI SPK" value={String(spkStock.length)} detail={formatKavioMoney(spkStock.reduce((n,s)=>n+Number(s.nilai_stok),0))}/></section>
 <KavioModuleTabs tabs={[{id:'saldo',label:'Saldo Gudang',focusIds:['receipt_material']},{id:'pembelian',label:'Pembelian',focusIds:['purchase_entry']},{id:'pemakaian',label:'Pemakaian & Rekonsiliasi',focusIds:['request_spk','issue_request','direct_spk','spk_usage_spk','reconcile_spk']},{id:'kartu',label:'Kartu Stok'}]}>
 <div className="kavio-module-content"><section className="kavio-panel"><MaterialActionPanel {...actionProps} mode="saldo"/></section><StockTable stocks={stockRows}/></div>
 <div className="kavio-module-content"><section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PEMBELIAN MATERIAL</h2><p className="kavio-panel-note">Masuk ke Gudang atau langsung menjadi stok SPK.</p></div><PurchaseEntry options={{...historyOptions,materials:actionProps.materials,suppliers:actionProps.suppliers,spks:activeSpks}}/></div></section><HistoryTable mode="purchase" options={historyOptions} today={today} revision={String(Date.now())}/></div>
 <div className="kavio-module-content"><section className="kavio-panel"><MaterialActionPanel {...actionProps} mode="pemakaian"/></section><section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">PERMINTAAN MATERIAL</h2><span className="kavio-badge">{requestTable.length} ITEM</span></div><KavioDataTable label="Permintaan material" columns={[{key:'no',label:'PERMINTAAN',width:'20%'},{key:'obj',label:'OBJEK SPK',width:'16%'},{key:'material',label:'MATERIAL',width:'23%'},{key:'qty',label:'DIMINTA',align:'right',width:'11%'},{key:'done',label:'DIPENUHI',align:'right',width:'11%'},{key:'status',label:'STATUS',width:'19%'}]}>{requestTable.map(r=><tr key={`${r.id_permintaan}-${r.id_material}`}><td>{r.no_permintaan}</td><td>{spks.find(s=>s.id_spk===r.id_spk)?.id_kavling??spks.find(s=>s.id_spk===r.id_spk)?.nama_objek??'SPK'}</td><td>{r.nama_material}</td><td className="kavio-number">{Number(r.jumlah_diminta).toLocaleString('id-ID')} {r.satuan}</td><td className="kavio-number">{Number(r.jumlah_dipenuhi).toLocaleString('id-ID')} {r.satuan}</td><td>{r.status.replaceAll('_',' ')}</td></tr>)}{!requestTable.length&&<tr><td colSpan={6} className="kavio-empty">BELUM ADA PERMINTAAN MATERIAL.</td></tr>}</KavioDataTable></section><HistoryTable mode="usage" options={historyOptions} today={today} revision={String(Date.now())}/></div>
 <div className="kavio-module-content"><HistoryTable mode="card" options={historyOptions} today={today} revision={String(Date.now())}/></div>
 </KavioModuleTabs></main>;
}
function Summary({label,value,detail}:{label:string;value:string;detail:string}) {return <div className="kavio-kpi material-summary-card"><div className="kavio-kpi-label">{label}</div><div className="kavio-kpi-value">{value}</div><div className="material-summary-detail">{detail}</div></div>;}
