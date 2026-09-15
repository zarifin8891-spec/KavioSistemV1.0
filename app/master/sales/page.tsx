import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSales, deactivateSales } from './actions';
import { createClient } from '../../../lib/supabase/server';

type SearchParams = Promise<{ error?: string; success?: string }>;
type Kavling = { id_kavling: string; blok: string; no_kavling: string; id_tipe: string; status_kavling: string; status_aktif: boolean };
type Tipe = { id_tipe: string; nama_tipe: string };
type Sales = { id_sales: string; id_kavling: string; nama_konsumen: string; status_sales: string; jenis_pembayaran: string; harga_jual: number | string | null; tgl_booking: string | null; target_akad: string | null; status_aktif: boolean; created_at: string };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
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
  const saleableKavlings = kavlingRows.filter((row) => ['AVAILABLE', 'BUILDING', 'READY_STOCK'].includes(row.status_kavling));
  const activeSales = salesRows.filter((row) => row.status_aktif);
  const count = (status: string) => activeSales.filter((row) => row.status_sales === status).length;

  return (
    <main className="sales-page" style={page}>
      <section style={content}>
        <div style={topTitle}>
          <div>
            <div style={eyebrow}>4. SALES MANAGEMENT</div>
            <h1 style={h1}>Data Sales</h1>
            <p style={subtitle}>Kelola data konsumen, status penjualan, dan status pembayaran.</p>
          </div>
          <div style={topActions}>
            <span style={userLabel}>{user.email}</span>
            <Link href="#input-sales" style={primaryButton}>＋ Tambah Sales</Link>
          </div>
        </div>

        <div style={summaryGrid}>
          <Summary label="TOTAL AKTIF" value={activeSales.length} />
          <Summary label="BOOKING" value={count('BOOKING')} />
          <Summary label="DP" value={count('DP')} />
          <Summary label="PROSES KPR" value={count('PROSES_KPR')} />
          <Summary label="AKAD" value={count('AKAD')} />
        </div>

        {error && <div style={alertError}>{error}</div>}
        {params.success && <div style={alertSuccess}>{params.success}</div>}

        <section id="input-sales" style={card}>
          <div style={sectionHead}><div><div style={sectionTitle}>Input Sales Baru</div><div style={sectionNote}>Sales adalah transaksi penjualan dan tetap terpisah dari histori SPK.</div></div></div>
          <form action={createSales} style={formGrid}>
            <Field label="Kavling"><select name="id_kavling" required style={input} defaultValue=""><option value="" disabled>Pilih kavling</option>{saleableKavlings.map((row) => <option key={row.id_kavling} value={row.id_kavling}>{row.id_kavling} — {tipeMap.get(row.id_tipe) ?? row.id_tipe} — {row.status_kavling}</option>)}</select></Field>
            <Field label="Nama Konsumen"><input name="nama_konsumen" required style={input} placeholder="Nama lengkap konsumen" /></Field>
            <Field label="Status Sales"><select name="status_sales" required style={input} defaultValue="BOOKING"><option value="BOOKING">BOOKING</option><option value="DP">DP</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></Field>
            <Field label="Jenis Pembayaran"><select name="jenis_pembayaran" required style={input} defaultValue="KPR"><option value="KPR">KPR</option><option value="CASH">CASH</option><option value="CASH_BERTAHAP">CASH BERTAHAP</option></select></Field>
            <Field label="Harga Jual"><input name="harga_jual" type="number" min="0" step="1000" style={input} placeholder="Rp 0" /></Field>
            <Field label="Tanggal Booking"><input name="tgl_booking" type="date" style={input} /></Field>
            <Field label="Target Akad"><input name="target_akad" type="date" style={input} /></Field>
            <div style={buttonRow}><button type="submit" style={saveButton} disabled={!saleableKavlings.length}>Simpan Sales</button></div>
          </form>
        </section>

        <section style={{ ...card, marginTop: 18, overflow: 'hidden' }}>
          <div style={tableHead}>
            <div><div style={sectionTitle}>Daftar Sales</div><div style={sectionNote}>Histori transaksi penjualan berdasarkan data Sales KAVIO.</div></div>
            <div style={activePill}>{activeSales.length} aktif</div>
          </div>
          <div style={filterRow}>
            <select style={filterInput} defaultValue=""><option value="">Semua Status</option><option value="BOOKING">Booking</option><option value="DP">DP</option><option value="PROSES_KPR">Proses KPR</option><option value="AKAD">Akad</option><option value="BATAL">Batal</option></select>
            <select style={filterInput} defaultValue=""><option value="">Semua Tipe</option>{tipeRows.map((tipe) => <option key={tipe.id_tipe} value={tipe.id_tipe}>{tipe.nama_tipe}</option>)}</select>
            <input style={{ ...filterInput, minWidth: 240 }} placeholder="⌕  Cari nama konsumen..." />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}><thead><tr><th style={th}>No</th><th style={th}>Tanggal</th><th style={th}>Kavling</th><th style={th}>Nama Konsumen</th><th style={th}>Tipe</th><th style={th}>Harga</th><th style={th}>Status</th><th style={th}>Aksi</th></tr></thead>
              <tbody>{salesRows.map((row, index) => { const kavling = kavlingMap.get(row.id_kavling); return <tr key={row.id_sales}><td style={tdCenter}>{index + 1}</td><td style={td}>{row.tgl_booking ?? '—'}</td><td style={tdStrong}>{row.id_kavling}</td><td style={tdStrong}>{row.nama_konsumen}</td><td style={td}>{tipeMap.get(kavling?.id_tipe ?? '') ?? kavling?.id_tipe ?? '—'}</td><td style={td}>{formatCurrency(row.harga_jual)}</td><td style={td}><span style={salesBadge(row.status_sales)}>{statusLabel(row.status_sales)}</span></td><td style={td}>{row.status_aktif ? <form action={deactivateSales}><input type="hidden" name="id_sales" value={row.id_sales} /><button type="submit" style={actionButton}>•••</button></form> : <span style={{ color: '#8D815F' }}>—</span>}</td></tr>; })}{!salesRows.length && <tr><td colSpan={8} style={empty}>Belum ada data sales.</td></tr>}</tbody>
            </table>
          </div>
          <div style={tableFoot}><span>Menampilkan {salesRows.length} data</span><span style={footNote}>Sales aktif: {activeSales.length}</span></div>
        </section>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) { return <div style={summaryCard}><div style={summaryLabel}>{label}</div><div style={summaryValue}>{value}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={labelStyle}><span>{label}</span>{children}</label>; }
function formatCurrency(value: number | string | null) { const n = Number(value); return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n) : '—'; }
function statusLabel(status: string) { return status === 'PROSES_KPR' ? 'PROSES KPR' : status; }
function salesBadge(status: string) { const tone = status === 'BATAL' ? ['rgba(248,113,113,.14)', '#FCA5A5', '#B91C1C'] : status === 'AKAD' ? ['rgba(134,239,172,.14)', '#BBF7D0', '#15803D'] : status === 'DP' ? ['rgba(232,204,122,.20)', '#172B43', '#D8B45A'] : ['rgba(92,171,239,.18)', '#DCEEFF', '#4D91C8']; return { display: 'inline-flex', padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 900, background: tone[0], color: tone[1], border: `1px solid ${tone[2]}`, whiteSpace: 'nowrap' as const }; }

const page = { minHeight: '100%', background: 'transparent', color: '#F7F3E8' };
const content = { maxWidth: 1400, margin: '0 auto', padding: '0 0 30px' };
const topTitle = { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, marginBottom: 20, flexWrap: 'wrap' as const };
const topActions = { display: 'flex', alignItems: 'center', gap: 18 };
const userLabel = { color: '#C9BC99', fontSize: 11 };
const eyebrow = { color: '#F0D48A', fontSize: 13, fontWeight: 900, letterSpacing: 1.1, textTransform: 'uppercase' as const };
const h1 = { margin: '5px 0 4px', color: '#F7F3E8', fontSize: 30, fontWeight: 900 };
const subtitle = { margin: 0, color: '#C9BC99', fontSize: 13 };
const primaryButton = { background: 'linear-gradient(180deg,#F0D48A,#D8B45A)', color: '#10213A', border: '1px solid #F0D48A', borderRadius: 9, padding: '12px 18px', textDecoration: 'none', fontWeight: 900, fontSize: 13, boxShadow: '0 6px 18px rgba(216,180,90,.16)' };
const summaryGrid = { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 18 };
const summaryCard = { padding: '14px 16px', border: '1px solid rgba(216,180,90,.30)', borderRadius: 11, background: 'linear-gradient(180deg,#173452,#0D2948)' };
const summaryLabel = { color: '#C9BC99', fontSize: 9, fontWeight: 900, letterSpacing: .8 };
const summaryValue = { marginTop: 4, color: '#F0D48A', fontSize: 23, fontWeight: 900 };
const card = { background: 'linear-gradient(180deg,#123150,#081F39)', border: '1px solid rgba(216,180,90,.34)', borderRadius: 14, boxShadow: '0 10px 28px rgba(0,0,0,.18)' };
const sectionHead = { padding: '15px 18px', borderBottom: '1px solid rgba(216,180,90,.18)' };
const tableHead = { padding: '15px 18px', borderBottom: '1px solid rgba(216,180,90,.18)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 };
const sectionTitle = { color: '#F7F3E8', fontWeight: 900, fontSize: 16 };
const sectionNote = { marginTop: 3, color: '#BFAF83', fontSize: 10 };
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 13, padding: 18 };
const labelStyle = { display: 'flex', flexDirection: 'column' as const, gap: 6, color: '#DCCB9C', fontSize: 11, fontWeight: 800 };
const input = { width: '100%', padding: '10px 11px', borderRadius: 8, border: '1px solid rgba(232,204,122,.48)', background: 'linear-gradient(180deg,#344C69,#293F5B)', color: '#F7F3E8', outline: 'none' };
const buttonRow = { gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' };
const saveButton = { padding: '10px 18px', borderRadius: 8, border: '1px solid #D8B45A', background: 'linear-gradient(180deg,#F0D48A,#D8B45A)', color: '#10213A', fontWeight: 900, cursor: 'pointer' };
const filterRow = { display: 'flex', gap: 10, padding: '13px 18px', background: 'rgba(4,24,47,.45)', borderBottom: '1px solid rgba(216,180,90,.16)', flexWrap: 'wrap' as const };
const filterInput = { minWidth: 150, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(232,204,122,.40)', background: '#314A68', color: '#F7F3E8', outline: 'none' };
const activePill = { padding: '5px 10px', borderRadius: 999, background: 'rgba(216,180,90,.12)', color: '#F0D48A', border: '1px solid #A98235', fontSize: 10, fontWeight: 900 };
const table = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12, background: '#F7F5EE' };
const th = { padding: '12px 13px', background: 'linear-gradient(180deg,#153654,#102E4D)', color: '#F0D48A', borderBottom: '1px solid #A98235', textAlign: 'left' as const, whiteSpace: 'nowrap' };
const td = { padding: '11px 13px', color: '#172B43', borderBottom: '1px solid rgba(23,43,67,.12)', verticalAlign: 'middle' as const };
const tdStrong = { ...td, fontWeight: 900 };
const tdCenter = { ...td, textAlign: 'center' as const, fontWeight: 800 };
const actionButton = { width: 36, height: 30, borderRadius: 7, border: '1px solid #CFC7B5', background: '#FFFDF6', color: '#172B43', fontWeight: 900, letterSpacing: 1, cursor: 'pointer' };
const tableFoot = { padding: '13px 18px', display: 'flex', justifyContent: 'space-between', color: '#E5DDCC', fontSize: 11 };
const footNote = { color: '#BFAF83' };
const empty = { padding: 28, textAlign: 'center' as const, color: '#665F50' };
const alertError = { marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(248,113,113,.10)', border: '1px solid #B91C1C', color: '#FCA5A5' };
const alertSuccess = { marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(134,239,172,.10)', border: '1px solid #15803D', color: '#BBF7D0' };
