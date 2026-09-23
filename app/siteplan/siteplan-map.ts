export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

// Coordinate system follows the new correct Siteplan source asset directly.
// Asset size: 3268 × 2189 (landscape). A.01 is on the right side as requested.
export const SITEPLAN_VIEWBOX = {
  width: 3268,
  height: 2189,
};

// Prototype polygons are cleared because their coordinates belonged to the previous image.
// New polygons are traced directly on the current Siteplan and persisted to Supabase.
export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {};
