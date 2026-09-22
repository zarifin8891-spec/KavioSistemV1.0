export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

// Master visual Siteplan terbaru berformat portrait.
// Mapping hard-coded lama dikosongkan agar tidak menampilkan polygon
// yang berpotensi bergeser dari Siteplan terbaru. Mapping dilakukan melalui Mapping Mode.
export const SITEPLAN_VIEWBOX = {
  width: 595,
  height: 842,
};

export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {};
