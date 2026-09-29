'use client';

import { ReactNode } from 'react';
import type { KavioAction } from '../../lib/kavio-permissions';
import { useKavioPermissions } from './KavioPermissionContext';

export default function KavioActionGate({
  action,
  children,
  fallback = null,
}: {
  action: KavioAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { ready, canAction } = useKavioPermissions();

  if (!ready) return null;
  return canAction(action) ? <>{children}</> : <>{fallback}</>;
}
