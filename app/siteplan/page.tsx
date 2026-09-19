import { redirect } from 'next/navigation';
import KavioShell from '../components/kavio-shell';
import { createClient } from '../../lib/supabase/server';
import SiteplanClient from './SiteplanClient';

export default async function SiteplanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('master_kavling')
    .select('id_kavling,blok,no_kavling,status_kavling,id_tipe')
    .order('blok')
    .order('no_kavling')
    .limit(10);

  return (
    <KavioShell>
      <SiteplanClient kavlings={data ?? []} />
    </KavioShell>
  );
}
