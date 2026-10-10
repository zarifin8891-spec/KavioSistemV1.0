'use client';
import {useState} from 'react';
import {useSearchParams} from 'next/navigation';
import KavioPercentInput from '../../components/KavioPercentInput';
import {weightUnits} from '../../lib/work-detail';
export default function KategoriFields({category,type,weight=0}:{category?:{id_kategori:string;nama_kategori:string;urutan:number};type?:{id_tipe:string;nama_tipe:string};weight?:number}) {
 const [bobot,setBobot]=useState(weight),params=useSearchParams();
 return <>
 {params.get('error')&&<div className="kavio-alert error" style={{gridColumn:'1 / -1'}} role="alert">{params.get('error')}</div>}
 <input type="hidden" name="id_tipe" value={type?.id_tipe??''}/>
 <label className="kavio-field"><span>URUTAN</span><input type="number" name="urutan" min="1" step="1" defaultValue={category?.urutan??''} placeholder="1" required/></label>
 <label className="kavio-field"><span>ID KATEGORI</span><input name="id_kategori" defaultValue={category?.id_kategori??''} placeholder="KAT01" readOnly={Boolean(category)} required/></label>
 <label className="kavio-field"><span>NAMA KATEGORI</span><input name="nama_kategori" defaultValue={category?.nama_kategori??''} placeholder="Pekerjaan Pondasi" required/></label>
 <label className="kavio-field"><span>BOBOT (%) · {type?.nama_tipe??'TIPE BELUM TERSEDIA'}</span><KavioPercentInput label="Bobot kategori" value={bobot*100} onChange={value=>setBobot(weightUnits(value/100)/1000000)}/></label>
 <input type="hidden" name="bobot_fraction" data-kavio-persist-hidden="true" value={bobot} onInput={e=>{const n=Number(e.currentTarget.value);if(Number.isFinite(n)&&n>=0&&n<=1)setBobot(n);}}/>
 <p className="kavio-form-note" style={{gridColumn:'1 / -1'}}>Bobot berlaku untuk tipe rumah yang dipilih. Jika perincian sudah siap digunakan, perubahan bobot harus tetap sesuai jumlah bobot item dan total 100%.</p>
 </>;
}
