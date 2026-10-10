'use client';
import {useEffect,useState} from 'react';
/** Locale-friendly percentage input: editing never drops the comma or moves the cursor. */
export default function KavioPercentInput({value,onChange,label,min=0,required=true,disabled=false}:{disabled?:boolean;value:number;onChange:(value:number)=>void;label:string;min?:number;required?:boolean}) {
 const format=(n:number)=>n.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
 const [text,setText]=useState(()=>format(value)),[focused,setFocused]=useState(false);
 useEffect(()=>{if(!focused)setText(format(value));},[value,focused]);
 return <input disabled={disabled} type="text" inputMode="decimal" aria-label={label} value={text} placeholder="0,00" required={required} pattern="[0-9]+([.,][0-9]{1,2})?" onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{
  const raw=e.target.value;
  if(!/^\d*(?:[.,]\d{0,2})?$/.test(raw))return;
  setText(raw);
  const number=Number(raw.replace(',','.'));
  e.currentTarget.setCustomValidity(raw&&(!Number.isFinite(number)||number<min||number>100)?'Bobot harus '+(min>0?'lebih dari 0':'minimal 0')+' dan maksimal 100,00%.':'');
  if(Number.isFinite(number))onChange(number);
 }}/>
}
