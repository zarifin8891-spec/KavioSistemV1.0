import KavioShell from '../components/kavio-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/dashboard"><div className="kavio-dashboard-page">{children}</div></KavioShell>;
}
