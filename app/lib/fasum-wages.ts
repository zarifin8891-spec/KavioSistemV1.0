/** Wage budgets use the same nearest-hundred rounding as work-detail wages. */
export const fasumItemWage=(volume:number,rate:number)=>Number.isFinite(volume)&&Number.isFinite(rate)?Math.round(volume*rate/100)*100:0;
export const fasumTotalWage=(items:ReadonlyArray<{volume:number;harga_satuan_upah:number}>)=>items.reduce((sum,item)=>sum+fasumItemWage(item.volume,item.harga_satuan_upah),0);
