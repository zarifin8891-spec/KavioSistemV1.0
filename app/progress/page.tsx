import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import ProgressCreatePanel from './ProgressCreatePanel';
import { formatKavioDate } from '../lib/date-format';

type SearchParams = Promise<{ spk?: string; error?: string; success?: string }>;
type Spk = { id_spk: string; id_kavling: string; id_tipe: string; tgl_spk: string; tgl_target_selesai: string; status_spk: string; is_active: boolean };
type Config = { id_kategori: string; bobot_final: number | string };
type Category = { id_kategori: string; nama_kategori: string; urutan: number };
type Current = { id_kategori: string; progress_akumulasi: number | string; bobot_final: number | string; progress_berbobot: number | string; tanggal_update_terakhir: string | null };
type History = { id_progress: string; tanggal_update: string; id_kategori: string; progress_periode: number | string; keterangan: string | null };
type Decision = { progress_aktual: number | string; progress_seharusnya: number | string; gap_progress: number | string; sisa_hari: number; tanggal_update_terakhir: string | null; progress_periode_terakhir: number | string; status_operasional: string; status_ritme: string; prioritas_tindakan: string; action_rekomendasi: string; hari_sejak_update: number; progress_diperlukan_per_hari: number | string; health_score: number; health_level: string; health_description: string };

export default async function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: spks, error: spkError }, { data: categories, error: categoryError }] = await Promise.all([
    supabase.from('spk').select('id_spk,id_kavling,id_tipe,tgl_spk,tgl_target_selesai,status_spk,is_active').eq('is_active', true).order('tgl_target_selesai'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori,nama_kategori,urutan').eq('status_aktif', true).order('urutan'),
  ]);

  const spkRows = (spks ?? []) as Spk[];
  const categoryRows = (categories ?? []) as Category[];
  const selected = spkRows.find((row) => row.id_spk === params.spk) ?? spkRows[0] ?? null;

  let configRows: Config[] = [];
  let currentRows: Current[] = [];
  let historyRows: History[] = [];
  let decision: Decision | null = null;
  let readError = spkError?.message ?? categoryError?.message ?? '';

  if (selected) {
    const results = await Promise.all([
      supabase.from('spk_progress_config').select('id_kategori,bobot_final').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('v_progress_kategori_current').select('id_kategori,progress_akumulasi,bobot_final,progress_berbobot,tanggal_update_terakhir').eq('id_spk', selected.id_spk).order('id_kategori'),
      supabase.from('progress_update').select('id_progress,tanggal_update,id_kategori,progress_periode,keterangan').eq('id_spk', selected.id_spk).order('tanggal_update', { ascending: false }).order('id_kategori'),
      supabase.from('v_decision_engine').select('progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,hari_sejak_update,progress_diperlukan_per_hari,health_score,health_level,health_description').eq('id_spk', selected.id_spk).maybeSingle(),
    ]);
    configRows = (results[0].data ?? []) as Config[];
    currentRows = (results[1].data ?? []) as Current[];
    historyRows = (results[2].data ?? []) as History[];
    decision = results[3].data as Decision | null;
    readError = results.map((r) => r.error?.message).find(Boolean) ?? readError;
  }

  const categoryMap = new Map(categoryRows.map((row) => [row.id_kategori, row]));
  const latestPeriod = getLatestPeriod(historyRows);
  const actual = Number(decision?.progress_aktual ?? currentRows.reduce((sum, row) => sum + Number(row.progress_berbobot ?? 0), 0));
  const expected = Number(decision?.progress_seharusnya ?? 0);
  const gap = Number(decision?.gap_progress ?? actual - expected);
  const pageError = params.error ?? readError;

  return (
    <main className="progress-page">
      {pageError && <div className="kavio-alert error">{pageError}</div>}
      {params.success && <div className="kavio-alert success">{params.success}</div>}

      <section className="kavio-panel">
        <div className="kavio-panel-head">
          <div><h2 className="kavio-panel-title">SPK AKTIF</h2><div className="kavio-panel-note">Pilih SPK untuk melihat kendali progress, histori, dan hasil Decision Engine.</div></div>
          <span className="kavio-badge">{spkRows.length} SPK</span>
        </div>
        <form method="get" className="kavio-form progress-selector-form">
          <label className="kavio-field progress-selector-field"><span>SPK / KAVLING</span><select name="spk" defaultValue={selected?.id_spk ?? ''}><option value="">PILIH SPK</option>{spkRows.map((row) => <option key={row.id_spk} value={row.id_spk}>{row.id_kavling} — TARGET {formatKavioDate(row.tgl_target_selesai)}</option>)}</select></label>
          <button type="submit" className="kavio-button progress-selector-button">TAMPILKAN</button>
        </form>
      </section>

      {selected && <>
        <section className="progress-summary">
          <SummaryCard label="PROGRESS AKTUAL" value={`${(actual * 100).toFixed(1)}%`} />
          <SummaryCard label="PROGRESS SEHARUSNYA" value={`${(expected * 100).toFixed(1)}%`} />
          <SummaryCard label="GAP" value={`${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)}%`} tone={gap < -0.05 ? 'danger' : gap < 0 ? 'warning' : 'normal'} />
          <SummaryCard label="SISA HARI" value={decision ? (decision.sisa_hari < 0 ? `LEWAT ${Math.abs(decision.sisa_hari)}` : String(decision.sisa_hari)) : '—'} tone={decision && decision.sisa_hari < 0 ? 'danger' : 'normal'} />
          <SummaryCard label="HEALTH SCORE" value={decision ? String(decision.health_score) : '—'} />
        </section>

        <section className="kavio-panel progress-decision-panel">
          <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DECISION ENGINE</h2></div><span className="kavio-badge">{decision?.health_level ?? 'BELUM TERSEDIA'}</span></div>
          <div className="kavio-panel-body"><div className="progress-decision"><div className="progress-decision-label">REKOMENDASI TINDAKAN</div><div className="progress-decision-main">{decision?.action_rekomendasi ?? 'Belum tersedia'}</div><div className="progress-decision-meta">{decision?.status_operasional ?? '—'} · {decision?.status_ritme ?? '—'} · PRIORITAS {decision?.prioritas_tindakan ?? '—'} · {decision?.health_description ?? ''}</div></div></div>
        </section>

        <section className="progress-data-grid"><section className="kavio-panel">
          <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">PROGRESS PER KATEGORI</h2><div className="kavio-panel-note">Progress periode diakumulasi per kategori kemudian dihitung berbobot.</div></div><Link href={`/master/spk/detail/${selected.id_spk}?from=progress`} className="kavio-button secondary">CONTROL SHEET</Link></div>
          <div className="kavio-table-wrap"><table className="kavio-table progress-table"><thead><tr><th>KATEGORI</th><th>BOBOT</th><th>AKUMULASI</th><th>BERBOBOT</th><th>UPDATE TERAKHIR</th></tr></thead><tbody>{configRows.map((c) => { const cur = currentRows.find((r) => r.id_kategori === c.id_kategori); return <tr key={c.id_kategori}><td className="progress-category-name">{categoryMap.get(c.id_kategori)?.nama_kategori ?? c.id_kategori}</td><td>{(Number(c.bobot_final) * 100).toFixed(2)}%</td><td>{(Number(cur?.progress_akumulasi ?? 0) * 100).toFixed(2)}%</td><td>{(Number(cur?.progress_berbobot ?? 0) * 100).toFixed(2)}%</td><td>{cur?.tanggal_update_terakhir ? formatKavioDate(cur.tanggal_update_terakhir) : 'BELUM ADA'}</td></tr>; })}{!configRows.length && <tr><td colSpan={5} className="kavio-empty">BELUM ADA KONFIGURASI PROGRESS.</td></tr>}</tbody></table></div>
        </section>

        <section className="kavio-panel">
          <div className="kavio-panel-head"><div><h2 className="kavio-panel-title">HISTORI PROGRESS</h2><div className="kavio-panel-note">Seluruh update periode tetap tersimpan.</div></div><span className="kavio-badge">{historyRows.length} UPDATE</span></div>
          <div className="kavio-table-wrap"><table className="kavio-table progress-table"><thead><tr><th>TANGGAL</th><th>KATEGORI</th><th>PROGRESS PERIODE</th><th>KETERANGAN</th></tr></thead><tbody>{historyRows.map((row) => <tr key={row.id_progress}><td>{formatKavioDate(row.tanggal_update)}</td><td>{categoryMap.get(row.id_kategori)?.nama_kategori ?? row.id_kategori}</td><td className="progress-highlight">{(Number(row.progress_periode) * 100).toFixed(2)}%</td><td>{row.keterangan || '—'}</td></tr>)}{!historyRows.length && <tr><td colSpan={4} className="kavio-empty">BELUM ADA HISTORI PROGRESS.</td></tr>}</tbody></table></div>
          <div className="progress-table-foot">UPDATE TERAKHIR: {decision?.tanggal_update_terakhir ? formatKavioDate(decision.tanggal_update_terakhir) : latestPeriod?.date ? formatKavioDate(latestPeriod.date) : 'BELUM ADA'} · PERIODE TERAKHIR: {decision ? `${(Number(decision.progress_periode_terakhir) * 100).toFixed(2)}%` : '—'} · KEBUTUHAN / HARI: {decision ? `${(Number(decision.progress_diperlukan_per_hari) * 100).toFixed(2)}%` : '—'}</div>
        </section>
                <ProgressCreatePanel idSpk={selected.id_spk} tglSpk={selected.tgl_spk} configs={configRows} categories={categoryRows} />
        </section>

      </>}

      {!selected && !spkRows.length && <div className="kavio-panel kavio-empty">BELUM ADA SPK AKTIF.</div>}
    </main>
  );
}

function getLatestPeriod(rows: History[]) {
  if (!rows.length) return null;
  const date = rows[0].tanggal_update;
  const progress = rows.filter((row) => row.tanggal_update === date).reduce((sum, row) => sum + Number(row.progress_periode ?? 0), 0);
  return { date, progress };
}

function SummaryCard({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'danger' | 'warning' | 'normal' }) {
  return <div className={`progress-summary-card progress-tone-${tone}`}><div className="progress-summary-label">{label}</div><div className="progress-summary-value">{value}</div></div>;
}
