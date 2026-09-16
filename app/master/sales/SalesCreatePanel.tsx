"use client";

import { useState } from 'react';
import { createSales } from './actions';

type Kavling = { id_kavling: string; id_tipe: string; status_kavling: string };
type Tipe = { id_tipe: string; nama_tipe: string };
type Bank = { id_bank: string; nama_bank: string };
type Notaris = { id_notaris: string; nama_notaris: string };

export default function SalesCreatePanel({
  kavlings,
  tipeMap,
  banks,
}: {
  kavlings: Kavling[];
  tipeMap: Tipe[];
  banks: Bank[];
  notaries?: Notaris[];
}) {
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState('KPR');

  const typeMap = new Map(tipeMap.map((row) => [row.id_tipe, row.nama_tipe]));
  const isKpr = payment === 'KPR';

  return (
    <div className="sales-create-wrap">
      <button type="button" className="sales-add-button" onClick={() => setOpen((value) => !value)}>
        {open ? '× TUTUP FORM' : '+ TAMBAH SALES'}
      </button>

      {open && (
        <div className="sales-create-panel">
          <div className="sales-create-head">
            <div>
              <h2>INPUT SALES BARU</h2>
              <p>DATA AWAL TRANSAKSI PENJUALAN.</p>
            </div>
          </div>

          <form action={createSales} className="sales-create-grid">
            {/* BARIS 1: TANGGAL BOOKING / KAVLING / NAMA KONSUMEN / STATUS */}
            <label>
              TANGGAL BOOKING
              <input name="tgl_booking" type="date" />
            </label>

            <label>
              KAVLING
              <select name="id_kavling" required defaultValue="">
                <option value="" disabled>PILIH KAVLING</option>
                {kavlings.map((row) => (
                  <option key={row.id_kavling} value={row.id_kavling}>
                    {row.id_kavling} — {typeMap.get(row.id_tipe) ?? row.id_tipe} — {row.status_kavling}
                  </option>
                ))}
              </select>
            </label>

            <label>
              NAMA KONSUMEN
              <input name="nama_konsumen" required placeholder="NAMA LENGKAP KONSUMEN" />
            </label>

            <label>
              STATUS SALES
              <select name="status_sales" defaultValue="BOOKING" required>
                <option value="BOOKING">BOOKING</option>
                <option value="DP">DP</option>
                <option value="PROSES_KPR">PROSES KPR</option>
                <option value="AKAD">AKAD</option>
                <option value="BATAL">BATAL</option>
              </select>
            </label>

            {/* BARIS 2: JENIS PEMBAYARAN / BANK KPR / HARGA JUAL / TARGET AKAD */}
            <label>
              JENIS PEMBAYARAN
              <select name="jenis_pembayaran" value={payment} onChange={(event) => setPayment(event.target.value)} required>
                <option value="KPR">KPR</option>
                <option value="CASH">CASH</option>
                <option value="CASH_BERTAHAP">CASH BERTAHAP</option>
              </select>
            </label>

            <label>
              BANK KPR {isKpr ? <span className="sales-required">*</span> : null}
              <select name="id_bank" required={isKpr} defaultValue="">
                <option value="">{isKpr ? 'PILIH BANK KPR' : 'TIDAK DIISI UNTUK CASH'}</option>
                {banks.map((row) => (
                  <option key={row.id_bank} value={row.id_bank}>{row.nama_bank}</option>
                ))}
              </select>
            </label>

            <label>
              HARGA JUAL
              <input name="harga_jual" type="number" min="0" step="1000" placeholder="0" />
            </label>

            <label>
              TARGET AKAD
              <input name="target_akad" type="date" />
            </label>

            <div className="sales-create-foot sales-full">
              <span>{isKpr ? 'BANK KPR WAJIB DIISI.' : 'PEMBAYARAN CASH TIDAK MEMERLUKAN BANK.'}</span>
              <button type="submit" disabled={!kavlings.length}>SIMPAN SALES</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
