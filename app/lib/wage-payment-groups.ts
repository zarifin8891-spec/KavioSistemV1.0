export type WageDebt={id_progress_detail:string;tanggal_update:string;id_mandor:string;nama_mandor:string;nama_pekerjaan:string;id_spk:string;jenis_spk:string;id_kavling:string|null;nama_objek:string|null;sisa_upah:number;retensi_tersedia:number;retensi_layak:boolean};
export type WageDebtGroup={key:string;date:string;spk:string;mandor:string;mandorName:string;label:string;amount:number;eligible:boolean;details:WageDebt[]};
const cents=(n:number)=>{const value=Math.round(n*100);if(!Number.isSafeInteger(value)||Math.abs(value/100-n)>0.000001)throw new Error('Nominal upah harus valid dengan maksimal dua desimal.');return value;};
export function groupWageDebts(rows:WageDebt[],kind:string):WageDebtGroup[]{
 const groups=new Map<string,WageDebtGroup>();
 for(const r of rows){const key=JSON.stringify([r.id_spk,r.tanggal_update,r.id_mandor]);let group=groups.get(key);if(!group){group={key,date:r.tanggal_update,spk:r.id_spk,mandor:r.id_mandor,mandorName:r.nama_mandor,label:`${r.jenis_spk} · ${r.id_kavling??r.nama_objek}`,amount:0,eligible:true,details:[]};groups.set(key,group);}group.details.push(r);group.amount=(cents(group.amount)+cents(Number(kind==='UPAH'?r.sisa_upah:r.retensi_tersedia)))/100;group.eligible=group.eligible&&(kind==='UPAH'||r.retensi_layak);}
 return Array.from(groups.values()).sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label)||a.mandor.localeCompare(b.mandor));
}
/** Allocate a recap payment proportionally to its work debts, conserving every cent. */
export function allocateWageGroup(group:WageDebtGroup,amount:number,kind:string){
 const requested=cents(amount),total=cents(group.amount);if(requested<=0||requested>total||!group.eligible)throw new Error('Nominal rekap melebihi sisa tagihan atau retensi belum layak.');
 const lines=[...group.details].sort((a,b)=>a.id_progress_detail.localeCompare(b.id_progress_detail)).map(r=>{const available=cents(Number(kind==='UPAH'?r.sisa_upah:r.retensi_tersedia));const exact=BigInt(requested)*BigInt(available);return {id_progress_detail:r.id_progress_detail,available,paid:Number(exact/BigInt(total)),remainder:exact%BigInt(total)};});
 let remaining=requested-lines.reduce((sum,r)=>sum+r.paid,0);
 for(const r of [...lines].sort((a,b)=>a.remainder===b.remainder?a.id_progress_detail.localeCompare(b.id_progress_detail):a.remainder>b.remainder?-1:1)){if(!remaining)break;if(r.paid<r.available){r.paid++;remaining--;}}
 if(remaining)throw new Error('Alokasi upah belum seimbang.');
 return lines.filter(r=>r.paid>0).map(r=>({id_progress_detail:r.id_progress_detail,nominal:r.paid/100}));
}
