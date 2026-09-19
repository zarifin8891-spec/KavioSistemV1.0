import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

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
type KavlingRow = { id_kavling: string; status_kavling: string; status_aktif: boolean };
type SalesRow = { status_sales: string; status_aktif: boolean };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: decisions, error: decisionError },
    { data: kavlings, error: kavlingError },
    { data: sales, error: salesError },
  ] = await Promise.all([
    supabase.from('v_decision_engine')
      .select('id_spk,id_kavling,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,health_description')
      .neq('status_spk', 'DRAFT')
      .order('health_score', { ascending: true })
      .limit(50),
    supabase.from('master_kavling')
      .select('id_kavling,status_kavling,status_aktif')
      .eq('status_aktif', true)
      .order('id_kavling'),
    supabase.from('sales')
      .select('status_sales,status_aktif')
      .order('created_at', { ascending: false }),
  ]);

  const rows = (decisions ?? []) as DecisionRow[];
  const kavlingRows = (kavlings ?? []) as KavlingRow[];
  const salesRows = (sales ?? []) as SalesRow[];
  const activeKavlings = kavlingRows.filter((row) => row.status_aktif);
  const activeSales = salesRows.filter((row) => row.status_aktif);
  const countKavling = (status: string) => activeKavlings.filter((row) => row.status_kavling === status).length;
  const countSales = (status: string) => activeSales.filter((row) => row.status_sales === status).length;

  const totalKavling = activeKavlings.length;
  const terjual = countKavling('SOLD');
  const building = countKavling('BUILDING');
  const readyStock = countKavling('READY_STOCK');
  const tersedia = countKavling('AVAILABLE');

  const avgProgress = rows.length ? rows.reduce((sum, row) => sum + Number(row.progress_aktual ?? 0), 0) / rows.length : 0;
  const avgHealth = rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.health_score ?? 0), 0) / rows.length) : 0;
  const healthCounts = rows.reduce(
    (acc, row) => {
      acc[row.health_level] += 1;
      return acc;
    },
    { SEHAT: 0, WASPADA: 0, KRITIS: 0 } as Record<HealthLevel, number>,
  );

  const concernRows = rows.filter((row) => row.health_level !== 'SEHAT').slice(0, 5);
  const actionRows = rows
    .filter((row) => row.prioritas_tindakan !== 'NORMAL')
    .sort((a, b) => priorityRank(a.prioritas_tindakan) - priorityRank(b.prioritas_tindakan) || a.health_score - b.health_score)
    .slice(0, 6);

  const statusChart = [
    ['AVAILABLE', tersedia],
    ['BOOKING', countKavling('BOOKING')],
    ['BUILDING', building],
    ['READY STOCK', readyStock],
    ['SOLD', terjual],
  ] as const;

  const salesChart = [
    ['BOOKING', countSales('BOOKING')],
    ['UANG MUKA', countSales('DP')],
    ['PROSES KPR', countSales('PROSES_KPR')],
    ['AKAD', countSales('AKAD')],
  ] as const;

  const error = decisionError?.message ?? kavlingError?.message ?? salesError?.message;

  return (
    <main className="kavio-dashboard">
      {error && <div className="kavio-alert error">{error}</div>}

      <section className="kavio-dashboard-kpi-grid" aria-label="KPI KAVIO">
        <DashboardKpi icon="⌗" label="TOTAL KAVLING" value={totalKavling} note="Seluruh inventory aktif" />
        <DashboardKpi icon="▣" label="TERJUAL" value={terjual} note="Status SOLD" />
        <DashboardKpi icon="⌂" label="SEDANG DIBANGUN" value={building} note="Kavling berstatus BUILDING" />
        <DashboardKpi icon="▰" label="READY STOCK" value={readyStock} note="Pekerjaan selesai, belum terjual" />
        <DashboardKpi icon="◇" label="TERSEDIA" value={tersedia} note="Kavling AVAILABLE" />
      </section>

      <section className="kavio-dashboard-health">
        <div className="kavio-dashboard-health-main">
          <div className="kavio-panel-note">PROJECT HEALTH</div>
          <div className="kavio-dashboard-health-title">{healthLabel(avgHealth)}</div>
          <div className="kavio-dashboard-health-meta">Health Score rata-rata {avgHealth}/100 · Progress aktual rata-rata {(avgProgress * 100).toFixed(1)}%</div>
        </div>
        <HealthSegment label="SEHAT" value={healthCounts.SEHAT} total={rows.length} />
        <HealthSegment label="WASPADA" value={healthCounts.WASPADA} total={rows.length} />
        <HealthSegment label="KRITIS" value={healthCounts.KRITIS} total={rows.length} />
      </section>

      <section className="kavio-dashboard-grid-2">
        <DashboardPanel title="SPK PERLU PERHATIAN" note="Ringkasan dari Decision Engine.">
          {concernRows.length ? (
            <div className="kavio-dashboard-list">
              {concernRows.map((row) => (
                <div className="kavio-dashboard-list-item" key={row.id_spk}>
                  <HealthBadge level={row.health_level} score={row.health_score} />
                  <div className="kavio-dashboard-list-main">
                    <Link href={'/master/spk/detail/' + row.id_spk}>{row.id_kavling}</Link>
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
                    <Link href={'/master/spk/detail/' + row.id_spk}>{row.id_kavling}</Link>
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
        <DashboardPanel title="KOMPOSISI KAVLING" note="Status inventory aktif saat ini.">
          <div className="kavio-dashboard-chart">
            {statusChart.map(([label, value]) => (
              <ChartRow key={label} label={label} value={value} max={Math.max(1, totalKavling)} />
            ))}
          </div>
        </DashboardPanel>
        <DashboardPanel title="PIPELINE SALES" note="Sales aktif berdasarkan tahap penjualan.">
          <div className="kavio-dashboard-chart">
            {salesChart.map(([label, value]) => (
              <ChartRow key={label} label={label} value={value} max={Math.max(1, activeSales.length)} />
            ))}
          </div>
        </DashboardPanel>
      </section>

      <DashboardPanel title="MONITORING SPK" note="Aktual vs rencana, ritme pekerjaan, dan kebutuhan progress harian.">
        {rows.length ? (
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead><tr><th>HEALTH</th><th>KAVLING</th><th>PROGRESS</th><th>GAP</th><th>UPDATE TERAKHIR</th><th>BUTUH / HARI</th><th>STATUS</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id_spk}>
                    <td><HealthBadge level={row.health_level} score={row.health_score} /></td>
                    <td><Link href={'/master/spk/detail/' + row.id_spk}>{row.id_kavling}</Link></td>
                    <td>
                      <strong>{(Number(row.progress_aktual) * 100).toFixed(1)}%</strong>
                      <div className="kavio-dashboard-chart-track" aria-hidden="true">
                        <div className="kavio-dashboard-chart-fill" style={{ width: Math.min(100, Math.max(0, Number(row.progress_aktual) * 100)) + '%' }} />
                      </div>
                    </td>
                    <td>{Number(row.gap_progress) >= 0 ? '+' : ''}{(Number(row.gap_progress) * 100).toFixed(1)}%</td>
                    <td>{row.tanggal_update_terakhir ?? 'BELUM ADA'}</td>
                    <td>{row.progress_diperlukan_per_hari == null ? '—' : (Number(row.progress_diperlukan_per_hari) * 100).toFixed(2) + '%'}</td>
                    <td><span className="kavio-badge">{row.status_operasional}</span><div className="kavio-dashboard-mini"><span>{row.status_ritme}</span></div></td>
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
    <div className="kavio-dashboard-kpi">
      <div className="kavio-dashboard-kpi-icon" aria-hidden="true">{icon}</div>
      <div className="kavio-dashboard-kpi-label">{label}</div>
      <div className="kavio-dashboard-kpi-value">{value}</div>
      <div className="kavio-dashboard-kpi-note">{note}</div>
    </div>
  );
}

function HealthSegment({ label, value, total }: { label: HealthLevel; value: number; total: number }) {
  const pct = total ? Math.round(value / total * 100) : 0;
  return (
    <div className="kavio-dashboard-health-segment">
      <div className="kavio-dashboard-health-segment-top"><span>{label}</span><strong>{value}</strong></div>
      <div className="kavio-dashboard-health-track"><div className="kavio-dashboard-health-fill" style={{ width: pct + '%' }} /></div>
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
