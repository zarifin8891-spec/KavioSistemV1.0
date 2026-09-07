import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

type OperationalStatus = 'BERJALAN' | 'PERHATIAN' | 'LEWAT TARGET' | 'SELESAI';
type PaceStatus = 'DI DEPAN' | 'SESUAI RITME' | 'TERTINGGAL';
type ActionPriority = 'TINGGI' | 'SEDANG' | 'NORMAL';
type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';
type DecisionRow = {
  id_spk: string;
  id_kavling: string;
  progress_aktual: number | string;
  progress_seharusnya: number | string;
  gap_progress: number | string;
  sisa_hari: number;
  tanggal_update_terakhir: string | null;
  progress_periode_terakhir: number | string;
  status_operasional: OperationalStatus;
  status_ritme: PaceStatus;
  prioritas_tindakan: ActionPriority;
  action_rekomendasi: string;
  tgl_target_selesai: string;
  hari_sejak_update: number | null;
  progress_diperlukan_per_hari: number | string | null;
  health_score: number;
  health_level: HealthLevel;
  health_description: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.from('v_decision_engine')
    .select('id_spk, id_kavling, progress_aktual, progress_seharusnya, gap_progress, sisa_hari, tanggal_update_terakhir, progress_periode_terakhir, status_operasional, status_ritme, prioritas_tindakan, action_rekomendasi, tgl_target_selesai, hari_sejak_update, progress_diperlukan_per_hari, health_score, health_level, health_description')
    .neq('status_spk', 'DRAFT').order('health_score', { ascending: true }).limit(50);

  const rows = (data ?? []) as DecisionRow[];
  const avgProgress = rows.length ? rows.reduce((s, r) => s + Number(r.progress_aktual ?? 0), 0) / rows.length : 0;
  const avgHealth = rows.length ? Math.round(rows.reduce((s, r) => s + Number(r.health_score ?? 0), 0) / rows.length) : 0;
  const healthCounts = rows.reduce((a, r) => { a[r.health_level] += 1; return a; }, { SEHAT: 0, WASPADA: 0, KRITIS: 0 } as Record<HealthLevel, number>);
  const statusCounts = rows.reduce((a, r) => { a[r.status_operasional] += 1; return a; }, { BERJALAN: 0, PERHATIAN: 0, 'LEWAT TARGET': 0, SELESAI: 0 } as Record<OperationalStatus, number>);
  const actionRows = rows.filter(r => r.prioritas_tindakan !== 'NORMAL').sort((a,b) => priorityRank(a.prioritas_tindakan) - priorityRank(b.prioritas_tindakan) || a.health_score - b.health_score);
  const riskRows = rows.filter(r => r.health_level !== 'SEHAT').slice(0, 6);
  const today = new Date().toISOString().slice(0,10);

  return <main style={page}>
    <header style={header}><div><div style={brand}>KAVIO</div><div style={title}>Monitor V1.0</div></div><div style={userBox}><div>{user.email}</div><form action="/auth/signout" method="post"><button type="submit" style={logout}>Keluar</button></form></div></header>
    <section style={content}>
      <div style={hero}><div><div style={eyebrow}>EXECUTIVE CONTROL ROOM</div><h1 style={h1}>Dashboard Monitoring</h1><p style={subtitle}>Kesehatan proyek, risiko, dan tindakan prioritas dalam satu layar.</p></div><div style={links}><Link href="/master/spk" style={primaryLink}>Kelola SPK</Link><Link href="/progress" style={secondaryLink}>Input Progress</Link><Link href="/master/kavling" style={ghostLink}>Master Kavling</Link></div></div>
      {error && <div style={alertError}>{error.message}</div>}

      <section style={healthBand}>
        <div style={healthMain}><div style={labelGold}>PROJECT HEALTH</div><div style={healthMainRow}><div style={healthRing(avgHealth)}>{avgHealth}</div><div><div style={healthTitle}>{healthLabel(avgHealth)}</div><div style={healthSub}>{rows.length} SPK dipantau · rata-rata progress {(avgProgress*100).toFixed(1)}%</div></div></div></div>
        <HealthSegment label="SEHAT" value={healthCounts.SEHAT} level="SEHAT" total={rows.length}/><HealthSegment label="WASPADA" value={healthCounts.WASPADA} level="WASPADA" total={rows.length}/><HealthSegment label="KRITIS" value={healthCounts.KRITIS} level="KRITIS" total={rows.length}/>
      </section>

      <section style={kpiGrid}><Kpi label="Kavling Terpantau" value={String(rows.length)} helper="SPK aktif / terpantau"/><Kpi label="Rata-rata Health" value={`${avgHealth}/100`} helper="Kesehatan operasional rata-rata"/><Kpi label="SPK Berjalan" value={String(statusCounts.BERJALAN)} helper={`${statusCounts.PERHATIAN + statusCounts['LEWAT TARGET']} perlu perhatian`}/><Kpi label="Perlu Tindakan" value={String(actionRows.length)} helper={`${actionRows.filter(r => r.prioritas_tindakan === 'TINGGI').length} prioritas tinggi`} warning={actionRows.length>0}/></section>

      <section style={twoCol}>
        <div style={card}><div style={sectionHead}><div><div style={sectionTitle}>SPK Perlu Perhatian</div><div style={sectionNote}>Ranking Health Score terendah.</div></div><div style={pill}>{riskRows.length}</div></div>{riskRows.length ? <div style={{padding:'8px 18px 18px'}}>{riskRows.map(r => <HealthRow key={r.id_spk} row={r}/>)}</div> : <div style={empty}>Semua SPK dalam kondisi sehat.</div>}</div>
        <div style={card}><div style={sectionHead}><div><div style={sectionTitle}>Action Center</div><div style={sectionNote}>Prioritas tindakan dari Decision Engine.</div></div><div style={pill}>{actionRows.length}</div></div>{actionRows.length ? <div style={{overflowX:'auto'}}><table style={table}><thead><tr><th style={th}>Prioritas</th><th style={th}>Kavling</th><th style={th}>Sisa</th><th style={th}>Tindakan</th></tr></thead><tbody>{actionRows.slice(0,8).map(r=><tr key={r.id_spk}><td style={td}><PriorityBadge priority={r.prioritas_tindakan}/></td><td style={td}><Link href={`/master/spk/detail/${r.id_spk}`} style={linkGold}>{r.id_kavling}</Link></td><td style={td}>{r.sisa_hari < 0 ? `Lewat ${Math.abs(r.sisa_hari)}h` : `${r.sisa_hari}h`}</td><td style={{...td,fontWeight:700}}>{r.action_rekomendasi}</td></tr>)}</tbody></table></div> : <div style={empty}>Belum ada tindakan prioritas.</div>}</div>
      </section>

      <section style={card}><div style={sectionHead}><div><div style={sectionTitle}>Monitoring SPK</div><div style={sectionNote}>Aktual vs rencana, update terakhir, dan kebutuhan progress harian.</div></div><div style={datePill}>Per {today}</div></div><div style={{overflowX:'auto'}}><table style={tableWide}><thead><tr><th style={th}>Health</th><th style={th}>Kavling</th><th style={th}>Progress</th><th style={th}>Gap</th><th style={th}>Update</th><th style={th}>Butuh / Hari</th><th style={th}>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.id_spk}><td style={td}><HealthBadge row={r}/></td><td style={td}><Link href={`/master/spk/detail/${r.id_spk}`} style={linkGold}>{r.id_kavling}</Link><div style={micro}>SPK {r.id_spk.slice(0,8)}</div></td><td style={{...td,minWidth:220}}><div style={percentLine}><strong>{(Number(r.progress_aktual)*100).toFixed(1)}%</strong><span>Rencana {(Number(r.progress_seharusnya)*100).toFixed(1)}%</span></div><div style={track}><div style={{...fill,width:`${Math.min(100,Math.max(0,Number(r.progress_aktual)*100))}%`}}/></div></td><td style={{...td,fontWeight:800,color:Number(r.gap_progress)<0?'#FCA5A5':'#E8CC7A'}}>{Number(r.gap_progress)>=0?'+':''}{(Number(r.gap_progress)*100).toFixed(1)}%</td><td style={td}>{r.tanggal_update_terakhir ?? 'Belum ada'}<div style={micro}>{r.hari_sejak_update == null ? 'Belum ada update' : `${r.hari_sejak_update} hari lalu`}</div></td><td style={td}>{r.progress_diperlukan_per_hari == null ? '—' : `${(Number(r.progress_diperlukan_per_hari)*100).toFixed(2)}%`}</td><td style={td}><StatusBadge status={r.status_operasional}/><div style={{marginTop:4}}><PaceBadge status={r.status_ritme}/></div></td></tr>)}</tbody></table></div></section>
    </section>
  </main>;
}

function HealthRow({row}:{row:DecisionRow}){return <div style={healthRow}><HealthBadge row={row}/><div style={{minWidth:0,flex:1}}><Link href={`/master/spk/detail/${row.id_spk}`} style={linkGold}>{row.id_kavling}</Link><div style={micro}>{row.health_description}</div></div><div style={healthMetrics}><strong>{(Number(row.progress_aktual)*100).toFixed(1)}%</strong><span>gap {(Number(row.gap_progress)*100).toFixed(1)}%</span></div></div>}
function HealthBadge({row}:{row:DecisionRow}){return <div style={miniHealth(row.health_level)}><span>{row.health_score}</span><small>{row.health_level}</small></div>}
function HealthSegment({label,value,level,total}:{label:HealthLevel;value:number;level:HealthLevel;total:number}){const pct=total?Math.round(value/total*100):0;return <div style={segment}><div style={segmentTop}><span>{label}</span><strong>{value}</strong></div><div style={segmentTrack}><div style={{...segmentFill(level),width:`${pct}%`}}/></div><div style={segmentPct}>{pct}% portfolio</div></div>}
function healthLabel(score:number){return score>=75?'SEHAT':score>=50?'WASPADA':'KRITIS'}
function Kpi({label,value,helper,warning=false}:{label:string;value:string;helper:string;warning?:boolean}){return <div style={{...card,padding:18,borderColor:warning?'#B8943F':'rgba(216,180,90,.35)'}}><div style={muted}>{label}</div><div style={kpiValue}>{value}</div><div style={{...micro,color:warning?'#E8CC7A':'#BFAF83'}}>{helper}</div></div>}
function PriorityBadge({priority}:{priority:ActionPriority}){const s=priorityStyles[priority];return <span style={{display:'inline-flex',padding:'5px 9px',borderRadius:999,fontSize:10,fontWeight:800,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{priority}</span>}
function StatusBadge({status}:{status:OperationalStatus}){const s=statusStyles[status];return <span style={{display:'inline-flex',padding:'5px 9px',borderRadius:999,fontSize:10,fontWeight:800,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{status}</span>}
function PaceBadge({status}:{status:PaceStatus}){const s=paceStyles[status];return <span style={{display:'inline-flex',padding:'4px 8px',borderRadius:999,fontSize:9,fontWeight:800,background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{status}</span>}
function healthRing(score:number){const tone=score>=75?'#D8B45A':score>=50?'#E8CC7A':'#FCA5A5';return {width:76,height:76,borderRadius:'50%',border:`3px solid ${tone}`,display:'grid',placeItems:'center',fontSize:28,fontWeight:900,color:tone,background:'#0B1D3A'};}
function miniHealth(level:HealthLevel){const s=healthStyles[level];return {width:64,minWidth:64,borderRadius:12,padding:'7px 6px',background:s.bg,color:s.color,border:`1px solid ${s.border}`,textAlign:'center' as const,display:'flex',flexDirection:'column' as const,gap:2};}
function segmentFill(level:HealthLevel){return {height:'100%',borderRadius:999,background:healthStyles[level].color};}
function priorityRank(p:ActionPriority){return p==='TINGGI'?0:p==='SEDANG'?1:2}
const page={minHeight:'100vh',background:'#0B1D3A',color:'#F7F3E8'};
const header={background:'#102A56',borderBottom:'1px solid #B8943F',padding:'18px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'};
const brand={fontSize:13,fontWeight:900,letterSpacing:2,color:'#E8CC7A'};
const title={fontSize:22,fontWeight:800,color:'#F7F3E8'};
const userBox={textAlign:'right' as const,fontSize:12,color:'#DCCB9C'};
const logout={marginTop:5,border:0,background:'transparent',color:'#E8CC7A',fontWeight:800,cursor:'pointer'};
const content={maxWidth:1500,margin:'0 auto',padding:28};
const hero={display:'flex',justifyContent:'space-between',alignItems:'end',gap:18,flexWrap:'wrap' as const,marginBottom:20};
const eyebrow={fontSize:11,fontWeight:900,letterSpacing:1.5,color:'#E8CC7A'};
const h1={margin:'5px 0 5px',fontSize:31,color:'#F7F3E8'};
const subtitle={margin:0,color:'#C9BC99',fontSize:14};
const links={display:'flex',gap:10,flexWrap:'wrap' as const};
const primaryLink={background:'linear-gradient(180deg,#E8CC7A,#D8B45A)',color:'#0B1D3A',padding:'11px 16px',borderRadius:10,textDecoration:'none',fontWeight:900,fontSize:13};
const secondaryLink={background:'#162F5B',color:'#E8CC7A',padding:'10px 15px',borderRadius:10,textDecoration:'none',fontWeight:800,fontSize:13,border:'1px solid #B8943F'};
const ghostLink={background:'transparent',color:'#DCCB9C',padding:'10px 15px',borderRadius:10,textDecoration:'none',fontWeight:700,fontSize:13,border:'1px solid rgba(216,180,90,.35)'};
const healthBand={display:'grid',gridTemplateColumns:'1.4fr repeat(3,1fr)',gap:1,background:'#B8943F',border:'1px solid #B8943F',borderRadius:16,overflow:'hidden',marginBottom:16};
const healthMain={background:'#102A56',padding:20};
const healthMainRow={display:'flex',alignItems:'center',gap:18,marginTop:10};
const labelGold={color:'#DCCB9C',fontSize:11,fontWeight:800,letterSpacing:1.2};
const healthTitle={fontSize:24,fontWeight:900,color:'#F7F3E8'};
const healthSub={marginTop:4,fontSize:12,color:'#DCCB9C'};
const segment={background:'#162F5B',padding:18};
const segmentTop={display:'flex',justifyContent:'space-between',fontWeight:900,color:'#F7F3E8'};
const segmentTrack={height:8,borderRadius:999,background:'#0B1D3A',overflow:'hidden',marginTop:13};
const segmentPct={marginTop:8,fontSize:11,color:'#BFAF83'};
const kpiGrid={display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:14,marginBottom:16};
const kpiValue={marginTop:7,fontSize:27,fontWeight:900,color:'#F7F3E8'};
const muted={color:'#DCCB9C',fontSize:12};
const micro={marginTop:4,fontSize:11,color:'#BFAF83',lineHeight:1.35};
const twoCol={display:'grid',gridTemplateColumns:'1fr 1.25fr',gap:16,marginBottom:16};
const card={background:'#162F5B',border:'1px solid rgba(216,180,90,.35)',borderRadius:16,boxShadow:'0 10px 28px rgba(0,0,0,.16)',overflow:'hidden'};
const sectionHead={padding:'16px 18px',borderBottom:'1px solid rgba(216,180,90,.18)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12};
const sectionTitle={fontSize:15,fontWeight:900,color:'#F7F3E8'};
const sectionNote={marginTop:3,fontSize:11,color:'#BFAF83'};
const pill={background:'rgba(216,180,90,.10)',color:'#E8CC7A',border:'1px solid #B8943F',borderRadius:999,padding:'5px 9px',fontSize:10,fontWeight:800};
const datePill={background:'#102A56',color:'#DCCB9C',border:'1px solid rgba(216,180,90,.25)',borderRadius:999,padding:'5px 9px',fontSize:10,fontWeight:700};
const healthStyles:Record<HealthLevel,{bg:string;color:string;border:string}>={SEHAT:{bg:'rgba(216,180,90,.10)',color:'#E8CC7A',border:'#B8943F'},WASPADA:{bg:'rgba(232,204,122,.10)',color:'#E8CC7A',border:'#D8B45A'},KRITIS:{bg:'rgba(248,113,113,.10)',color:'#FCA5A5',border:'#B91C1C'}};
const priorityStyles:Record<ActionPriority,{bg:string;color:string;border:string}>={TINGGI:{bg:'rgba(248,113,113,.10)',color:'#FCA5A5',border:'#B91C1C'},SEDANG:{bg:'rgba(232,204,122,.10)',color:'#E8CC7A',border:'#D8B45A'},NORMAL:{bg:'rgba(220,203,156,.08)',color:'#DCCB9C',border:'#B8943F'}};
const statusStyles:Record<OperationalStatus,{bg:string;color:string;border:string}>={BERJALAN:{bg:'rgba(216,180,90,.10)',color:'#E8CC7A',border:'#B8943F'},PERHATIAN:{bg:'rgba(232,204,122,.10)',color:'#E8CC7A',border:'#D8B45A'},'LEWAT TARGET':{bg:'rgba(248,113,113,.10)',color:'#FCA5A5',border:'#B91C1C'},SELESAI:{bg:'rgba(134,239,172,.10)',color:'#BBF7D0',border:'#15803D'}};
const paceStyles:Record<PaceStatus,{bg:string;color:string;border:string}>={'DI DEPAN':{bg:'rgba(216,180,90,.10)',color:'#E8CC7A',border:'#B8943F'},'SESUAI RITME':{bg:'rgba(220,203,156,.08)',color:'#DCCB9C',border:'#B8943F'},TERTINGGAL:{bg:'rgba(248,113,113,.10)',color:'#FCA5A5',border:'#B91C1C'}};
const healthRow={display:'flex',alignItems:'center',gap:12,padding:'11px 0',borderBottom:'1px solid rgba(216,180,90,.12)'};
const healthMetrics={minWidth:80,textAlign:'right' as const,display:'flex',flexDirection:'column' as const,gap:2,color:'#DCCB9C',fontSize:11};
const empty={padding:28,color:'#DCCB9C',textAlign:'center' as const};
const table={width:'100%',borderCollapse:'collapse' as const,fontSize:13};
const tableWide={width:'100%',borderCollapse:'collapse' as const,fontSize:13,minWidth:1050};
const th={padding:'11px 14px',borderBottom:'1px solid rgba(216,180,90,.22)',background:'#102A56',color:'#E8CC7A',textAlign:'left' as const,whiteSpace:'nowrap'};
const td={padding:'12px 14px',borderBottom:'1px solid rgba(216,180,90,.10)',color:'#F7F3E8',verticalAlign:'middle' as const};
const linkGold={color:'#E8CC7A',textDecoration:'none',fontWeight:900};
const percentLine={display:'flex',justifyContent:'space-between',gap:10,marginBottom:6,fontSize:11};
const track={height:7,borderRadius:999,background:'#0B1D3A',overflow:'hidden'};
const fill={height:'100%',borderRadius:999,background:'linear-gradient(90deg,#B8943F,#E8CC7A)'};
const alertError={background:'rgba(248,113,113,.10)',border:'1px solid #B91C1C',color:'#FCA5A5',padding:13,borderRadius:12,marginBottom:16};
