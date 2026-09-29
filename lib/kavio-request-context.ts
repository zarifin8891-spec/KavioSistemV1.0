import { headers } from 'next/headers';
import { normalizeRole, type KavioAction } from './kavio-permissions';

export async function getKavioRequestContext() {
  const requestHeaders = await headers();
  const actions = (requestHeaders.get('x-kavio-actions') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    userEmail: requestHeaders.get('x-kavio-user-email') ?? '',
    role: normalizeRole(requestHeaders.get('x-kavio-role')),
    actions,
    accessReady: requestHeaders.get('x-kavio-access-ready') === '1',
    canAction(action: KavioAction) {
      return actions.includes(action);
    },
  };
}
