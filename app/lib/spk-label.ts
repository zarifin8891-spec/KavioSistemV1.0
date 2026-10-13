export type SpkIdentity={no_spk?:string|null;jenis_spk?:string|null;id_kavling?:string|null;nama_objek?:string|null};
export function spkLabel(s:SpkIdentity){return [s.no_spk??'NOMOR BELUM TERSEDIA',s.jenis_spk,s.id_kavling??s.nama_objek].filter(Boolean).join(' · ');}
