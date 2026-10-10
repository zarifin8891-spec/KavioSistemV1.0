import { createClient } from '../../../lib/supabase/server';
import '../../material/material.css';
import MaterialCatalog from './MaterialCatalog';

export default async function MasterMaterialPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('master_material').select('id_material,kode_referensi,nama_material,kategori,satuan,jenis_item').eq('status_aktif', true).order('nama_material');
  return <main className="master-simple-page">{error && <div className="kavio-alert error">{error.message}</div>}<MaterialCatalog materials={data ?? []} /></main>;
}
