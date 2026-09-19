'use client';

import { useMemo, useState } from 'react';
import { SITEPLAN_IMAGE } from './siteplan-image';

type Kavling = {
  id_kavling: string;
  blok?: string | null;
  no_kavling?: string | null;
  status_kavling?: string | null;
  id_tipe?: string | null;
};

type Sale = {
  id_sales: string;
  id_kavling: string;
  nama_konsumen?: string | null;
  status_sales?: string | null;
  jenis_pembayaran?: string | null;
  harga_jual?: number | string | null;
  tgl_booking?: string | null;
  target_akad?: string | null;
  tgl_akad?: string | null;
  id_bank?: string | null;
  id_notaris?: string | null;
};

type Spk = {
  id_spk: string;
  id_kavling: string;
  tgl_spk?: string | null;
  id_tipe?: string | null;
  jenis_bobot?: string | null;
  id_kantor?: string | null;
  id_mandor?: string | null;
  status_spk?: string | null;
  tgl_target_selesai?: string | null;
  is_active?: boolean | null;
};

type ProgressUpdate = {
  id_progress: string;
  id_spk: string;
  tanggal_update?: string | null;
  id_kategori?: string | null;
  progress_periode?: number | string | null;
  keterangan?: string | null;
};

type Props = {
  kavlings: Kavling[];
  sales: Sale[];
  spks: Spk[];
  progressUpdates: ProgressUpdate[];
};

const STATUS_LIST = ['AVAILABLE', 'BOOKING', 'BUILDING', 'READY_STOCK', 'SOLD', 'COMPLETED'] as const;

const areas = [
  { x: 25.5, y: 7.2, w: 8.2, h: 6.3 }, { x: 33.9, y: 8.0, w: 8.0, h: 6.3 },
  { x: 42.0, y: 9.0, w: 8.0, h: 6.3 }, { x: 18.0, y: 18.2, w: 8.0, h: 6.0 },
  { x: 26.1, y: 19.2, w: 8.0, h: 6.0 }, { x: 34.4, y: 20.2, w: 8.0, h: 6.0 },
  { x: 18.2, y: 29.5, w: 8.0, h: 6.0 }, { x: 26.3, y: 30.5, w: 8.0, h: 6.0 },
  { x: 34.5, y: 31.5, w: 8.0, h: 6.0 }, { x: 42.7, y: 32.5, w: 8.0, h: 6.0 },
];

const fallback: Kavling[] = Array.from({ length: 10 }, (_, i) => ({
  id_kavling: `DEMO-${String(i + 1).padStart(2, '0')}`,
  blok: 'DEMO',
  no_kavling: String(i + 1),
  status_kavling: ['AVAILABLE', 'BOOKING', 'SOLD', 'BUILDING', 'READY_STOCK'][i % 5],
}));

function statusClass(status?: string | null) {
  return (status || 'AVAILABLE').toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatMoney(value?: number | string | null) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function SiteplanClient({ kavlings, sales, spks, progressUpdates }: Props) {
  const rows = useMemo(() => (kavlings.length ? kavlings.slice(0, areas.length) : fallback), [kavlings]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const selected = selectedIndex == null ? null : rows[selectedIndex];

  const selectedSale = selected ? sales.find((row) => row.id_kavling === selected.id_kavling) : null;
  const selectedSpk = selected ? spks.find((row) => row.id_kavling === selected.id_kavling) : null;
  const selectedProgress = selectedSpk
    ? progressUpdates.filter((row) => row.id_spk === selectedSpk.id_spk).sort((a, b) => String(b.tanggal_update || '').localeCompare(String(a.tanggal_update || '')))[0]
    : null;

  const visibleRows = useMemo(
    () => rows.map((row, index) => ({ row, index })).filter(({ row }) => filter === 'ALL' || row.status_kavling === filter),
    [rows, filter],
  );

  const counts = useMemo(
    () => STATUS_LIST.reduce<Record<string, number>>((acc, status) => {
      acc[status] = rows.filter((row) => row.status_kavling === status).length;
      return acc;
    }, {}),
    [rows],
  );

  return (
    <main className="siteplan-page">
      <section className="siteplan-toolbar kavio-panel">
        <div>
          <h2 className="kavio-panel-title">SITEPLAN INTERAKTIF</h2>
          <div className="kavio-panel-note">Peta operasional: kavling terhubung ke Sales, SPK, dan Progress berdasarkan id_kavling.</div>
        </div>
        <div className="siteplan-legend">
          {STATUS_LIST.map((status) => (
            <button key={status} type="button" className={`siteplan-legend-item status-${status.toLowerCase()} ${filter === status ? 'is-active' : ''}`} onClick={() => setFilter(filter === status ? 'ALL' : status)}>
              <i />{status.replace('_', ' ')} <strong>{counts[status] || 0}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="siteplan-summary">
        <div className="siteplan-summary-item"><span>TOTAL KAVLING</span><strong>{rows.length}</strong></div>
        <div className="siteplan-summary-item"><span>TERSEDIA</span><strong>{counts.AVAILABLE || 0}</strong></div>
        <div className="siteplan-summary-item"><span>BOOKING</span><strong>{counts.BOOKING || 0}</strong></div>
        <div className="siteplan-summary-item"><span>BUILDING</span><strong>{counts.BUILDING || 0}</strong></div>
      </section>

      <section className="siteplan-layout">
        <div className="siteplan-canvas kavio-panel">
          <div className="siteplan-stage">
            <img src={SITEPLAN_IMAGE} alt="Siteplan Cibodas" className="siteplan-image" />
            {rows.map((row, index) => {
              const area = areas[index];
              const status = row.status_kavling || 'AVAILABLE';
              const hidden = filter !== 'ALL' && status !== filter;
              return (
                <button
                  key={row.id_kavling}
                  type="button"
                  className={`siteplan-hotspot status-${statusClass(status)} ${selectedIndex === index ? 'is-selected' : ''} ${hidden ? 'is-dimmed' : ''}`}
                  style={{ left: area.x + '%', top: area.y + '%', width: area.w + '%', height: area.h + '%' }}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Pilih kavling ${row.id_kavling}`}
                >
                  <span>{row.blok}-{row.no_kavling || row.id_kavling}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="siteplan-detail kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">{selected ? `KAVLING ${selected.no_kavling || selected.id_kavling}` : 'PILIH KAVLING'}</h2>
              <div className="kavio-panel-note">{selected ? 'Data operasional yang terkait dengan kavling ini.' : 'Klik area pada siteplan atau pilih dari daftar.'}</div>
            </div>
            {selected && <span className={`siteplan-status status-${statusClass(selected.status_kavling)}`}>{selected.status_kavling || 'AVAILABLE'}</span>}
          </div>

          {selected ? (
            <>
              <div className="siteplan-detail-body">
                <div className="siteplan-kpi"><span>KAVLING</span><strong>{selected.id_kavling}</strong></div>
                <div className="siteplan-kpi"><span>BLOK / NO</span><strong>{selected.blok || '—'} / {selected.no_kavling || '—'}</strong></div>
                <div className="siteplan-kpi"><span>TIPE</span><strong>{selected.id_tipe || '—'}</strong></div>
                <div className="siteplan-kpi"><span>STATUS</span><strong>{selected.status_kavling || '—'}</strong></div>
              </div>

              <div className="siteplan-related">
                <div className="siteplan-related-title">SALES</div>
                {selectedSale ? (
                  <div className="siteplan-related-grid">
                    <div><span>KONSUMEN</span><strong>{selectedSale.nama_konsumen || '—'}</strong></div>
                    <div><span>PEMBAYARAN</span><strong>{selectedSale.jenis_pembayaran || '—'}</strong></div>
                    <div><span>HARGA JUAL</span><strong>{formatMoney(selectedSale.harga_jual)}</strong></div>
                    <div><span>TARGET AKAD</span><strong>{formatDate(selectedSale.target_akad)}</strong></div>
                  </div>
                ) : <div className="siteplan-related-empty">Belum ada data Sales untuk kavling ini.</div>}
              </div>

              <div className="siteplan-related">
                <div className="siteplan-related-title">SPK & PROGRESS</div>
                {selectedSpk ? (
                  <div className="siteplan-related-grid">
                    <div><span>SPK</span><strong>{selectedSpk.id_spk}</strong></div>
                    <div><span>STATUS SPK</span><strong>{selectedSpk.status_spk || '—'}</strong></div>
                    <div><span>TARGET SELESAI</span><strong>{formatDate(selectedSpk.tgl_target_selesai)}</strong></div>
                    <div><span>PROGRESS TERAKHIR</span><strong>{selectedProgress?.progress_periode != null ? `${selectedProgress.progress_periode}%` : '—'}</strong></div>
                  </div>
                ) : <div className="siteplan-related-empty">Belum ada SPK aktif untuk kavling ini.</div>}
              </div>
            </>
          ) : (
            <div className="siteplan-empty">Belum ada kavling dipilih.</div>
          )}

          <div className="siteplan-list">
            <div className="siteplan-list-head">
              <span>DAFTAR KAVLING</span>
              <small>{visibleRows.length} data</small>
            </div>
            {visibleRows.map(({ row, index }) => (
              <button key={row.id_kavling} type="button" className={`siteplan-list-row ${selectedIndex === index ? 'is-selected' : ''}`} onClick={() => setSelectedIndex(index)}>
                <span><strong>{row.id_kavling}</strong><small>{row.id_tipe || 'Tipe —'}</small></span>
                <em className={`siteplan-status status-${statusClass(row.status_kavling)}`}>{row.status_kavling || 'AVAILABLE'}</em>
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
