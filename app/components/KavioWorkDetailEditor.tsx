'use client';
import {useEffect,useRef,useState} from 'react';
import KavioPercentInput from './KavioPercentInput';
import KavioMoneyInput from './KavioMoneyInput';
import {useSearchParams} from 'next/navigation';
import {useFormStatus} from 'react-dom';
import KavioFormModal from './KavioFormModal';
import KavioFormActions from './KavioFormActions';
import {WorkEditorState,WorkDetail,weightUnits,workTotalPercent,workWeightIssues,workPercent,workItemWage} from '../lib/work-detail';
import {t36WorkReference} from '../lib/t36-work-reference';

export default function KavioWorkDetailEditor({initial,action,identifier,spk=false,mandors=[],defaultMandor='',reference,autoOpen=false,readOnly=false}:{
 initial:WorkEditorState;action:(form:FormData)=>Promise<void>;identifier:string;spk?:boolean;
 mandors?:{id_mandor:string;nama_mandor:string}[];defaultMandor?:string;
 reference?:WorkDetail[];autoOpen?:boolean;readOnly?:boolean;
}) {
 const [open,setOpen]=useState(autoOpen),[state,setState]=useState(initial);
 const [notice,setNotice]=useState('');
 const [activeId,setActiveId]=useState(initial.groups[0]?.id_kategori??'');
 const formRef=useRef<HTMLFormElement>(null);
 const [focusTarget,setFocusTarget]=useState<{index:number;label:string}|null>(null);
 useEffect(()=>{if(!focusTarget)return;const row=formRef.current?.querySelector(`[data-work-line-index="${focusTarget.index}"]`);const field=Array.from(row?.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select')??[]).find(el=>el.getAttribute('aria-label')===focusTarget.label);if(field){field.id='kavio-work-invalid-field';field.focus({preventScroll:true});}field?.scrollIntoView({block:'nearest',inline:'nearest'});},[focusTarget,activeId]);
 const params=useSearchParams(),success=params.get('success'),error=params.get('error');
 useEffect(()=>{if(success&&!error){setOpen(false);setState(initial);setNotice('');}},[success,error,initial]);
 const showSaveError=(message:string)=>{setNotice(message);window.dispatchEvent(new CustomEvent('kavio-message',{detail:{tone:'error',message,focusTarget:'kavio-work-invalid-field'}}));};
 const details=state.details.map((d,index)=>({...d,key:index}));
 const update=(index:number,patch:Partial<WorkDetail>)=>setState(s=>({...s,details:s.details.map((d,i)=>i===index?{...d,...patch}:d)}));
 const detailMode=!spk||state.mode==='PERINCIAN';
 const issues=workWeightIssues(state.groups,state.details);
 const total=workTotalPercent(state.groups);
 const preset=()=>{setState(s=>({...s,total_upah:15569000,details:t36WorkReference,groups:s.groups.map(g=>({...g,bobot:t36WorkReference.filter(d=>d.group_id===g.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0)/1000000}))}));setNotice('Contoh PDF dimuat untuk ditinjau. Total bobot sumber 99,9964% dibulatkan menjadi 100,00%. Dua satuan kosong perlu diisi. Satuan lain mengikuti PDF, mohon diperiksa sebelum digunakan.');};
 return <>
 <button className="kavio-button secondary" type="button" onClick={()=>setOpen(true)}>{readOnly?'LIHAT KONFIGURASI':spk?'KONFIGURASI PEKERJAAN':'EDIT PERINCIAN'}</button>
 <KavioFormModal open={open} onClose={()=>setOpen(false)} size={spk?'wide':'standard'} className="work-editor-modal" ariaLabel={spk?'Konfigurasi Pekerjaan SPK':'Master Perincian Pekerjaan'} persistenceKey={`work-detail:${identifier}`} closeOnBackdrop={false}>
 <section className="kavio-panel work-detail-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">{spk?'KONFIGURASI PEKERJAAN SPK':'MASTER PERINCIAN PEKERJAAN'}</h2><p className="kavio-panel-note">Bobot item terhadap seluruh SPK. Total upah item dibulatkan ke ratusan rupiah.</p></div><span className="kavio-badge">TOTAL {total.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}%</span></div>
 <form ref={formRef} noValidate action={action} className="kavio-panel-body" onSubmit={event=>{
  if(readOnly)return;
  if(!Number.isFinite(state.total_upah)||state.total_upah<0){event.preventDefault();showSaveError('Total upah borongan harus berupa angka minimal 0.');formRef.current?.querySelector<HTMLInputElement>('[aria-label="Total upah borongan"]')?.focus();return;}
  const invalidIndex=detailMode?state.details.findIndex(d=>!d.nama_pekerjaan.trim()||!d.satuan.trim()||!Number.isFinite(d.volume)||d.volume<=0||!Number.isFinite(d.bobot)||d.bobot<=0||d.bobot>1||(spk&&!d.id_mandor&&!defaultMandor)):-1;
  if(invalidIndex>=0){
   event.preventDefault();const d=state.details[invalidIndex];
   const field=!d.nama_pekerjaan.trim()?'Nama pekerjaan':!d.satuan.trim()?'Satuan':!Number.isFinite(d.volume)||d.volume<=0?'Volume':!Number.isFinite(d.bobot)||d.bobot<=0||d.bobot>1?'Bobot':'Mandor';
   setActiveId(d.group_id);setFocusTarget({index:invalidIndex,label:field==='Nama pekerjaan'?field:`${field} ${d.nama_pekerjaan}`});
   showSaveError(`Belum disimpan: lengkapi ${field.toLowerCase()} pada item "${d.nama_pekerjaan||'Item '+(invalidIndex+1)}" (${state.groups.find(g=>g.id_kategori===d.group_id)?.nama_kategori??'kategori pekerjaan'}).`);return;
  }
  const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  if((spk||submitter?.value==='true')&&((detailMode&&issues.length>0)||total!==100)){
   event.preventDefault();
   const mismatch=state.groups.find(g=>state.details.filter(d=>d.group_id===g.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0)!==weightUnits(g.bobot));
   if(mismatch&&detailMode)setActiveId(mismatch.id_kategori);
   showSaveError(total!==100?`Total bobot setelah pembulatan ${total.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}%. Total kategori harus 100,00% sebelum Siap Digunakan. Simpan Draft dapat digunakan sementara.`:issues.join(' '));
  }
 }}>
 {error&&<div className="kavio-alert error" role="alert">{error}</div>}
 <input type="hidden" name={spk?'id_spk':'id_tipe'} value={identifier}/>
 <fieldset disabled={readOnly} className="work-detail-fields">
 <div className="kavio-form work-detail-settings"><label className="kavio-field work-wage-field"><span>TOTAL UPAH BORONGAN (RP)</span><KavioMoneyInput label="Total upah borongan" value={state.total_upah} onChange={value=>setState(s=>({...s,total_upah:value}))}/></label>
 {spk&&<label className="kavio-field"><span>CARA INPUT PROGRESS</span><select value={state.mode} aria-label="Cara input progress" onChange={e=>setState(s=>({...s,mode:e.target.value}))}><option value="KATEGORI">Per Kategori</option><option value="PERINCIAN">Dengan Perincian</option></select></label>}
 <div className="work-detail-tools">{!spk&&identifier==='T36'&&<button type="button" className="kavio-button secondary" onClick={preset}>MUAT CONTOH T36</button>}{spk&&reference&&reference.length>0&&detailMode&&<button className="kavio-button secondary" type="button" onClick={()=>{setState(s=>({...s,details:reference.map(d=>({...d,id_mandor:defaultMandor}))}));setNotice('Perincian master disalin. Periksa bobot custom dan penugasan mandor sebelum menyimpan.');}}>SALIN PERINCIAN MASTER</button>}</div></div>
 {notice&&<div className="kavio-alert" role="alert">{notice}</div>}
 {spk&&detailMode&&<p className="kavio-panel-note">Konfigurasi dapat disimpan sebagai draft. Aktivasi menyusul setelah fitur input progress perincian tersedia.</p>}
 </fieldset>
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
 return <div key={group.id_kategori} className="work-detail-fields work-selected-category" role="group" aria-label={group.nama_kategori}>{spk&&<div className="work-detail-group-head"><div><h3>{group.nama_kategori}</h3><p className="kavio-panel-note">{lines.length} item pekerjaan</p></div><label className="kavio-field"><span>BOBOT KATEGORI (%)</span><KavioPercentInput disabled={readOnly} label={`Bobot kategori ${group.nama_kategori}`} value={group.bobot*100} onChange={value=>setState(s=>({...s,groups:s.groups.map(g=>g.id_kategori===group.id_kategori?{...g,bobot:weightUnits(value/100)/1000000}:g)}))}/></label></div>}
 {detailMode&&<><div className={`work-weight-summary ${valid?'is-valid':'is-pending'}`} role="status"><span>TOTAL BOBOT ITEM <strong>{workPercent(sum/1000000)}%</strong></span><span>{valid?'Bobot sesuai':`Selisih ${delta<.0001?'< 0,01':workPercent(delta)}%`}</span></div>
 <div className="work-input-table"><table className={`kavio-table kavio-input-table ${spk?'has-mandor':''}`}><thead><tr><th>NAMA PEKERJAAN</th><th>VOLUME</th><th>SATUAN</th><th>BOBOT (%)</th><th>RETENSI</th>{spk&&<th>MANDOR</th>}<th className="work-detail-money">TOTAL UPAH</th><th className="work-detail-money">HARGA SATUAN</th><th>AKSI</th></tr></thead><tbody>{lines.map((d,index)=><tr key={d.key} data-work-line-index={d.key}>
 <td><label className="kavio-field"><input disabled={readOnly} aria-label="Nama pekerjaan" value={d.nama_pekerjaan} maxLength={200} placeholder="Nama item pekerjaan" onChange={e=>update(d.key,{nama_pekerjaan:e.target.value})} required/></label></td>
 <td><label className="kavio-field"><input disabled={readOnly} aria-label={`Volume ${d.nama_pekerjaan}`} type="number" min="0.0001" step="0.0001" value={d.volume||''} placeholder="0" onChange={e=>update(d.key,{volume:Number(e.target.value)})} required/></label></td>
 <td><label className="kavio-field"><input disabled={readOnly} aria-label={`Satuan ${d.nama_pekerjaan}`} value={d.satuan} maxLength={30} placeholder="Satuan" onChange={e=>update(d.key,{satuan:e.target.value})} required/></label></td>
 <td><label className="kavio-field"><KavioPercentInput disabled={readOnly} label={`Bobot ${d.nama_pekerjaan}`} min={.0001} value={d.bobot*100} onChange={value=>update(d.key,{bobot:weightUnits(value/100)/1000000})}/></label></td>
 <td><label className="kavio-field"><select disabled={readOnly} aria-label={`Retensi ${d.nama_pekerjaan}`} value={d.retensi} onChange={e=>update(d.key,{retensi:Number(e.target.value)})}><option value={.05}>5%</option><option value={0}>Tanpa retensi</option></select></label></td>
 {spk&&<td><label className="kavio-field"><select disabled={readOnly} aria-label={`Mandor ${d.nama_pekerjaan}`} value={d.id_mandor??defaultMandor} onChange={e=>update(d.key,{id_mandor:e.target.value})} required><option value="">Pilih mandor</option>{mandors.map(m=><option key={m.id_mandor} value={m.id_mandor}>{m.nama_mandor}</option>)}</select></label></td>}
 <td className="work-detail-money">{workItemWage(d.bobot,state.total_upah).toLocaleString('id-ID',{maximumFractionDigits:0})}</td><td className="work-detail-money">{d.volume>0?(workItemWage(d.bobot,state.total_upah)/d.volume).toLocaleString('id-ID',{maximumFractionDigits:0}):'—'}</td>
 <td><button disabled={readOnly} type="button" className="kavio-button secondary" aria-label={`Hapus ${d.nama_pekerjaan||'item '+(index+1)}`} onClick={()=>setState(s=>({...s,details:s.details.filter((_,i)=>i!==d.key)}))}>HAPUS</button></td>
 </tr>)}</tbody></table></div>
 {!lines.length&&<div className="work-item-empty">Belum ada item pekerjaan. Klik Tambah Item untuk mengisi.</div>}
 <button disabled={readOnly} type="button" className="kavio-button secondary work-add-item" onClick={()=>setState(s=>({...s,details:[...s.details,{group_id:group.id_kategori,urutan:lines.length+1,nama_pekerjaan:'',volume:0,satuan:'',bobot:0,retensi:.05,...(spk?{id_mandor:defaultMandor}:{})}]}))}>+ TAMBAH ITEM</button></>}
 </div>;
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
