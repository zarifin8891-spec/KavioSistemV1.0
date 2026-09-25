export const KAVIO_ROLES = ['DIREKTUR', 'ADMIN', 'MARKETING', 'PELAKSANA', 'USER'] as const;
export type KavioRole = typeof KAVIO_ROLES[number];

export const ROLE_MENU_ACCESS: Record<KavioRole, string[]> = {
  DIREKTUR: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan', '/manajemen-user'],
  ADMIN: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan', '/manajemen-user'],
  MARKETING: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/laporan'],
  PELAKSANA: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/spk', '/progress', '/laporan'],
  USER: ['/dashboard', '/master', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan'],
};

export const ROLE_ACTION_ACCESS: Record<KavioRole, string[]> = {
  DIREKTUR: ['MASTER_WRITE', 'SALES_WRITE', 'SPK_WRITE', 'PROGRESS_WRITE', 'SITEPLAN_MAP', 'USER_MANAGE'],
  ADMIN: ['MASTER_WRITE', 'SALES_WRITE', 'SPK_WRITE', 'PROGRESS_WRITE', 'SITEPLAN_MAP', 'USER_MANAGE'],
  MARKETING: ['SALES_WRITE'],
  PELAKSANA: ['SPK_WRITE', 'PROGRESS_WRITE'],
  USER: [],
};

export function normalizeRole(value: unknown): KavioRole {
  const role = String(value ?? '').toUpperCase();
  return (KAVIO_ROLES as readonly string[]).includes(role) ? role as KavioRole : 'USER';
}

export function canAction(role: unknown, action: string) {
  const normalized = normalizeRole(role);
  return ROLE_ACTION_ACCESS[normalized].includes(action);
}

export function canViewPath(role: unknown, pathname: string) {
  const normalized = normalizeRole(role);
  const allowed = ROLE_MENU_ACCESS[normalized];
  return allowed.some((route) => pathname === route || pathname.startsWith(route + '/'));
}