import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { upsertTemplateProgress } from './actions';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Tipe = { id_tipe: string; nama_tipe: string };
type Kategori = { id_kategori: string; nama_kategori: string; urutan: number };
type Template = { id_tipe: string; id_kategori: string; bobot_standar: number | string };

export default async function TemplateProgressPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [tipeRes, kategoriRes, templateRes] = await Promise.all([
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('master_kategori_pekerjaan').select('id_kategori, nama_kategori, urutan').eq('status_aktif', true).order('urutan'),
    supabase.from('template_progress_tipe').select('id_tipe, id_kategori, bobot_standar').order('id_tipe').order('id_kategori'),
  ]);

  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const kategoriRows = (kategoriRes.data ?? []) as Kategori[];
  const templateRows = (templateRes.data ?? []) as Template[];
  const pageError = params.error ?? tipeRes.error?.message ?? kategoriRes.error?.message ?? templateRes.error?.message;

  const tipeMap = new Map(tipeRows.map((row) => [row.id_tipe, row.nama_tipe]));
  const kategoriMap = new Map(kategoriRows.map((row) => [row.id_kategori, row.nama_kategori]));
  const grouped = new Map<string, Template[]>();
  for (const row of templateRows) {
    const list = grouped.get(row.id_tipe) ?? [];
    list.push(row);
    grouped.set(row.id_tipe, list);
  }

  return (
    <main className="spk-page">
      <div className="spk-heading">
        <div>
          <div className="spk-eyebrow">MASTER DATA CONTROL</div>
          <h1>Template Progress</h1>
          <p>Atur bobot progress standar per tipe rumah. Template ini menjadi sumber konfigurasi SPK standar dan akan disnapshot saat SPK dibuat.</p>
        </div>
        <Link href="/master" className="spk-secondary">← Kembali ke Master Data</Link>
      </div>

      {pageError && <div className="spk-alert error">{pageError}</div>}
      {params.success && <div className="spk-alert success">{params.success}</div>}

      <section className="spk-card">
        <div className="spk-card-head">
          <div><b>Tambah / Ubah Bobot</b><span>Simpan satu kombinasi tipe rumah + kategori. Nilai 100% berarti seluruh bobot pekerjaan.</span></div>
          <span className="spk-tag">TEMPLATE</span>
        </div>
        <form action={upsertTemplateProgress} className="spk-form">
          <label className="spk-field"><span>Tipe Rumah</span><select name="id_tipe" required defaultValue=""><option value="" disabled>Pilih tipe rumah</option>{tipeRows.map((row) => <option key={row.id_tipe} value={row.id_tipe}>{row.id_tipe} — {row.nama_tipe}</option>)}</select></label>
          <label className="spk-field"><span>Kategori Pekerjaan</span><select name="id_kategori" required defaultValue=""><option value="" disabled>Pilih kategori</option>{kategoriRows.map((row) => <option key={row.id_kategori} value={row.id_kategori}>{row.id_kategori} — {row.nama_kategori}</option>)}</select></label>
          <label className="spk-field"><span>Bobot Standar (%)</span><input name="bobot_standar" type="number" min="0" max="100" step="0.01" required placeholder="Contoh: 15" /></label>
          <div className="spk-form-foot"><span><b>Catatan:</b> total bobot ideal untuk setiap tipe rumah adalah 100%. Halaman ini menampilkan total aktual agar mudah diverifikasi.</span><button type="submit" className="spk-primary">＋ Simpan Bobot</button></div>
        </form>
      </section>

      <section className="spk-card spk-list-card">
        <div className="spk-card-head"><div><b>Template per Tipe Rumah</b><span>Audit cepat total bobot untuk memastikan standar = 100%.</span></div><span className="spk-count">{tipeRows.length} tipe</span></div>
        <div className="spk-table-wrap">
          <table className="spk-table">
            <thead><tr><th>Tipe Rumah</th><th>Kategori</th><th>Bobot</th></tr></thead>
            <tbody>
              {tipeRows.map((tipe) => {
                const rows = grouped.get(tipe.id_tipe) ?? [];
                const total = rows.reduce((sum, row) => sum + Number(row.bobot_standar), 0) * 100;
                return rows.length ? rows.map((row) => (
                  <tr key={`${row.id_tipe}-${row.id_kategori}`}>
                    <td>{tipe.id_tipe} — {tipe.nama_tipe}</td>
                    <td>{row.id_kategori} — {kategoriMap.get(row.id_kategori) ?? row.id_kategori}</td>
                    <td>{(Number(row.bobot_standar) * 100).toFixed(2)}%</td>
                  </tr>
                )) : (
                  <tr key={`${tipe.id_tipe}-empty`}><td>{tipe.id_tipe} — {tipe.nama_tipe}</td><td colSpan={2} className="spk-empty">Belum ada template.</td></tr>
                );
              })}
              {!tipeRows.length && <tr><td colSpan={3} className="spk-empty">Belum ada tipe rumah aktif.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
          {tipeRows.map((tipe) => {
            const rows = grouped.get(tipe.id_tipe) ?? [];
            const total = rows.reduce((sum, row) => sum + Number(row.bobot_standar), 0) * 100;
            const tone = Math.abs(total - 100) < 0.01 ? 'spk-status-ok' : 'spk-status-warn';
            return <div key={`total-${tipe.id_tipe}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid rgba(216,180,90,.22)', borderRadius: 9 }}>
              <span style={{ color: 'var(--kavio-ivory)', fontWeight: 800 }}>{tipeMap.get(tipe.id_tipe) ?? tipe.id_tipe}</span>
              <span className={tone}>{total.toFixed(2)}% {Math.abs(total - 100) < 0.01 ? 'VALID' : 'PERLU DILENGKAPI'}</span>
            </div>;
          })}
        </div>
      </section>
    </main>
  );
}
