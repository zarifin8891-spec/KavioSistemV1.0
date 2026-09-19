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
    polygon: [[1523,671],[1548,677],[1539,713],[1515,706]],
    label: [1531, 693],
  },
  'A-02': {
    id_kavling: 'A-02',
    polygon: [[1499,665],[1523,671],[1515,706],[1490,701]],
    label: [1507, 685],
  },
  'A-03': {
    id_kavling: 'A-03',
    polygon: [[1473,659],[1499,665],[1490,701],[1466,696]],
    label: [1482, 679],
  },
  'A-04': {
    id_kavling: 'A-04',
    polygon: [[1449,653],[1473,659],[1466,696],[1442,690]],
    label: [1460, 673],
  },
  'A-05': {
    id_kavling: 'A-05',
    polygon: [[1424,647],[1449,653],[1442,690],[1418,684]],
    label: [1435, 668],
  },
  'B-01': {
    id_kavling: 'B-01',
    polygon: [[1023,848],[1074,860],[1063,907],[1009,893]],
    label: [1042, 880],
  },
  'B-02': {
    id_kavling: 'B-02',
    polygon: [[1011,803],[1064,814],[1055,858],[998,846]],
    label: [1030, 829],
  },
  'B-03': {
    id_kavling: 'B-03',
    polygon: [[1003,762],[1057,773],[1047,816],[991,805]],
    label: [1022, 788],
  },
  'B-04': {
    id_kavling: 'B-04',
    polygon: [[995,722],[1049,733],[1040,775],[984,764]],
    label: [1014, 748],
  },
  'B-05': {
    id_kavling: 'B-05',
    polygon: [[987,684],[1041,694],[1032,737],[976,726]],
    label: [1008, 711],
  },
};

// Calibrated against the labeled Cibodas Siteplan supplied for KAVIO.
// Coordinates use the original 1672 x 990 image coordinate system.
// Additional lots should be traced from the source Siteplan, not inferred from DB ordering.
