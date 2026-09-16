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

export default function KavioShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState('');
  const [today, setToday] = useState('');
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
          <div className="kavio-search">⌕ <span>Cari kavling, SPK, konsumen...</span></div>
        </header>
        <div className="kavio-content">{children}</div>
      </div>
      <style>{`
        .kavio-shell{display:flex;min-height:100vh;}
        .kavio-sidebar{width:216px !important;flex-basis:216px !important;padding:14px 8px !important;display:flex !important;flex-direction:column !important;}
        .kavio-brand{gap:9px !important;padding:4px 6px 18px !important;}
        .kavio-brand-mark{width:42px !important;height:42px !important;font-size:23px !important;flex:0 0 42px;}
        .kavio-brand strong{font-size:25px !important;letter-spacing:1.8px !important;line-height:1 !important;}
        .kavio-brand small{font-size:6.5px !important;letter-spacing:.2px !important;white-space:nowrap !important;line-height:1 !important;}
        .kavio-nav{gap:8px !important;margin-top:14px !important;flex:1 !important;}
        .kavio-nav-section{gap:6px !important;}
        .kavio-nav-section + .kavio-nav-section{padding-top:11px !important;}
        .kavio-nav-item{gap:10px !important;padding:11px 10px !important;font-size:13px !important;}
        .kavio-nav-icon{width:18px !important;font-size:16px !important;}
        .kavio-sidebar-footer{font-size:7.5px !important;line-height:1.45 !important;padding:12px 6px 2px !important;}
        .kavio-sidebar-user{margin-top:14px !important;padding-top:12px !important;border-top:1px solid rgba(216,180,90,.22) !important;font-size:10px !important;}
        .kavio-sidebar-user-main{display:flex !important;align-items:flex-start !important;gap:7px !important;}
        .kavio-sidebar-user-dot{color:#F0D48A !important;font-size:8px !important;margin-top:2px !important;}
        .kavio-sidebar-user-main strong{display:block !important;color:#F7F3E8 !important;font-size:10px !important;font-weight:800 !important;line-height:1.25 !important;max-width:185px !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}
        .kavio-sidebar-user-main small{display:block !important;color:#DCCB9C !important;font-size:9px !important;line-height:1.2 !important;}
        .kavio-sidebar-date{margin-top:7px !important;color:#F0D48A !important;font-size:9px !important;}
        .kavio-topbar{min-height:64px !important;}
        .kavio-topbar .kavio-search{margin-right:0 !important;}
        @media (max-width:900px){
          .kavio-sidebar{width:76px !important;flex-basis:76px !important;padding:12px 8px !important;}
          .kavio-brand{padding-left:0 !important;padding-right:0 !important;}
          .kavio-brand-mark{width:40px !important;height:40px !important;flex-basis:40px;}
          .kavio-brand > span:last-child,.kavio-nav-item > span:last-child,.kavio-sidebar-footer{display:none !important;}
        }
      `}</style>
    </div>
  );
}

function icon(label: string) {
  const map: Record<string, string> = { Beranda: '⌂', 'Master Data': '▦', Sales: '♙', 'SPK / Pekerjaan': '▣', Progress: '◔' };
  return map[label] ?? '•';
}
