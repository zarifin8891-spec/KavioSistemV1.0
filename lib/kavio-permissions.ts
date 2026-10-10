export const KAVIO_ROLES = ['DIREKTUR', 'ADMIN', 'MARKETING', 'PELAKSANA', 'GUDANG', 'KEUANGAN', 'USER'] as const;
export type KavioRole = typeof KAVIO_ROLES[number];

export const KAVIO_ACTIONS = [
  'MASTER_WRITE',
  'SALES_WRITE',
  'SPK_WRITE',
  'PROGRESS_WRITE',
  'SITEPLAN_MAP',
  'USER_MANAGE',
  'MATERIAL_CATALOG_WRITE',
  'MATERIAL_WAREHOUSE_WRITE',
  'MATERIAL_REQUEST_WRITE',
  'MATERIAL_USE_WRITE',
  'PAYMENT_PLAN_WRITE',
  'PAYMENT_RECEIPT_WRITE',
] as const;
export type KavioAction = typeof KAVIO_ACTIONS[number];

const MASTER_DATA_ROUTES = [
  '/master/tipe-rumah',
  '/master/kategori-pekerjaan',
  '/master/kantor-pelaksana',
  '/master/mandor',
  '/master/template-progress',
  '/master/bank',
  '/master/notaris',
] as const;

export const ROLE_MENU_ACCESS: Record<KavioRole, string[]> = {
  DIREKTUR: ['/dashboard', '/master', ...MASTER_DATA_ROUTES, '/siteplan', '/master/kavling', '/master/sales', '/penerimaan', '/master/spk', '/progress', '/material', '/laporan', '/manajemen-user'],
  ADMIN: ['/dashboard', '/master', ...MASTER_DATA_ROUTES, '/siteplan', '/master/kavling', '/master/sales', '/penerimaan', '/master/spk', '/progress', '/material', '/laporan', '/manajemen-user'],
  MARKETING: ['/dashboard', '/siteplan', '/master/kavling', '/master/sales', '/laporan'],
  PELAKSANA: ['/dashboard', '/siteplan', '/master/kavling', '/master/spk', '/progress', '/material', '/laporan'],
  GUDANG: ['/dashboard', '/master/spk', '/progress', '/material'],
  KEUANGAN: ['/dashboard', '/master/sales', '/penerimaan', '/laporan'],
  USER: ['/dashboard', '/siteplan', '/master/kavling', '/master/sales', '/master/spk', '/progress', '/laporan'],
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
