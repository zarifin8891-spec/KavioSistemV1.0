import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/server';
import {readAllReportRows} from '../../../lib/report-data';
import {formatKavioDate} from '../../../lib/date-format';
import KavioActionGate from '../../../components/KavioActionGate';
import KavioDataTable from '../../../components/KavioDataTable';
import KavioFormModal from '../../../components/KavioFormModal';
import KavioReportActions from '../../../components/KavioReportActions';
import KavioTableTotals from '../../../components/KavioTableTotals';
import {formatKavioMoney} from '../../../lib/number-format';
import MaterialRabReport from '../../../laporan/MaterialRabReport';
import MaterialPlanEditor,{type RabReference} from './MaterialPlanEditor';
export default async function SpkMaterialPlanPage({searchParams}:{searchParams:Promise<{id?:string;revisi?:string;error?:string;success?:string}>}) {
 const params=await searchParams;if(!params.id||!/^[\da-f-]{36}$/i.test(params.id))notFound();
 const db=await createClient();
 const {data:spk,error}=await db.from('spk').select('id_spk,jenis_spk,id_kavling,nama_objek,id_tipe,status_spk').eq('id_spk',params.id).maybeSingle();
 if(error)throw Error(error.message);if(!spk)notFound();
 const [history,materials,templates]=await Promise.all([
  readAllReportRows(db.from('spk_material_plan').select('*').eq('id_spk',spk.id_spk).order('revisi',{ascending:false})),
  readAllReportRows(db.from('master_material').select('id_material,nama_material,satuan,status_aktif').neq('jenis_item','UPAH').order('nama_material').order('id_material')),
  spk.id_tipe?readAllReportRows(db.from('rab_template').select('id_rab,nama_template,versi').eq('id_tipe',spk.id_tipe).eq('status_aktif',true).order('created_at',{ascending:false}).order('id_rab')):Promise.resolve([]),
 ]);
 const latest=history[0]??null;
 const selectedRevision=history.find(h=>String(h.revisi)===params.revisi);
 const [planItems,referenceItems,oldItems]=await Promise.all([
  latest?readAllReportRows(db.from('spk_material_plan_item').select('id_material,volume,harga_standar').eq('id_plan',latest.id_plan).order('urutan')):Promise.resolve([]),
  templates.length?readAllReportRows(db.from('rab_template_item').select('id_rab,id_material,volume,harga_standar,urutan').in('id_rab',templates.map(r=>r.id_rab)).order('id_rab').order('urutan')):Promise.resolve([]),
  selectedRevision?readAllReportRows(db.from('spk_material_plan_item').select('id_material,nama_snapshot,satuan_snapshot,volume,harga_standar').eq('id_plan',selectedRevision.id_plan).order('urutan')):Promise.resolve([]),
 ]);
 const materialIds=new Set(materials.filter(m=>m.status_aktif).map(m=>m.id_material));
 const references:RabReference[]=templates.map(r=>({...r,items:referenceItems.filter(i=>i.id_rab===r.id_rab&&materialIds.has(i.id_material)).map(i=>({id_material:i.id_material,jumlah:Number(i.volume),harga_satuan:Number(i.harga_standar)}))}));
 const oldTotal=oldItems.reduce((sum,i)=>sum+Math.round(Number(i.volume)*Number(i.harga_standar)*100)/100,0);
 return <main className="kavio-page-stack">
 {(params.error||params.success)&&<div className={'kavio-alert '+(params.error?'error':'success')}>{params.error??params.success}</div>}
 <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">RAB SPK · {spk.jenis_spk} · {spk.id_kavling??spk.nama_objek}</h2><p className="kavio-panel-note">{latest?'Revisi '+latest.revisi+' · '+latest.nama_sumber+' · '+formatKavioDate(latest.dibuat_pada):'RAB material belum ditetapkan.'}</p></div><div className="kavio-actions"><Link href="/master/spk" className="kavio-button secondary">KEMBALI</Link>{spk.status_spk!=='SELESAI'&&<KavioActionGate action="SPK_WRITE"><MaterialPlanEditor key={latest?.id_plan??'new'} id={spk.id_spk} revision={latest?.revisi??0} source={latest?.id_rab??null} initial={planItems.map(i=>({id_material:i.id_material,jumlah:Number(i.volume),harga_satuan:Number(i.harga_standar)}))} materials={materials.filter(m=>m.status_aktif)} references={references}/></KavioActionGate>}</div></div></section>
 <MaterialRabReport spks={[spk]} initialSpk={spk.id_spk} fixed revisionKey={latest?.id_plan??''}/>
 {history.length>0&&<section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">RIWAYAT RAB MATERIAL</h2></div><KavioDataTable label="Riwayat RAB" columns={[{key:'revision',label:'REVISI',width:'8%'},{key:'date',label:'DITETAPKAN',width:'15%'},{key:'source',label:'SUMBER',width:'32%'},{key:'reason',label:'ALASAN',width:'45%'}]}>{history.map(h=><tr key={h.id_plan}><td><Link href={'/master/spk/rab?id='+spk.id_spk+'&revisi='+h.revisi}>{h.revisi}</Link></td><td>{formatKavioDate(h.dibuat_pada)}</td><td>{h.nama_sumber} {h.versi_sumber}</td><td>{h.alasan}</td></tr>)}</KavioDataTable></section>}
 {selectedRevision&&<KavioFormModal open closeHref={'/master/spk/rab?id='+spk.id_spk} ariaLabel={'RAB Revisi '+selectedRevision.revisi}><section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">RAB MATERIAL · REVISI {selectedRevision.revisi}</h2><p className="kavio-panel-note">{selectedRevision.nama_sumber} · {selectedRevision.alasan}</p></div><KavioReportActions title={'RAB Material Revisi '+selectedRevision.revisi} meta={spk.jenis_spk+' · '+(spk.id_kavling??spk.nama_objek)} headers={['MATERIAL','VOLUME','SATUAN','HARGA STANDAR','NILAI RAB']} rows={oldItems.map(i=>[i.nama_snapshot,Number(i.volume),i.satuan_snapshot,Number(i.harga_standar),Math.round(Number(i.volume)*Number(i.harga_standar)*100)/100])} totals={[{label:'TOTAL RAB',value:oldTotal}]} totalColumns={[4]}/></div><KavioDataTable label="Snapshot revisi RAB" footer={<KavioTableTotals columns={5} totals={[{label:'TOTAL RAB',value:oldTotal,column:4}]}/>} columns={[{key:'material',label:'MATERIAL'},{key:'qty',label:'VOLUME',align:'right'},{key:'unit',label:'SATUAN'},{key:'price',label:'HARGA STANDAR',align:'right'},{key:'value',label:'NILAI RAB',align:'right'}]}>{oldItems.map(i=><tr key={i.id_material}><td>{i.nama_snapshot}</td><td className="kavio-number">{Number(i.volume).toLocaleString('id-ID',{maximumFractionDigits:4})}</td><td>{i.satuan_snapshot}</td><td className="kavio-number">{formatKavioMoney(i.harga_standar)}</td><td className="kavio-number">{formatKavioMoney(Number(i.volume)*Number(i.harga_standar),2)}</td></tr>)}</KavioDataTable></section></KavioFormModal>}
 </main>;
}

