export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

export const SITEPLAN_VIEWBOX = {
  width: 1488,
  height: 2105,
};

// Mapping manual dimulai dari Siteplan terbaru yang disimpan di public/siteplan.
// Polygon lama tidak digunakan karena memakai sistem koordinat dari gambar prototype sebelumnya.
export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {};
