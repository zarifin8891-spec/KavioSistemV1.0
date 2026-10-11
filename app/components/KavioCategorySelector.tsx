'use client';
import KavioPercentInput from './KavioPercentInput';
import {workPercent} from '../lib/work-detail';
/** Shared compact category strip: selection and optional percentage editing stay together. */
export default function KavioCategorySelector({items,activeId,onSelect,onWeightChange,readOnly=false}:{items:{id_kategori:string;nama_kategori:string;bobot:number}[];activeId:string;onSelect:(id:string)=>void;onWeightChange?:(id:string,value:number)=>void;readOnly?:boolean}) {
 return <nav className="kavio-category-selector" aria-label="Kategori pekerjaan"><span className="kavio-category-label">PILIH KATEGORI</span><div className="kavio-category-strip">{items.map(item=><div key={item.id_kategori} className={`kavio-category-card ${activeId===item.id_kategori?'is-active':''}`} style={{flexGrow:Math.max(1,Math.min(2,item.nama_kategori.length/12))}}><button type="button" aria-pressed={activeId===item.id_kategori} onClick={()=>onSelect(item.id_kategori)}>{item.nama_kategori}</button>{onWeightChange?<label className="kavio-category-weight" onFocus={()=>onSelect(item.id_kategori)}><KavioPercentInput precision={4} disabled={readOnly} label={`Bobot kategori ${item.nama_kategori}`} value={item.bobot*100} onChange={value=>onWeightChange(item.id_kategori,value)}/><span>%</span></label>:<span className="kavio-category-weight">{workPercent(item.bobot)}%</span>}</div>)}</div></nav>;
}
