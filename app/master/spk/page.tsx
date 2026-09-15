import Link from 'next/link';
import { redirect } from 'next/navigation';
import { activateSpk, createSpk, deactivateSpk } from './actions';
import WeightConfigurator from './WeightConfigurator';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string; status_kavling: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };
type Spk = { id_spk: string; id_kavling: string; tgl_spk: string; id_tipe: string; jenis_bobot: string; id_kantor: string; id_mandor: string; status_spk: string; tgl_target_selesai: string; is_active: boolean };

export default async function MasterSpkPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [kavlingRes, tipeRes, kantorRes, mandorRes, kategoriRes, templateRes, spkRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe, status_kavling').eq('status_aktif', true).order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('master_kantor_pelaksana').select('id_kantor, nama_kantor_pelaksana').eq('status_aktif', true).order('nama_kantor_pelaksana'),
    supabase.from('master_mandor').select('id_mandor, nama_mandor, id_kantor').eq('status_aktif', true).order('nama_mandor'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('template_progress_tipe').select('id_tipe, id_kategori, bobot_standar').order('id_tipe').order('id_kategori'),
    supabase.from('spk').select('id_spk, id_kavling, tgl_spk, id_tipe, jenis_bobot, id_kantor, id_mandor, status_spk, tgl_target_selesai, is_active').order('created_at', { ascending: false }),
  ]);

  const allKavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const kavlingRows = allKavlingRows.filter((row) => ['AVAILABLE', 'BOOKING'].includes(row.status_kavling));
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kantorRows = (kantorRes.data ?? []) as Kantor[];
  const mandorRows = (mandorRes.data ?? []) as Mandor[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const templateRows = (templateRes.data ?? []) as Template[];
  const spkRows = (spkRes.data ?? []) as Spk[];

  const pageError = params.error ?? kavlingRes.error?.message ?? tipeRes.error?.message ?? kantorRes.error?.message ?? mandorRes.error?.message ?? kategoriRes.error?.message ?? templateRes.error?.message ?? spkRes.error?.message;
  const tipeMap = new Map(tipeRows.map((item) => [item.id_tipe, item.nama_tipe]));
  const kantorMap = new Map(kantorRows.map((item) => [item.id_kantor, item.nama_kantor_pelaksana]));
  const mandorMap = new Map(mandorRows.map((item) => [item.id_mandor, item.nama_mandor]));
  const aktif = spkRows.filter((row) => row.is_active).length;
  const draft = spkRows.filter((row) => row.status_spk === 'DRAFT').length;
  const selesai = spkRows.filter((row) => row.status_spk === 'SELESAI').length;

  return (
    <main className="spk-page">
      <div className="spk-heading">
        <div><div className="spk-eyebrow">5. SPK / PEKERJAAN</div><h1>Construction Management</h1><p>Kelola Surat Perintah Kerja, tim pelaksana, target penyelesaian, dan siklus pembangunan kavling.</p></div>
        <Link href="/progress" className="spk-secondary">Lihat Progress</Link>
      </div>

      {pageError && <div className="spk-alert error">{pageError}</div>}
      {params.success && <div className="spk-alert success">{params.success}</div>}

      <div className="spk-stats">
        <div className="spk-stat"><span>SPK AKTIF</span><strong>{aktif}</strong><small>Pekerjaan berjalan</small></div>
        <div className="spk-stat"><span>DRAFT</span><strong>{draft}</strong><small>Menunggu aktivasi</small></div>
        <div className="spk-stat"><span>SELESAI</span><strong>{selesai}</strong><small>Riwayat pekerjaan</small></div>
        <div className="spk-stat"><span>SIAP SPK</span><strong>{kavlingRows.length}</strong><small>Kavling tersedia</small></div>
      </div>

      <section className="spk-card">
        <div className="spk-card-head"><div><b>Buat SPK Baru</b><span>SPK menjadi aktif setelah konfigurasi bobot progress valid dan diaktifkan.</span></div><span className="spk-tag">WORK ORDER</span></div>
        <form action={createSpk} className="spk-form">
          <WeightConfigurator kavlingRows={kavlingRows} kategoriRows={kategoriRows} templateRows={templateRows} />
          <Field name="tgl_spk" label="Tanggal SPK" type="date" />
          <Field name="tgl_target_selesai" label="Target Selesai" type="date" />
          <label className="spk-field"><span>Kantor / Pelaksana</span><select name="id_kantor" required defaultValue=""><option value="" disabled>Pilih kantor</option>{kantorRows.map((item) => <option key={item.id_kantor} value={item.id_kantor}>{item.nama_kantor_pelaksana}</option>)}</select></label>
          <label className="spk-field"><span>Mandor</span><select name="id_mandor" required defaultValue=""><option value="" disabled>Pilih mandor</option>{mandorRows.map((item) => <option key={item.id_mandor} value={item.id_mandor}>{item.nama_mandor} — {kantorMap.get(item.id_kantor) ?? item.id_kantor}</option>)}</select></label>
          <div className="spk-form-foot"><span><b>Aturan:</b> Sales tidak wajib. SPK baru hanya untuk kavling AVAILABLE atau BOOKING. Saat aktif, kavling menjadi BUILDING.</span><button type="submit" className="spk-primary" disabled={!kavlingRows.length || !kantorRows.length || !mandorRows.length || !kategoriRows.length}>＋ Simpan SPK sebagai DRAFT</button></div>
        </form>
      </section>

      <section className="spk-card spk-list-card">
        <div className="spk-card-head"><div><b>Daftar SPK</b><span>Histori SPK tersimpan; hanya satu SPK dapat aktif pada satu kavling.</span></div><span className="spk-count">{spkRows.length} data</span></div>
        <div className="spk-table-wrap"><table className="spk-table"><thead><tr><th>Kavling</th><th>Tanggal</th><th>Tipe</th><th>Pelaksana</th><th>Mandor</th><th>Bobot</th><th>Target</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
          {spkRows.map((row) => <tr key={row.id_spk}><td><Link href={`/master/spk/detail?id=${row.id_spk}`} className="spk-kavling">{row.id_kavling}</Link></td><td>{row.tgl_spk}</td><td>{tipeMap.get(row.id_tipe) ?? row.id_tipe}</td><td>{kantorMap.get(row.id_kantor) ?? row.id_kantor}</td><td>{mandorMap.get(row.id_mandor) ?? row.id_mandor}</td><td>{row.jenis_bobot}</td><td>{row.tgl_target_selesai}</td><td><span className={`spk-badge ${row.status_spk.toLowerCase()}`}>{row.status_spk}</span></td><td><div className="spk-actions"><Link href={`/master/spk/detail?id=${row.id_spk}`} className="spk-detail">Detail</Link>{row.status_spk === 'DRAFT' && !row.is_active ? <form action={activateSpk}><input type="hidden" name="id_spk" value={row.id_spk} /><button type="submit" className="spk-mini primary">Aktifkan</button></form> : row.is_active ? <form action={deactivateSpk}><input type="hidden" name="id_spk" value={row.id_spk} /><button type="submit" className="spk-mini">Selesaikan</button></form> : null}</div></td></tr>)}
          {!spkRows.length && <tr><td colSpan={9} className="spk-empty">Belum ada data SPK.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  );
}

function Field({ name, label, type = 'text' }: { name: string; label: string; type?: string }) { return <label className="spk-field"><span>{label}</span><input name={name} type={type} required /></label>; }
