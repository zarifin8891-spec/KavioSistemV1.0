"use client";

import { useState } from 'react';
import { createSales } from './actions';

type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };

export default function SalesCreatePanel({
  kavlings,
  tipeMap,
  banks,
}: {
  kavlings: Kavling[];
  tipeMap: Tipe[];
  banks: Bank[];
  notaries?: { id_notaris: string; nama_notaris: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState('KPR');
  const typeMap = new Map(tipeMap.map((row) => [row.id_tipe, row.nama_tipe]));
  const isKpr = payment === 'KPR';

  return (
    <div className="sales-create-wrap">
      <button type="button" className="kavio-command-button" onClick={() => setOpen((value) => !value)}>
        <span className="kavio-command-icon" aria-hidden="true">{open ? '×' : '+'}</span><span>{open ? 'Tutup Form' : 'Tambah Sales'}</span>
      </button>

      {open && (
        <section className="kavio-panel sales-create-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">INPUT SALES BARU</h2>
              <div className="kavio-panel-note">Data awal transaksi penjualan. Data akad diisi saat transaksi benar-benar AKAD.</div>
            </div>
          </div>

          <form action={createSales} className="kavio-form sales-create-grid">
            <label className="kavio-field"><span>TANGGAL BOOKING</span><input name="tgl_booking" type="date" /></label>
            <label className="kavio-field"><span>KAVLING</span><select name="id_kavling" required defaultValue=""><option value="" disabled>PILIH KAVLING</option>{kavlings.map((row) => <option key={row.id_kavling} value={row.id_kavling}>{row.id_kavling} — {typeMap.get(row.id_tipe) ?? row.id_tipe} — {row.status_kavling}</option>)}</select></label>
            <label className="kavio-field"><span>NAMA KONSUMEN</span><input name="nama_konsumen" required placeholder="NAMA LENGKAP KONSUMEN" /></label>
            <label className="kavio-field"><span>STATUS SALES</span><select name="status_sales" defaultValue="BOOKING" required><option value="BOOKING">BOOKING</option><option value="DP">UANG MUKA</option><option value="PROSES_KPR">PROSES KPR</option><option value="AKAD">AKAD</option><option value="BATAL">BATAL</option></select></label>

            <label className="kavio-field sales-span-2"><span>ALAMAT KONSUMEN</span><input name="alamat_konsumen" placeholder="ALAMAT LENGKAP KONSUMEN" /></label>
            <label className="kavio-field"><span>HP KONSUMEN</span><input name="hp_konsumen" type="tel" inputMode="tel" placeholder="08XXXXXXXXXX" /></label>
            <label className="kavio-field"><span>JENIS PEMBAYARAN</span><select name="jenis_pembayaran" value={payment} onChange={(event) => setPayment(event.target.value)} required><option value="KPR">KPR</option><option value="CASH">CASH</option><option value="CASH_BERTAHAP">CASH BERTAHAP</option></select></label>

            <label className="kavio-field"><span>BANK KPR {isKpr ? <em className="sales-required">*</em> : null}</span><select name="id_bank" required={isKpr} defaultValue=""><option value="">{isKpr ? 'PILIH BANK KPR' : 'TIDAK DIISI UNTUK CASH'}</option>{banks.map((row) => <option key={row.id_bank} value={row.id_bank}>{row.nama_bank}</option>)}</select></label>
            <label className="kavio-field"><span>HARGA JUAL</span><input name="harga_jual" type="number" min="0" step="1000" placeholder="0" /></label>
            <label className="kavio-field"><span>TARGET AKAD</span><input name="target_akad" type="date" /></label>
            <div className="sales-contact-note"><span>{isKpr ? 'BANK KPR WAJIB DIISI.' : 'PEMBAYARAN CASH TIDAK MEMERLUKAN BANK.'}</span></div>

            <div className="kavio-actions"><button type="submit" className="kavio-button" disabled={!kavlings.length}>SIMPAN SALES</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
