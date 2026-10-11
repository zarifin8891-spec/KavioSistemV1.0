import Link from 'next/link';
/** Compact navigation for modules fetched through their own URL. */
export default function KavioNavTabs({label,items}:{label:string;items:{label:string;href:string;active:boolean}[]}) {
 return <nav className="kavio-module-tabs kavio-nav-tabs" aria-label={label}>{items.map(item=><Link key={item.href} href={item.href} className={`kavio-module-tab ${item.active?'is-active':''}`} aria-current={item.active?'page':undefined}>{item.label}</Link>)}</nav>;
}
