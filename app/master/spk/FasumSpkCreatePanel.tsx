'use client';

import {workTotalPercent} from '../../lib/work-detail';
import KavioFormActions from '../../components/KavioFormActions';
import KavioMoneyInput from '../../components/KavioMoneyInput';
import KavioPercentInput from '../../components/KavioPercentInput';
import {fasumItemWage,fasumTotalWage} from '../../lib/fasum-wages';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createFasumSpk } from './actions';
import KavioActionGate from '../../components/KavioActionGate';
import KavioFormModal from '../../components/KavioFormModal';

type Kantor = { id_kantor: string; nama_kantor_pelaksana: string };
type Mandor = { id_mandor: string; nama_mandor: string; id_kantor: string };
type WorkItem = { nama_pekerjaan:string;bobot_percent:string;volume:string;satuan:string;harga_satuan_upah:number;keterangan:string };
const emptyItem=():WorkItem=>({nama_pekerjaan:'',bobot_percent:'',volume:'',satuan:'',harga_satuan_upah:0,keterangan:''});

export default function FasumSpkCreatePanel({ kantorRows, mandorRows }: { kantorRows: Kantor[]; mandorRows: Mandor[] }) {
  const [open, setOpen] = useState(false);
  const [selectedKantor, setSelectedKantor] = useState('');
  const [items, setItems] = useState<WorkItem[]>([emptyItem()]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mandors = useMemo(() => mandorRows.filter((row) => row.id_kantor === selectedKantor), [mandorRows, selectedKantor]);
  const payload = items.map((item) => ({nama_pekerjaan:item.nama_pekerjaan.trim(),bobot:Number(item.bobot_percent)/100,volume:Number(item.volume),satuan:item.satuan.trim(),harga_satuan_upah:item.harga_satuan_upah,keterangan:item.keterangan.trim()}));
  const total = workTotalPercent(payload);
  const totalUpah=fasumTotalWage(payload);

  useEffect(() => {
    if (searchParams.get('form') === 'spk-fasum-create') setOpen(true);
    if (searchParams.get('success')) setOpen(false);
  }, [searchParams]);

  const close = () => {
    setOpen(false);
    if (searchParams.get('form') !== 'spk-fasum-create') return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('form');
    next.delete('error');
    next.delete('focus');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const updateItem = (index: number, key: keyof WorkItem, value: string|number) => {
    setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  return (
    <KavioActionGate action="SPK_WRITE">
      <div className="kavio-create-wrap">
        <button type="button" className="kavio-command-button" onClick={() => setOpen(true)}>
          <span className="kavio-command-icon" aria-hidden="true">+</span><span>Tambah SPK Fasum</span>
        </button>
        <KavioFormModal open={open} onClose={close} size="wide" className="kavio-table-entry-modal" ariaLabel="Input SPK Fasum" closeOnBackdrop={false} persistenceKey="spk-fasum-create">
          <section className="kavio-panel">
            <div className="kavio-panel-head">
              <div><h2 className="kavio-panel-title">INPUT SPK FASUM</h2><div className="kavio-panel-note">Rincian pekerjaan dan bobot dibuat khusus untuk setiap objek Fasum.</div></div>
              
            </div>
            <form action={createFasumSpk} className="kavio-panel-body kavio-fasum-form">
              <div className="kavio-form kavio-batch-toolbar kavio-compact-spk-fields">
              <label className="kavio-field"><span>NAMA OBJEK FASUM</span><input name="nama_objek" required placeholder="Contoh: Jalan Utama Blok A" /></label>
              <label className="kavio-field"><span>TANGGAL SPK</span><input name="tgl_spk" type="date" required /></label>
              <label className="kavio-field"><span>TARGET SELESAI</span><input name="tgl_target_selesai" type="date" required /></label>
              <label className="kavio-field"><span>KANTOR / PELAKSANA</span><select name="id_kantor" required value={selectedKantor} onChange={(event) => setSelectedKantor(event.target.value)}><option value="">PILIH KANTOR</option>{kantorRows.map((row) => <option key={row.id_kantor} value={row.id_kantor}>{row.nama_kantor_pelaksana}</option>)}</select></label>
              <label className="kavio-field"><span>MANDOR</span><select name="id_mandor" required defaultValue=""><option value="">PILIH MANDOR</option>{mandors.map((row) => <option key={row.id_mandor} value={row.id_mandor}>{row.nama_mandor}</option>)}</select></label>
              </div>
              <input type="hidden" name="items_json" data-kavio-persist-hidden="true" value={JSON.stringify(payload)} onInput={e=>{try{const saved=JSON.parse(e.currentTarget.value);if(Array.isArray(saved)&&saved.length)setItems(saved.map(i=>({nama_pekerjaan:String(i.nama_pekerjaan??''),bobot_percent:String(Number(i.bobot)*100),volume:String(i.volume??''),satuan:String(i.satuan??''),harga_satuan_upah:Number(i.harga_satuan_upah)||0,keterangan:String(i.keterangan??'')})));}catch{/* retain current rows */}}}/>
              <div className="kavio-batch-toolbar kavio-fasum-totals"><span>ITEM PEKERJAAN · Volume × harga satuan upah</span><output className="kavio-form-total">TOTAL UPAH <strong>{totalUpah.toLocaleString('id-ID')}</strong></output><output className={`kavio-form-total ${total===100?'is-valid':'is-pending'}`}>BOBOT <strong>{total.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}%</strong></output></div>
              <div className="kavio-table-wrap"><table className="kavio-table kavio-input-table kavio-fasum-items"><thead><tr><th>NO.</th><th>NAMA PEKERJAAN</th><th>VOLUME</th><th>SATUAN</th><th>HARGA SATUAN UPAH</th><th>BOBOT (%)</th><th>TOTAL UPAH</th><th>KETERANGAN</th><th>AKSI</th></tr></thead><tbody>
                {items.map((item,index)=><tr key={index}><td>{index+1}</td><td><label className="kavio-field"><input aria-label={`Nama pekerjaan ${index+1}`} value={item.nama_pekerjaan} maxLength={200} required onChange={e=>updateItem(index,'nama_pekerjaan',e.target.value)}/></label></td><td><label className="kavio-field"><input aria-label={`Volume pekerjaan ${index+1}`} type="number" min="0.0001" step="0.0001" required value={item.volume} onChange={e=>updateItem(index,'volume',e.target.value)}/></label></td><td><label className="kavio-field"><input aria-label={`Satuan pekerjaan ${index+1}`} value={item.satuan} maxLength={30} required onChange={e=>updateItem(index,'satuan',e.target.value)}/></label></td><td><label className="kavio-field"><KavioMoneyInput label={`Harga satuan upah ${index+1}`} value={item.harga_satuan_upah} onChange={value=>updateItem(index,'harga_satuan_upah',value)}/></label></td><td><label className="kavio-field"><KavioPercentInput label={`Bobot pekerjaan ${index+1}`} min={.0001} precision={4} value={Number(item.bobot_percent)||0} onChange={value=>updateItem(index,'bobot_percent',String(value))}/></label></td><td className="work-detail-money">{fasumItemWage(Number(item.volume),item.harga_satuan_upah).toLocaleString('id-ID')}</td><td><label className="kavio-field"><input aria-label={`Keterangan pekerjaan ${index+1}`} value={item.keterangan} maxLength={500} onChange={e=>updateItem(index,'keterangan',e.target.value)}/></label></td><td><button type="button" className="kavio-button secondary" disabled={items.length===1} onClick={()=>setItems(rows=>rows.filter((_,i)=>i!==index))}>HAPUS</button></td></tr>)}
              </tbody></table></div>
              <div className="kavio-batch-footer"><button type="button" className="kavio-button secondary" onClick={() => setItems((rows) => [...rows,emptyItem()])}>TAMBAH ITEM</button></div><KavioFormActions><button type="submit" className="kavio-button" disabled={!items.length || total !== 100 || totalUpah<=0 || !kantorRows.length}>SIMPAN SPK FASUM SEBAGAI DRAFT</button></KavioFormActions>
            </form>
          </section>
        </KavioFormModal>
      </div>
    </KavioActionGate>
  );
}
