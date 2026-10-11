export function workPipelineStages(rows:{progress_akumulasi:number|string}[]) {
 return [
  {label:'BELUM MULAI',count:rows.filter(r=>Number(r.progress_akumulasi)<=0).length,tone:'muted' as const},
  {label:'BERJALAN',count:rows.filter(r=>Number(r.progress_akumulasi)>0&&Number(r.progress_akumulasi)<1).length,tone:'gold' as const},
  {label:'SELESAI',count:rows.filter(r=>Number(r.progress_akumulasi)>=1).length,tone:'success' as const},
 ];
}
