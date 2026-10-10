'use client';

import {Children, useEffect, useId, useRef, useState} from 'react';
import {useSearchParams} from 'next/navigation';

/** All panel data comes with the page; changing tabs never requests it again. */
export default function KavioModuleTabs({tabs,children}: {
  tabs:{id:string;label:string;focusIds?:string[]}[];
  children:React.ReactNode;
}) {
  const params=useSearchParams();
  const focus=params.get('focus')??'';
  const errorTab=params.get('error')?tabs.find(t=>t.focusIds?.includes(focus))?.id:undefined;
  const urlTab=errorTab??(tabs.some(t=>t.id===params.get('tab'))?params.get('tab'):tabs[0]?.id);
  const [active,setActive]=useState(urlTab);
  const id=useId();
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  useEffect(()=>setActive(urlTab),[urlTab]);
  const select=(tab:string)=>{
    setActive(tab);
    const url=new URL(window.location.href);
    url.searchParams.set('tab',tab);
    ['error','focus','form','edit','hapus'].forEach(key=>url.searchParams.delete(key));
    window.history.pushState(null,'',url.pathname+url.search+url.hash);
  };
  const panels=Children.toArray(children);
  return <>
    <nav className="kavio-module-tabs" role="tablist" aria-label="Modul operasional">{tabs.map((tab,index)=><button key={tab.id} ref={node=>{buttons.current[index]=node;}} id={`${id}-tab-${tab.id}`} type="button" role="tab" aria-controls={`${id}-panel-${tab.id}`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} className={`kavio-module-tab ${active===tab.id?'is-active':''}`} onClick={()=>select(tab.id)} onKeyDown={event=>{
      let next:number;
      if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=tabs.length-1;
      else return;
      event.preventDefault();select(tabs[next].id);buttons.current[next]?.focus();
    }}>{tab.label}</button>)}</nav>
    {tabs.map((tab,index)=><section key={tab.id} id={`${id}-panel-${tab.id}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab.id}`} className="kavio-module-content" hidden={active!==tab.id}>{panels[index]}</section>)}
  </>;
}
