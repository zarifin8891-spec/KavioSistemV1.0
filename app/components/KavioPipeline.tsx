type Stage = { label:string; count:number; tone:'muted'|'gold'|'success' };
export default function KavioPipeline({label,stages}:{label:string;stages:Stage[]}) {
 const total=stages.reduce((sum,s)=>sum+s.count,0);
 return <section className="kavio-pipeline" aria-label={label}><div className="kavio-pipeline-heading"><span>{label}</span><small>{total.toLocaleString('id-ID')} DATA</small></div><div className="kavio-pipeline-track" aria-hidden="true">{stages.map(s=><span key={s.label} className={`kavio-pipeline-segment tone-${s.tone}`} style={{flexGrow:s.count}}/>)}</div><dl className="kavio-pipeline-stages">{stages.map(s=><div key={s.label}><dt><i className={`tone-${s.tone}`}/>{s.label}</dt><dd>{s.count.toLocaleString('id-ID')} <small>{total?Math.round(s.count/total*100):0}%</small></dd></div>)}</dl></section>;
}
