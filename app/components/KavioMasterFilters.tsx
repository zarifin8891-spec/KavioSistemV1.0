import type {ReactNode} from 'react';
import KavioFilterBar from './KavioFilterBar';

/** Master catalogs share the canonical Foundation filter sizing and alignment. */
export default function KavioMasterFilters({children}:{children:ReactNode}) {
 return <KavioFilterBar>{children}</KavioFilterBar>;
}
