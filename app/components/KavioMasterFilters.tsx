import type {ReactNode} from 'react';

/** Shared filter row for master catalogs, using the foundation fields and spacing. */
export default function KavioMasterFilters({children}:{children:ReactNode}) {
 return <div className="kavio-master-filters">{children}</div>;
}
