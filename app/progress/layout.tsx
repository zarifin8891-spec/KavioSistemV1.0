import KavioShell from '../components/kavio-shell';

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/progress">{children}</KavioShell>;
}
