'use client';
import {useEffect,useState} from 'react';
import KavioPercentInput from './KavioPercentInput';
import {useSearchParams} from 'next/navigation';
import {useFormStatus} from 'react-dom';
import KavioFormModal from './KavioFormModal';
import KavioFormActions from './KavioFormActions';
import {WorkEditorState,WorkDetail,weightUnits,workWeightIssues,workMoney,workPercent} from '../lib/work-detail';
import {t36WorkReference} from '../lib/t36-work-reference';

export default function KavioWorkDetailEditor({initial,action,identifier,spk=false,mandors=[],defaultMandor='',reference,autoOpen=false,readOnly=false}:{
 initial:WorkEditorState;action:(form:FormData)=>Promise<void>;identifier:string;spk?:boolean;
 mandors?:{id_mandor:string;nama_mandor:string}[];defaultMandor?:string;
 reference?:WorkDetail[];autoOpen?:boolean;readOnly?:boolean;
}) {
 const [open,setOpen]=useState(autoOpen),[state,setState]=useState(initial);
 const [notice,setNotice]=useState('');
 const [activeId,setActiveId]=useState(initial.groups[0]?.id_kategori??'');
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
 <KavioFormModal open={open} onClose={()=>setOpen(false)} size={spk?'wide':'standard'} ariaLabel={spk?'Konfigurasi Pekerjaan SPK':'Master Perincian Pekerjaan'} persistenceKey={`work-detail:${identifier}`} closeOnBackdrop={false}>
 <section className="kavio-panel work-detail-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">{spk?'KONFIGURASI PEKERJAAN SPK':'MASTER PERINCIAN PEKERJAAN'}</h2><p className="kavio-panel-note">Bobot item terhadap seluruh SPK. Total upah item = bobot item × total upah borongan.</p></div><span className="kavio-badge">TOTAL {workPercent(total/100)}%</span></div>
 <form action={action} className="kavio-panel-body" onSubmit={event=>{
  if(readOnly)return;
  const invalid=detailMode?state.details.find(d=>!d.nama_pekerjaan.trim()||!d.satuan.trim()||!Number.isFinite(d.volume)||d.volume<=0||!Number.isFinite(d.bobot)||d.bobot<=0||d.bobot>1||(spk&&!d.id_mandor&&!defaultMandor)):undefined;
  if(invalid){event.preventDefault();setActiveId(invalid.group_id);setNotice('Lengkapi nama pekerjaan, volume, satuan, bobot, dan mandor pada kategori '+(state.groups.find(g=>g.id_kategori===invalid.group_id)?.nama_kategori??'yang dipilih')+'.');return;}
  const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  if((spk||submitter?.value==='true')&&((detailMode&&issues.length>0)||total!==100)){
   event.preventDefault();
   const mismatch=state.groups.find(g=>state.details.filter(d=>d.group_id===g.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0)!==weightUnits(g.bobot));
   if(mismatch&&detailMode)setActiveId(mismatch.id_kategori);
   setNotice('Bobot belum sesuai. Total kategori harus tepat 100% dan total item harus sama dengan kategori.');
  }
 }}>
 {error&&<div className="kavio-alert error" role="alert">{error}</div>}
 <input type="hidden" name={spk?'id_spk':'id_tipe'} value={identifier}/>
 <fieldset disabled={readOnly} className="work-detail-fields">
 <div className="kavio-form work-detail-settings"><label className="kavio-field"><span>TOTAL UPAH BORONGAN (RP)</span><input aria-label="Total upah borongan" type="number" min="0" step="0.01" value={state.total_upah} onChange={e=>setState(s=>({...s,total_upah:Number(e.target.value)}))} required/></label>
 {spk&&<label className="kavio-field"><span>CARA INPUT PROGRESS</span><select value={state.mode} aria-label="Cara input progress" onChange={e=>setState(s=>({...s,mode:e.target.value}))}><option value="KATEGORI">Per Kategori</option><option value="PERINCIAN">Dengan Perincian</option></select></label>}
 <div className="work-detail-tools">{!spk&&identifier==='T36'&&<button type="button" className="kavio-button secondary" onClick={preset}>MUAT CONTOH T36</button>}{spk&&reference&&reference.length>0&&detailMode&&<button className="kavio-button secondary" type="button" onClick={()=>{setState(s=>({...s,details:reference.map(d=>({...d,id_mandor:defaultMandor}))}));setNotice('Perincian master disalin. Periksa bobot custom dan penugasan mandor sebelum menyimpan.');}}>SALIN PERINCIAN MASTER</button>}</div></div>
 {notice&&<div className="kavio-alert">{notice}</div>}
 {spk&&detailMode&&<p className="kavio-panel-note">Konfigurasi dapat disimpan sebagai draft. Aktivasi menyusul setelah fitur input progress perincian tersedia.</p>}
 </fieldset>
 <p className="kavio-panel-note work-detail-precision">Bobot ditampilkan dua desimal. Nilai rinci sumber tetap digunakan sampai bobot tersebut diedit.</p>
 <div className="work-editor-layout">
 <nav className="work-category-nav" aria-label="Kategori pekerjaan">
 <span className="work-category-label">PILIH KATEGORI</span>
 {state.groups.map(group=><button type="button" key={group.id_kategori} className={`work-category-button ${activeId===group.id_kategori?'is-active':''}`} aria-pressed={activeId===group.id_kategori} onClick={()=>{setActiveId(group.id_kategori);setNotice('');}}><strong>{group.nama_kategori}</strong><span>{workPercent(group.bobot)}%</span></button>)}
 </nav>
 <div className="work-category-content">
 {state.groups.filter(g=>g.id_kategori===activeId).map(group=>{
 const lines=details.filter(d=>d.group_id===group.id_kategori);
 const sum=lines.reduce((n,d)=>n+weightUnits(d.bobot),0);
 const valid=sum===weightUnits(group.bobot),delta=Math.abs(sum-weightUnits(group.bobot))/1000000;
 return <fieldset key={group.id_kategori} disabled={readOnly} className="work-detail-fields work-selected-category"><div className="work-detail-group-head"><div><h3>{group.nama_kategori}</h3><p className="kavio-panel-note">{lines.length} item pekerjaan</p></div><label className="kavio-field"><span>BOBOT KATEGORI (%)</span><KavioPercentInput label={`Bobot kategori ${group.nama_kategori}`} value={group.bobot*100} onChange={value=>setState(s=>({...s,groups:s.groups.map(g=>g.id_kategori===group.id_kategori?{...g,bobot:weightUnits(value/100)/1000000}:g)}))}/></label></div>
 {detailMode&&<><div className={`work-weight-summary ${valid?'is-valid':'is-pending'}`} role="status"><span>TOTAL BOBOT ITEM <strong>{workPercent(sum/1000000)}%</strong></span><span>{valid?'Bobot sesuai':`Selisih ${delta<.0001?'< 0,01':workPercent(delta)}%`}</span></div>
 {lines.length>0&&<div className="work-item-heading" aria-hidden="true"><span>NAMA PEKERJAAN</span><span>VOLUME</span><span>SATUAN</span><span>BOBOT (%)</span></div>}
 <div className="work-item-list">{lines.map((d,index)=><article key={d.key} className="work-item-card" data-work-line-index={d.key}>
 <div className="work-item-main"><label className="kavio-field work-item-name"><span className="work-mobile-label">NAMA PEKERJAAN · {index+1}</span><input aria-label="Nama pekerjaan" value={d.nama_pekerjaan} maxLength={200} placeholder="Nama item pekerjaan" onChange={e=>update(d.key,{nama_pekerjaan:e.target.value})} required/></label><label className="kavio-field"><span className="work-mobile-label">VOLUME</span><input aria-label={`Volume ${d.nama_pekerjaan}`} type="number" min="0.0001" step="0.0001" value={d.volume||''} placeholder="0" onChange={e=>update(d.key,{volume:Number(e.target.value)})} required/></label><label className="kavio-field"><span className="work-mobile-label">SATUAN</span><input aria-label={`Satuan ${d.nama_pekerjaan}`} value={d.satuan} maxLength={30} placeholder="m² / m³ / unit" onChange={e=>update(d.key,{satuan:e.target.value})} required/></label><label className="kavio-field"><span className="work-mobile-label">BOBOT (%)</span><KavioPercentInput label={`Bobot ${d.nama_pekerjaan}`} min={.0001} value={d.bobot*100} onChange={value=>update(d.key,{bobot:weightUnits(value/100)/1000000})}/></label></div>
 <div className="work-item-extra"><label className="kavio-field"><span>RETENSI</span><select aria-label={`Retensi ${d.nama_pekerjaan}`} value={d.retensi} onChange={e=>update(d.key,{retensi:Number(e.target.value)})}><option value={.05}>5%</option><option value={0}>Tanpa retensi</option></select></label>{spk&&<label className="kavio-field"><span>MANDOR</span><select aria-label={`Mandor ${d.nama_pekerjaan}`} value={d.id_mandor??defaultMandor} onChange={e=>update(d.key,{id_mandor:e.target.value})} required><option value="">Pilih mandor</option>{mandors.map(m=><option key={m.id_mandor} value={m.id_mandor}>{m.nama_mandor}</option>)}</select></label>}<div className="work-item-calculation"><span>TOTAL UPAH<strong>{workMoney(d.bobot*state.total_upah)}</strong></span><span>HARGA SATUAN<strong>{d.volume>0?workMoney(d.bobot*state.total_upah/d.volume):'—'}</strong></span></div><button type="button" className="kavio-button secondary work-item-remove" aria-label={`Hapus ${d.nama_pekerjaan||'item '+(index+1)}`} onClick={()=>setState(s=>({...s,details:s.details.filter((_,i)=>i!==d.key)}))}>HAPUS ITEM</button></div>
 </article>)}</div>
 {!lines.length&&<div className="work-item-empty">Belum ada item pekerjaan. Klik Tambah Item untuk mengisi.</div>}
 <button type="button" className="kavio-button secondary work-add-item" onClick={()=>setState(s=>({...s,details:[...s.details,{group_id:group.id_kategori,urutan:lines.length+1,nama_pekerjaan:'',volume:0,satuan:'',bobot:0,retensi:.05,...(spk?{id_mandor:defaultMandor}:{})}]}))}>+ TAMBAH ITEM</button></>}
 </fieldset>;
 })}
 </div></div>
 <input type="hidden" name="editor_state" data-kavio-persist-hidden={!readOnly?'true':undefined} value={JSON.stringify({...state,details:state.details.map(d=>({...d,id_mandor:d.id_mandor??defaultMandor}))})} onInput={e=>{if(readOnly)return;try{const saved=JSON.parse(e.currentTarget.value);if(Array.isArray(saved.groups)&&Array.isArray(saved.details)&&saved.groups.length===initial.groups.length&&saved.groups.every((g:{id_kategori:string})=>initial.groups.some(i=>i.id_kategori===g.id_kategori))&&Number.isFinite(saved.total_upah))setState(saved);}catch{/* Keep current input. */}}}/>
 <EditorFooter spk={spk} readOnly={readOnly}/>
 </form></section></KavioFormModal></>;
}
function EditorFooter({spk,readOnly}:{spk:boolean;readOnly:boolean}) {
 const {pending}=useFormStatus();
 return <KavioFormActions disabled={pending}>{!readOnly&&<>{!spk&&<button className="kavio-button secondary" name="publish" value="false" disabled={pending}>SIMPAN DRAFT</button>}<button className="kavio-button" name="publish" value="true" disabled={pending}>{pending?'MENYIMPAN…':spk?'SIMPAN KONFIGURASI':'SIMPAN & SIAP DIGUNAKAN'}</button></>}</KavioFormActions>;
}
