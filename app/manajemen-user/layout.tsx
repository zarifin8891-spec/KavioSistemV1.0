import KavioShell from '../components/kavio-shell';

export default function ManajemenUserLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/manajemen-user">{children}</KavioShell>;
}
