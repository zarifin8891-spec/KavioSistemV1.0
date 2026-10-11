'use client';
export default function KavioPrintButton({label='CETAK LAPORAN',disabled=false}:{label?:string;disabled?:boolean}) {
 return <button type="button" className="kavio-button" disabled={disabled} onClick={()=>window.print()}>{label}</button>;
}
