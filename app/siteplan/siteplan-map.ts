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

const SITEPLAN_IDS = [
  ...Array.from({ length: 16 }, (_, i) => `A.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 43 }, (_, i) => `B.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 82 }, (_, i) => `C.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 60 }, (_, i) => `D.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 73 }, (_, i) => `E.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 28 }, (_, i) => `F.${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 27 }, (_, i) => `F.${String(i + 30).padStart(2, '0')}`),
  ...Array.from({ length: 70 }, (_, i) => `G.${String(i + 1).padStart(2, '0')}`),
] as const;

const SITEPLAN_DATA = "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";

function decodeVarints(encoded: string): number[] {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const values: number[] = [];
  let current = 0;
  let shift = 0;

  for (const byte of bytes) {
    current |= (byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7;
    } else {
      values.push(current);
      current = 0;
      shift = 0;
    }
  }
  return values;
}

function unzigzag(value: number) {
  return value & 1 ? -((value + 1) / 2) : value / 2;
}

function buildMap(): Record<string, SiteplanLotMap> {
  const values = decodeVarints(SITEPLAN_DATA);
  const map: Record<string, SiteplanLotMap> = {};
  let index = 0;

  for (const id of SITEPLAN_IDS) {
    const polygon: SiteplanPoint[] = [];
    let prevX = 0;
    let prevY = 0;

    for (let point = 0; point < 4; point += 1) {
      const dx = unzigzag(values[index++]);
      const dy = unzigzag(values[index++]);
      const x = point === 0 ? dx : prevX + dx;
      const y = point === 0 ? dy : prevY + dy;
      polygon.push([x, y]);
      prevX = x;
      prevY = y;
    }

    const label = polygon.reduce(
      (acc, [x, y]) => [acc[0] + x, acc[1] + y],
      [0, 0] as [number, number],
    ).map((value) => Math.round(value / polygon.length)) as SiteplanPoint;

    map[id] = { id_kavling: id, polygon, label };
  }

  return map;
}

export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = buildMap();
