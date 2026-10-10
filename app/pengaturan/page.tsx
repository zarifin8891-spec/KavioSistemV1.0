import {createClient} from '../../lib/supabase/server';
import {requireKavioAction} from '../../lib/kavio-permissions-server';
import KavioTransactionModal from '../components/KavioTransactionModal';
import KavioFormActions from '../components/KavioFormActions';
import {saveCompanySettings} from './actions';
export default async function SettingsPage({searchParams}:{searchParams:Promise<{error?:string;success?:string}>}) {
 await requireKavioAction('MASTER_WRITE');
 const params=await searchParams,supabase=await createClient();
 const {data,error}=await supabase.from('company_settings').select('nama_perusahaan,logo_data_url').eq('id',true).maybeSingle();
 return <main className="collection-page">{(params.error||error)&&<div className="kavio-alert error">{params.error||error?.message}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}
 <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">IDENTITAS PERUSAHAAN</h2><p className="kavio-panel-note">Nama dan logo perusahaan untuk header kuitansi.</p></div></div>
 <div className="kavio-panel-body">{data?.logo_data_url&&<img src={data.logo_data_url} alt="Logo perusahaan" style={{width:100,height:100,objectFit:'contain',background:'#fff',borderRadius:6}}/>}<p>{data?.nama_perusahaan??'Identitas perusahaan belum diisi.'}</p>
 <KavioTransactionModal title="Edit Pengaturan Perusahaan" focusIds={['company_name']}><form action={saveCompanySettings} className="kavio-form collection-form"><label className="kavio-field collection-wide"><span>NAMA PERUSAHAAN</span><input id="company_name" name="nama_perusahaan" defaultValue={data?.nama_perusahaan??''} maxLength={200} required/></label><label className="kavio-field collection-wide"><span>LOGO (PNG / JPG, MAKSIMAL 250 KB)</span><input name="logo" type="file" accept="image/png,image/jpeg"/></label><label className="kavio-field"><span><input type="checkbox" name="hapus_logo"/> HAPUS LOGO SAAT INI</span></label><KavioFormActions><button className="kavio-button" type="submit">SIMPAN</button></KavioFormActions></form></KavioTransactionModal>
 </div></section></main>;
}
