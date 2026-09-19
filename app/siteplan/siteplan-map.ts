export type SiteplanPoint = [number, number];

export type SiteplanLotMap = {
  id_kavling: string;
  polygon: SiteplanPoint[];
  label: SiteplanPoint;
};

export const SITEPLAN_VIEWBOX = {
  width: 1672,
  height: 990,
};

export const SITEPLAN_MAP: Record<string, SiteplanLotMap> = {
  'A-01': {
    id_kavling: 'A-01',
    polygon: [[1570,645],[1600,650],[1595,700],[1565,695]],
    label: [1582, 676],
  },
  'A-02': {
    id_kavling: 'A-02',
    polygon: [[1535,640],[1570,645],[1565,695],[1530,690]],
    label: [1548, 672],
  },
  'A-03': {
    id_kavling: 'A-03',
    polygon: [[1505,636],[1535,640],[1530,690],[1500,686]],
    label: [1517, 668],
  },
  'A-04': {
    id_kavling: 'A-04',
    polygon: [[1475,632],[1505,636],[1500,686],[1470,682]],
    label: [1487, 664],
  },
  'A-05': {
    id_kavling: 'A-05',
    polygon: [[1440,628],[1475,632],[1470,682],[1438,678]],
    label: [1455, 660],
  },
  'B-01': {
    id_kavling: 'B-01',
    polygon: [[1003,925],[1055,936],[1049,985],[996,973]],
    label: [1025,958],
  },
  'B-02': {
    id_kavling: 'B-02',
    polygon: [[1010,881],[1062,892],[1055,936],[1003,925]],
    label: [1032,910],
  },
  'B-03': {
    id_kavling: 'B-03',
    polygon: [[1017,837],[1069,847],[1062,892],[1010,881]],
    label: [1038,866],
  },
  'B-04': {
    id_kavling: 'B-04',
    polygon: [[1024,792],[1077,803],[1069,847],[1017,837]],
    label: [1045,820],
  },
  'B-05': {
    id_kavling: 'B-05',
    polygon: [[1029,749],[1085,759],[1077,803],[1024,792]],
    label: [1051,777],
  },
};

// Coordinates are calibrated against the labeled Cibodas Siteplan supplied for KAVIO.
// Future lots should be added here from the same source; do not infer positions from DB ordering.
