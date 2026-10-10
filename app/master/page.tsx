import Link from 'next/link';
import { getKavioRequestContext } from '../../lib/kavio-request-context';
import { canViewPath } from '../../lib/kavio-permissions';

const masterLinks = [
  { href: '/master/material', title: 'Material', desc: 'Referensi nama material, kategori, satuan, dan jenis item RAB.', icon: '▦' },
  { href: '/master/pemasok', title: 'Pemasok', desc: 'Kelola pemasok material, kontak, dan alamat.', icon: '▤' },
  { href: '/master/tipe-rumah', title: 'Tipe Rumah', desc: 'Kelola referensi tipe rumah dan spesifikasi luas.', icon: '⌂' },
  { href: '/master/kategori-pekerjaan', title: 'Kategori Pekerjaan', desc: 'Kelola kategori pekerjaan dan bobot pembangunan.', icon: '▦' },
  { href: '/master/kantor-pelaksana', title: 'Kantor Pelaksana', desc: 'Kelola kantor/pelaksana yang menangani pekerjaan.', icon: '▥' },
  { href: '/master/mandor', title: 'Mandor', desc: 'Kelola mandor dan relasinya dengan kantor pelaksana.', icon: '♙' },
  { href: '/master/template-progress', title: 'Template Progress', desc: 'Kelola bobot progress standar berdasarkan tipe rumah.', icon: '◔' },
  { href: '/master/bank', title: 'Bank', desc: 'Kelola bank untuk pembiayaan KPR Sales.', icon: '▤' },
  { href: '/master/notaris', title: 'Notaris', desc: 'Kelola notaris untuk proses akad Sales.', icon: '✎' },
];

export default async function MasterPage() {
  const { role } = await getKavioRequestContext();
  const visibleLinks = masterLinks.filter((item) => canViewPath(role, item.href));

  return (
    <main className="master-hub">
      <section className="master-card-grid">
        {visibleLinks.map((item) => (
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
