import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

const masterLinks = [
  { href: '/master/kavling', title: 'Kavling', desc: 'Blok, nomor kavling, tipe rumah, dan status kavling.' },
  { href: '/master/tipe-rumah', title: 'Tipe Rumah', desc: 'Master tipe rumah dan luas tanah/bangunan.' },
  { href: '/master/kategori-pekerjaan', title: 'Kategori Pekerjaan', desc: 'Urutan dan master kategori untuk progress pembangunan.' },
  { href: '/master/kantor-pelaksana', title: 'Kantor Pelaksana', desc: 'Data kantor/pelaksana yang menangani pekerjaan.' },
  { href: '/master/mandor', title: 'Mandor', desc: 'Data mandor dan relasinya dengan kantor pelaksana.' },
  { href: '/master/spk', title: 'SPK Pembangunan', desc: 'Penerbitan SPK, bobot standard/custom, aktivasi, dan histori.' },
];

export default async function MasterHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <Link href="/dashboard" style={back}>← Dashboard</Link>
          <div style={brand}>KAVIO</div>
          <div style={title}>Master Data</div>
        </div>
        <div style={userBox}>
          <div>{user.email}</div>
          <form action="/auth/signout" method="post">
            <button type="submit" style={logout}>Keluar</button>
          </form>
        </div>
      </header>

      <section style={content}>
        <div style={hero}>
          <div>
            <div style={eyebrow}>MASTER DATA CONTROL</div>
            <h1 style={h1}>Pusat Master KAVIO</h1>
            <p style={subtitle}>Semua referensi utama proyek dikelola dari satu pintu agar data SPK dan progress tetap konsisten.</p>
          </div>
        </div>

        <section style={notice}>
          <div style={noticeTitle}>Urutan kerja yang disarankan</div>
          <div style={noticeText}>Tipe Rumah → Kategori Pekerjaan → Kavling → Kantor Pelaksana → Mandor → SPK</div>
        </section>

        <section style={grid}>
          {masterLinks.map((item, index) => (
            <Link key={item.href} href={item.href} style={masterCard}>
              <div style={number}>{String(index + 1).padStart(2, '0')}</div>
              <div style={masterTitle}>{item.title}</div>
              <div style={masterDesc}>{item.desc}</div>
              <div style={openLabel}>Buka Master →</div>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}

const page = { minHeight: '100vh', background: '#0B1D3A', color: '#F7F3E8' };
const header = { background: '#102A56', borderBottom: '1px solid #B8943F', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#DCCB9C', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 900, letterSpacing: 1.8, color: '#E8CC7A' };
const title = { fontSize: 21, fontWeight: 800, color: '#F7F3E8' };
const userBox = { textAlign: 'right' as const, fontSize: 12, color: '#DCCB9C' };
const logout = { marginTop: 5, border: 0, background: 'transparent', color: '#E8CC7A', fontWeight: 800, cursor: 'pointer' };
const content = { maxWidth: 1280, margin: '0 auto', padding: 28 };
const hero = { marginBottom: 18 };
const eyebrow = { fontSize: 11, fontWeight: 900, letterSpacing: 1.4, color: '#E8CC7A' };
const h1 = { margin: '5px 0 6px', fontSize: 30, color: '#F7F3E8' };
const subtitle = { margin: 0, color: '#C9BC99', fontSize: 14, lineHeight: 1.55 };
const notice = { background: '#102A56', border: '1px solid #B8943F', borderRadius: 14, padding: 16, marginBottom: 18 };
const noticeTitle = { color: '#E8CC7A', fontSize: 11, fontWeight: 900, letterSpacing: 1 };
const noticeText = { marginTop: 6, color: '#F7F3E8', fontWeight: 800, fontSize: 14 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 15 };
const masterCard = { display: 'block', textDecoration: 'none', background: '#162F5B', border: '1px solid rgba(216,180,90,.35)', borderRadius: 16, padding: 18, boxShadow: '0 10px 28px rgba(0,0,0,.16)' };
const number = { color: '#B8943F', fontWeight: 900, fontSize: 11, letterSpacing: 1 };
const masterTitle = { marginTop: 10, color: '#F7F3E8', fontSize: 18, fontWeight: 900 };
const masterDesc = { marginTop: 6, color: '#BFAF83', fontSize: 12, lineHeight: 1.5, minHeight: 38 };
const openLabel = { marginTop: 14, color: '#E8CC7A', fontSize: 12, fontWeight: 900 };
