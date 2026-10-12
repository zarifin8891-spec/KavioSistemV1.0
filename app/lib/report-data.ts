/** Read the complete filtered result, never relying on the API's default row cap. */
export async function readAllReportRows<T>(query:{range:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:{message:string}|null}>}):Promise<T[]> {
 const rows:T[]=[];for(let offset=0;;offset+=500){const result=await query.range(offset,offset+499);if(result.error)throw new Error(result.error.message);rows.push(...(result.data??[]));if((result.data?.length??0)<500)return rows;}
}
export type ReportCell=string|number|null|undefined;
export function reportCsv(headers:string[],rows:ReportCell[][]):string {
 const cell=(v:ReportCell)=>{let text=v==null?'':String(v);if(typeof v!=='number'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
}
export function escapeReportHtml(value:ReportCell):string{return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
