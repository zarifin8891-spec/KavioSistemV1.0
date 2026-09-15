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
              <div className="kavio-nav-section-title">{section.title}</div>
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
    </div>
  );
}

function icon(label: string) {
  const map: Record<string, string> = { Beranda: '⌂', 'Master Data': '▦', Sales: '♙', 'SPK / Pekerjaan': '▣', Progress: '◔' };
  return map[label] ?? '•';
}
