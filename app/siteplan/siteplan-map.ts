export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

// Landscape coordinate system after rotating the supplied Siteplan 90° clockwise.
// Original asset: 1488 × 2105. Rotated display: 2105 × 1488.
export const SITEPLAN_VIEWBOX = {
  width: 2105,
  height: 1488,
};

// Prototype polygons were cleared because their coordinates belonged to the previous image.
// New polygons are traced directly on the rotated latest Siteplan and persisted to Supabase.
export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {};
