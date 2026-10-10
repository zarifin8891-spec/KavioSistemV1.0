import Link from 'next/link';
import {createClient} from '../../../lib/supabase/server';
import {requireKavioAction} from '../../../lib/kavio-permissions-server';
import KavioWorkDetailEditor from '../../components/KavioWorkDetailEditor';
import {workMoney} from '../../lib/work-detail';
import {saveWorkMaster} from './actions';
export default async function WorkMasterPage({searchParams}:{searchParams:Promise<{tipe?:string;edit?:string;error?:string;success?:string}>}) {
 await requireKavioAction('MASTER_WRITE');
 const params=await searchParams,supabase=await createClient();
 const results=await Promise.all([
  supabase.from('master_tipe_rumah').select('id_tipe,nama_tipe,total_upah_borongan,perincian_siap').eq('status_aktif',true).order('nama_tipe'),
  supabase.from('master_kategori_pekerjaan').select('id_kategori,nama_kategori,urutan').eq('status_aktif',true).order('urutan'),
 ]);
 const types=results[0].data??[],categories=results[1].data??[];
 const selected=types.find(t=>t.id_tipe===params.tipe)??types[0];
 const [templates,detailResult]=selected?await Promise.all([
  supabase.from('template_progress_tipe').select('id_kategori,bobot_standar').eq('id_tipe',selected.id_tipe),
  supabase.from('master_work_detail').select('id_kategori,urutan,nama_pekerjaan,volume,satuan,bobot,retensi').eq('id_tipe',selected.id_tipe).order('urutan'),
 ]):[{data:[],error:null},{data:[],error:null}];
 const groups=categories.map(c=>({id_kategori:c.id_kategori,nama_kategori:c.nama_kategori,bobot:Number(templates.data?.find(t=>t.id_kategori===c.id_kategori)?.bobot_standar??0)}));
 const details=(detailResult.data??[]).map(d=>({group_id:d.id_kategori,urutan:d.urutan,nama_pekerjaan:d.nama_pekerjaan,volume:Number(d.volume),satuan:d.satuan,bobot:Number(d.bobot),retensi:Number(d.retensi)}));
 const error=params.error??results.find(r=>r.error)?.error?.message??templates.error?.message??detailResult.error?.message;
 return <main className="master-simple-page">{error&&<div className="kavio-alert error">{error}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}
 <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PERINCIAN PEKERJAAN PER TIPE</h2><p className="kavio-panel-note">Master untuk SPK baru. Perubahan master tidak mengubah konfigurasi SPK yang telah disimpan.</p></div><Link className="kavio-button secondary" href="/master">DATA MASTER</Link></div>
 <div className="kavio-panel-body"><form className="kavio-form" method="get"><label className="kavio-field"><span>TIPE RUMAH</span><select name="tipe" defaultValue={selected?.id_tipe}>{types.map(t=><option key={t.id_tipe} value={t.id_tipe}>{t.nama_tipe}</option>)}</select></label><div className="kavio-actions"><button className="kavio-button secondary">TAMPILKAN</button></div></form>
 {selected&&<><div className="work-detail-summary"><span>TOTAL UPAH: <strong>{workMoney(Number(selected.total_upah_borongan))}</strong></span><span className="kavio-badge">{selected.perincian_siap?'SIAP DIGUNAKAN':'DRAFT'}</span><span>{details.length} ITEM</span><KavioWorkDetailEditor key={selected.id_tipe} identifier={selected.id_tipe} initial={{total_upah:Number(selected.total_upah_borongan),mode:'PERINCIAN',groups,details}} action={saveWorkMaster} autoOpen={params.edit==='1'}/></div>{!selected.perincian_siap&&<p className="kavio-panel-note">Lengkapi item dan bobot, lalu pilih Simpan & Siap Digunakan. Draft belum dapat menjadi referensi SPK.</p>}
 {groups.map(g=><section key={g.id_kategori} className="work-detail-group"><div className="work-detail-group-head"><h3>{g.nama_kategori}</h3><span>BOBOT KATEGORI: {(g.bobot*100).toLocaleString('id-ID',{maximumFractionDigits:4})}%</span></div><div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>PEKERJAAN</th><th>VOLUME</th><th>SATUAN</th><th>BOBOT (%)</th><th>RETENSI</th><th className="work-detail-money">TOTAL UPAH</th><th className="work-detail-money">HARGA SATUAN</th></tr></thead><tbody>{details.filter(d=>d.group_id===g.id_kategori).map(d=><tr key={d.urutan}><td>{d.nama_pekerjaan}</td><td>{d.volume.toLocaleString('id-ID')}</td><td>{d.satuan}</td><td>{(d.bobot*100).toLocaleString('id-ID',{maximumFractionDigits:4})}</td><td>{d.retensi===0?'Tanpa retensi':'5%'}</td><td className="work-detail-money">{workMoney(d.bobot*Number(selected.total_upah_borongan))}</td><td className="work-detail-money">{workMoney(d.bobot*Number(selected.total_upah_borongan)/d.volume)}</td></tr>)}{!details.some(d=>d.group_id===g.id_kategori)&&<tr><td className="kavio-empty" colSpan={7}>Belum ada perincian pekerjaan.</td></tr>}</tbody></table></div></section>)}</>}
 {!selected&&<div className="kavio-empty">Tambahkan tipe rumah terlebih dahulu.</div>}
 </div></section></main>;
}
