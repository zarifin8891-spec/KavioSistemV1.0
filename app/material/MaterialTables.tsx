'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {createClient} from '../../lib/supabase/client';
import KavioDataTable from '../components/KavioDataTable';
import KavioTableControls from '../components/KavioTableControls';
import {formatKavioMoney} from '../lib/number-format';
import {formatKavioDate} from '../lib/date-format';
import {PurchaseActions,type Purchase,type PurchaseOptions} from './PurchaseForm';
const quantity=new Intl.NumberFormat('id-ID',{maximumFractionDigits:3});
export type Stock={key:string;kind:string;holder:string;location:string;material:string;unit:string;qty:number;average:number;value:number};
export function StockTable({stocks}:{stocks:Stock[]}) {
 const [kind,setKind]=useState(''),[holder,setHolder]=useState('');
 const rows=stocks.filter(s=>(!kind||s.kind===kind)&&(!holder||s.holder===holder));
 const locations=Array.from(new Map(stocks.filter(s=>!kind||s.kind===kind).map(s=>[s.holder,s.location])).entries());
 return <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">SALDO GUDANG / SPK</h2><p className="kavio-panel-note">Nilai persediaan dihitung dengan harga rata-rata tertimbang.</p></div><span className="kavio-badge">{rows.length} ITEM</span></div>
 <div className="kavio-table-filters"><label className="kavio-field"><span>JENIS LOKASI</span><select value={kind} onChange={e=>{setKind(e.target.value);setHolder('');}}><option value="">SEMUA · GUDANG & SPK</option><option value="GUDANG">GUDANG</option><option value="SPK">SPK</option></select></label><label className="kavio-field"><span>LOKASI / OBJEK</span><select value={holder} onChange={e=>setHolder(e.target.value)}><option value="">SEMUA LOKASI</option>{locations.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
 <KavioDataTable label="Saldo Gudang dan SPK" columns={[{key:'location',label:'LOKASI',width:'24%'},{key:'material',label:'MATERIAL',width:'28%'},{key:'qty',label:'STOK',align:'right',width:'14%'},{key:'avg',label:'HARGA RATA-RATA',align:'right',width:'17%'},{key:'value',label:'NILAI',align:'right',width:'17%'}]}>{rows.map(s=><tr key={s.key}><td>{s.kind} · {s.location}</td><td>{s.material}</td><td className="kavio-number">{quantity.format(s.qty)} {s.unit}</td><td className="kavio-number">{formatKavioMoney(s.average)}</td><td className="kavio-number">{formatKavioMoney(s.value)}</td></tr>)}{!rows.length&&<tr><td colSpan={5} className="kavio-empty">BELUM ADA STOK PADA LOKASI YANG DIPILIH.</td></tr>}</KavioDataTable>
 </section>;
}
type Card={id_item_transaksi:string;id_transaksi:string;no_transaksi:string;tanggal:string;jenis_transaksi:string;id_material:string;nama_material:string;satuan:string;jenis_lokasi:string;pemegang:string;nama_lokasi:string;masuk:number;keluar:number;harga_satuan:number;saldo:number};
type Usage={no_transaksi:string;id_spk:string;tanggal:string;jenis_transaksi:string;id_material:string;nama_material:string;satuan:string;jumlah:number;harga_satuan:number;biaya_dibebankan:number};
export function HistoryTable({mode,options,today,revision}:{revision:string;mode:'purchase'|'card'|'usage';options:PurchaseOptions;today:string}) {
 const params=useSearchParams(),failedFocus=params.get('error')?params.get('focus')??'':'';
 const [from,setFrom]=useState(today.slice(0,7)+'-01'),[to,setTo]=useState(today),[supplier,setSupplier]=useState(''),[material,setMaterial]=useState(''),[location,setLocation]=useState('');
 const [filters,setFilters]=useState({from:today.slice(0,7)+'-01',to:today,supplier:'',material:'',location:''});
 const [page,setPage]=useState(0),[rows,setRows]=useState<(Purchase|Card|Usage)[]>([]),[count,setCount]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let ignore=false;async function read(){setBusy(true);setError('');
  const supabase=createClient();
  const view=mode==='purchase'?'v_material_purchase':mode==='card'?'v_material_stock_card':'v_material_spk_usage';
  let query=supabase.from(view).select('*',{count:'exact'}).order('tanggal',{ascending:false}).order('no_transaksi',{ascending:false});
  if(mode==='purchase'&&/^purchase_(edit|delete):/.test(failedFocus)) query=query.eq('id_transaksi',failedFocus.split(':')[1]);
  else query=query.gte('tanggal',filters.from).lte('tanggal',filters.to);
  if(mode==='card')query=query.order('id_item_transaksi');
  if(mode==='usage')query=query.order('id_material');
  if(filters.material&&!failedFocus) query=mode==='purchase'?query.contains('id_materials',[filters.material]):query.eq('id_material',filters.material);
  if(mode==='purchase'&&filters.supplier&&!failedFocus) query=query.eq('id_pemasok',filters.supplier);
  if(mode==='card'&&filters.location) query=query.eq('pemegang',filters.location);
  const offset=mode==='purchase'&&/^purchase_(edit|delete):/.test(failedFocus)?0:page*50;
  const result=await query.range(offset,offset+49);
  if(ignore)return;setRows((result.data??[]) as (Purchase|Card|Usage)[]);setCount(result.count??0);setError(result.error?.message??'');setBusy(false);
 }read().catch(e=>{if(!ignore){setError(e instanceof Error?e.message:'Data tidak dapat dimuat.');setBusy(false);}});return()=>{ignore=true;};},[filters,page,mode,revision,failedFocus]);
 const title=mode==='purchase'?'DATA PEMBELIAN':mode==='card'?'KARTU STOK':'PEMAKAIAN MATERIAL';
 return <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">{title}</h2><p className="kavio-panel-note">{mode==='card'?'Saldo per material dan lokasi mencakup transaksi sebelum periode yang dipilih.':'Filter periode transaksi sesuai kebutuhan.'}</p></div></div>
 <form onSubmit={e=>{e.preventDefault();if(from>to){setError('Tanggal awal harus sebelum atau sama dengan tanggal akhir.');return;}setFilters({from,to,supplier,material,location});setPage(0);}}>
 <KavioTableControls count={count} page={page} onPage={setPage} busy={busy}><label className="kavio-field"><span>DARI TANGGAL</span><input type="date" required value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="kavio-field"><span>SAMPAI TANGGAL</span><input type="date" required value={to} onChange={e=>setTo(e.target.value)}/></label>
 {mode==='purchase'&&<label className="kavio-field"><span>PEMASOK</span><select value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">SEMUA PEMASOK</option>{options.suppliers.map(s=><option key={s.id_pemasok} value={s.id_pemasok}>{s.nama_pemasok}</option>)}</select></label>}
 <label className="kavio-field"><span>MATERIAL</span><select value={material} onChange={e=>setMaterial(e.target.value)}><option value="">SEMUA MATERIAL</option>{options.materials.map(m=><option key={m.id_material} value={m.id_material}>{m.nama_material}</option>)}</select></label>
 {mode==='card'&&<label className="kavio-field"><span>LOKASI</span><select value={location} onChange={e=>setLocation(e.target.value)}><option value="">SEMUA LOKASI</option>{options.locations.map(l=><option key={l.id_lokasi} value={l.id_lokasi}>{l.nama_lokasi}</option>)}{options.spks.map(s=><option key={s.id_spk} value={s.id_spk}>SPK · {s.id_kavling??s.nama_objek}</option>)}</select></label>}
 <button type="submit" className="kavio-button" disabled={busy}>TERAPKAN FILTER</button></KavioTableControls></form>
 {error&&<div className="kavio-alert error" role="alert">{error}</div>}
 {mode==='purchase'?<KavioDataTable label={title} minWidth="1140px" columns={[{key:'date',label:'TANGGAL',width:'9%'},{key:'no',label:'NOMOR / NOTA',width:'15%'},{key:'supplier',label:'PEMASOK',width:'15%'},{key:'target',label:'TUJUAN',width:'13%'},{key:'items',label:'MATERIAL / VOLUME',width:'19%'},{key:'total',label:'TOTAL',align:'right',width:'13%'},{key:'status',label:'STATUS',width:'6%'},{key:'action',label:'AKSI',width:'10%'}]}>{(rows as Purchase[]).map(p=><tr key={p.id_transaksi}><td>{formatKavioDate(p.tanggal)}</td><td>{p.no_transaksi}<small className="material-subtext">{p.no_nota}</small></td><td>{p.nama_pemasok}</td><td>{p.tujuan} · {p.nama_tujuan}</td><td>{p.items.map(i=><div key={i.id_material}>{i.nama_material}<small className="material-subtext">{quantity.format(Number(i.jumlah))} {i.satuan} × {formatKavioMoney(i.harga_satuan)}</small></div>)}</td><td className="kavio-number">{formatKavioMoney(p.total)}</td><td>{p.status}</td><td><PurchaseActions purchase={p} options={{...options,spks:options.spks.filter(s=>!('is_active' in s)||s.is_active),suppliers:options.suppliers.filter(s=>!('status_aktif' in s)||s.status_aktif)}}/></td></tr>)}{!rows.length&&<Empty cols={8} busy={busy}/>}</KavioDataTable>:
 mode==='card'?<KavioDataTable label={title} minWidth="1120px" columns={[{key:'date',label:'TANGGAL',width:'9%'},{key:'no',label:'NOMOR / JENIS',width:'20%'},{key:'material',label:'MATERIAL',width:'19%'},{key:'location',label:'LOKASI',width:'17%'},{key:'in',label:'MASUK',align:'right',width:'9%'},{key:'out',label:'KELUAR',align:'right',width:'9%'},{key:'balance',label:'SALDO',align:'right',width:'9%'},{key:'unit',label:'SATUAN',width:'8%'}]}>{(rows as Card[]).map(r=><tr key={`${r.id_item_transaksi}-${r.jenis_lokasi}-${r.pemegang}`}><td>{formatKavioDate(r.tanggal)}</td><td>{r.no_transaksi}<small className="material-subtext">{r.jenis_transaksi.replaceAll('_',' ')}</small></td><td>{r.nama_material}</td><td>{r.jenis_lokasi} · {r.nama_lokasi}</td><td className="kavio-number">{quantity.format(Number(r.masuk))}</td><td className="kavio-number">{quantity.format(Number(r.keluar))}</td><td className="kavio-number">{quantity.format(Number(r.saldo))}</td><td>{r.satuan}</td></tr>)}{!rows.length&&<Empty cols={8} busy={busy}/>}</KavioDataTable>:
 <KavioDataTable label={title} minWidth="1050px" columns={[{key:'date',label:'TANGGAL',width:'10%'},{key:'no',label:'NOMOR / JENIS',width:'23%'},{key:'spk',label:'OBJEK SPK',width:'15%'},{key:'material',label:'MATERIAL',width:'23%'},{key:'qty',label:'VOLUME',align:'right',width:'13%'},{key:'cost',label:'BIAYA DIBEBANKAN',align:'right',width:'16%'}]}>{(rows as Usage[]).map((r,i)=><tr key={`${r.no_transaksi}-${r.id_material}-${i}`}><td>{formatKavioDate(r.tanggal)}</td><td>{r.no_transaksi}<small className="material-subtext">{r.jenis_transaksi.replaceAll('_',' ')}</small></td><td>{options.spks.find(s=>s.id_spk===r.id_spk)?.id_kavling??options.spks.find(s=>s.id_spk===r.id_spk)?.nama_objek??r.id_spk}</td><td>{r.nama_material}</td><td className="kavio-number">{quantity.format(Number(r.jumlah))} {r.satuan}</td><td className="kavio-number">{formatKavioMoney(r.biaya_dibebankan)}</td></tr>)}{!rows.length&&<Empty cols={6} busy={busy}/>}</KavioDataTable>}
 </section>;
}
function Empty({cols,busy}:{cols:number;busy:boolean}) {return <tr><td className="kavio-empty" colSpan={cols}>{busy?'MEMUAT DATA…':'TIDAK ADA TRANSAKSI SESUAI FILTER.'}</td></tr>;}
