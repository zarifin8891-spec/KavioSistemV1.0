import KavioShell from '../components/kavio-shell';

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/master">{children}</KavioShell>;
}
