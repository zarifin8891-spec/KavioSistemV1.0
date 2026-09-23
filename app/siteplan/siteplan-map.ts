export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

export const SITEPLAN_VIEWBOX = {
  width: 3268,
  height: 2189,
};

// Verified mappings are loaded from Supabase at runtime.
// No synthetic/default polygons are injected here; AUTO DETECT or verified DB mappings are authoritative.
export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {};
