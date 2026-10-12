import KavioFormActions from '../../components/KavioFormActions';
import KavioConfirmAction from '../../components/KavioConfirmAction';
import Link from 'next/link';
import { createClient } from '../../../lib/supabase/server';
import KavioCreatePanel from '../../components/KavioCreatePanel';
import KavioFormModal from '../../components/KavioFormModal';
import KavioActionGate from '../../components/KavioActionGate';
import { deleteWarehouse, saveWarehouse, toggleWarehouse } from './actions';

type Warehouse = { id_lokasi: string; kode_lokasi:string; nama_lokasi: string; status_aktif: boolean };

export default async function WarehousePage({ searchParams }: { searchParams: Promise<{ edit?: string; error?: string; success?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from('material_location').select('id_lokasi,kode_lokasi,nama_lokasi,status_aktif').eq('jenis_lokasi','GUDANG').order('nama_lokasi');
  const rows = (data ?? []) as Warehouse[];
  const edit = rows.find((row) => row.id_lokasi === params.edit);
  return <main className="master-simple-page">
    {(params.error || error) && <div className="kavio-alert error">{params.error || error?.message}</div>}
    {params.success && <div className="kavio-alert success">{params.success}</div>}
    <section className="kavio-panel"><div className="kavio-panel-head"><div><h2 className="kavio-panel-title">DAFTAR GUDANG</h2><div className="kavio-panel-note">Gudang aktif dapat dipilih pada pembelian, pemakaian dan rekonsiliasi material.</div></div><KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioCreatePanel modalSize="compact" formKey="master-gudang-create" buttonLabel="Tambah Gudang" title="INPUT GUDANG BARU" badge="MASTER"><WarehouseForm /></KavioCreatePanel></KavioActionGate></div>
      <div className="kavio-table-wrap"><table className="kavio-table"><thead><tr><th>ID GUDANG</th><th>NAMA GUDANG</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id_lokasi}><td className="master-highlight">{row.kode_lokasi}</td><td>{row.nama_lokasi}</td><td><span className={`master-status ${row.status_aktif ? 'active' : 'inactive'}`}>{row.status_aktif ? 'AKTIF' : 'NONAKTIF'}</span></td><td><KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><div className="kavio-master-row-actions"><Link className="kavio-button secondary" href={`/master/gudang?edit=${row.id_lokasi}`}>EDIT</Link><form action={toggleWarehouse}><input type="hidden" name="id_lokasi" value={row.id_lokasi} /><input type="hidden" name="status_aktif" value={String(row.status_aktif)} /><button className="kavio-button secondary" type="submit">{row.status_aktif ? 'NONAKTIFKAN' : 'AKTIFKAN'}</button></form><KavioConfirmAction action={deleteWarehouse} label="HAPUS" confirmMessage="Hapus data master ini? Data yang sudah digunakan tidak dapat dihapus." hidden={{id_lokasi:row.id_lokasi}}/></div></KavioActionGate></td></tr>)}{!rows.length && <tr><td colSpan={4} className="kavio-empty">BELUM ADA GUDANG. TAMBAHKAN GUDANG SEBELUM MENCATAT PEMBELIAN.</td></tr>}</tbody></table></div>
    </section>
    {edit && <KavioActionGate action="MATERIAL_WAREHOUSE_WRITE"><KavioFormModal size="compact" open closeHref="/master/gudang" ariaLabel="Edit Gudang" closeOnBackdrop={false} persistenceKey={`gudang-edit:${edit.id_lokasi}`}><section className="kavio-panel"><div className="kavio-panel-head"><h2 className="kavio-panel-title">EDIT GUDANG</h2></div><WarehouseForm row={edit} /></section></KavioFormModal></KavioActionGate>}
  </main>;
}

function WarehouseForm({ row }: { row?: Warehouse }) {
  return <form action={saveWarehouse} className="kavio-form kavio-panel-body kavio-master-form">
    {row && <input type="hidden" name="id_lokasi" value={row.id_lokasi} />}
    <label className="kavio-field"><span>ID GUDANG</span><input name="kode_lokasi" defaultValue={row?.kode_lokasi??''} required aria-label="ID Gudang"/></label>
    <label className="kavio-field"><span>NAMA GUDANG</span><input id="nama_lokasi" name="nama_lokasi" defaultValue={row?.nama_lokasi ?? ''} required /></label>
    <KavioFormActions><button className="kavio-button" type="submit">SIMPAN GUDANG</button></KavioFormActions>
  </form>;
}
