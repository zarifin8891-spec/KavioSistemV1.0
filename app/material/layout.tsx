import KavioShell from '../components/kavio-shell';

export default function MaterialLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/material">{children}</KavioShell>;
}
