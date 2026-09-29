import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { KavioAction } from './kavio-permissions';

export async function requireKavioAction(
  action: KavioAction,
  deniedPath = '/dashboard?akses=ditolak',
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc('kavio_can_action', {
    p_action: action,
  });

  if (error || data !== true) {
    redirect(deniedPath);
  }

  return user;
}
