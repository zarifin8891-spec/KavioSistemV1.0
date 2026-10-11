'use client';
import {useEffect,useState} from 'react';
/** Shared decimal quantity input: two decimals on blur, Indonesian comma while editing. */
export default function KavioDecimalInput({value,onChange,label,required=true}:{value:number;onChange:(value:number)=>void;label:string;required?:boolean}) {
 const format=(n:number)=>n.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
 const [text,setText]=useState(()=>format(value)),[focused,setFocused]=useState(false);
 useEffect(()=>{if(!focused)setText(format(value));},[value,focused]);
 return <input type="text" inputMode="decimal" aria-label={label} required={required} value={text} pattern="[0-9]+([.,][0-9]{1,2})?" onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{
  const raw=e.target.value;if(!/^\d*(?:[.,]\d{0,2})?$/.test(raw))return;
  const number=Number(raw.replace(',','.'));if(!Number.isFinite(number))return;
  e.currentTarget.setCustomValidity(number<=0?'Volume harus lebih dari nol.':'');setText(raw);onChange(number);
 }}/>
}
