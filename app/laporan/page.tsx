import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { formatKavioDate } from '../lib/date-format';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const REPORTS = [
  { key: 'sales', label: 'LAPORAN SALES', note: 'Rekap status penjualan, konsumen, pembayaran, dan target akad.' },
  { key: 'progress', label: 'LAPORAN PROGRESS', note: 'Rekap progress pembangunan per SPK/kavling.' },
  { key: 'decision', label: 'LAPORAN DECISION ENGINE', note: 'Rekap kondisi operasional dan tindakan yang dihasilkan sistem.' },
] as const;

const textParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
};

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
  String(value ?? '').toLowerCase().replace(/\s+/g, '_');

const displaySalesStatus = (value: string | null | undefined) =>
  String(value ?? '').toUpperCase() === 'DP' ? 'UANG MUKA' : (value || '—');

const SALES_STATUS_OPTIONS = ['BOOKING', 'UANG MUKA', 'PROSES KPR', 'AKAD'] as const;

const displaySalesStatus = (value: string | null | undefined) =>
  String(value ?? '').toUpperCase() === 'DP' ? 'UANG MUKA' : (value || '—');

const SALES_STATUS_OPTIONS = ['BOOKING', 'UANG MUKA', 'PROSES KPR', 'AKAD'] as const;

const formatDocumentCode = (
  prefix: 'SPK' | 'SLS',
  dateValue: string | null | undefined,
  sequence: number,
) => {
  const year = dateValue && /^\d{4}/.test(dateValue) ? dateValue.slice(2, 4) : String(new Date().getFullYear()).slice(2, 4);
  return `${prefix}-${year}/${String(sequence).padStart(4, '0')}`;
};

const contains = (value: unknown, q: string) =>
  !q || String(value ?? '').toLowerCase().includes(q.toLowerCase());

export default async function LaporanPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selected = REPORTS.some((item) => item.key === textParam(params, 'jenis'))
    ? textParam(params, 'jenis')
    : 'sales';

  const q = textParam(params, 'q');
  const status = textParam(params, 'status');
  const payment = textParam(params, 'payment');
  const dateFrom = textParam(params, 'date_from');
  const dateTo = textParam(params, 'date_to');
  const spkStatus = textParam(params, 'spk');
  const tipe = textParam(params, 'tipe');
  const kantor = textParam(params, 'kantor');
  const mandor = textParam(params, 'mandor');
  const health = textParam(params, 'health');
  const priority = textParam(params, 'priority');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [
    { data: sales },
    { data: progress },
    { data: decision },
    { data: banks },
    { data: offices },
    { data: mandors },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('id_sales,id_kavling,nama_konsumen,status_sales,jenis_pembayaran,harga_jual,tgl_booking,target_akad,status_aktif,id_bank')
      .order('tgl_booking', { ascending: false }),
    supabase
      .from('v_progress_summary')
      .select('id_spk,id_kavling,id_tipe,id_kantor,id_mandor,tgl_spk,tgl_target_selesai,status_spk,progress_total')
      .order('id_kavling'),
    supabase
      .from('v_decision_engine')
      .select('id_spk,id_kavling,id_tipe,tgl_spk,tgl_target_selesai,status_spk,is_active,progress_aktual,progress_seharusnya,sisa_hari,tanggal_update_terakhir,status_operasional,status_ritme,prioritas_tindakan,action_rekomendasi,health_score,health_level,health_description')
      .order('id_kavling'),
    supabase
      .from('master_bank')
      .select('id_bank,nama_bank')
      .order('nama_bank'),
    supabase
      .from('master_kantor_pelaksana')
      .select('id_kantor,nama_kantor_pelaksana')
      .order('nama_kantor_pelaksana'),
    supabase
      .from('master_mandor')
      .select('id_mandor,nama_mandor,id_kantor')
      .order('nama_mandor'),
  ]);

  const salesRows = (sales ?? []) as Array<{
    id_sales: string;
    id_kavling: string;
    nama_konsumen: string | null;
    id_bank?: string | null;
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
    id_kantor: string | null;
    id_mandor: string | null;
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
    sisa_hari: number | null;
    tanggal_update_terakhir: string | null;
    status_operasional: string | null;
    status_ritme: string | null;
    prioritas_tindakan: string | null;
    action_rekomendasi: string | null;
    health_score: number | null;
    health_level: string | null;
    health_description: string | null;
  }>;

  const bankMap = new Map((banks ?? []).map((row) => [String(row.id_bank), String(row.nama_bank)]));
  const officeMap = new Map((offices ?? []).map((row) => [String(row.id_kantor), String(row.nama_kantor_pelaksana)]));
  const mandorMap = new Map((mandors ?? []).map((row) => [String(row.id_mandor), String(row.nama_mandor)]));

  const activeSales = salesRows.filter((row) => row.status_aktif !== false);

  const salesWithCode = activeSales.map((row, index) => ({
    ...row,
    displayId: formatDocumentCode('SLS', row.tgl_booking, index + 1),
  }));

  const progressWithCode = progressRows.map((row, index) => ({
    ...row,
    displayId: formatDocumentCode('SPK', row.tgl_spk, index + 1),
  }));

  const filteredSales = salesWithCode.filter((row) =>
    (!status || displaySalesStatus(row.status_sales) === status) &&
    (!payment || row.jenis_pembayaran === payment) &&
    (!dateFrom || !row.tgl_booking || row.tgl_booking >= dateFrom) &&
    (!dateTo || !row.tgl_booking || row.tgl_booking <= dateTo) &&
    (
      contains(row.displayId, q) ||
      contains(row.id_sales, q) ||
      contains(row.id_kavling, q) ||
      contains(row.nama_konsumen, q)
    )
  );

  const filteredProgress = progressWithCode.filter((row) =>
    (!spkStatus || row.status_spk === spkStatus) &&
    (!tipe || row.id_tipe === tipe) &&
    (!kantor || row.id_kantor === kantor) &&
    (!mandor || row.id_mandor === mandor) &&
    (
      contains(row.displayId, q) ||
      contains(row.id_spk, q) ||
      contains(row.id_kavling, q) ||
      contains(row.id_tipe, q)
    )
  );

  const decisionWithCode = decisionRows.map((row, index) => ({
    ...row,
    displayId: formatDocumentCode('SPK', row.tgl_spk, index + 1),
  }));

  const filteredDecision = decisionWithCode.filter((row) =>
    (!health || row.health_level === health) &&
    (!priority || row.prioritas_tindakan === priority) &&
    (
      contains(row.id_spk, q) ||
      contains(row.id_kavling, q) ||
      contains(row.health_level, q)
    )
  );

  const salesStatuses = SALES_STATUS_OPTIONS;
  const payments = [...new Set(activeSales.map((row) => row.jenis_pembayaran).filter(Boolean))].sort();
  const spkStatuses = [...new Set(progressRows.map((row) => row.status_spk).filter(Boolean))].sort();
  const tipeOptions = [...new Set(progressRows.map((row) => row.id_tipe).filter(Boolean))].sort();
  const kantorOptions = [...new Set(progressRows.map((row) => row.id_kantor).filter(Boolean))].sort();
  const mandorOptions = [...new Set(progressRows.map((row) => row.id_mandor).filter(Boolean))].sort();
  const healthOptions = [...new Set(decisionRows.map((row) => row.health_level).filter(Boolean))].sort();
  const priorityOptions = [...new Set(decisionRows.map((row) => row.prioritas_tindakan).filter(Boolean))].sort();

  const filterHref = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    next.set('jenis', selected);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    return `/laporan?${next.toString()}`;
  };

  const FilterBar = ({ children }: { children: React.ReactNode }) => (
    <form method="get" className="laporan-filterbar">
      <input type="hidden" name="jenis" value={selected} />
      {children}
      <button type="submit" className="kavio-button">TAMPILKAN</button>
      <Link href={`/laporan?jenis=${selected}`} className="kavio-button secondary">RESET</Link>
    </form>
  );

  return (
    <main className="laporan-page">
      <section className="kavio-panel laporan-selector">
        <div className="laporan-tabs">
          {REPORTS.map((item) => (
            <Link key={item.key} href={`/laporan?jenis=${item.key}`} className={`laporan-tab ${selected === item.key ? 'is-active' : ''}`}>
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
            <span className="kavio-badge">{filteredSales.length} DATA</span>
          </div>
          <FilterBar>
            <input className="laporan-filter-search" name="q" defaultValue={q} placeholder="CARI ID SALES / KAVLING / KONSUMEN..." />
            <select name="status" defaultValue={status}><option value="">SEMUA STATUS</option>{salesStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select name="payment" defaultValue={payment}><option value="">SEMUA PEMBAYARAN</option>{payments.map((item) => <option key={item} value={item!}>{item}</option>)}</select>
            <label className="laporan-date-filter"><span>DARI TANGGAL</span><input type="date" name="date_from" defaultValue={dateFrom} /></label>
            <label className="laporan-date-filter"><span>SAMPAI TANGGAL</span><input type="date" name="date_to" defaultValue={dateTo} /></label>
          </FilterBar>
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead><tr><th>NO</th><th>ID SALES</th><th>TANGGAL BOOKING</th><th>KAVLING</th><th>NAMA KONSUMEN</th><th>PEMBAYARAN</th><th>BANK KPR</th><th>HARGA JUAL</th><th>TARGET AKAD</th><th>STATUS</th></tr></thead>
              <tbody>
                {filteredSales.map((row, index) => <tr key={row.id_sales}><td>{index + 1}</td><td>{row.displayId}</td><td>{formatKavioDate(row.tgl_booking)}</td><td>{row.id_kavling}</td><td>{row.nama_konsumen || '—'}</td><td>{row.jenis_pembayaran || '—'}</td><td>{row.id_bank ? (bankMap.get(String(row.id_bank)) || row.id_bank) : '—'}</td><td>{money(row.harga_jual)}</td><td>{formatKavioDate(row.target_akad)}</td><td><span className={`kavio-badge status-${statusClass(displaySalesStatus(row.status_sales))}`}>{displaySalesStatus(row.status_sales)}</span></td></tr>)}
                {!filteredSales.length && <tr><td colSpan={10} className="kavio-empty">TIDAK ADA DATA YANG SESUAI FILTER.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected === 'progress' && (
        <section className="kavio-panel">
          <div className="kavio-panel-head">
            <div><h2 className="kavio-panel-title">LAPORAN PROGRESS</h2><div className="kavio-panel-note">Rekap progress total berdasarkan view progress summary.</div></div>
            <span className="kavio-badge">{filteredProgress.length} DATA</span>
          </div>
          <FilterBar>
            <input className="laporan-filter-search" name="q" defaultValue={q} placeholder="CARI ID SPK / KAVLING / TIPE..." />
            <select name="spk" defaultValue={spkStatus}><option value="">SEMUA STATUS SPK</option>{spkStatuses.map((item) => <option key={item} value={item!}>{item}</option>)}</select>
            <select name="tipe" defaultValue={tipe}><option value="">SEMUA TIPE</option>{tipeOptions.map((item) => <option key={item} value={item!}>{item}</option>)}</select>
            <select name="kantor" defaultValue={kantor}><option value="">SEMUA KANTOR</option>{kantorOptions.map((item) => <option key={item} value={item!}>{item}</option>)}</select>
            <select name="mandor" defaultValue={mandor}><option value="">SEMUA MANDOR</option>{mandorOptions.map((item) => <option key={item} value={item!}>{item}</option>)}</select>
          </FilterBar>
          <div className="kavio-table-wrap">
            <table className="kavio-table">
              <thead><tr><th>NO</th><th>SPK</th><th>KAVLING</th><th>TIPE</th><th>KANTOR</th><th>MANDOR</th><th>TANGGAL SPK</th><th>TARGET SELESAI</th><th>PROGRESS TOTAL</th><th>STATUS SPK</th></tr></thead>
              <tbody>
                {filteredProgress.map((row,index) => <tr key={row.id_spk}><td>{index+1}</td><td>{row.displayId}</td><td>{row.id_kavling}</td><td>{row.id_tipe || '—'}</td><td>{row.id_kantor ? (officeMap.get(String(row.id_kantor)) || row.id_kantor) : '—'}</td><td>{row.id_mandor ? (mandorMap.get(String(row.id_mandor)) || row.id_mandor) : '—'}</td><td>{formatKavioDate(row.tgl_spk)}</td><td>{formatKavioDate(row.tgl_target_selesai)}</td><td>{pct(row.progress_total)}</td><td><span className="kavio-badge">{row.status_spk || '—'}</span></td></tr>)}
                {!filteredProgress.length && <tr><td colSpan={10} className="kavio-empty">TIDAK ADA DATA YANG SESUAI FILTER.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected === 'decision' && (
        <section className="kavio-panel">
          <div className="kavio-panel-head">
            <div><h2 className="kavio-panel-title">LAPORAN DECISION ENGINE</h2><div className="kavio-panel-note">Rekap kondisi operasional dan tindakan yang dihasilkan Decision Engine.</div></div>
            <span className="kavio-badge">{filteredDecision.length} DATA</span>
          </div>
          <FilterBar>
            <input className="laporan-filter-search" name="q" defaultValue={q} placeholder="CARI ID SPK / KAVLING / HEALTH..." />
            <select name="health" defaultValue={health}><option value="">SEMUA HEALTH</option>{healthOptions.map((item)=><option key={item} value={item!}>{item}</option>)}</select>
            <select name="priority" defaultValue={priority}><option value="">SEMUA PRIORITAS</option>{priorityOptions.map((item)=><option key={item} value={item!}>{item}</option>)}</select>
          </FilterBar>
          <div className="kavio-table-wrap">
            <table className="kavio-table laporan-decision-table">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead><tr><th>NO</th><th>SPK</th><th>KAVLING</th><th>TANGGAL SPK</th><th>TARGET SELESAI</th><th>UPDATE TERAKHIR</th><th>PROGRESS AKTUAL</th><th>TARGET PROGRESS</th><th>SISA HARI</th><th>HEALTH SCORE</th><th>HEALTH</th><th>PRIORITAS</th><th>TINDAKAN</th></tr></thead>
              <tbody>
                {filteredDecision.map((row,index) => <tr key={row.id_spk}><td>{index+1}</td><td>{row.displayId}</td><td>{row.id_kavling}</td><td>{formatKavioDate(row.tgl_spk)}</td><td>{formatKavioDate(row.tgl_target_selesai)}</td><td>{formatKavioDate(row.tanggal_update_terakhir)}</td><td>{pct(row.progress_aktual)}</td><td>{pct(row.progress_seharusnya)}</td><td>{row.sisa_hari ?? '—'}</td><td>{row.health_score ?? '—'}</td><td><span className="kavio-badge">{row.health_level || '—'}</span></td><td><span className="kavio-badge">{row.prioritas_tindakan || '—'}</span></td><td className="laporan-action-cell">{row.action_rekomendasi || '—'}</td></tr>)}
                {!filteredDecision.length && <tr><td colSpan={13} className="kavio-empty">TIDAK ADA DATA YANG SESUAI FILTER.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
