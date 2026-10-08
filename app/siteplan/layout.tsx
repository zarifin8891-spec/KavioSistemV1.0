import KavioShell from '../components/kavio-shell';

export default function SiteplanLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/siteplan">{children}</KavioShell>;
}
