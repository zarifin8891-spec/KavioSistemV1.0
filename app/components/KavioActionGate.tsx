'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function KavioActionGate({
  action,
  children,
  fallback = null,
}: {
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    createClient()
      .rpc('kavio_can_action', { p_action: action })
      .then(({ data, error }) => {
        if (mounted) setAllowed(!error && data === true);
      });
    return () => { mounted = false; };
  }, [action]);

  if (allowed === true) return <>{children}</>;
  if (allowed === false) return <>{fallback}</>;
  return null;
}
