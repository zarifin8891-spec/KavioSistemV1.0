'use client';

import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { KavioAction } from '../../lib/kavio-permissions';

type PermissionContextValue = {
  ready: boolean;
  canAction: (action: KavioAction | string) => boolean;
};

const KavioPermissionContext = createContext<PermissionContextValue>({
  ready: false,
  canAction: () => false,
});

export function KavioPermissionProvider({
  actions,
  ready,
  children,
}: {
  actions: readonly string[];
  ready: boolean;
  children: ReactNode;
}) {
  const actionSet = useMemo(() => new Set(actions), [actions]);
  const value = useMemo<PermissionContextValue>(
    () => ({
      ready,
      canAction: (action) => actionSet.has(action),
    }),
    [actionSet, ready],
  );

  return (
    <KavioPermissionContext.Provider value={value}>
      {children}
    </KavioPermissionContext.Provider>
  );
}

export function useKavioPermissions() {
  return useContext(KavioPermissionContext);
}
