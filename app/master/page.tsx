import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import KavioShell from '../components/kavio-shell';

const masterLinks = [
  { href: '/master/kavling', title: 'Kavling', desc: 'Blok, nomor kavling, tipe rumah, dan lifecycle inventory.', icon: '⌗' },
  { href: '/master/tipe-rumah', title: 'Tipe Rumah', desc: 'Master tipe rumah dan spesifikasi luas.', icon: '⌂' },
  { href: '/master/kategori-pekerjaan', title: 'Kategori Pekerjaan', desc: 'Kategori dan bobot pekerjaan pembangunan.', icon: '▦' },
  { href: '/master/kantor-pelaksana', title: 'Kantor Pelaksana', desc: 'Kantor/pelaksana yang menangani pekerjaan.', icon: '▥' },
  { href: '/master/mandor', title: 'Mandor', desc: 'Mandor dan relasinya dengan kantor pelaksana.', icon: '♙' },
  { href: '/master/spk', title: 'SPK Pembangunan', desc: 'Penerbitan, bobot, aktivasi, dan histori SPK.', icon: '▣' },
];

export default async function MasterHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <KavioShell active="/master">
      <div className="kavio-page-title">
        <div className="kavio-gold" style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.4 }}>MASTER DATA CONTROL</div>
        <h1>Pusat Master KAVIO</h1>
        <p>Semua referensi utama proyek dikelola dari satu pintu agar data SPK dan progress tetap konsisten.</p>
      </div>

      <section className="kavio-card" style={{ marginBottom: 18 }}>
        <div className="kavio-card-head">
          <div><div className="kavio-card-title">Urutan kerja yang disarankan</div><div className="kavio-card-note">Bangun referensi sebelum transaksi operasional.</div></div>
          <span className="kavio-status">CONTROL</span>
        </div>
        <div style={{ padding: '14px 18px', color: 'var(--kavio-gold-300)', fontWeight: 800, fontSize: 13 }}>Tipe Rumah → Kategori Pekerjaan → Kavling → Kantor Pelaksana → Mandor → SPK</div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 15 }}>
        {masterLinks.map((item, index) => (
          <a key={item.href} href={item.href} className="kavio-card" style={{ textDecoration: 'none', padding: 20, display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 26, color: 'var(--kavio-gold-300)' }}>{item.icon}</span><span style={{ fontSize: 10, fontWeight: 900, color: 'var(--kavio-gold-700)' }}>{String(index + 1).padStart(2,'0')}</span></div>
            <div style={{ marginTop: 16, color: 'var(--kavio-ivory)', fontSize: 17, fontWeight: 900 }}>{item.title}</div>
            <div style={{ marginTop: 7, color: 'var(--kavio-muted)', fontSize: 12, lineHeight: 1.5, minHeight: 38 }}>{item.desc}</div>
            <div style={{ marginTop: 14, color: 'var(--kavio-gold-300)', fontSize: 11, fontWeight: 900 }}>Buka Master →</div>
          </a>
        ))}
      </section>
    </KavioShell>
  );
}
