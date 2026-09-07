import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSales, deactivateSales } from './actions';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean };
type Tipe = { id_tipe: string; nama_tipe: string };
type Sales = { id_sales: string; id_kavling: string; nama_konsumen: string; status_sales: string; jenis_pembayaran: string; harga_jual: number | string | null; tgl_booking: string | null; target_akad: string | null; status_aktif: boolean; created_at: string };

export default async function MasterSalesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [kavlingRes, tipeRes, salesRes] = await Promise.all([
    supabase.from('master_kavling').select('id_kavling, blok, no_kavling, id_tipe, status_kavling, status_aktif').eq('status_aktif', true).order('blok').order('no_kavling'),
    supabase.from('master_tipe_rumah').select('id_tipe, nama_tipe').eq('status_aktif', true).order('nama_tipe'),
    supabase.from('sales').select('id_sales, id_kavling, nama_konsumen, status_sales, jenis_pembayaran, harga_jual, tgl_booking, target_akad, status_aktif, created_at').order('created_at', { ascending: false }),
  ]);

  const kavlingRows = (kavlingRes.data ?? []) as Kavling[];
  const tipeRows = (tipeRes.data ?? []) as Tipe[];
  const salesRows = (salesRes.data ?? []) as Sales[];
  const error = params.error ?? kavlingRes.error?.message ?? tipeRes.error?.message ?? salesRes.error?.message;
  const tipeMap = new Map(tipeRows.map((row) => [row.id_tipe, row.nama_tipe]));
  const kavlingMap = new Map(kavlingRows.map((row) => [row.id_kavling, row]));
  const availableKavlings = kavlingRows.filter((row) => row.status_kavling === 'AVAILABLE');

  return (
    <main style={page}>
      <header style={header}><div><Link href="/dashboard" style={back}>← Dashboard</Link><div style={brand}>KAVIO</div><div style={title}>Sales / Konsumen</div></div><div style={userBox}><div>{user.email}</div><form action="/auth/signout" method="post"><button type="submit" style={logout}>Keluar</button></form></div></header>
      <section style={content}>
        <div style={hero}><div><div style={eyebrow}>SALES MONITORING</div><h1 style={h1}>Penjualan Kavling</h1><p style={subtitle}>Kelola booking, penjualan, dan target akad tanpa memutus histori transaksi.</p></div><Link href="/master/kavling" style={secondaryLink}>Lihat Kavling</Link></div>
        {error && <div style={alertError}>{error}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section style={card}><div style={sectionTitle}>Input Sales Baru</div><form action={createSales} style={formGrid}>
          <label style={label}><span>Kavling</span><select name="id_kavling" required style={input} defaultValue=""><option value="" disabled>Pilih kavling AVAILABLE</option>{availableKavlings.map((row) => <option key={row.id_kavling} value={row.id_kavling}>{row.id_kavling} — {tipeMap.get(row.id_tipe) ?? row.id_tipe}</option>)}</select></label>
          <label style={label}><span>Nama Konsumen</span><input name="nama_konsumen" required style={input} placeholder="Nama lengkap konsumen" /></label>
          <label style={label}><span>Status Sales</span><select name="status_sales" required style={input} defaultValue="BOOKING"><option value="BOOKING">BOOKING</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></label>
          <label style={label}><span>Jenis Pembayaran</span><select name="jenis_pembayaran" required style={input} defaultValue="KPR"><option value="KPR">KPR</option><option value="CASH">CASH</option><option value="CASH_BERTAHAP">CASH BERTAHAP</option></select></label>
          <label style={label}><span>Harga Jual</span><input name="harga_jual" type="number" min="0" step="1000" style={input} placeholder="0" /></label>
          <label style={label}><span>Tanggal Booking</span><input name="tgl_booking" type="date" style={input} /></label>
          <label style={label}><span>Target Akad</span><input name="target_akad" type="date" style={input} /></label>
          <div style={buttonRow}><button type="submit" style={primaryButton} disabled={!availableKavlings.length}>+ Simpan Sales</button></div>
        </form></section>

        <section style={{ ...card, marginTop: 18, overflow: 'hidden' }}><div style={sectionHead}><div><div style={sectionTitleNoPad}>Daftar Sales</div><div style={sectionNote}>Satu kavling hanya boleh mempunyai satu sales aktif.</div></div><div style={pill}>{salesRows.filter((row) => row.status_aktif).length} aktif</div></div><div style={{ overflowX: 'auto' }}><table style={table}><thead><tr><th style={th}>Kavling</th><th style={th}>Konsumen</th><th style={th}>Status</th><th style={th}>Pembayaran</th><th style={th}>Harga</th><th style={th}>Booking</th><th style={th}>Target Akad</th><th style={th}>Status Data</th><th style={th}>Aksi</th></tr></thead><tbody>{salesRows.map((row) => <tr key={row.id_sales}><td style={tdStrong}>{row.id_kavling}<div style={micro}>{kavlingMap.get(row.id_kavling)?.blok ?? ''} · {tipeMap.get(kavlingMap.get(row.id_kavling)?.id_tipe ?? '') ?? kavlingMap.get(row.id_kavling)?.id_tipe ?? '—'}</div></td><td style={td}>{row.nama_konsumen}</td><td style={td}><span style={salesBadge(row.status_sales)}>{row.status_sales}</span></td><td style={td}>{row.jenis_pembayaran}</td><td style={td}>{formatCurrency(row.harga_jual)}</td><td style={td}>{row.tgl_booking ?? '—'}</td><td style={td}>{row.target_akad ?? '—'}</td><td style={td}><span style={row.status_aktif ? activeBadge : inactiveBadge}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td><td style={td}>{row.status_aktif ? <form action={deactivateSales}><input type="hidden" name="id_sales" value={row.id_sales} /><button type="submit" style={outlineButton}>Tutup Sales</button></form> : <span style={{ color: '#8D815F' }}>—</span>}</td></tr>)}{!salesRows.length && <tr><td colSpan={9} style={empty}>Belum ada data sales.</td></tr>}</tbody></table></div></section>
      </section>
    </main>
  );
}

function formatCurrency(value: number | string | null) { const n = Number(value); return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n) : '—'; }
function salesBadge(status: string) { const tone = status === 'BATAL' ? { bg: 'rgba(248,113,113,.10)', color: '#FCA5A5', border: '#B91C1C' } : status === 'AKAD' ? { bg: 'rgba(134,239,172,.10)', color: '#BBF7D0', border: '#15803D' } : { bg: 'rgba(216,180,90,.10)', color: '#E8CC7A', border: '#B8943F' }; return { display: 'inline-flex', padding: '5px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }; }
const page = { minHeight: '100vh', background: '#0B1D3A', color: '#F7F3E8' };
const header = { background: '#102A56', borderBottom: '1px solid #B8943F', padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const back = { textDecoration: 'none', color: '#DCCB9C', fontSize: 13 };
const brand = { marginTop: 8, fontSize: 12, fontWeight: 900, letterSpacing: 1.5, color: '#E8CC7A' };
const title = { fontSize: 21, fontWeight: 800, color: '#F7F3E8' };
const userBox = { textAlign: 'right' as const, fontSize: 12, color: '#DCCB9C' };
const logout = { marginTop: 5, border: 0, background: 'transparent', color: '#E8CC7A', fontWeight: 800, cursor: 'pointer' };
const content = { maxWidth: 1400, margin: '0 auto', padding: 28 };
const hero = { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 18, flexWrap: 'wrap' as const, marginBottom: 18 };
const eyebrow = { fontSize: 11, fontWeight: 900, letterSpacing: 1.5, color: '#E8CC7A' };
const h1 = { margin: '5px 0 5px', fontSize: 30, color: '#F7F3E8' };
const subtitle = { margin: 0, color: '#C9BC99', fontSize: 14 };
const card = { background: '#162F5B', border: '1px solid rgba(216,180,90,.35)', borderRadius: 16, boxShadow: '0 10px 28px rgba(0,0,0,.16)', overflow: 'hidden' };
const sectionTitle = { padding: '16px 18px', borderBottom: '1px solid rgba(216,180,90,.18)', fontWeight: 900, color: '#F7F3E8' };
const sectionTitleNoPad = { fontWeight: 900, color: '#F7F3E8' };
const sectionHead = { padding: '16px 18px', borderBottom: '1px solid rgba(216,180,90,.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
const sectionNote = { marginTop: 3, fontSize: 11, color: '#BFAF83' };
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, padding: 18 };
const label = { display: 'flex', flexDirection: 'column' as const, gap: 7, fontSize: 12, fontWeight: 800, color: '#DCCB9C' };
const input = { width: '100%', boxSizing: 'border-box' as const, border: '1px solid #B8943F', borderRadius: 9, padding: '10px 11px', fontSize: 14, background: '#102A56', color: '#F7F3E8' };
const buttonRow = { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' };
const primaryButton = { background: 'linear-gradient(180deg,#E8CC7A,#D8B45A)', color: '#0B1D3A', border: 0, borderRadius: 9, padding: '11px 16px', fontWeight: 900, cursor: 'pointer' };
const secondaryLink = { background: '#162F5B', color: '#E8CC7A', border: '1px solid #B8943F', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 13 };
const pill = { background: 'rgba(216,180,90,.10)', color: '#E8CC7A', border: '1px solid #B8943F', borderRadius: 999, padding: '5px 9px', fontSize: 10, fontWeight: 800 };
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 };
const th = { padding: '11px 14px', borderBottom: '1px solid rgba(216,180,90,.22)', background: '#102A56', color: '#E8CC7A', textAlign: 'left' as const, whiteSpace: 'nowrap' };
const td = { padding: '12px 14px', borderBottom: '1px solid rgba(216,180,90,.10)', color: '#F7F3E8', verticalAlign: 'middle' as const };
const tdStrong = { ...td, fontWeight: 900 };
const micro = { marginTop: 4, fontSize: 11, color: '#BFAF83', lineHeight: 1.35 };
const activeBadge = { display: 'inline-block', background: 'rgba(134,239,172,.10)', color: '#BBF7D0', padding: '4px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, border: '1px solid #15803D' };
const inactiveBadge = { display: 'inline-block', background: 'rgba(220,203,156,.08)', color: '#DCCB9C', padding: '4px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, border: '1px solid #B8943F' };
const outlineButton = { background: '#102A56', color: '#E8CC7A', border: '1px solid #B8943F', borderRadius: 8, padding: '7px 10px', fontWeight: 800, cursor: 'pointer' };
const empty = { padding: 30, textAlign: 'center' as const, color: '#DCCB9C' };
const alertError = { background: 'rgba(248,113,113,.10)', border: '1px solid #B91C1C', color: '#FCA5A5', padding: 13, borderRadius: 12, marginBottom: 16 };
const alertSuccess = { background: 'rgba(134,239,172,.10)', border: '1px solid #15803D', color: '#BBF7D0', padding: 13, borderRadius: 12, marginBottom: 16 };
