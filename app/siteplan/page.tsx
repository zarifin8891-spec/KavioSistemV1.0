import KavioShell from '../components/kavio-shell';
import { createClient } from '../../lib/supabase/server';
import SiteplanClient from './SiteplanClient';

export default async function SiteplanPage() {
  const supabase = await createClient();

  // Stage 1: load independent page foundations in parallel.
  const [{ data: kavlings }, { data: tipeRumah }, { data: activeSiteplan }] = await Promise.all([
    supabase
      .from('master_kavling')
      .select('id_kavling,blok,no_kavling,id_tipe,status_kavling,status_aktif,luas_tanah_standar,luas_tanah_real,kelebihan_tanah,harga_standar,harga_tanah_meter,harga_jual')
      .order('blok')
      .order('no_kavling'),
    supabase
      .from('master_tipe_rumah')
      .select('id_tipe,nama_tipe')
      .eq('status_aktif', true)
      .order('nama_tipe'),
    supabase
      .from('siteplan_versions')
      .select('id,nama_siteplan,versi,file_name,file_path,mime_type,file_size,image_width,image_height,is_active,activated_at')
      .eq('is_active', true)
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const tipeMap = new Map((tipeRumah ?? []).map((row) => [row.id_tipe, row.nama_tipe]));
  const kavlingRows = (kavlings ?? []).map((row) => ({
    ...row,
    nama_tipe: tipeMap.get(row.id_tipe) ?? row.id_tipe,
  }));
  const ids = kavlingRows.map((row) => row.id_kavling);

  const mappingPromise = ids.length
    ? (() => {
        let query = supabase
          .from('siteplan_kavling_mapping')
          .select('id_kavling,polygon,label,siteplan_version_id')
          .in('id_kavling', ids);
        if (activeSiteplan?.id) query = query.eq('siteplan_version_id', activeSiteplan.id);
        return query;
      })()
    : Promise.resolve({ data: [] as any[] });

  const signedUrlPromise = activeSiteplan?.id && activeSiteplan.file_path
    ? supabase.storage.from('siteplans').createSignedUrl(activeSiteplan.file_path, 3600)
    : Promise.resolve({ data: null, error: null });

  // Stage 2 critical path: only mapping + image URL block the first Siteplan paint.
  // Sales/SPK detail is deliberately loaded after the image is visible so it
  // cannot delay or compete with the Siteplan image request.
  const [{ data: savedMappings }, signedSiteplan] = await Promise.all([
    mappingPromise,
    signedUrlPromise,
  ]);

  let siteplanSrc = '/siteplan/siteplan-clean-source.png';
  if (!signedSiteplan.error && signedSiteplan.data?.signedUrl) {
    siteplanSrc = signedSiteplan.data.signedUrl;
  }

  return (
    <KavioShell>
      <SiteplanClient
        kavlings={kavlingRows}
        savedMappings={(savedMappings ?? []) as { id_kavling: string; polygon: [number, number][]; label?: [number, number] | null; siteplan_version_id?: string | null }[]}
        activeSiteplan={activeSiteplan ? {
          id: activeSiteplan.id,
          nama_siteplan: activeSiteplan.nama_siteplan,
          versi: activeSiteplan.versi,
          file_name: activeSiteplan.file_name,
          file_path: activeSiteplan.file_path,
          image_width: activeSiteplan.image_width,
          image_height: activeSiteplan.image_height,
        } : null}
        siteplanSrc={siteplanSrc}
      />
    </KavioShell>
  );
}
