import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: summary, error } = await supabase
    .from('v_progress_summary')
    .select('id_kavling, progress_total, tgl_target_selesai, status_spm')
    .order('progress_total', { ascending: false })
    .limit(20);

  const rows = summary ?? [];
  const avgProgress = rows.length
    ? rows.reduce((total, row) => total + Number(row.progress_total ?? 0), 0) / rows.length
    : 0;

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fc', color: '#0f172a' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.2, color: '#2563eb' }}>KAVIO</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Monitor V1.0</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post" style={{ marginTop: 6 }}>
            <button type="submit" style={{ border: 0, background: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}>Keluar</button>
          </form>
        </div>
      </header>

      <section style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 28 }}>Dashboard Monitoring</h1>
            <p style={{ margin: 0, color: '#64748b' }}>Ringkasan progress proyek dari database KAVIO.</p>
          </div>
          <a href="/master/kavling" style={{ background: '#2563eb', color: '#fff', padding: '11px 16px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Master Kavling</a>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 14, borderRadius: 12, marginBottom: 20 }}>
            Gagal membaca data dashboard: {error.message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
          <Kpi label="Kavling Terpantau" value={String(rows.length)} />
          <Kpi label="Rata-rata Progress" value={`${(avgProgress * 100).toFixed(1)}%`} />
          <Kpi label="SPK Aktif" value={String(rows.filter((row) => row.status_spm === 'AKTIF').length)} />
        </div>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: 18, borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>Progress Kavling</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={th}>Kavling</th>
                  <th style={th}>Progress</th>
                  <th style={th}>Target Selesai</th>
                  <th style={th}>Status SPK</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id_kavling}>
                    <td style={td}>{row.id_kavling}</td>
                    <td style={td}>{(Number(row.progress_total ?? 0) * 100).toFixed(1)}%</td>
                    <td style={td}>{row.tgl_target_selesai ?? '-'}</td>
                    <td style={td}>{row.status_spm ?? '-'}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', padding: 32 }}>Belum ada data progress.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20 }}>
      <div style={{ color: '#64748b', fontSize: 13 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const th = { padding: '13px 16px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 };
const td = { padding: '14px 16px', borderBottom: '1px solid #f1f5f9' };
