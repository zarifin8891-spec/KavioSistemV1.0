export type WorkGroup = {id_kategori:string;nama_kategori:string;bobot:number};
export type WorkDetail = {group_id:string;urutan:number;nama_pekerjaan:string;volume:number;satuan:string;bobot:number;retensi:number;id_mandor?:string};
export type WorkEditorState = {total_upah:number;mode:string;groups:WorkGroup[];details:WorkDetail[]};
// Weights use six decimal places as fractions (four as percentages), like the existing template engine.
export const weightUnits=(value:number)=>Math.round(value*1_000_000);
// Round the final percentage total, not each item; keep six-decimal source weights.
export const workTotalPercent=(groups:WorkGroup[])=>Math.floor((groups.reduce((sum,g)=>sum+weightUnits(g.bobot),0)+50)/100)/100;
export function workWeightIssues(groups:WorkGroup[],details:WorkDetail[]) {
 const issues:string[]=[];
 if(workTotalPercent(groups)!==100) issues.push('Total bobot kategori setelah pembulatan dua desimal harus 100,00%.');
 for(const group of groups) {
  const sum=details.filter(d=>d.group_id===group.id_kategori).reduce((n,d)=>n+weightUnits(d.bobot),0);
  if(sum!==weightUnits(group.bobot)) issues.push(`${group.nama_kategori}: bobot item belum sama dengan bobot kategori.`);
 }
 return issues;
}
export const workMoney=(value:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);

export const workPercent=(fraction:number)=>new Intl.NumberFormat('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}).format(fraction*100);

/** Item wages are rounded to the nearest hundred rupiah (spreadsheet ROUND(value; -2)). */
export const workItemWage=(bobot:number,totalUpah:number)=>Math.round(bobot*totalUpah/100)*100;
