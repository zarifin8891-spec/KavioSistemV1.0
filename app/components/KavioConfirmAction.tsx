'use client';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import KavioFormModal from './KavioFormModal';
import KavioFormActions from './KavioFormActions';
type ServerAction=(formData:FormData)=>void|Promise<void>;
/** Foundation confirmation dialog; all callers avoid browser-native confirmation. */
export default function KavioConfirmAction({action,confirmMessage,label,className='kavio-button secondary',hidden,focusId,blockingMessage}:{action:ServerAction;confirmMessage:string;label:string;className?:string;hidden?:Record<string,string>;focusId?:string;blockingMessage?:string}){
 const [open,setOpen]=useState(false),params=useSearchParams();
 const failed=!!focusId&&params.get('focus')===focusId&&!!params.get('error');
 useEffect(()=>{if(failed)setOpen(true);else if(params.get('success'))setOpen(false);},[failed,params]);
 return <><button type="button" className={className} onClick={()=>setOpen(true)}>{label}</button><KavioFormModal open={open} onClose={()=>setOpen(false)} size="compact" ariaLabel={'Konfirmasi '+label} closeOnBackdrop={false}><section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">KONFIRMASI {label}</h2></div><form action={action} className="kavio-form kavio-panel-body">{Object.entries(hidden??{}).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}{failed&&params.get('error')!==blockingMessage&&<div className="kavio-alert error kavio-field-wide" role="alert">{params.get('error')}</div>}{blockingMessage?<div className="kavio-alert error kavio-field-wide" role="alert">{blockingMessage}</div>:<p className="kavio-field-wide">{confirmMessage}</p>}<KavioFormActions>{!blockingMessage&&<button type="submit" className="kavio-button">{label}</button>}</KavioFormActions></form></section></KavioFormModal></>;
}
