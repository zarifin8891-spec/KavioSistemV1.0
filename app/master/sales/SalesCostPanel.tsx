"use client";

import { useState } from 'react';
import { saveSalesBiaya } from './actions';

type Cost = { jenis_biaya: string; nominal: number | string };

const ITEMS = [
  ['PENAMBAHAN BANGUNAN', 'biaya_penambahan_bangunan'],
  ['NOTARIS', 'biaya_notaris'],
  ['PEMILIHAN LOKASI HOOK', 'biaya_hook'],
  ['BIAYA LAINNYA', 'biaya_lainnya'],
] as const;

function money(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SalesCostPanel({
  idSales,
  hargaDasar,
  costs,
}: {
  idSales: string;
  hargaDasar: number | string | null;
  costs: Cost[];
}) {
  const costMap = new Map(costs.map((item) => [item.jenis_biaya, Number(item.nominal) || 0]));
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(ITEMS.map(([label, name]) => [name, costMap.get(label) ?? 0])),
  );
  const base = Number(hargaDasar) || 0;
  const totalBiaya = Object.values(values).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalHarga = base + totalBiaya;

  return (
    <section className="kavio-panel sales-cost-panel">
      <div className="kavio-panel-head">
        <div>
          <h2 className="kavio-panel-title">BIAYA SALES</h2>
          <div className="kavio-panel-note">Biaya tambahan tersimpan terpisah dari harga jual dasar dan otomatis masuk ke total harga.</div>
        </div>
      </div>
      <form action={saveSalesBiaya} className="kavio-panel-body">
        <input type="hidden" name="id_sales" value={idSales} />
        <div className="sales-costs-grid">
          {ITEMS.map(([label, name]) => (
            <label className="kavio-field" key={name}>
              <span>{label}</span>
              <input
                name={name}
                type="number"
                min="0"
                step="1000"
                value={values[name] ?? 0}
                onChange={(event) => setValues((current) => ({ ...current, [name]: Number(event.target.value) || 0 }))}
              />
            </label>
          ))}
        </div>
        <div className="sales-cost-summary">
          <div><span>HARGA JUAL DASAR</span><strong>{money(base)}</strong></div>
          <div><span>TOTAL BIAYA TAMBAHAN</span><strong>{money(totalBiaya)}</strong></div>
          <div><span>TOTAL HARGA SALES</span><strong>{money(totalHarga)}</strong></div>
        </div>
        <div className="kavio-actions"><button type="submit" className="kavio-button">SIMPAN BIAYA</button></div>
      </form>
    </section>
  );
}
