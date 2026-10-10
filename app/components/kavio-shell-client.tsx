'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { formatKavioDate } from '../lib/date-format';
import { KAVIO_LOGO_DATA_URI } from './kavio-sidebar-logo';
import { canViewPath, type KavioRole } from '../../lib/kavio-permissions';
import { KavioPermissionProvider } from './KavioPermissionContext';
import KavioMessageBox from './KavioMessageBox';

const sections = [
  { title: 'UTAMA', items: [['Beranda', '/dashboard']] },
  { title: 'MASTER DATA', items: [['Master Data', '/master']] },
  { title: 'KAVLING', items: [['Siteplan', '/siteplan'], ['Kavling', '/master/kavling']] },
  { title: 'OPERASIONAL', items: [['Sales', '/master/sales'], ['Piutang', '/penerimaan'], ['SPK / Pekerjaan', '/master/spk'], ['Progress', '/progress'], ['Gudang & Material', '/material']] },
  { title: 'LAPORAN', items: [['Laporan', '/laporan']] },
  { title: 'PENGATURAN', items: [['Manajemen User', '/manajemen-user']] },
] as const;

const pageHeader = (pathname: string) => {
  if (pathname.startsWith('/siteplan')) return ['Siteplan Interaktif', 'Peta operasional proyek dan lifecycle setiap kavling.'];
  if (pathname.startsWith('/master/sales/detail')) return ['Sales Detail', 'Detail konsumen, akad, bank KPR, dan histori proses KPR.'];
  if (pathname.startsWith('/master/sales')) return ['Sales Management', 'Kelola data konsumen, status penjualan, dan status pembayaran.'];
  if (pathname.startsWith('/master/spk/detail/')) return ['SPK Control Sheet', 'Kontrol pekerjaan, progress, target penyelesaian, dan Curva-S.'];
  if (pathname.startsWith('/master/spk')) return ['Monitoring SPK', 'Kelola SPK, tim pelaksana, target penyelesaian, dan siklus pembangunan kavling.'];
  if (pathname.startsWith('/progress')) return ['Progress Monitoring', 'Pantau progress pembangunan berdasarkan SPK aktif.'];
  if (pathname.startsWith('/material')) return ['Gudang & Material', 'Pantau stok, permintaan, pemakaian, dan rekonsiliasi material per SPK.'];
  if (pathname.startsWith('/penerimaan')) return ['Piutang & Penerimaan', 'Catat penerimaan, kelola saldo piutang, dan terbitkan kuitansi.'];
  if (pathname.startsWith('/laporan')) return ['Laporan Monitoring', 'Ringkasan penjualan, progress pembangunan, dan kondisi operasional proyek.'];
  if (pathname.startsWith('/manajemen-user')) return ['Manajemen User', 'Kelola akun pengguna, role, dan akses KAVIO.'];
  if (pathname.startsWith('/master/template-progress')) return ['Template Progress', 'Kelola bobot progress standar berdasarkan tipe rumah.'];
  if (pathname.startsWith('/master/material')) return ['Master Material', 'Referensi material RAB, kategori, satuan, dan jenis item.'];
  if (pathname.startsWith('/master/pemasok')) return ['Master Pemasok', 'Kelola pemasok material dan informasi kontak.'];
  if (pathname.startsWith('/master/tipe-rumah')) return ['Master Tipe Rumah', 'Kelola referensi tipe rumah dan spesifikasi luas.'];
  if (pathname.startsWith('/master/kategori-pekerjaan')) return ['Master Kategori Pekerjaan', 'Kelola kategori pekerjaan dan bobot pembangunan.'];
  if (pathname.startsWith('/master/kavling')) return ['Master Kavling', 'Kelola inventory kavling dan lifecycle pembangunan.'];
  if (pathname.startsWith('/master/kantor-pelaksana')) return ['Master Kantor Pelaksana', 'Kelola kantor atau pelaksana pekerjaan proyek.'];
  if (pathname.startsWith('/master/mandor')) return ['Master Mandor', 'Kelola mandor dan relasinya dengan kantor pelaksana.'];
  if (pathname.startsWith('/master/bank')) return ['Master Bank / Kas', 'Kelola bank untuk proses pembiayaan KPR Sales.'];
  if (pathname.startsWith('/master/notaris')) return ['Master Notaris', 'Kelola notaris untuk proses akad Sales.'];
  if (pathname.startsWith('/master')) return ['Master Data', 'Pusat referensi data utama proyek KAVIO.'];
  return ['Dashboard Monitoring', 'Kesehatan proyek, risiko, dan tindakan prioritas.'];
};

export default function KavioShellClient({
  children,
  active,
  initialUserEmail,
  initialRole,
  initialActions,
  accessReady,
}: {
  children: React.ReactNode;
  active?: string;
  initialUserEmail: string;
  initialRole: KavioRole;
  initialActions: string[];
  accessReady: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail] = useState(initialUserEmail);
  const [role] = useState<KavioRole>(initialRole);
  const [actions] = useState<string[]>(initialActions);
  const [today, setToday] = useState('');
  const [browserSessionReady, setBrowserSessionReady] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState('');
  const prefetchedRoutes = useRef(new Set<string>());
  const prefetchTimers = useRef(new Map<string, number>());
  const [title, subtitle] = pageHeader(pathname);

  const effectiveActive =
    pathname.startsWith('/siteplan') ? '/siteplan' :
    pathname.startsWith('/master/sales') ? '/master/sales' :
    pathname.startsWith('/master/spk') ? '/master/spk' :
    pathname.startsWith('/master/kavling') ? '/master/kavling' :
    pathname.startsWith('/progress') ? '/progress' :
    pathname.startsWith('/material') ? '/material' :
    pathname.startsWith('/penerimaan') ? '/penerimaan' :
    pathname.startsWith('/laporan') ? '/laporan' :
    pathname.startsWith('/manajemen-user') ? '/manajemen-user' :
    pathname.startsWith('/dashboard') ? '/dashboard' :
    pathname === '/master' || pathname.startsWith('/master/') ? '/master' :
    active;

  useEffect(() => {
    setToday(formatKavioDate(new Date()));

    const pageSessionToken = sessionStorage.getItem('kavio_browser_session');
    const cookieSessionToken = document.cookie
      .split('; ')
      .find((part) => part.startsWith('kavio_browser_session='))
      ?.slice('kavio_browser_session='.length);

    const cookieToken = cookieSessionToken ? decodeURIComponent(cookieSessionToken) : '';

    if (!pageSessionToken || !cookieToken || pageSessionToken !== cookieToken) {
      // Some browsers restore session cookies after a browser restart. Do not
      // trust the cookie alone: without the page-session token KAVIO requires
      // a fresh login.
      sessionStorage.removeItem('kavio_browser_session');
      document.cookie = 'kavio_browser_session=; Path=/; Max-Age=0; SameSite=Lax';
      window.location.replace('/login?session=berakhir');
      return;
    }

    setBrowserSessionReady(true);
  }, []);

  useEffect(() => {
    setNavigatingTo('');
  }, [pathname]);

  useEffect(() => {
    const timers = prefetchTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const prefetchRoute = useCallback((href: string) => {
    if (prefetchedRoutes.current.has(href)) return;
    prefetchedRoutes.current.add(href);
    router.prefetch(href);
  }, [router]);

  const schedulePrefetch = useCallback((href: string) => {
    if (prefetchedRoutes.current.has(href) || prefetchTimers.current.has(href)) return;
    const timer = window.setTimeout(() => {
      prefetchTimers.current.delete(href);
      prefetchRoute(href);
    }, 120);
    prefetchTimers.current.set(href, timer);
  }, [prefetchRoute]);

  const cancelPrefetch = useCallback((href: string) => {
    const timer = prefetchTimers.current.get(href);
    if (timer == null) return;
    window.clearTimeout(timer);
    prefetchTimers.current.delete(href);
  }, []);

  const startNavigation = useCallback((href: string) => {
    cancelPrefetch(href);
    prefetchRoute(href);
    if (href !== pathname) setNavigatingTo(href);
  }, [cancelPrefetch, pathname, prefetchRoute]);

  const handleLogout = async () => {
    const supabase = createClient();
    sessionStorage.removeItem('kavio_browser_session');
    document.cookie = 'kavio_browser_session=; Path=/; Max-Age=0; SameSite=Lax';
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!browserSessionReady) return null;

  return (
    <KavioPermissionProvider actions={actions} ready={accessReady}>
      <div className="kavio-shell">
      <Suspense fallback={null}><KavioMessageBox /></Suspense>
      <aside className="kavio-sidebar">
        <Link
          href="/dashboard"
          prefetch={false}
          className="kavio-brand"
          aria-label="KAVIO"
          onPointerEnter={() => schedulePrefetch('/dashboard')}
          onPointerLeave={() => cancelPrefetch('/dashboard')}
          onFocus={() => prefetchRoute('/dashboard')}
          onPointerDown={() => prefetchRoute('/dashboard')}
          onClick={() => startNavigation('/dashboard')}
        >
          <img src={KAVIO_LOGO_DATA_URI} alt="KAVIO — Satu Data, Satu Kendali, Satu Hasil" className="kavio-brand-logo" />
        </Link>

        <nav className="kavio-nav" aria-label="Navigasi KAVIO">
          {sections.map((section) => (
            <div key={section.title} className="kavio-nav-section">
              {section.items.map(([label, href]) => {
                if (!canViewPath(role, href)) return null;
                return (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    className={`kavio-nav-item ${effectiveActive === href ? 'is-active' : ''} ${navigatingTo === href ? 'is-loading' : ''}`}
                    onPointerEnter={() => schedulePrefetch(href)}
                    onPointerLeave={() => cancelPrefetch(href)}
                    onFocus={() => prefetchRoute(href)}
                    onPointerDown={() => prefetchRoute(href)}
                    onClick={() => startNavigation(href)}
                    aria-busy={navigatingTo === href || undefined}
                  >
                    <span className="kavio-nav-icon" aria-hidden="true">{icon(label)}</span>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <button type="button" className="kavio-nav-item kavio-nav-logout" onClick={handleLogout}>
            <span className="kavio-nav-icon" aria-hidden="true">⇥</span>
            <span>KELUAR</span>
          </button>
        </nav>

        <div className="kavio-sidebar-footer">
          <div className="kavio-sidebar-user">
            <div className="kavio-sidebar-user-main">
              <span className="kavio-sidebar-user-dot" aria-hidden="true">●</span>
              <span>
                <strong>{userEmail || 'Admin'}</strong>
                <small>{role}</small>
              </span>
            </div>
            <div className="kavio-sidebar-date">{today || 'Memuat tanggal...'}</div>
          </div>
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
            {pathname.startsWith('/master/') && !pathname.startsWith('/master/spk') && pathname !== '/master/sales' && pathname !== '/master/kavling' && (
              <Link
                href={pathname.startsWith('/master/sales/detail') ? '/master/sales' : '/master'}
                className="kavio-command-button kavio-page-command"
                aria-label={pathname.startsWith('/master/sales/detail') ? 'Kembali ke Sales Management' : 'Kembali ke Master Data'}
              >
                <span className="kavio-command-icon" aria-hidden="true">←</span>
                <span>{pathname.startsWith('/master/sales/detail') ? 'Kembali ke Sales' : 'Kembali'}</span>
              </Link>
            )}
          </div>
        </header>
        <div className={`kavio-content ${navigatingTo ? 'is-navigating' : ''}`} aria-busy={Boolean(navigatingTo)}>
          {navigatingTo ? (
            <div className="kavio-navigation-progress" role="status" aria-live="polite">
              <span className="kavio-navigation-progress-bar" aria-hidden="true" />
              <span>MEMUAT HALAMAN...</span>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
    </KavioPermissionProvider>
  );
}

function icon(label: string) {
  const map: Record<string, string> = {
    Beranda: '⌂',
    'Master Data': '▦',
    Siteplan: '⌗',
    Kavling: '⌗',
    Sales: '♙',
    'SPK / Pekerjaan': '▣',
    SPK: '▣',
    Progress: '◔',
    Laporan: '▤',
    'Manajemen User': '⚙',
  };
  return map[label] ?? '•';
}
