import type {CSSProperties,ReactNode} from 'react';
export type KavioDetailItem={label:string;value:ReactNode;money?:boolean;span?:number};
/** Compact read-only details. Shared spacing/type and responsive columns live in Foundation. */
export default function KavioDetailGrid({items,columns=6}:{items:KavioDetailItem[];columns?:4|5|6}){
 return <div className="kavio-detail-grid" style={{'--kavio-detail-columns':columns} as CSSProperties}>{items.map(item=><div key={item.label} className={`kavio-detail-item${item.money?' kavio-detail-money':''}`} style={item.span?{'--kavio-detail-span':item.span} as CSSProperties:undefined}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>;
}
