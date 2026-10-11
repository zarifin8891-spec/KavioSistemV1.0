import type {ReactNode} from 'react';
/** Shared filter layout with explicit, bounded field widths. */
export default function KavioFilterBar({children,className=''}:{children:ReactNode;className?:string}) {
 return <div className={`kavio-filter-bar ${className}`}>{children}</div>;
}
export function KavioFilterField({label,kind='select',children}:{label:string;kind?:'date'|'search'|'select';children:ReactNode}) {
 return <label className={`kavio-field kavio-filter-field kavio-filter-${kind}`}><span>{label}</span>{children}</label>;
}

export function KavioFilterActions({children}:{children:ReactNode}) {
 return <div className="kavio-filter-actions">{children}</div>;
}
