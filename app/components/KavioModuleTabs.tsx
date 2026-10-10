'use client';

import Link from 'next/link';
import { Children } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function KavioModuleTabs({ tabs, children }: {
  tabs: { id: string; label: string; focusIds?: string[] }[];
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const focus = params.get('focus') ?? '';
  const chosen = params.get('error') ? tabs.find((tab) => tab.focusIds?.includes(focus))?.id : undefined;
  const active = chosen ?? (tabs.some((tab) => tab.id === params.get('tab')) ? params.get('tab') : tabs[0].id);
  const index = tabs.findIndex((tab) => tab.id === active);
  return <>
    <nav className="kavio-module-tabs" aria-label="Modul operasional">{tabs.map((tab) => <Link key={tab.id} href={`${pathname}?tab=${tab.id}`} prefetch={false} scroll={false} className={`kavio-module-tab ${active === tab.id ? 'is-active' : ''}`} aria-current={active === tab.id ? 'page' : undefined}>{tab.label}</Link>)}</nav>
    <section className="kavio-module-content" aria-label={tabs[index].label}>{Children.toArray(children)[index]}</section>
  </>;
}
