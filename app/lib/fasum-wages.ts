/** Wage budgets use the same nearest-hundred rounding as work-detail wages. */
export const fasumItemWage=(volume:number,rate:number)=>Number.isFinite(volume)&&Number.isFinite(rate)?Math.round(volume*rate/100)*100:0;
export const fasumTotalWage=(items:ReadonlyArray<{volume:number;harga_satuan_upah:number}>)=>items.reduce((sum,item)=>sum+fasumItemWage(item.volume,item.harga_satuan_upah),0);

/** Apportion integer six-decimal weight units by wage value; stable largest remainder totals exactly 1. */
export function fasumAutoWeights(items:ReadonlyArray<{volume:number;harga_satuan_upah:number}>) {
 const wages=items.map(item=>Math.max(0,fasumItemWage(item.volume,item.harga_satuan_upah)));
 if(wages.some(w=>!Number.isSafeInteger(w)))return wages.map(()=>0);
 const total=wages.reduce((n,w)=>n+BigInt(w),0n);if(total===0n)return wages.map(()=>0);
 const quotas=wages.map((w,index)=>{const numerator=BigInt(w)*1000000n;return {index,units:Number(numerator/total),remainder:numerator%total};});
 let remaining=1000000-quotas.reduce((n,q)=>n+q.units,0);
 const ranked=[...quotas].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
 for(const row of ranked){if(!remaining)break;row.units++;remaining--;}
 return quotas.map(q=>q.units/1000000);
}
