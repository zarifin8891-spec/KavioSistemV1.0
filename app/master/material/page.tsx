import { createClient } from '../../../lib/supabase/server';
import '../../material/material.css';
import KavioFormModal from '../../components/KavioFormModal';
import KavioActionGate from '../../components/KavioActionGate';
import MaterialForm from './MaterialForm';
import MaterialCatalog from './MaterialCatalog';

export default async function MasterMaterialPage({searchParams}:{searchParams:Promise<{edit?:string;error?:string;success?:string}>}) {
  const params=await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from('master_material').select('id_material,kode_referensi,nama_material,kategori,satuan,jenis_item').eq('status_aktif', true).neq('jenis_item', 'UPAH').order('nama_material');
  const edit=data?.find(row=>row.id_material===params.edit);
  return <main className="master-simple-page">{params.error&&<div className="kavio-alert error">{params.error}</div>}{params.success&&<div className="kavio-alert success">{params.success}</div>}{error && <div className="kavio-alert error">{error.message}</div>}<MaterialCatalog materials={data ?? []} />{edit&&<KavioActionGate action="MATERIAL_CATALOG_WRITE"><KavioFormModal open closeHref="/master/material" ariaLabel="Edit Material" persistenceKey={`material-edit:${edit.id_material}`}><section className="kavio-panel"><div className="kavio-panel-head"><h2>EDIT MATERIAL</h2></div><MaterialForm row={edit}/></section></KavioFormModal></KavioActionGate>}</main>;
}
