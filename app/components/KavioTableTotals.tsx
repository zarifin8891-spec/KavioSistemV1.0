import {formatKavioMoney} from '../lib/number-format';
export type TableTotal={label:string;value:number;column:number};
export default function KavioTableTotals({columns,totals,label='TOTAL SELURUH DATA SESUAI FILTER'}:{columns:number;totals:TableTotal[];label?:string}){
 const repeated=new Set(totals.map(t=>t.column)).size!==totals.length;
 const groups=repeated?totals.map(t=>[t]):[totals];
 return <tfoot>{groups.map((group,i)=>{const first=Math.min(...group.map(t=>t.column));return <tr key={i}><td colSpan={first}>{repeated?group[0].label:label}</td>{Array.from({length:columns-first},(_,offset)=>{const column=first+offset,total=group.find(t=>t.column===column);return <td className="kavio-number" key={column}>{total?formatKavioMoney(total.value,2):''}</td>;})}</tr>;})}</tfoot>;
}
