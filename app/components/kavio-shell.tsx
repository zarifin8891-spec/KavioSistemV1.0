'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

const sections = [
  { title: 'UTAMA', items: [['Beranda', '/dashboard']] },
  { title: 'MASTER DATA', items: [['Master Data', '/master']] },
  { title: 'OPERASIONAL', items: [['Sales', '/master/sales'], ['SPK / Pekerjaan', '/master/spk'], ['Progress', '/progress']] },
] as const;

const pageHeader = (pathname: string) => {
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
  if (pathname.startsWith('/master')) return ['Master Data', 'Pusat referensi data utama proyek KAVIO.'];
  return ['Dashboard Monitoring', 'Kesehatan proyek, risiko, dan tindakan prioritas.'];
};

export default function KavioShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState('');
  const [today, setToday] = useState('');
  const [title, subtitle] = pageHeader(pathname);
  const effectiveActive = pathname.startsWith('/master/sales')
    ? '/master/sales'
    : pathname.startsWith('/master/spk')
      ? '/master/spk'
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
        <Link href="/dashboard" className="kavio-brand">
          <span className="kavio-brand-mark">K</span>
          <span><strong>KAVIO</strong><small>KONTROL PROYEK, NILAI LEBIH BESAR</small></span>
        </Link>
        <nav className="kavio-nav">
          {sections.map((section) => (
            <div key={section.title} className="kavio-nav-section">
              {section.items.map(([label, href]) => (
                <Link key={href} href={href} className={`kavio-nav-item ${effectiveActive === href ? 'is-active' : ''}`}>
                  <span className="kavio-nav-icon" aria-hidden="true">{icon(label)}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="kavio-sidebar-footer">
          <div>SATU DATA<br />SATU KENDALI<br />SATU HASIL</div>
          <div className="kavio-sidebar-user">
            <div className="kavio-sidebar-user-main">
              <span className="kavio-sidebar-user-dot">●</span>
              <span>
                <strong>{userEmail || 'Admin'}</strong>
                <small>Direktur</small>
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
          </div>
        </header>
        <div className="kavio-content">{children}</div>
      </div>
      <style jsx global>{`
        .kavio-shell{display:flex;min-height:100vh;}
        .kavio-sidebar{width:216px !important;flex:0 0 216px !important;padding:14px 8px !important;display:flex !important;flex-direction:column !important;}
        .kavio-brand{gap:9px !important;padding:4px 6px 18px !important;}
        .kavio-brand-mark{width:42px !important;height:42px !important;font-size:23px !important;flex:0 0 42px;}
        .kavio-brand strong{font-size:25px !important;letter-spacing:1.8px !important;line-height:1 !important;}
        .kavio-brand small{font-size:6.5px !important;letter-spacing:.2px !important;white-space:nowrap !important;line-height:1 !important;}
        .kavio-nav{gap:8px !important;margin-top:14px !important;flex:0 0 auto !important;}
        .kavio-nav-section{gap:6px !important;}
        .kavio-nav-section + .kavio-nav-section{padding-top:11px !important;}
        .kavio-nav-item{gap:10px !important;padding:11px 10px !important;font-size:13px !important;}
        .kavio-nav-icon{width:18px !important;font-size:16px !important;}
        .kavio-sidebar-footer{margin-top:auto !important;font-size:7.5px !important;line-height:1.45 !important;padding:12px 6px 2px !important;}
        .kavio-sidebar-user{margin-top:12px !important;padding-top:11px !important;border-top:1px solid rgba(216,180,90,.22) !important;font-size:10px !important;}
        .kavio-sidebar-user-main{display:flex !important;align-items:flex-start !important;gap:7px !important;}
        .kavio-sidebar-user-dot{color:#F0D48A !important;font-size:8px !important;margin-top:2px !important;}
        .kavio-sidebar-user-main strong{display:block !important;color:#F7F3E8 !important;font-size:10px !important;font-weight:800 !important;line-height:1.25 !important;max-width:185px !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}
        .kavio-sidebar-user-main small{display:block !important;color:#DCCB9C !important;font-size:9px !important;line-height:1.2 !important;}
        .kavio-sidebar-date{margin-top:7px !important;color:#F0D48A !important;font-size:9px !important;}
        .kavio-topbar{height:126px !important;min-height:126px !important;padding:12px 28px !important;background:transparent !important;border-bottom:0 !important;display:flex !important;align-items:stretch !important;}
        .kavio-page-banner{position:relative;isolation:isolate;overflow:hidden;width:100%;min-height:102px;border-radius:16px;border:1px solid rgba(216,180,90,.18);background:
          radial-gradient(circle at 57% 52%, rgba(240,212,138,.13), transparent 16%),
          linear-gradient(120deg,#091C34 0%,#102E4A 44%,#0A2440 72%,#071B31 100%);
          box-shadow:0 14px 30px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.045);}
        .kavio-page-banner-text{position:relative;z-index:2;padding:14px 36px 13px;display:flex;flex-direction:column;justify-content:center;height:100%;max-width:74%;}
        .kavio-page-banner h1{margin:0 0 1px !important;color:#F7F3E8 !important;font-size:31px !important;line-height:1.03 !important;font-weight:900 !important;letter-spacing:.2px !important;}
        .kavio-page-banner p{margin:0 !important;color:#E7DDC5 !important;font-size:13px !important;line-height:1.25 !important;}
        .kavio-banner-geometry{position:absolute;inset:0;z-index:1;opacity:.8;background:
          linear-gradient(28deg,transparent 0 36%,rgba(154,184,208,.12) 36.1%,transparent 36.5%),
          linear-gradient(154deg,transparent 0 44%,rgba(154,184,208,.10) 44.1%,transparent 44.45%),
          linear-gradient(72deg,transparent 0 56%,rgba(240,212,138,.12) 56.1%,transparent 56.4%),
          linear-gradient(124deg,transparent 0 70%,rgba(154,184,208,.10) 70.1%,transparent 70.45%),
          radial-gradient(circle at 68% 28%,rgba(255,255,255,.09) 0 1.5px,transparent 2px),
          radial-gradient(circle at 82% 68%,rgba(255,255,255,.06) 0 2px,transparent 2.5px);}
        .kavio-banner-geometry::before,.kavio-banner-geometry::after{content:"";position:absolute;inset:-25%;background:linear-gradient(137deg,transparent 47.8%,rgba(190,210,225,.10) 48%,transparent 48.25%);transform:rotate(-3deg);}
        .kavio-banner-geometry::after{transform:rotate(11deg);opacity:.65;}
        .kavio-content{padding:0 28px 28px !important;}
        .kavio-content > main > header{display:none !important;}
        .kavio-content > main > section:first-of-type{padding-top:0 !important;}
        .sales-page > section > div:first-child,.kavio-page-title,.spk-heading,.kavio-dashboard-page > main > section > div:first-child{display:none !important;}
        .kavio-dashboard-page > main > section{padding-top:0 !important;}
        @media (max-width:900px){
          .kavio-sidebar{width:76px !important;flex-basis:76px !important;padding:12px 8px !important;}
          .kavio-brand{padding-left:0 !important;padding-right:0 !important;}
          .kavio-brand-mark{width:40px !important;height:40px !important;flex-basis:40px;}
          .kavio-brand > span:last-child,.kavio-nav-item > span:last-child,.kavio-sidebar-footer{display:none !important;}
          .kavio-topbar{height:112px !important;min-height:112px !important;padding:10px 12px !important;}
          .kavio-page-banner{min-height:92px;border-radius:14px;}
          .kavio-page-banner-text{padding:12px 18px;max-width:96%;}
          .kavio-page-banner h1{font-size:24px !important;}
          .kavio-page-banner p{font-size:11px !important;}
          .kavio-content{padding:0 12px 20px !important;}
        }
      `}</style>
    </div>
  );
}

function icon(label: string) {
  const map: Record<string, string> = { Beranda: '⌂', 'Master Data': '▦', Sales: '♙', 'SPK / Pekerjaan': '▣', Progress: '◔' };
  return map[label] ?? '•';
}
