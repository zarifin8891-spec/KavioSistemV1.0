import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';

type SearchParams = Promise<{ jenis?: string }>;

const REPORTS = [
  { key: 'sales', label: 'LAPORAN SALES', note: 'Rekap status penjualan, konsumen, pembayaran, dan target akad.' },
  { key: 'progress', label: 'LAPORAN PROGRESS', note: 'Rekap progress pembangunan per SPK/kavling.' },
  { key: 'decision', label: 'LAPORAN DECISION ENGINE', note: 'Rekap kondisi operasional dan tindakan yang dihasilkan sistem.' },
] as const;

const pct = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—';
};

const money = (value: number | string | null | undefined) => {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const statusClass = (value: string | null | undefined) =>
  String(value ?? 'AVAILABLE').toLowerCase().replace(/\s+/g, '_');

export default async function LaporanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selected = REPORTS.some((item) => item.key === params.jenis) ? params.jenis! : 'sales';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: sales },
    { data: progress },
    { data: decision },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('id_sales,id_kavling,nama_konsumen,status_sales,jenis_pembayaran,harga_jual,tgl_booking,target_akad,status_aktif')
      .order('tgl_booking', { ascending: false }),
    supabase
      .from('v_progress_summary')
      .select('id_spk,id_kavling,id_tipe,tgl_spk,tgl_target_selesai,status_spk,progress_total')
      .order('id_kavling'),
    supabase
      .from('v_decision_engine')
      .select('id_spk,id_kavling,id_tipe,tgl_spk,tgl_target_selesai,status_spk,is_active,progress_aktual,progress_seharusnya,gap_progress,sisa_hari,tanggal_update_terakhir,progress_periode_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,health_score,health_level,health_description')
      .order('id_kavling'),
  ]);

  const salesRows = (sales ?? []) as Array<{
    id_sales: string;
    id_kavling: string;
    nama_konsumen: string | null;
    status_sales: string | null;
    jenis_pembayaran: string | null;
    harga_jual: number | string | null;
    tgl_booking: string | null;
    target_akad: string | null;
    status_aktif: boolean | null;
  }>;

  const progressRows = (progress ?? []) as Array<{
    id_spk: string;
    id_kavling: string;
    id_tipe: string | null;
    tgl_spk: string | null;
    tgl_target_selesai: string | null;
    status_spk: string | null;
    progress_total: number | string | null;
  }>;

  const decisionRows = (decision ?? []) as Array<{
    id_spk: string;
    id_kavling: string;
    id_tipe: string | null;
    tgl_spk: string | null;
    tgl_target_selesai: string | null;
    status_spk: string | null;
    is_active: boolean | null;
    progress_aktual: number | string | null;
    progress_seharusnya: number | string | null;
    gap_progress: number | string | null;
    sisa_hari: number | null;
    tanggal_update_terakhir: string | null;
    progress_periode_terakhir: number | string | null;
    status_operasional: string | null;
    status_ritme: string | null;
    prioritas_tindakan: string | null;
    action_rekomendasi: string | null;
    health_score: number | null;
    health_level: string | null;
    health_description: string | null;
  }>;

  const activeRows = salesRows.filter((row) => row.status_aktif !== false);

  return (
    <main className="laporan-page">
      <section className="kavio-panel laporan-selector">
        <div className="kavio-panel-head">
          <div>
            <h2 className="kavio-panel-title">PILIH LAPORAN</h2>
            <div className="kavio-panel-note">Laporan bersumber dari data operasional KAVIO yang sedang berjalan.</div>
          </div>
        </div>
        <div className="laporan-tabs">
          {REPORTS.map((item) => (
            <Link
              key={item.key}
              href={`/laporan?jenis=${item.key}`}
              className={`laporan-tab ${selected === item.key ? 'is-active' : ''}`}
            >
              <span>{item.label}</span>
              <small>{item.note}</small>
            </Link>
          ))}
        </div>
      </section>

      {selected === 'sales' && (
        <section className="kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">LAPORAN SALES</h2>
              <div className="kavio-panel-note">Rekap sales aktif berdasarkan data penjualan yang tersimpan.</div>
            </div>
            <span className="kavio-badge">{activeRows.length} DATA</span>
          </div>
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>TANGGAL BOOKING</th>
                  <th>KAVLING</th>
                  <th>NAMA KONSUMEN</th>
                  <th>PEMBAYARAN</th>
                  <th>HARGA JUAL</th>
                  <th>TARGET AKAD</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, index) => (
                  <tr key={row.id_sales}>
                    <td>{index + 1}</td>
                    <td>{formatKavioDate(row.tgl_booking)}</td>
                    <td>{row.id_kavling}</td>
                    <td>{row.nama_konsumen || '—'}</td>
                    <td>{row.jenis_pembayaran || '—'}</td>
                    <td>{money(row.harga_jual)}</td>
                    <td>{formatKavioDate(row.target_akad)}</td>
                    <td><span className={`kavio-badge status-${statusClass(row.status_sales)}`}>{row.status_sales || '—'}</span></td>
                  </tr>
                ))}
                {!activeRows.length && <tr><td colSpan={8} className="kavio-empty">BELUM ADA DATA SALES AKTIF.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected === 'progress' && (
        <section className="kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">LAPORAN PROGRESS</h2>
              <div className="kavio-panel-note">Rekap progress total berdasarkan view progress summary.</div>
            </div>
            <span className="kavio-badge">{progressRows.length} DATA</span>
          </div>
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>SPK</th>
                  <th>KAVLING</th>
                  <th>TIPE</th>
                  <th>TANGGAL SPK</th>
                  <th>TARGET SELESAI</th>
                  <th>PROGRESS TOTAL</th>
                  <th>STATUS SPK</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row, index) => (
                  <tr key={row.id_spk}>
                    <td>{index + 1}</td>
                    <td>{row.id_spk}</td>
                    <td>{row.id_kavling}</td>
                    <td>{row.id_tipe || '—'}</td>
                    <td>{formatKavioDate(row.tgl_spk)}</td>
                    <td>{formatKavioDate(row.tgl_target_selesai)}</td>
                    <td>{pct(row.progress_total)}</td>
                    <td><span className="kavio-badge">{row.status_spk || '—'}</span></td>
                  </tr>
                ))}
                {!progressRows.length && <tr><td colSpan={8} className="kavio-empty">BELUM ADA DATA PROGRESS.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected === 'decision' && (
        <section className="kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">LAPORAN DECISION ENGINE</h2>
              <div className="kavio-panel-note">Rekap kondisi operasional dan tindakan yang dihasilkan Decision Engine.</div>
            </div>
            <span className="kavio-badge">{decisionRows.length} DATA</span>
          </div>
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead>
                <tr>
                  <th>NO</th>
                  <th>KAVLING</th>
                  <th>PROGRESS AKTUAL</th>
                  <th>TARGET PROGRESS</th>
                  <th>GAP</th>
                  <th>SISA HARI</th>
                  <th>HEALTH</th>
                  <th>PRIORITAS</th>
                  <th>TINDAKAN</th>
                </tr>
              </thead>
              <tbody>
                {decisionRows.map((row, index) => (
                  <tr key={row.id_spk}>
                    <td>{index + 1}</td>
                    <td>{row.id_kavling}</td>
                    <td>{pct(row.progress_aktual)}</td>
                    <td>{pct(row.progress_seharusnya)}</td>
                    <td>{pct(row.gap_progress)}</td>
                    <td>{row.sisa_hari ?? '—'}</td>
                    <td><span className="kavio-badge">{row.health_level || '—'}</span></td>
                    <td><span className="kavio-badge">{row.prioritas_tindakan || '—'}</span></td>
                    <td>{row.action_rekomendasi || '—'}</td>
                  </tr>
                ))}
                {!decisionRows.length && <tr><td colSpan={9} className="kavio-empty">BELUM ADA DATA DECISION ENGINE.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
