'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { KAVIO_LOGO_DATA_URI } from './kavio-sidebar-logo';

const navItems = [
  ['Beranda', '/dashboard'],
  ['Master Data', '/master'],
  ['Kavling', '/master/kavling'],
  ['Sales', '/master/sales'],
  ['SPK', '/master/spk'],
  ['Progress', '/progress'],
] as const;

const utilityItems = ['Laporan', 'Pengaturan'] as const;
const pageHeader = (pathname: string) => {
  if (pathname.startsWith('/siteplan')) return ['Siteplan Interaktif', 'Peta operasional proyek dan lifecycle setiap kavling.'];
  if (pathname.startsWith('/master/sales/detail')) return ['Sales Detail', 'Detail konsumen, akad, bank KPR, dan histori proses KPR.'];
  if (pathname.startsWith('/master/sales')) return ['Sales Management', 'Kelola data konsumen, status penjualan, dan status pembayaran.'];
  if (pathname.startsWith('/master/spk/detail/')) return ['SPK Control Sheet', 'Kontrol pekerjaan, progress, target penyelesaian, dan Curva-S.'];
  if (pathname.startsWith('/master/spk')) return ['Construction Management', 'Kelola SPK, tim pelaksana, target penyelesaian, dan siklus pembangunan kavling.'];
  if (pathname.startsWith('/progress')) return ['Progress Monitoring', 'Pantau progress pembangunan berdasarkan SPK aktif.'];
  if (pathname.startsWith('/master/template-progress')) return ['Template Progress', 'Kelola bobot standar progress berdasarkan tipe rumah.'];
  if (pathname.startsWith('/master/tipe-rumah')) return ['Master Tipe Rumah', 'Kelola referensi tipe rumah dan spesifikasi luas.'];
  if (pathname.startsWith('/master/kategori-pekerjaan')) return ['Master Kategori Pekerjaan', 'Kelola kategori pekerjaan dan bobot pembangunan.'];
  if (pathname.startsWith('/master/kavling')) return ['Master Kavling', 'Kelola inventory kavling dan lifecycle pembangunan.'];
  if (pathname.startsWith('/master/kantor-pelaksana')) return ['Master Kantor Pelaksana', 'Kelola kantor atau pelaksana pekerjaan proyek.'];
  if (pathname.startsWith('/master/mandor')) return ['Master Mandor', 'Kelola mandor dan relasinya dengan kantor pelaksana.'];
  if (pathname.startsWith('/master/bank')) return ['Master Bank', 'Kelola bank untuk proses pembiayaan KPR Sales.'];
  if (pathname.startsWith('/master/notaris')) return ['Master Notaris', 'Kelola notaris untuk proses akad Sales.'];
  if (pathname.startsWith('/master')) return ['Master Data', 'Pusat referensi data utama proyek KAVIO.'];
  return ['Dashboard Monitoring', 'Kesehatan proyek, risiko, dan tindakan prioritas.'];
};

export default function KavioShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [today, setToday] = useState('');
  const [title, subtitle] = pageHeader(pathname);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const effectiveActive = pathname.startsWith('/siteplan')
    ? '/siteplan'
    : pathname.startsWith('/master/sales')
    ? '/master/sales'
    : pathname.startsWith('/master/spk')
      ? '/master/spk'
      : pathname.startsWith('/master/kavling')
        ? '/master/kavling'
        : pathname.startsWith('/progress')
          ? '/progress'
          : pathname.startsWith('/dashboard')
            ? '/dashboard'
            : active;

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserEmail(data.user?.email ?? '');
    });
    setToday(new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date()));
    return () => { mounted = false; };
  }, []);

  return (
    <div className="kavio-shell">
      <aside className="kavio-sidebar">
        <Link href="/dashboard" className="kavio-brand" aria-label="KAVIO">
          <img src={KAVIO_LOGO_DATA_URI} alt="KAVIO" className="kavio-brand-logo" />
        </Link>

        <div className="kavio-sidebar-account">
          <div className="kavio-sidebar-account-label">USER LOGIN</div>
          <div className="kavio-sidebar-account-label">{userEmail || 'ADMIN'}</div>
          <div className="kavio-sidebar-account-label">DIREKTUR</div>
          <div className="kavio-sidebar-account-label">{today || 'MEMUAT TANGGAL...'}</div>
        </div>
        <nav className="kavio-nav" aria-label="Navigasi KAVIO">
          <div className="kavio-nav-list">
            {navItems.map(([label, href]) => (
              <Link key={href} href={href} className={`kavio-nav-item ${effectiveActive === href ? 'is-active' : ''}`}>
                <span>{label}</span>
              </Link>
          <div className="kavio-sidebar-footer">
          <div>SATU DATA<br />SATU KENDALI<br />SATU HASIL</div>
        </div>
      </aside>

      <div className="kavio-main">
        <header className="kavio-topbar">
          <div className="kavio-page-banner" aria-label={title}>
            <div className="kavio-banner-geometry" aria-hidden="true" />
            <div className="kavio-page-banner-text">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {pathname.startsWith('/master/') && <Link href="/master" className="kavio-command-button kavio-page-command" aria-label="Kembali ke Master Data"><span className="kavio-command-icon" aria-hidden="true">←</span><span>Kembali</span></Link>}
          </div>
        </header>
        <div className="kavio-content">{children}</div>
      </div>
    </div>
  );
}

