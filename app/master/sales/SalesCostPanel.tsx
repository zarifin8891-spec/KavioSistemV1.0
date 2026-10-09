"use client";

import { useState } from 'react';
import { saveSalesBiaya } from './actions';
import KavioActionGate from '../../components/KavioActionGate';
import { formatKavioMoney } from '../../lib/number-format';
import KavioModalAction from '../../components/KavioModalAction';

type Cost = { jenis_biaya: string; nominal: number | string };

const ITEMS = [
  ['PENAMBAHAN BANGUNAN', 'biaya_penambahan_bangunan'],
  ['KELEBIHAN TANAH', 'biaya_kelebihan_tanah'],
  ['NOTARIS', 'biaya_notaris'],
  ['BIAYA AKAD', 'biaya_akad'],
  ['PEMILIHAN LOKASI HOOK', 'biaya_hook'],
  ['BIAYA LAINNYA', 'biaya_lainnya'],
] as const;

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
  const includedPriceCosts = (values.biaya_penambahan_bangunan ?? 0) + (values.biaya_kelebihan_tanah ?? 0) + (values.biaya_hook ?? 0);
  const separateFees = (values.biaya_notaris ?? 0) + (values.biaya_akad ?? 0) + (values.biaya_lainnya ?? 0);
  const totalHargaJual = base + includedPriceCosts;
  const totalTagihan = totalHargaJual + separateFees;

  return (
    <section className="kavio-panel sales-cost-panel">
      <div className="kavio-panel-head">
        <div>
          <h2 className="kavio-panel-title">BIAYA SALES</h2>
          <div className="kavio-panel-note">Biaya tambahan tersimpan terpisah dari harga jual dasar dan otomatis masuk ke total harga.</div>
        </div>
        <KavioActionGate action="SALES_WRITE">
          <KavioModalAction
            formKey="sales-cost"
            buttonLabel="UBAH BIAYA"
            title="INPUT BIAYA SALES"
            note="Ubah biaya tambahan transaksi lalu simpan."
            size="standard"
          >
            <form id="sales-cost-form" action={saveSalesBiaya} className="kavio-panel-body">
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
                <div><span>HARGA JUAL DASAR</span><strong className="kavio-money">{formatKavioMoney(base)}</strong></div>
                <div><span>BIAYA YANG DIGABUNG KE HARGA</span><strong className="kavio-money">{formatKavioMoney(includedPriceCosts)}</strong></div>
                <div><span>HARGA JUAL</span><strong className="kavio-money">{formatKavioMoney(totalHargaJual)}</strong></div>
                <div><span>NOTARIS & BIAYA TERPISAH</span><strong className="kavio-money">{formatKavioMoney(separateFees)}</strong></div>
                <div><span>TOTAL TAGIHAN</span><strong className="kavio-money">{formatKavioMoney(totalTagihan)}</strong></div>
              </div>
              <div className="kavio-actions">
                <button type="submit" className="kavio-button">SIMPAN BIAYA</button>
              </div>
            </form>
          </KavioModalAction>
        </KavioActionGate>
      </div>
      <div className="sales-cost-summary kavio-panel-body">
        <div><span>HARGA JUAL DASAR</span><strong className="kavio-money">{formatKavioMoney(base)}</strong></div>
        <div><span>BIAYA YANG DIGABUNG KE HARGA</span><strong className="kavio-money">{formatKavioMoney(includedPriceCosts)}</strong></div>
        <div><span>HARGA JUAL</span><strong className="kavio-money">{formatKavioMoney(totalHargaJual)}</strong></div>
        <div><span>NOTARIS & BIAYA TERPISAH</span><strong className="kavio-money">{formatKavioMoney(separateFees)}</strong></div>
        <div><span>TOTAL TAGIHAN</span><strong className="kavio-money">{formatKavioMoney(totalTagihan)}</strong></div>
      </div>
    </section>
  );
}
