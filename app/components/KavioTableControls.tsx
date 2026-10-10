'use client';
import type {ReactNode} from 'react';
/** Global foundation for table filters and counted server pagination. */
export default function KavioTableControls({children,count,page,pageSize=50,onPage,busy=false}:{children:ReactNode;count:number;page:number;pageSize?:number;onPage:(page:number)=>void;busy?:boolean}) {
 const pages=Math.max(1,Math.ceil(count/pageSize));
 return <><div className="kavio-table-filters">{children}</div><div className="kavio-table-pagination" aria-live="polite"><span>{busy?'Memuat data…':`${count} baris · Halaman ${page+1} dari ${pages}`}</span><div><button className="kavio-button secondary" type="button" disabled={busy||page===0} onClick={()=>onPage(page-1)}>SEBELUMNYA</button><button className="kavio-button secondary" type="button" disabled={busy||page+1>=pages} onClick={()=>onPage(page+1)}>BERIKUTNYA</button></div></div></>;
}
