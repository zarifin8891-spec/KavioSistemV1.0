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
    .select('id_kavling,blok,no_kavling,status_kavling,id_tipe')
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

  const { data: savedMappings } = await supabase
    .from('siteplan_kavling_mapping')
    .select('id_kavling,polygon,label')
    .in('id_kavling', ids);

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
        savedMappings={(savedMappings ?? []) as { id_kavling: string; polygon: [number, number][]; label?: [number, number] | null }[]}
      />
    </KavioShell>
  );
}
