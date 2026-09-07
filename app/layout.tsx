import type { Metadata } from 'next';

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
