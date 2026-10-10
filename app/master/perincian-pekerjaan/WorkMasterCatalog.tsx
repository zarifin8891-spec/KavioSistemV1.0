'use client';
import {useMemo,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import KavioMasterFilters from '../../components/KavioMasterFilters';
import KavioWorkDetailEditor from '../../components/KavioWorkDetailEditor';
import {WorkEditorState,workPercent,workItemWage} from '../../lib/work-detail';
import {saveWorkMaster} from './actions';

type HouseType={id_tipe:string;nama_tipe:string;perincian_siap:boolean};
const number=(value:number)=>value.toLocaleString('id-ID',{maximumFractionDigits:4});
const money=(value:number)=>value.toLocaleString('id-ID',{maximumFractionDigits:0});
export default function WorkMasterCatalog({types,selected,initial,autoOpen}:{types:HouseType[];selected?:HouseType;initial:WorkEditorState;autoOpen:boolean}) {
 const router=useRouter();
 const [category,setCategory]=useState(''),[search,setSearch]=useState('');
 const [pending,startTransition]=useTransition();
 const names=useMemo(()=>new Map(initial.groups.map(g=>[g.id_kategori,g.nama_kategori])),[initial.groups]);
 const rows=useMemo(()=>initial.details.filter(d=>(!category||d.group_id===category)&&`${d.nama_pekerjaan} ${names.get(d.group_id)??''}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))),[initial.details,category,search,names]);
 const group=initial.groups.find(g=>g.id_kategori===category);
 return <section className="kavio-panel" aria-busy={pending}>
  <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">MASTER PERINCIAN PEKERJAAN</h2><div className="kavio-panel-note">Perincian dan bobot pekerjaan per tipe rumah untuk SPK baru.</div></div>{selected&&<KavioWorkDetailEditor identifier={selected.id_tipe} initial={initial} action={saveWorkMaster} autoOpen={autoOpen}/>}</div>
  <KavioMasterFilters>
   <label className="kavio-field"><span>TIPE RUMAH</span><select value={selected?.id_tipe??''} disabled={pending||!types.length} onChange={e=>{const type=e.target.value;startTransition(()=>router.push(`/master/perincian-pekerjaan?tipe=${encodeURIComponent(type)}`));}}>{!types.length&&<option value="">Belum ada tipe rumah</option>}{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select></label>
   <label className="kavio-field"><span>KATEGORI PEKERJAAN</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">SEMUA KATEGORI</option>{initial.groups.map(g=><option key={g.id_kategori} value={g.id_kategori}>{g.nama_kategori} ({workPercent(g.bobot)}%)</option>)}</select></label>
   <label className="kavio-field"><span>CARI PEKERJAAN</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nama pekerjaan atau kategori"/></label>
  </KavioMasterFilters>
  <div className="kavio-master-summary" role="status"><span>TOTAL UPAH (RP): <strong>{money(initial.total_upah)}</strong></span>{selected&&<span className="kavio-badge">{selected.perincian_siap?'SIAP DIGUNAKAN':'DRAFT'}</span>}{group&&<span>BOBOT KATEGORI: <strong>{workPercent(group.bobot)}%</strong></span>}{pending&&<span>Memuat tipe rumah…</span>}</div>
  <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>KATEGORI</th><th>NAMA PEKERJAAN</th><th className="work-detail-money">VOLUME</th><th>SATUAN</th><th className="work-detail-money">BOBOT (%)</th><th>RETENSI</th><th className="work-detail-money">TOTAL UPAH (RP)</th><th className="work-detail-money">HARGA SATUAN (RP)</th></tr></thead><tbody>{rows.map((d,i)=><tr key={`${d.group_id}:${d.urutan}:${i}`}><td>{names.get(d.group_id)??d.group_id}</td><td>{d.nama_pekerjaan}</td><td className="work-detail-money">{number(d.volume)}</td><td>{d.satuan}</td><td className="work-detail-money">{workPercent(d.bobot)}</td><td>{d.retensi===0?'Tanpa retensi':'5%'}</td><td className="work-detail-money">{money(workItemWage(d.bobot,initial.total_upah))}</td><td className="work-detail-money">{d.volume>0?money(workItemWage(d.bobot,initial.total_upah)/d.volume):'—'}</td></tr>)}{!rows.length&&<tr><td colSpan={8} className="kavio-empty">{!selected?'TAMBAHKAN TIPE RUMAH TERLEBIH DAHULU.':initial.details.length?'TIDAK ADA PEKERJAAN SESUAI FILTER.':'BELUM ADA PERINCIAN PEKERJAAN. KLIK EDIT PERINCIAN UNTUK MENAMBAHKAN.'}</td></tr>}</tbody></table></div>
  <div className="kavio-panel-body"><div className="kavio-panel-note">Menampilkan {rows.length} dari {initial.details.length} item.{selected&&!selected.perincian_siap&&' Lengkapi perincian, lalu simpan sebagai Siap Digunakan.'} Perubahan master tidak mengubah SPK yang telah disimpan.</div></div>
 </section>;
}
