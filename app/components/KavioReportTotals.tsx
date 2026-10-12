import {formatKavioMoney} from '../lib/number-format';
export type ReportTotal={label:string;value:number};
export default function KavioReportTotals({values,label='TOTAL SELURUH DATA SESUAI FILTER'}:{values:ReportTotal[];label?:string}){
 return <div className="kavio-report-totals"><strong>{label}</strong><div>{values.map(v=><span key={v.label}>{v.label}<strong className="kavio-number">{formatKavioMoney(v.value,2)}</strong></span>)}</div></div>;
}
