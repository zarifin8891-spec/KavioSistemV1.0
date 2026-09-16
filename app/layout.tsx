import type { Metadata } from 'next';
import './kavio-theme.css';
import './kavio-dashboard-overrides.css';
import './kavio-dashboard-tune.css';
import './kavio-dashboard-attention.css';
import './kavio-sales-layout.css';
import './kavio-typography.css';

export const metadata: Metadata = {
  title: 'KAVIO Monitor V1.0',
  description: 'Monitoring pembangunan perumahan',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
