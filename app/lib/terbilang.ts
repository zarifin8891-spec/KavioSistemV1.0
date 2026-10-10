const small = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function words(n: bigint): string {
  if(n<12n) return small[Number(n)];
  if(n<20n) return `${words(n-10n)} belas`;
  if(n<100n) return `${words(n/10n)} puluh ${words(n%10n)}`.trim();
  if(n<200n) return `seratus ${words(n-100n)}`.trim();
  if(n<1000n) return `${words(n/100n)} ratus ${words(n%100n)}`.trim();
  if(n<2000n) return `seribu ${words(n-1000n)}`.trim();
  for(const [limit,label] of [[1000000000000000n,'kuadriliun'],[1000000000000n,'triliun'],[1000000000n,'miliar'],[1000000n,'juta'],[1000n,'ribu']] as const) {
    if(n>=limit) return `${words(n/limit)} ${label} ${words(n%limit)}`.trim();
  }
  return '';
}
export function terbilangRupiah(value: string | number): string {
  const text=String(value);
  if(!/^\d+(\.\d+)?$/.test(text)) throw new Error('Nominal rupiah tidak valid');
  const [whole,decimal='']=text.split('.');
  const rupiah=BigInt(whole),sen=Number(decimal.padEnd(2,'0').slice(0,2));
  return `${rupiah===0n?'nol':words(rupiah)} rupiah${sen?` ${words(BigInt(sen))} sen`:''}`;
}
