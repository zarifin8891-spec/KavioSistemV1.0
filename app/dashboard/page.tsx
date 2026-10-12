import Link from 'next/link';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';

type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';
type ActionPriority = 'TINGGI' | 'SEDANG' | 'NORMAL';
type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';
type DecisionRow = {
  id_spk: string;
  id_kavling: string;
  progress_aktual: number | string;
  progress_seharusnya: number | string;
  gap_progress: number | string;
  sisa_hari: number;
  tanggal_update_terakhir: string | null;
  progress_periode_terakhir: number | string;
  status_operasional: OperationalStatus;
  status_ritme: PaceStatus;
  prioritas_tindakan: ActionPriority;
  action_rekomendasi: string;
  hari_sejak_update: number | null;
  progress_diperlukan_per_hari: number | string | null;
  health_score: number;
  health_level: HealthLevel;
  health_description: string;
};
type DashboardSummary = {
  kavling: { total: number; available: number; booking: number; building: number; ready_stock: number; siap_akad: number; sold: number };
  sales: { total: number; booking: number; dp: number; proses_kpr: number; akad: number; batal: number; terjual: number };
  health: { total: number; avg_progress: number; avg_health: number; sehat: number; waspada: number; kritis: number };
};

export default async function DashboardPage() {
  const supabase = await createClient();
const [
    { data: decisions, error: decisionError },
    { data: summaryData, error: summaryError },
  ] = await Promise.all([
    supabase.from('v_decision_engine')
      .select('id_spk,id_kavling,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,health_description')
      .neq('status_spk', 'DRAFT')
      .order('health_score', { ascending: true })
      .order('id_spk')
      .limit(50),
    supabase.from('v_dashboard_summary').select('kavling,sales,health').single(),
  ]);

  const rows = (decisions ?? []) as DecisionRow[];
  // Project metrics use the complete database aggregate, never the attention list.
  const summary = summaryData as DashboardSummary | null;
  const totalKavling = Number(summary?.kavling.total ?? 0);
  const terjual = Number(summary?.sales.terjual ?? 0);
  const building = Number(summary?.kavling.building ?? 0);
  const readyStock = Number(summary?.kavling.ready_stock ?? 0);
  const siapAkad = Number(summary?.kavling.siap_akad ?? 0);
  const tersedia = Number(summary?.kavling.available ?? 0);
  const totalSales = Number(summary?.sales.total ?? 0);
  const totalMonitored = Number(summary?.health.total ?? 0);
  const avgProgress = Number(summary?.health.avg_progress ?? 0);
  const avgHealth = Math.round(Number(summary?.health.avg_health ?? 0));
  const healthCounts = { SEHAT: Number(summary?.health.sehat ?? 0), WASPADA: Number(summary?.health.waspada ?? 0), KRITIS: Number(summary?.health.kritis ?? 0) };

  const concernRows = rows.filter((row) => row.health_level !== 'SEHAT').slice(0, 5);
  const actionRows = rows
    .filter((row) => row.prioritas_tindakan !== 'NORMAL')
    .sort((a, b) => priorityRank(a.prioritas_tindakan) - priorityRank(b.prioritas_tindakan) || a.health_score - b.health_score)
    .slice(0, 6);

  const statusChart = [
    ['AVAILABLE', tersedia],
    ['BOOKING', Number(summary?.kavling.booking ?? 0)],
    ['BUILDING', building],
    ['READY STOCK', readyStock],
    ['SIAP AKAD', siapAkad],
    ['SOLD', Number(summary?.kavling.sold ?? 0)],
  ] as const;

  const salesChart = [
    ['BOOKING', Number(summary?.sales.booking ?? 0)],
    ['UANG MUKA', Number(summary?.sales.dp ?? 0)],
    ['PROSES KPR', Number(summary?.sales.proses_kpr ?? 0)],
    ['AKAD', Number(summary?.sales.akad ?? 0)],
    ['BATAL', Number(summary?.sales.batal ?? 0)],
  ] as const;

  const error = decisionError?.message ?? summaryError?.message;

  return (
    <main className="kavio-dashboard">
      {error && <div className="kavio-alert error">{error}</div>}

      <section className="kavio-kpi-grid kavio-dashboard-kpi-grid" aria-label="KPI KAVIO">
        <DashboardKpi icon="⌗" label="TOTAL KAVLING" value={totalKavling} note="Seluruh inventory aktif" />
        <DashboardKpi icon="▣" label="TERJUAL" value={terjual} note="Sales aktif + sudah AKAD" />
        <DashboardKpi icon="⌂" label="SEDANG DIBANGUN" value={building} note="Kavling berstatus BUILDING" />
        <DashboardKpi icon="▰" label="READY STOCK" value={readyStock} note="Pekerjaan selesai, belum terjual" />
        <DashboardKpi icon="◆" label="SIAP AKAD" value={siapAkad} note="Syarat kesiapan akad terpenuhi" />
        <DashboardKpi icon="◇" label="TERSEDIA" value={tersedia} note="Kavling AVAILABLE" />
      </section>

      <section className="kavio-project-health kavio-dashboard-health">
        <div className="kavio-project-health-main kavio-dashboard-health-main">
          <div className="kavio-panel-note">PROJECT HEALTH</div>
          <div className="kavio-project-health-title kavio-dashboard-health-title">{healthLabel(avgHealth)}</div>
          <div className="kavio-project-health-meta kavio-dashboard-health-meta">Health Score rata-rata {avgHealth}/100 · Progress aktual rata-rata {(avgProgress * 100).toFixed(1)}%</div>
        </div>
        <HealthSegment label="SEHAT" value={healthCounts.SEHAT} total={totalMonitored} />
        <HealthSegment label="WASPADA" value={healthCounts.WASPADA} total={totalMonitored} />
        <HealthSegment label="KRITIS" value={healthCounts.KRITIS} total={totalMonitored} />
      </section>

      <section className="kavio-dashboard-grid-2">
        <DashboardPanel title="SPK PERLU PERHATIAN" note="Ringkasan dari Decision Engine.">
          {concernRows.length ? (
            <div className="kavio-dashboard-list">
              {concernRows.map((row) => (
                <div className="kavio-dashboard-list-item" key={row.id_spk}>
                  <HealthBadge level={row.health_level} score={row.health_score} />
                  <div className="kavio-dashboard-list-main">
                    <Link href={'/master/spk/detail/' + row.id_spk} prefetch={false}>{row.id_kavling}</Link>
                    <small>{row.health_description}</small>
                  </div>
                  <div className="kavio-dashboard-list-value">{(Number(row.progress_aktual) * 100).toFixed(1)}% · gap {(Number(row.gap_progress) * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="kavio-dashboard-empty">BELUM ADA SPK YANG MEMERLUKAN PERHATIAN.</div>
          )}
        </DashboardPanel>

        <DashboardPanel title="ACTION CENTER" note="Tindakan prioritas teratas.">
          {actionRows.length ? (
            <div className="kavio-dashboard-list">
              {actionRows.map((row) => (
                <div className="kavio-dashboard-list-item" key={row.id_spk}>
                  <PriorityBadge priority={row.prioritas_tindakan} />
                  <div className="kavio-dashboard-list-main">
                    <Link href={'/master/spk/detail/' + row.id_spk} prefetch={false}>{row.id_kavling}</Link>
                    <small>{row.action_rekomendasi}</small>
                  </div>
                  <div className="kavio-dashboard-list-value">{row.sisa_hari < 0 ? 'LEWAT ' + Math.abs(row.sisa_hari) + ' HARI' : row.sisa_hari + ' HARI'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="kavio-dashboard-empty">TIDAK ADA TINDAKAN PRIORITAS SAAT INI.</div>
          )}
        </DashboardPanel>
      </section>

      <section className="kavio-dashboard-grid-3">
        <DashboardPanel title="KOMPOSISI KAVLING" note="Status inventory aktif saat ini; terjual dihitung terpisah pada KPI.">
          <div className="kavio-dashboard-chart">
            {statusChart.map(([label, value]) => (
              <ChartRow key={label} label={label} value={value} max={Math.max(1, totalKavling)} />
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel title="PIPELINE SALES" note="Seluruh data Sales berdasarkan status transaksi.">
          <div className="kavio-dashboard-chart">
            {salesChart.map(([label, value]) => (
              <ChartRow key={label} label={label} value={value} max={Math.max(1, totalSales)} />
            ))}
          </div>
        </DashboardPanel>
      </section>

      <DashboardPanel title="MONITORING SPK" note={`Menampilkan ${rows.length} dari ${totalMonitored} SPK, diurutkan menurut Health Score. KPI dihitung dari seluruh SPK terpantau.`}>
        {rows.length ? (
          <div className="kavio-table-wrap">
            <table className="kavio-table kavio-operational-table">
              <thead><tr><th>HEALTH</th><th>KAVLING</th><th>PROGRESS</th><th>GAP</th><th>UPDATE TERAKHIR</th><th>BUTUH / HARI</th><th>STATUS</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id_spk}>
                    <td><HealthBadge level={row.health_level} score={row.health_score} /></td>
                    <td><Link href={'/master/spk/detail/' + row.id_spk} prefetch={false}>{row.id_kavling}</Link></td>
                    <td>
                      <strong>{(Number(row.progress_aktual) * 100).toFixed(1)}%</strong>
                      <div className="kavio-dashboard-chart-track" aria-hidden="true">
                        <div className="kavio-dashboard-chart-fill" style={{ width: Math.min(100, Math.max(0, Number(row.progress_aktual) * 100)) + '%' }} />
                      </div>
                    </td>
                    <td>{Number(row.gap_progress) >= 0 ? '+' : ''}{(Number(row.gap_progress) * 100).toFixed(1)}%</td>
                    <td>{row.tanggal_update_terakhir ? formatKavioDate(row.tanggal_update_terakhir) : 'BELUM ADA'}</td>
                    <td>{row.progress_diperlukan_per_hari == null ? '—' : (Number(row.progress_diperlukan_per_hari) * 100).toFixed(2) + '%'}</td>
                    <td><div className="kavio-dashboard-status"><span className="kavio-badge">{row.status_operasional}</span><div className="kavio-dashboard-mini"><span>{row.status_ritme}</span></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="kavio-dashboard-empty">BELUM ADA DATA SPK UNTUK DIMONITOR.</div>
        )}
      </DashboardPanel>
    </main>
  );
}

function DashboardKpi({ icon, label, value, note }: { icon: string; label: string; value: number; note: string }) {
  return (
    <div className="kavio-kpi kavio-dashboard-kpi">
      <div className="kavio-kpi-icon kavio-dashboard-kpi-icon" aria-hidden="true">{icon}</div>
      <div className="kavio-kpi-label kavio-dashboard-kpi-label">{label}</div>
      <div className="kavio-kpi-value kavio-dashboard-kpi-value">{value}</div>
      <div className="kavio-kpi-note kavio-dashboard-kpi-note">{note}</div>
    </div>
  );
}

function HealthSegment({ label, value, total }: { label: HealthLevel; value: number; total: number }) {
  const pct = total ? Math.round(value / total * 100) : 0;
  return (
    <div className="kavio-project-health-segment kavio-dashboard-health-segment">
      <div className="kavio-project-health-segment-top kavio-dashboard-health-segment-top"><span>{label}</span><strong>{value}</strong></div>
      <div className="kavio-project-health-track kavio-dashboard-health-track"><div className="kavio-project-health-fill kavio-dashboard-health-fill" style={{ width: pct + '%' }} /></div>
      <small>{pct}% dari SPK terpantau</small>
    </div>
  );
}

function HealthBadge({ level, score }: { level: HealthLevel; score: number }) {
  const tone = level === 'KRITIS' ? 'high' : level === 'WASPADA' ? 'medium' : '';
  return <span className={'kavio-dashboard-priority ' + tone}>{score} · {level}</span>;
}

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const tone = priority === 'TINGGI' ? 'high' : priority === 'SEDANG' ? 'medium' : '';
  return <span className={'kavio-dashboard-priority ' + tone}>{priority}</span>;
}

function ChartRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max ? Math.round(value / max * 100) : 0;
  return (
    <div className="kavio-dashboard-chart-row">
      <div className="kavio-dashboard-chart-label">{label}</div>
      <div className="kavio-dashboard-chart-track"><div className="kavio-dashboard-chart-fill" style={{ width: width + '%' }} /></div>
      <div className="kavio-dashboard-chart-value">{value}</div>
    </div>
  );
}

function DashboardPanel({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="kavio-dashboard-panel">
      <div className="kavio-dashboard-panel-head">
        <div><div className="kavio-dashboard-panel-title">{title}</div><div className="kavio-dashboard-panel-note">{note}</div></div>
      </div>
      <div className="kavio-dashboard-panel-body">{children}</div>
    </section>
  );
}

function healthLabel(score: number) {
  return score >= 75 ? 'SEHAT' : score >= 50 ? 'WASPADA' : 'KRITIS';
}

function priorityRank(priority: ActionPriority) {
  return priority === 'TINGGI' ? 0 : priority === 'SEDANG' ? 1 : 2;
}
