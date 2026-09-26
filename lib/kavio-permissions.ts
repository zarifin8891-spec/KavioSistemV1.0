export const KAVIO_ROLES = ['DIREKTUR', 'ADMIN', 'MARKETING', 'PELAKSANA', 'USER'] as const;
export type KavioRole = typeof KAVIO_ROLES[number];

export const ROLE_MENU_ACCESS: Record<KavioRole, string[]> = {
  DIREKTUR: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan', '/manajemen-user'],
  ADMIN: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan', '/manajemen-user'],
  MARKETING: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/laporan'],
  PELAKSANA: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/spk', '/progress', '/laporan'],
  USER: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan'],
};

export function normalizeRole(value: unknown): KavioRole {
  const role = String(value ?? '').toUpperCase();
  return (KAVIO_ROLES as readonly string[]).includes(role) ? role as KavioRole : 'USER';
}

export function canViewPath(role: unknown, pathname: string) {
  const normalized = normalizeRole(role);
  const allowed = ROLE_MENU_ACCESS[normalized];

  return allowed.some((route) => {
    if (pathname === route) return true;

    // /master is the navigation hub, not a wildcard for every /master/* page.
    // Child routes must be explicitly listed in ROLE_MENU_ACCESS.
    if (route === '/master') return false;

    return pathname.startsWith(route + '/');
  });
}
