export type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
export type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';

export type HealthInput = {
  statusOperasional: OperationalStatus;
  statusRitme: PaceStatus;
  gapProgress: number;
  sisaHari: number;
  tanggalUpdateTerakhir: string | null;
  progressAktual: number;
};

export type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';

export function calculateHealthScore(input: HealthInput, today: string): number {
  let score = 100;

  if (input.statusOperasional === 'LEWAT TARGET') score -= 45;
  else if (input.statusOperasional === 'PERHATIAN') score -= 20;

  if (input.statusRitme === 'TERTINGGAL') score -= Math.min(30, Math.round(Math.abs(input.gapProgress) * 300));
  else if (input.statusRitme === 'DI DEPAN') score += 5;

  if (input.sisaHari < 0) score -= 20;
  else if (input.sisaHari <= 7) score -= 12;
  else if (input.sisaHari <= 14) score -= 5;

  if (!input.tanggalUpdateTerakhir) score -= 18;
  else {
    const staleDays = daysBetween(input.tanggalUpdateTerakhir, today);
    if (staleDays > 14) score -= 20;
    else if (staleDays > 7) score -= 8;
  }

  if (input.progressAktual >= 0.999999) score = Math.max(score, 95);
  return Math.max(0, Math.min(100, score));
}

export function healthLevel(score: number): HealthLevel {
  if (score >= 75) return 'SEHAT';
  if (score >= 50) return 'WASPADA';
  return 'KRITIS';
}

export function healthDescription(level: HealthLevel): string {
  if (level === 'SEHAT') return 'Kondisi operasional terkendali.';
  if (level === 'WASPADA') return 'Perlu monitoring lebih dekat.';
  return 'Perlu tindakan segera.';
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}
