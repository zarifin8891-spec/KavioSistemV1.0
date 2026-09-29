import { headers } from 'next/headers';
import { normalizeRole } from '../../lib/kavio-permissions';
import KavioShellClient from './kavio-shell-client';

export default async function KavioShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const requestHeaders = await headers();
  const initialUserEmail = requestHeaders.get('x-kavio-user-email') ?? '';
  const initialRole = normalizeRole(requestHeaders.get('x-kavio-role'));
  const initialActions = (requestHeaders.get('x-kavio-actions') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const accessReady = requestHeaders.get('x-kavio-access-ready') === '1';

  return (
    <KavioShellClient
      active={active}
      initialUserEmail={initialUserEmail}
      initialRole={initialRole}
      initialActions={initialActions}
      accessReady={accessReady}
    >
      {children}
    </KavioShellClient>
  );
}
