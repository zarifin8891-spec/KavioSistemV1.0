import { redirect } from 'next/navigation';
import KavioShell from '../components/kavio-shell';
import { createClient } from '../../lib/supabase/server';
import SiteplanClient from './SiteplanClient';

export default async function SiteplanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: kavlings } = await supabase
    .from('master_kavling')
    .select('id_kavling,blok,no_kavling,id_tipe,status_kavling,status_aktif,luas_tanah_standar,luas_tanah_real,kelebihan_tanah,harga_standar,harga_tanah_meter,harga_jual')
    .order('blok')
    .order('no_kavling');

  const ids = (kavlings ?? []).map((row) => row.id_kavling);

  const [{ data: sales }, { data: spks }] = await Promise.all([
    ids.length
      ? supabase
          .from('sales')
          .select('id_sales,id_kavling,nama_konsumen,status_sales,jenis_pembayaran,harga_jual,tgl_booking,target_akad,tgl_akad,id_bank,id_notaris')
          .in('id_kavling', ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from('spk')
          .select('id_spk,id_kavling,tgl_spk,id_tipe,jenis_bobot,id_kantor,id_mandor,status_spk,tgl_target_selesai,is_active')
          .in('id_kavling', ids)
          .eq('is_active', true)
      : Promise.resolve({ data: [] }),
  ]);

  const { data: activeSiteplan } = await supabase
    .from('siteplan_versions')
    .select('id,nama_siteplan,versi,file_name,file_path,mime_type,file_size,image_width,image_height,is_active,activated_at')
    .eq('is_active', true)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let siteplanSrc = '/siteplan/siteplan-clean-source.png';
  if (activeSiteplan?.file_path) {
    const { data: signed } = await supabase.storage
      .from('siteplans')
      .createSignedUrl(activeSiteplan.file_path, 3600);
    if (signed?.signedUrl) siteplanSrc = signed.signedUrl;
  }

  let mappingQuery = supabase
    .from('siteplan_kavling_mapping')
    .select('id_kavling,polygon,label,siteplan_version_id')
    .in('id_kavling', ids);
  if (activeSiteplan?.id) {
    mappingQuery = mappingQuery.eq('siteplan_version_id', activeSiteplan.id);
  }
  const { data: savedMappings } = await mappingQuery;

  const spkIds = (spks ?? []).map((row) => row.id_spk);
  const { data: progressUpdates } = spkIds.length
    ? await supabase
        .from('progress_update')
        .select('id_progress,id_spk,tanggal_update,id_kategori,progress_periode,keterangan')
        .in('id_spk', spkIds)
        .order('tanggal_update', { ascending: false })
    : { data: [] };

  return (
    <KavioShell>
      <SiteplanClient
        kavlings={kavlings ?? []}
        sales={sales ?? []}
        spks={spks ?? []}
        progressUpdates={progressUpdates ?? []}
        savedMappings={(savedMappings ?? []) as { id_kavling: string; polygon: [number, number][]; label?: [number, number] | null; siteplan_version_id?: string | null }[]}
        activeSiteplan={activeSiteplan ? {
          id: activeSiteplan.id,
          nama_siteplan: activeSiteplan.nama_siteplan,
          versi: activeSiteplan.versi,
          file_name: activeSiteplan.file_name,
          image_width: activeSiteplan.image_width,
          image_height: activeSiteplan.image_height,
        } : null}
        siteplanSrc={siteplanSrc}
      />
    </KavioShell>
  );
}
