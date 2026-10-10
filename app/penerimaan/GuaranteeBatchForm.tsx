'use client';
import {useState} from 'react';
import KavioFormActions from '../components/KavioFormActions';
import {formatKavioMoney} from '../lib/number-format';
import {submitGuaranteeBatch} from './actions';
import type {Sale,Account} from './ReceiptEntryPanel';
export type Guarantee={id_bank_kpr?:string|null;id_jaminan:string;id_sales:string;jenis_item:string;nominal_tagihan:number|string;status:string};
export type GuaranteeProps={sales:Sale[];items:Guarantee[];accounts:Account[];received:Record<string,number>};
export default function GuaranteeBatchForm({mode,sales,items,accounts,received,initialId,focus}:{mode:'PENGAJUAN'|'PENCAIRAN';initialId?:string;focus:string}&GuaranteeProps){
 const eligible=items.filter(g=>g.status===(mode==='PENGAJUAN'?'BELUM_DIAJUKAN':'DIAJUKAN_KE_BANK')&&Number(g.nominal_tagihan)>(received[g.id_jaminan]??0)&&sales.some(s=>s.id_sales===g.id_sales));
 const initial=eligible.find(g=>g.id_jaminan===initialId);
 const [bank,setBank]=useState(initial?.id_bank_kpr??'');
 const [selected,setSelected]=useState<Record<string,number>>(initial?{[initial.id_jaminan]:Number(initial.nominal_tagihan)-(received[initial.id_jaminan]??0)}:{});
 const rows=eligible.filter(g=>g.id_bank_kpr===bank);
 const chosen=rows.filter(g=>selected[g.id_jaminan]!==undefined);
 const invalid=chosen.some(g=>!Number.isFinite(selected[g.id_jaminan])||selected[g.id_jaminan]<=0||selected[g.id_jaminan]>Number(g.nominal_tagihan)-(received[g.id_jaminan]??0));
 const total=chosen.reduce((sum,g)=>sum+selected[g.id_jaminan],0);
 const toggle=(g:Guarantee,checked:boolean)=>setSelected(current=>{const next={...current};if(checked)next[g.id_jaminan]=Number(g.nominal_tagihan)-(received[g.id_jaminan]??0);else delete next[g.id_jaminan];return next;});
 return <form action={submitGuaranteeBatch} className="kavio-form collection-form">
 <input type="hidden" name="mode" value={mode}/><input type="hidden" name="focus" value={focus}/>

 <label className="kavio-field"><span>BANK KPR</span><select id={focus} name="id_bank_kpr" value={bank} required onChange={e=>{setBank(e.target.value);setSelected({});}}><option value="" disabled>PILIH BANK KPR</option>{accounts.filter(a=>eligible.some(g=>g.id_bank_kpr===a.id_bank)).map(a=><option key={a.id_bank} value={a.id_bank}>{a.nama_bank}</option>)}</select></label>
 <label className="kavio-field"><span>{mode==='PENGAJUAN'?'TANGGAL PENGAJUAN':'TANGGAL DITERIMA'}</span><input type="date" name="tanggal" required/></label>
 {mode==='PENCAIRAN'&&<><label className="kavio-field"><span>KAS / BANK TUJUAN</span><select name="id_bank_penerimaan" required defaultValue=""><option value="" disabled>PILIH KAS / BANK</option>{accounts.map(a=><option key={a.id_bank} value={a.id_bank}>{a.jenis_akun} · {a.nama_bank}</option>)}</select></label><label className="kavio-field"><span>METODE</span><select name="metode_penerimaan" defaultValue="TRANSFER">{['TUNAI','TRANSFER','GIRO','LAINNYA'].map(m=><option key={m}>{m}</option>)}</select></label><label className="kavio-field collection-wide"><span>NO. REFERENSI BANK</span><input name="no_referensi"/></label></>}
 <div className="kavio-guarantee-batch"><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th><input type="checkbox" aria-label="Pilih semua item" checked={rows.length>0&&chosen.length===rows.length} disabled={!rows.length} onChange={e=>setSelected(e.target.checked?Object.fromEntries(rows.map(g=>[g.id_jaminan,Number(g.nominal_tagihan)-(received[g.id_jaminan]??0)])): {})}/></th><th>KAVLING / KONSUMEN</th><th>ITEM JAMINAN</th><th className="kavio-number">SISA TAGIHAN</th>{mode==='PENCAIRAN'&&<th className="kavio-number">NOMINAL DICAIRKAN</th>}</tr></thead><tbody>{rows.map(g=>{const sale=sales.find(s=>s.id_sales===g.id_sales);const due=Number(g.nominal_tagihan)-(received[g.id_jaminan]??0);const checked=selected[g.id_jaminan]!==undefined;return <tr key={g.id_jaminan}><td><input type="checkbox" aria-label={`Pilih ${sale?.id_kavling} ${g.jenis_item}`} checked={checked} onChange={e=>toggle(g,e.target.checked)}/></td><td>{sale?.id_kavling} · {sale?.nama_konsumen}</td><td>{g.jenis_item.replaceAll('_',' & ')}</td><td className="kavio-number">{formatKavioMoney(due)}</td>{mode==='PENCAIRAN'&&<td><input type="number" aria-label={`Nominal ${sale?.id_kavling} ${g.jenis_item}`} disabled={!checked} required={checked} min="1" step="1" max={due} value={checked?selected[g.id_jaminan]:''} onChange={e=>setSelected({...selected,[g.id_jaminan]:Number(e.target.value)})}/></td>}</tr>;})}{!rows.length&&<tr><td colSpan={mode==='PENCAIRAN'?5:4} className="kavio-empty">{!eligible.length?(mode==='PENCAIRAN'?'Belum ada dana jaminan siap dicairkan. Ajukan ke bank terlebih dahulu.':'Belum ada dana jaminan yang perlu diajukan.'):'Pilih bank KPR untuk menampilkan item.'}</td></tr>}</tbody></table></div></div>
 <p className="collection-wide">{chosen.length} item dipilih · Total {mode==='PENGAJUAN'?'pengajuan':'pencairan'}: <strong>{formatKavioMoney(total)}</strong>. Dapat memilih item dari beberapa kavling pada bank KPR yang sama.</p>
 <label className="kavio-field collection-wide"><span>CATATAN</span><input name="keterangan"/></label>
 {invalid&&<div className="kavio-alert error collection-wide">Nominal setiap item harus positif dan tidak melebihi sisa tagihannya.</div>}
 <input type="hidden" name="items" data-kavio-persist-hidden="true" value={JSON.stringify(chosen.map(g=>({id_jaminan:g.id_jaminan,...(mode==='PENCAIRAN'?{nominal:selected[g.id_jaminan]}:{})})))} onInput={e=>{try{const saved=JSON.parse(e.currentTarget.value);if(Array.isArray(saved)){const first=eligible.find(g=>g.id_jaminan===saved[0]?.id_jaminan);if(first){setBank(first.id_bank_kpr??'');setSelected(Object.fromEntries(saved.filter(i=>eligible.some(g=>g.id_jaminan===i.id_jaminan&&g.id_bank_kpr===first.id_bank_kpr)).map(i=>[i.id_jaminan,Number(i.nominal??(Number(eligible.find(g=>g.id_jaminan===i.id_jaminan)?.nominal_tagihan)-(received[i.id_jaminan]??0)))])));}}}catch{/* Keep valid selection. */}}}/>
 <KavioFormActions><button type="submit" className="kavio-button" disabled={!chosen.length||invalid}>{mode==='PENGAJUAN'?'SIMPAN PENGAJUAN':'SIMPAN PENCAIRAN'}</button></KavioFormActions>
 </form>;
}
