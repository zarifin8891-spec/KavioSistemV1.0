import KavioShell from '../components/kavio-shell';

export default function LaporanLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/laporan">{children}</KavioShell>;
}
