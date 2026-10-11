import Link from 'next/link';
import KavioPipeline from '../../components/KavioPipeline';
import KavioSplitKpi from '../../components/KavioSplitKpi';
import { activateSpk, deactivateSpk } from './actions';
import SpkCreatePanel from './SpkCreatePanel';
import FasumSpkCreatePanel from './FasumSpkCreatePanel';
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
type Spk = { id_spk: string; id_kavling: string | null; jenis_spk: 'KAVLING' | 'FASUM'; nama_objek: string | null; tgl_spk: string; id_tipe: string | null; jenis_bobot: string; id_kantor: string; id_mandor: string; status_spk: string; tgl_target_selesai: string; is_active: boolean; configured_at:string|null };
type SpkKpi = { jenis_spk: 'KAVLING' | 'FASUM'; total_spk:number|string; aktif:number|string; draft:number|string; selesai:number|string };

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
    supabase.from('spk').select('id_spk, id_kavling, jenis_spk, nama_objek, tgl_spk, id_tipe, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active, configured_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
    supabase.rpc('kavio_spk_kpi_by_kind'),
  ]);

  const kavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kantorRows = (kantorRes.data ?? []) as Kantor[];
  const mandorRows = (mandorRes.data ?? []) as Mandor[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const templateRows = (templateRes.data ?? []) as Template[];
  const spkRows = (spkRes.data ?? []) as Spk[];
  const kpiRows = (kpiRes.data ?? []) as SpkKpi[];
  const kpi = { total_spk:0, aktif:0, draft:0, selesai:0 };
  for (const row of kpiRows) for (const key of Object.keys(kpi) as (keyof typeof kpi)[]) kpi[key] += Number(row[key]);
  const kindParts = (key: keyof typeof kpi) => (['KAVLING','FASUM'] as const).map(kind=>({label:kind,value:Number(kpiRows.find(row=>row.jenis_spk===kind)?.[key] ?? 0)}));
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
        {([{label:'TOTAL SPK',value:totalSpk,key:'total_spk'},{label:'AKTIF',value:aktif,key:'aktif'},{label:'DRAFT',value:draft,key:'draft'},{label:'SELESAI',value:selesai,key:'selesai'}] as const).map(card=><KavioSplitKpi key={card.key} label={card.label} total={card.value} parts={kindParts(card.key)}/>)}
      </div>

      <KavioPipeline label="PIPELINE SPK" stages={[{label:'DRAFT',count:draft,tone:'muted'},{label:'AKTIF',count:aktif,tone:'gold'},{label:'SELESAI',count:selesai,tone:'success'}]}/>

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
            <thead><tr><th>OBJEK SPK</th><th>TANGGAL</th><th>TIPE</th><th>PELAKSANA</th><th>MANDOR</th><th>BOBOT</th><th>TARGET</th><th>STATUS</th><th>AKSI</th></tr></thead>
            <tbody>
              {spkRows.map((row) => <tr key={row.id_spk}>
                <td><Link href={`/master/spk/detail/${row.id_spk}`} prefetch={false} className="spk-kavling">{row.jenis_spk === 'FASUM' ? `FASUM · ${row.nama_objek}` : row.id_kavling}</Link></td>
                <td>{formatKavioDate(row.tgl_spk)}</td>
                <td>{row.id_tipe ? tipeMap.get(row.id_tipe) ?? row.id_tipe : '—'}</td>
                <td>{kantorMap.get(row.id_kantor) ?? row.id_kantor}</td>
                <td>{mandorMap.get(row.id_mandor) ?? row.id_mandor}</td>
                <td>{row.jenis_bobot}</td>
                <td>{formatKavioDate(row.tgl_target_selesai)}</td>
                <td><span className={`spk-badge ${row.status_spk.toLowerCase()}`}>{row.status_spk}</span></td>
                <td><div className="spk-actions">
                  <Link href={`/master/spk/detail/${row.id_spk}`} prefetch={false} className="kavio-button secondary">CONTROL SHEET</Link>
                  <Link href={`/master/spk/konfigurasi?id=${row.id_spk}`} className="kavio-button secondary">KONFIGURASI</Link>
                  <KavioActionGate action="SPK_WRITE">
                    {row.status_spk === 'DRAFT' && !row.is_active ? <form action={activateSpk}><input type="hidden" name="id_spk" value={row.id_spk} /><button type="submit" className="kavio-button" disabled={!row.configured_at} title={!row.configured_at?'Simpan konfigurasi sebelum aktivasi':undefined}>AKTIFKAN</button></form> : null}
                    {row.is_active ? <KavioConfirmAction action={deactivateSpk} hidden={{ id_spk: row.id_spk }} label="SELESAIKAN" confirmMessage={'Konfirmasi: SPK ' + row.id_spk.slice(0, 8) + ' untuk objek ' + (row.jenis_spk === 'FASUM' ? row.nama_objek : row.id_kavling) + ' akan ditandai SELESAI. Pastikan progress aktual sudah 100%. Lanjutkan?'} /> : null}
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

      <div className="kavio-actions"><SpkCreatePanel kavlingRows={kavlingRows} kategoriRows={kategoriRows} templateRows={templateRows} kantorRows={kantorRows} mandorRows={mandorRows} /><FasumSpkCreatePanel kantorRows={kantorRows} mandorRows={mandorRows} /></div>
    </main>
  );
}
