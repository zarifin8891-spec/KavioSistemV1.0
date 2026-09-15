'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  { title: 'UTAMA', items: [['Beranda', '/dashboard']] },
  { title: 'MASTER DATA', items: [['Master Data', '/master']] },
  { title: 'OPERASIONAL', items: [['Sales', '/master/sales'], ['SPK / Pekerjaan', '/master/spk'], ['Progress', '/progress']] },
] as const;

export default function KavioShell({ children, active }: { children: React.ReactNode; active?: string }) {
  const pathname = usePathname();
  const effectiveActive = pathname.startsWith('/master/sales')
    ? '/master/sales'
    : pathname.startsWith('/master/spk')
      ? '/master/spk'
      : pathname.startsWith('/progress')
        ? '/progress'
        : pathname.startsWith('/dashboard')
          ? '/dashboard'
          : active;

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
        <div className="kavio-sidebar-footer">SATU DATA<br />SATU KENDALI<br />SATU HASIL</div>
      </aside>
      <div className="kavio-main">
        <header className="kavio-topbar">
          <div className="kavio-search">⌕ <span>Cari kavling, SPK, konsumen...</span></div>
          <div className="kavio-user">● &nbsp; Admin <small>Direktur</small></div>
        </header>
        <div className="kavio-content">{children}</div>
      </div>
      <style>{`
        .kavio-sidebar{width:216px !important;flex-basis:216px !important;padding:14px 8px !important;}
        .kavio-brand{gap:9px !important;padding:4px 6px 18px !important;}
        .kavio-brand-mark{width:42px !important;height:42px !important;font-size:23px !important;flex:0 0 42px;}
        .kavio-brand strong{font-size:25px !important;letter-spacing:1.8px !important;line-height:1 !important;}
        .kavio-brand small{font-size:6.5px !important;letter-spacing:.2px !important;white-space:nowrap !important;line-height:1 !important;}
        .kavio-nav{gap:8px !important;margin-top:14px !important;}
        .kavio-nav-section{gap:6px !important;}
        .kavio-nav-section + .kavio-nav-section{padding-top:11px !important;}
        .kavio-nav-item{gap:10px !important;padding:11px 10px !important;font-size:13px !important;}
        .kavio-nav-icon{width:18px !important;font-size:16px !important;}
        .kavio-sidebar-footer{font-size:7.5px !important;line-height:1.45 !important;}
        @media (max-width:900px){
          .kavio-sidebar{width:76px !important;flex-basis:76px !important;padding:12px 8px !important;}
          .kavio-brand{padding-left:0 !important;padding-right:0 !important;}
          .kavio-brand-mark{width:40px !important;height:40px !important;flex-basis:40px;}
        }
      `}</style>
    </div>
  );
}

function icon(label: string) {
  const map: Record<string, string> = { Beranda: '⌂', 'Master Data': '▦', Sales: '♙', 'SPK / Pekerjaan': '▣', Progress: '◔' };
  return map[label] ?? '•';
}
