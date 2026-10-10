import KavioFormActions from '../../components/KavioFormActions';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioFormModal from '../../components/KavioFormModal';
import KavioActionGate from '../../components/KavioActionGate';
import { deleteSupplier, saveSupplier, toggleSupplier } from './actions';

type Supplier = { id_pemasok: string; nama_pemasok: string; kontak: string | null; telepon: string | null; alamat: string | null; keterangan: string | null; status_aktif: boolean };

export default async function SupplierPage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from('master_pemasok').select('id_pemasok,nama_pemasok,kontak,telepon,alamat,keterangan,status_aktif').order('nama_pemasok');
  const rows = (data ?? []) as Supplier[];
  const edit = rows.find((row) => row.id_pemasok === params.edit);
  return <main className="master-simple-page">
    {(params.error || error) && <div className="kavio-alert error">{params.error || error?.message}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR PEMASOK</h2><div className="kavio-panel-note">Pemasok aktif dapat dipilih pada penerimaan dan pembelian material.</div></div><KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioCreatePanel formKey="master-pemasok-create" buttonLabel="Tambah Pemasok" title="INPUT PEMASOK BARU" badge="MASTER"><SupplierForm /></KavioCreatePanel></KavioActionGate></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>NAMA PEMASOK</th><th>KONTAK</th><th>TELEPON</th><th>ALAMAT</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id_pemasok}><td>{row.nama_pemasok}</td><td>{row.kontak || '—'}</td><td>{row.telepon || '—'}</td><td>{row.alamat || '—'}</td><td><span className={`master-status ${row.status_aktif ? 'active' : 'inactive'}`}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td><td><KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><div className="kavio-master-row-actions"><Link className="kavio-button secondary" href={`/master/pemasok?edit=${row.id_pemasok}`}>EDIT</Link><form action={toggleSupplier}><input type="hidden" name="id_pemasok" value={row.id_pemasok} /><input type="hidden" name="status_aktif" value={String(row.status_aktif)} /><button className="kavio-button secondary" type="submit">{row.status_aktif ? 'NONAKTIFKAN' : 'AKTIFKAN'}</button></form><KavioConfirmAction action={deleteSupplier} label="HAPUS" confirmMessage="Hapus data master ini? Data yang sudah digunakan tidak dapat dihapus." hidden={{id_pemasok:row.id_pemasok}}/></div></KavioActionGate></td></tr>)}{!rows.length && <tr><td colSpan={6} className="kavio-empty">BELUM ADA PEMASOK. TAMBAHKAN PEMASOK SEBELUM MENCATAT PEMBELIAN.</td></tr>}</tbody></table></div>
    </section>
    {edit && <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioFormModal open closeHref="/master/pemasok" ariaLabel="Edit Pemasok" closeOnBackdrop={false} persistenceKey={`pemasok-edit:${edit.id_pemasok}`}><section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">EDIT PEMASOK</h2></div><SupplierForm row={edit} /></section></KavioFormModal></KavioActionGate>}
  </main>;
}

function SupplierForm({ row }: { row?: Supplier }) {
  return <form action={saveSupplier} className="kavio-form kavio-panel-body">
    {row && <input type="hidden" name="id_pemasok" value={row.id_pemasok} />}
    <label className="kavio-field"><span>NAMA PEMASOK</span><input id="nama_pemasok" name="nama_pemasok" defaultValue={row?.nama_pemasok ?? ''} required /></label>
    <label className="kavio-field"><span>NAMA KONTAK</span><input name="kontak" defaultValue={row?.kontak ?? ''} /></label>
    <label className="kavio-field"><span>TELEPON</span><input name="telepon" type="tel" defaultValue={row?.telepon ?? ''} /></label>
    <label className="kavio-field"><span>ALAMAT</span><input name="alamat" defaultValue={row?.alamat ?? ''} /></label>
    <label className="kavio-field sales-span-2"><span>KETERANGAN</span><textarea name="keterangan" defaultValue={row?.keterangan ?? ''} rows={2} /></label>
    <KavioFormActions><button className="kavio-button" type="submit">SIMPAN PEMASOK</button></KavioFormActions>
  </form>;
}
