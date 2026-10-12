'use client';
import {useState} from 'react';
import KavioTransactionModal from '../../../components/KavioTransactionModal';
import KavioFormActions from '../../../components/KavioFormActions';
import KavioFilterBar,{KavioFilterField,KavioFilterActions} from '../../../components/KavioFilterBar';
import KavioMaterialLines,{type MaterialChoice,type MaterialLine} from '../../../components/KavioMaterialLines';
import {saveSpkMaterialPlan} from './actions';
export type RabReference={id_rab:string;nama_template:string;versi:string;items:MaterialLine[]};
export default function MaterialPlanEditor({id,revision,source,initial,materials,references}:{id:string;revision:number;source:string|null;initial:MaterialLine[];materials:MaterialChoice[];references:RabReference[]}) {
 const [reference,setReference]=useState(source??''),[loadedSource,setLoadedSource]=useState(source??''),[lines,setLines]=useState(initial),[generation,setGeneration]=useState(0);
 return <KavioTransactionModal title={revision?'Revisi RAB Material':'Isi RAB Material'} focusIds={['rab_plan']}><form action={saveSpkMaterialPlan} className="kavio-panel-body kavio-form kavio-transaction-form">
 <input type="hidden" name="id_spk" value={id}/><input type="hidden" name="revisi" value={revision}/><input type="hidden" name="id_rab" value={loadedSource} data-kavio-persist-hidden="true" onInput={e=>setLoadedSource(e.currentTarget.value)}/>
 {references.length>0&&<div className="kavio-field-wide"><KavioFilterBar><KavioFilterField label="RAB STANDAR" kind="select"><select value={reference} onChange={e=>setReference(e.target.value)}><option value="">PILIH RAB STANDAR</option>{references.map(r=><option key={r.id_rab} value={r.id_rab}>{r.nama_template} · {r.versi}</option>)}</select></KavioFilterField><KavioFilterActions><button className="kavio-button secondary" type="button" disabled={!reference} onClick={()=>{const r=references.find(r=>r.id_rab===reference);if(r){setLines(r.items);setLoadedSource(r.id_rab);setGeneration(n=>n+1);}}}>MUAT RAB STANDAR</button></KavioFilterActions></KavioFilterBar></div>}
 <div className="kavio-field-wide"><button className="kavio-button secondary" type="button" onClick={()=>setLoadedSource('')}>GUNAKAN RAB CUSTOM</button></div>
 <label className="kavio-field kavio-field-wide"><span>ALASAN PENETAPAN / REVISI</span><input name="alasan" id="rab_plan" required maxLength={500} placeholder={revision?'Alasan perubahan rencana material':'Dasar penetapan RAB SPK'}/></label>
 <div className="kavio-table-wrap kavio-field-wide" style={{maxHeight:'55vh',overflowY:'auto'}}><KavioMaterialLines key={generation} materials={materials} initial={lines.length?lines:undefined} withPrice allowZero quantityStep="0.0001" quantityLabel="VOLUME RAB" totalLabel="TOTAL RAB MATERIAL"/></div>
 <p className="kavio-field-wide kavio-panel-note">Upah terpisah. Volume nol diperbolehkan. Setiap penyimpanan membuat revisi baru; riwayat sebelumnya tetap tersimpan.</p>
 <KavioFormActions><button className="kavio-button" type="submit">SIMPAN RAB</button></KavioFormActions>
 </form></KavioTransactionModal>;
}

