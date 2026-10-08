import Link from 'next/link';
import { activateSpk, deactivateSpk } from './actions';
import SpkCreatePanel from './SpkCreatePanel';
import { createClient } from '../../../lib/supabase/server';
import { formatKavioDate } from '../../lib/date-format';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import KavioActionGate from '../../components/KavioActionGate';

const PAGE_SIZE = 25;

type SearchParams = Promise<{ error?: string; success?: string; page?: string }>;
type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string; status_kavling: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };
type Spk = { id_spk: string; id_kavling: string; tgl_spk: string; id_tipe: string; jenis_bobot: string; id_kantor: string; id_mandor: string; status_spk: string; tgl_target_selesai: string; is_active: boolean };
type SpkKpi = { total_spk:number|string; aktif:number|string; draft:number|string; selesai:number|string };

export default async function MasterSpkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const requestedPage = Number.parseInt(params.page ?? '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

const [kavlingRes, tipeRes, kantorRes, mandorRes, kategoriRes, templateRes, spkRes, kpiRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe, status_kavling').eq('status_aktif', true).in('status_kavling', ['AVAILABLE', 'BOOKING']).order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('master_kantor_pelaksana').select('id_kantor, nama_kantor_pelaksana').eq('status_aktif', true).order('nama_kantor_pelaksana'),
    supabase.from('master_mandor').select('id_mandor, nama_mandor, id_kantor').eq('status_aktif', true).order('nama_mandor'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('template_progress_tipe').select('id_tipe, id_kategori, bobot_standar').order('id_tipe').order('id_kategori'),
    supabase.from('spk').select('id_spk, id_kavling, tgl_spk, id_tipe, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('kavio_spk_kpi'),
  ]);

  const kavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kantorRows = (kantorRes.data ?? []) as Kantor[];
  const mandorRows = (mandorRes.data ?? []) as Mandor[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const templateRows = (templateRes.data ?? []) as Template[];
  const spkRows = (spkRes.data ?? []) as Spk[];
  const kpi = (kpiRes.data?.[0] ?? { total_spk: 0, aktif: 0, draft: 0, selesai: 0 }) as SpkKpi;
  const totalSpk = spkRes.count ?? Number(kpi.total_spk);
  const totalPages = Math.max(1, Math.ceil(totalSpk / PAGE_SIZE));
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;
  const pageHref = (page: number) => page > 1 ? `/master/spk?page=${page}` : '/master/spk';

  const pageError = params.error ?? kavlingRes.error?.message ?? tipeRes.error?.message ?? kantorRes.error?.message ?? mandorRes.error?.message ?? kategoriRes.error?.message ?? templateRes.error?.message ?? spkRes.error?.message ?? kpiRes.error?.message;
  const tipeMap = new Map(tipeRows.map((item) => [item.id_tipe, item.nama_tipe]));
  const kantorMap = new Map(kantorRows.map((item) => [item.id_kantor, item.nama_kantor_pelaksana]));
  const mandorMap = new Map(mandorRows.map((item) => [item.id_mandor, item.nama_mandor]));
  const aktif = Number(kpi.aktif);
  const draft = Number(kpi.draft);
  const selesai = Number(kpi.selesai);

  return (
    <main className="spk-page">
      {pageError && <div className="kavio-alert error">{pageError}</div>}
      {params.success && <div className="kavio-alert success">{params.success}</div>}

      <div className="spk-stats">
        <div className="kavio-kpi spk-stat"><span className="kavio-kpi-label">SPK AKTIF</span><strong className="kavio-kpi-value">{aktif}</strong><small className="kavio-kpi-note">Pekerjaan berjalan</small></div>
        <div className="spk-stat"><span className="kavio-kpi-label">DRAFT</span><strong className="kavio-kpi-value">{draft}</strong><small className="kavio-kpi-note">Menunggu aktivasi</small></div>
        <div className="spk-stat"><span className="kavio-kpi-label">SELESAI</span><strong className="kavio-kpi-value">{selesai}</strong><small className="kavio-kpi-note">Riwayat pekerjaan</small></div>
        <div className="spk-stat"><span className="kavio-kpi-label">SIAP SPK</span><strong className="kavio-kpi-value">{kavlingRows.length}</strong><small className="kavio-kpi-note">Kavling tersedia</small></div>
      </div>

      <section className="kavio-panel spk-list-card">
        <div className="kavio-panel-head">
          <div><h2 className="kavio-panel-title">DAFTAR SPK</h2><div className="kavio-panel-note">Histori SPK tersimpan; hanya satu SPK dapat aktif pada satu kavling.</div></div>
          <div className="spk-toolbar-actions">
            <span className="kavio-badge">{totalSpk} DATA</span>
            <Link href="/progress" className="kavio-button secondary">LIHAT PROGRESS</Link>
          </div>
        </div>
        <div className="kavio-table-wrap">
          <table className="kavio-table spk-table">
            <thead><tr><th>KAVLING</th><th>TANGGAL</th><th>TIPE</th><th>PELAKSANA</th><th>MANDOR</th><th>BOBOT</th><th>TARGET</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>
              {spkRows.map((row) => <tr key={row.id_spk}>
                <td><Link href={`/master/spk/detail/${row.id_spk}`} prefetch={false} className="spk-kavling">{row.id_kavling}</Link></td>
                <td>{formatKavioDate(row.tgl_spk)}</td>
                <td>{tipeMap.get(row.id_tipe) ?? row.id_tipe}</td>
                <td>{kantorMap.get(row.id_kantor) ?? row.id_kantor}</td>
                <td>{mandorMap.get(row.id_mandor) ?? row.id_mandor}</td>
                <td>{row.jenis_bobot}</td>
                <td>{formatKavioDate(row.tgl_target_selesai)}</td>
                <td><span className={`spk-badge ${row.status_spk.toLowerCase()}`}>{row.status_spk}</span></td>
                <td><div className="spk-actions">
                  <Link href={`/master/spk/detail/${row.id_spk}`} prefetch={false} className="kavio-button secondary">DETAIL</Link>
                  <KavioActionGate action="SPK_WRITE">
                    {row.status_spk === 'DRAFT' && !row.is_active ? <form action={activateSpk}><input type="hidden" name="id_spk" value={row.id_spk} /><button type="submit" className="kavio-button">AKTIFKAN</button></form> : null}
                    {row.is_active ? <KavioConfirmAction action={deactivateSpk} hidden={{ id_spk: row.id_spk }} label="SELESAIKAN" confirmMessage={'Konfirmasi: SPK ' + row.id_spk.slice(0, 8) + ' untuk kavling ' + row.id_kavling + ' akan ditandai SELESAI. Pastikan progress aktual sudah 100%. Lanjutkan?'} /> : null}
                  </KavioActionGate>
                </div></td>
              </tr>)}
              {!spkRows.length && <tr><td colSpan={9} className="kavio-empty">BELUM ADA DATA SPK.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="kavio-pagination kavio-pagination-foot" aria-label="Navigasi halaman SPK">
          {hasPrev ? <Link href={pageHref(currentPage-1)} className="kavio-button secondary">← SEBELUMNYA</Link> : <span />}
          <span>HALAMAN {currentPage} / {totalPages} · MENAMPILKAN {spkRows.length} DARI {totalSpk} DATA</span>
          {hasNext ? <Link href={pageHref(currentPage+1)} className="kavio-button secondary">BERIKUTNYA →</Link> : <span />}
        </div>
      </section>

      <SpkCreatePanel kavlingRows={kavlingRows} kategoriRows={kategoriRows} templateRows={templateRows} kantorRows={kantorRows} mandorRows={mandorRows} />
    </main>
  );
}
