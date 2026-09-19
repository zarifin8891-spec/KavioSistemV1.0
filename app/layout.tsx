import type { Metadata } from 'next';
import './kavio-theme.css';
import './kavio-dashboard.css';
import './kavio-sales-layout.css';
import './kavio-sales-module.css';
import './kavio-ui-components.css';
import './siteplan/siteplan.css';

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
