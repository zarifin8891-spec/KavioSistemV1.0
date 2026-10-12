import type {ReactNode} from 'react';
export default function KavioTransactionHeader({today,children}:{today:string;children:ReactNode}) {
 return <div className="kavio-transaction-header kavio-transaction-header-flex"><label className="kavio-field kavio-transaction-date"><span>TANGGAL</span><input name="tanggal" type="date" defaultValue={today} max={today} required/></label>{children}</div>;
}
