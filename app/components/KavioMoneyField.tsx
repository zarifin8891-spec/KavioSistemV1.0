'use client';
import {useState} from 'react';
import KavioMoneyInput from './KavioMoneyInput';
/** Foundation money field: formatted display, numeric submission and restored drafts. */
export default function KavioMoneyField({name,label,initial=0}:{name:string;label:string;initial?:number}) {
 const [value,setValue]=useState(initial);
 return <label className="kavio-field"><span>{label}</span><KavioMoneyInput value={value} onChange={setValue} label={label}/><input type="hidden" name={name} value={value} data-kavio-persist-hidden="true" onInput={e=>{const n=Number(e.currentTarget.value);if(Number.isFinite(n))setValue(n);}}/></label>;
}

