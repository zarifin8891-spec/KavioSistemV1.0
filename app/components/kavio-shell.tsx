import Link from 'next/link';

const nav = [
  ['Beranda', '/dashboard'],
  ['Master Data', '/master'],
  ['Kavling', '/master/kavling'],
  ['Sales', '/master/sales'],
  ['SPK', '/master/spk'],
  ['Progress', '/progress'],
];

export default function KavioShell({ children, active }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="kavio-shell">
      <aside className="kavio-sidebar">
        <Link href="/dashboard" className="kavio-brand">
          <span className="kavio-brand-mark">K</span>
          <span><strong>KAVIO</strong><small>KONTROL PROYEK, NILAI LEBIH BESAR</small></span>
        </Link>
        <nav className="kavio-nav">
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className={`kavio-nav-item ${active === href ? 'is-active' : ''}`}>
              <span className="kavio-nav-icon" aria-hidden="true">{icon(label)}</span>
              <span>{label}</span>
            </Link>
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
  const map: Record<string, string> = { Beranda: '⌂', 'Master Data': '▦', Kavling: '⌗', Sales: '♙', SPK: '▣', Progress: '◔' };
  return map[label] ?? '•';
}
