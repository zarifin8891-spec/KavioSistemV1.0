import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

const masterLinks = [
  { href: '/master/tipe-rumah', title: 'Tipe Rumah', desc: 'Kelola referensi tipe rumah dan spesifikasi luas.', icon: '⌂' },
  { href: '/master/kategori-pekerjaan', title: 'Kategori Pekerjaan', desc: 'Kelola kategori pekerjaan dan bobot pembangunan.', icon: '▦' },
  { href: '/master/kantor-pelaksana', title: 'Kantor Pelaksana', desc: 'Kelola kantor/pelaksana yang menangani pekerjaan.', icon: '▥' },
  { href: '/master/mandor', title: 'Mandor', desc: 'Kelola mandor dan relasinya dengan kantor pelaksana.', icon: '♙' },
  { href: '/master/template-progress', title: 'Template Progress', desc: 'Kelola bobot progress standar berdasarkan tipe rumah.', icon: '◔' },
  { href: '/master/bank', title: 'Bank', desc: 'Kelola bank untuk pembiayaan KPR Sales.', icon: '▤' },
  { href: '/master/notaris', title: 'Notaris', desc: 'Kelola notaris untuk proses akad Sales.', icon: '✎' },
];

export default async function MasterPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="master-hub">
      <section className="kavio-panel master-hub-intro-panel">
        <div className="kavio-panel-head">
          <div><h2 className="kavio-panel-title">MASTER DATA CONTROL</h2><div className="kavio-panel-note">Semua referensi utama proyek dikelola dari satu pintu agar Sales, SPK, dan Progress tetap konsisten.</div></div>
          <span className="kavio-badge">MASTER</span>
        </div>
        <div className="kavio-panel-body master-workflow">TIPE RUMAH → KATEGORI PEKERJAAN → KAVLING → KANTOR PELAKSANA → MANDOR → TEMPLATE PROGRESS → BANK → NOTARIS</div>
      </section>

      <section className="master-card-grid">
        <Link href="/master/kavling" className="master-card master-card-featured">
          <span className="master-card-icon">⌗</span>
          <span className="master-card-title">Kavling</span>
          <span className="master-card-note">Kelola blok, nomor kavling, tipe rumah, dan lifecycle inventory.</span>
        </Link>
        {masterLinks.map((item) => (
          <Link key={item.href} href={item.href} className="master-card">
            <span className="master-card-icon">{item.icon}</span>
            <span className="master-card-title">{item.title}</span>
            <span className="master-card-note">{item.desc}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
