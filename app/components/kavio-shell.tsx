import { getKavioRequestContext } from '../../lib/kavio-request-context';
import KavioShellClient from './kavio-shell-client';

export default async function KavioShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const {
    userEmail: initialUserEmail,
    role: initialRole,
    actions: initialActions,
    accessReady,
  } = await getKavioRequestContext();

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
