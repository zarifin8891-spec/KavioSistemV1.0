'use client';
import {useEffect,useState} from 'react';

/** Indonesian money display, with an unformatted numeric value for calculations. */
export default function KavioMoneyInput({value,onChange,label,required=true}:{value:number;onChange:(value:number)=>void;label:string;required?:boolean}) {
 const format=(amount:number)=>amount.toLocaleString('id-ID',{maximumFractionDigits:2});
 const [text,setText]=useState(()=>format(value)),[focused,setFocused]=useState(false);
 useEffect(()=>{if(!focused)setText(format(value));},[value,focused]);
 return <input type="text" inputMode="decimal" aria-label={label} value={text} required={required} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={e=>{
  const raw=e.target.value;
  if(!/^[\d.]*(?:,\d{0,2})?$/.test(raw))return;
  const amount=Number(raw.replaceAll('.','').replace(',','.'));
  if(!Number.isFinite(amount))return;
  setText(raw);onChange(amount);
 }}/>;
}
