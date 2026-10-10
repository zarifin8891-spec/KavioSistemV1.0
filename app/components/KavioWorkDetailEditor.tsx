'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {useFormStatus} from 'react-dom';
import KavioFormModal from './KavioFormModal';
import KavioFormActions from './KavioFormActions';
import {WorkEditorState,WorkDetail,weightUnits,workWeightIssues,workMoney} from '../lib/work-detail';
import {t36WorkReference} from '../lib/t36-work-reference';

export default function KavioWorkDetailEditor({initial,action,identifier,spk=false,mandors=[],defaultMandor='',reference,autoOpen=false,readOnly=false}:{
 initial:WorkEditorState;action:(form:FormData)=>Promise<void>;identifier:string;spk?:boolean;
 mandors?:{id_mandor:string;nama_mandor:string}[];defaultMandor?:string;
 reference?:WorkDetail[];autoOpen?:boolean;readOnly?:boolean;
}) {
 const [open,setOpen]=useState(autoOpen),[state,setState]=useState(initial);
 const [notice,setNotice]=useState('');
 const params=useSearchParams(),success=params.get('success'),error=params.get('error');
 useEffect(()=>{if(success&&!error){setOpen(false);setState(initial);setNotice('');}},[success,error,initial]);
 const details=state.details.map((d,index)=>({...d,key:index}));
 const update=(index:number,patch:Partial<WorkDetail>)=>setState(s=>({...s,details:s.details.map((d,i)=>i===index?{...d,...patch}:d)}));
 const detailMode=!spk||state.mode==='PERINCIAN';
 const issues=workWeightIssues(state.groups,state.details);
 const total=state.groups.reduce((n,g)=>n+weightUnits(g.bobot),0)/10000;
 const preset=()=>{setState(s=>({...s,total_upah:15569000,details:t36WorkReference,groups:s.groups.map(g=>({...g,bobot:t36WorkReference.filter(d=>d.group_id===g.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0)/1000000}))}));setNotice('Contoh PDF dimuat untuk ditinjau. Bobot sumber berjumlah 99,9964%; sesuaikan selisih pembulatan agar menjadi 100%. Dua satuan kosong perlu diisi. Satuan lain mengikuti PDF, mohon diperiksa sebelum digunakan.');};
 return <>
 <button className="kavio-button secondary" type="button" onClick={()=>setOpen(true)}>{readOnly?'LIHAT KONFIGURASI':spk?'KONFIGURASI PEKERJAAN':'EDIT PERINCIAN'}</button>
 <KavioFormModal open={open} onClose={()=>setOpen(false)} size="full" ariaLabel={spk?'Konfigurasi Pekerjaan SPK':'Master Perincian Pekerjaan'} persistenceKey={`work-detail:${identifier}`} closeOnBackdrop={false}>
 <section className="kavio-panel work-detail-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">{spk?'KONFIGURASI PEKERJAAN SPK':'MASTER PERINCIAN PEKERJAAN'}</h2><p className="kavio-panel-note">Bobot item terhadap seluruh SPK. Total upah item = bobot item × total upah borongan.</p></div><span className="kavio-badge">TOTAL {total.toLocaleString('id-ID',{maximumFractionDigits:4})}%</span></div>
 <form action={action} className="kavio-panel-body">
 {error&&<div className="kavio-alert error" role="alert">{error}</div>}
 <input type="hidden" name={spk?'id_spk':'id_tipe'} value={identifier}/>
 <fieldset disabled={readOnly} className="work-detail-fields">
 <div className="kavio-form work-detail-settings"><label className="kavio-field"><span>TOTAL UPAH BORONGAN (RP)</span><input aria-label="Total upah borongan" type="number" min="0" step="0.01" value={state.total_upah} onChange={e=>setState(s=>({...s,total_upah:Number(e.target.value)}))} required/></label>
 {spk&&<label className="kavio-field"><span>CARA INPUT PROGRESS</span><select value={state.mode} aria-label="Cara input progress" onChange={e=>setState(s=>({...s,mode:e.target.value}))}><option value="KATEGORI">Per Kategori</option><option value="PERINCIAN">Dengan Perincian</option></select></label>}
 <div className="kavio-actions">{!spk&&identifier==='T36'&&<button type="button" className="kavio-button secondary" onClick={preset}>MUAT CONTOH T36</button>}{spk&&reference&&reference.length>0&&detailMode&&<button className="kavio-button secondary" type="button" onClick={()=>{setState(s=>({...s,details:reference.map(d=>({...d,id_mandor:defaultMandor}))}));setNotice('Perincian master disalin. Periksa bobot custom dan penugasan mandor sebelum menyimpan.');}}>SALIN PERINCIAN MASTER</button>}</div></div>
 {notice&&<div className="kavio-alert">{notice}</div>}
 {detailMode&&issues.length>0&&<div className="kavio-alert error" role="status">{issues.map(i=><div key={i}>{i}</div>)}</div>}
 {spk&&detailMode&&<p className="kavio-panel-note">Konfigurasi dapat disimpan sebagai draft. Aktivasi menyusul setelah fitur input progress perincian tersedia.</p>}
 {state.groups.map(group=>{
 const lines=details.filter(d=>d.group_id===group.id_kategori);
 const sum=lines.reduce((n,d)=>n+weightUnits(d.bobot),0)/10000;
 return <section key={group.id_kategori} className="work-detail-group"><div className="work-detail-group-head"><h3>{group.nama_kategori}</h3><label className="kavio-field"><span>BOBOT KATEGORI (%)</span><input type="number" min="0" max="100" step="0.0001" aria-label={`Bobot kategori ${group.nama_kategori}`} value={+(group.bobot*100).toFixed(4)} onChange={e=>setState(s=>({...s,groups:s.groups.map(g=>g.id_kategori===group.id_kategori?{...g,bobot:weightUnits(Number(e.target.value)/100)/1000000}:g)}))} required/></label>{detailMode&&<span className="kavio-panel-note">ITEM: {sum.toLocaleString('id-ID',{maximumFractionDigits:4})}% · {sum===weightUnits(group.bobot)/10000?'SESUAI':'BELUM SESUAI'}</span>}</div>
 {detailMode&&<><div className="kavio-table-wrap"><table className="kavio-table work-detail-table"><thead><tr><th>PEKERJAAN</th><th>VOLUME</th><th>SATUAN</th><th>BOBOT (%)</th><th>RETENSI</th>{spk&&<th>MANDOR</th>}<th>TOTAL UPAH</th><th>HARGA SATUAN</th><th>AKSI</th></tr></thead><tbody>
 {lines.map(d=><tr key={d.key}><td><input aria-label="Nama pekerjaan" value={d.nama_pekerjaan} maxLength={200} onChange={e=>update(d.key,{nama_pekerjaan:e.target.value})} required/></td><td><input aria-label={`Volume ${d.nama_pekerjaan}`} type="number" min="0.0001" step="0.0001" value={d.volume||''} onChange={e=>update(d.key,{volume:Number(e.target.value)})} required/></td><td><input aria-label={`Satuan ${d.nama_pekerjaan}`} value={d.satuan} maxLength={30} onChange={e=>update(d.key,{satuan:e.target.value})} required/></td><td><input aria-label={`Bobot ${d.nama_pekerjaan}`} type="number" min="0.0001" max="100" step="0.0001" value={+(d.bobot*100).toFixed(4)||''} onChange={e=>update(d.key,{bobot:weightUnits(Number(e.target.value)/100)/1000000})} required/></td><td><select aria-label={`Retensi ${d.nama_pekerjaan}`} value={d.retensi} onChange={e=>update(d.key,{retensi:Number(e.target.value)})}><option value={.05}>5%</option><option value={0}>Tanpa retensi</option></select></td>{spk&&<td><select aria-label={`Mandor ${d.nama_pekerjaan}`} value={d.id_mandor??defaultMandor} onChange={e=>update(d.key,{id_mandor:e.target.value})} required><option value="">Pilih mandor</option>{mandors.map(m=><option key={m.id_mandor} value={m.id_mandor}>{m.nama_mandor}</option>)}</select></td>}<td className="work-detail-money">{workMoney(d.bobot*state.total_upah)}</td><td className="work-detail-money">{d.volume>0?workMoney(d.bobot*state.total_upah/d.volume):'—'}</td><td><button type="button" className="kavio-button secondary" onClick={()=>setState(s=>({...s,details:s.details.filter((_,i)=>i!==d.key)}))}>HAPUS</button></td></tr>)}
 {!lines.length&&<tr><td colSpan={spk?9:8} className="kavio-empty">Belum ada perincian pekerjaan.</td></tr>}
 </tbody></table></div><button type="button" className="kavio-button secondary" onClick={()=>{setState(s=>({...s,details:[...s.details,{group_id:group.id_kategori,urutan:lines.length+1,nama_pekerjaan:'',volume:0,satuan:'',bobot:0,retensi:.05,...(spk?{id_mandor:defaultMandor}:{})}]}));}}>+ TAMBAH ITEM</button></>}
 </section>;
 })}
 </fieldset>
 <input type="hidden" name="editor_state" data-kavio-persist-hidden={!readOnly?'true':undefined} value={JSON.stringify({...state,details:state.details.map(d=>({...d,id_mandor:d.id_mandor??defaultMandor}))})} onInput={e=>{if(readOnly)return;try{const saved=JSON.parse(e.currentTarget.value);if(Array.isArray(saved.groups)&&Array.isArray(saved.details)&&saved.groups.length===initial.groups.length&&saved.groups.every((g:{id_kategori:string})=>initial.groups.some(i=>i.id_kategori===g.id_kategori))&&Number.isFinite(saved.total_upah))setState(saved);}catch{/* Keep current input. */}}}/>
 <EditorFooter spk={spk} readOnly={readOnly}/>
 </form></section></KavioFormModal></>;
}
function EditorFooter({spk,readOnly}:{spk:boolean;readOnly:boolean}) {
 const {pending}=useFormStatus();
 return <KavioFormActions disabled={pending}>{!readOnly&&<>{!spk&&<button className="kavio-button secondary" name="publish" value="false" disabled={pending}>SIMPAN DRAFT</button>}<button className="kavio-button" name="publish" value="true" disabled={pending}>{pending?'MENYIMPAN…':spk?'SIMPAN KONFIGURASI':'SIMPAN & SIAP DIGUNAKAN'}</button></>}</KavioFormActions>;
}
