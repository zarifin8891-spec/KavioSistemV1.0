import {saveMaterial} from './actions';
export type Material={id_material:string;kode_referensi:string|null;nama_material:string;kategori:string;satuan:string;jenis_item:string};
export default function MaterialForm({row}:{row?:Material}){return <form action={saveMaterial} className="kavio-form kavio-panel-body">
 {row&&<input type="hidden" name="id_material" value={row.id_material}/>}
 <label className="kavio-field"><span>KODE</span><input name="kode_referensi" defaultValue={row?.kode_referensi??''}/></label>
 <label className="kavio-field"><span>NAMA MATERIAL</span><input id="nama_material" name="nama_material" defaultValue={row?.nama_material??''} required/></label>
 <label className="kavio-field"><span>KATEGORI</span><input name="kategori" defaultValue={row?.kategori??''} required/></label>
 <label className="kavio-field"><span>SATUAN</span><input name="satuan" defaultValue={row?.satuan??''} required/></label>
 <label className="kavio-field"><span>JENIS</span><select name="jenis_item" defaultValue={row?.jenis_item??'BAHAN'}><option value="BAHAN">BAHAN</option><option value="ALAT_PAKAI_ULANG">ALAT PAKAI ULANG</option></select></label>
 <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN MATERIAL</button></div>
 </form>;}
