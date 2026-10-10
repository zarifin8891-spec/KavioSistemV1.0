import KavioShell from '../components/kavio-shell';

export default function PenerimaanLayout({ children }: { children: React.ReactNode }) {
  return <KavioShell active="/penerimaan">{children}</KavioShell>;
}
