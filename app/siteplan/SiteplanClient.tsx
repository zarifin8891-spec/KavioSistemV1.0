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

type Props = { kavlings: Kavling[] };

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

export default function SiteplanClient({ kavlings }: Props) {
  const rows = useMemo(() => (kavlings.length ? kavlings.slice(0, areas.length) : fallback), [kavlings]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const selected = selectedIndex == null ? null : rows[selectedIndex];

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
          <div className="kavio-panel-note">Prototype operasional: status kavling dan ringkasan data terhubung ke master_kavling.</div>
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
        <div className="siteplan-summary-item"><span>BUILDING</span><strong>{counts.BUILDING || 0}</strong></div>
        <div className="siteplan-summary-item"><span>TERJUAL / SELESAI</span><strong>{(counts.SOLD || 0) + (counts.COMPLETED || 0)}</strong></div>
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
              <div className="kavio-panel-note">{selected ? 'Ringkasan data kavling aktif.' : 'Klik area pada siteplan atau pilih dari daftar.'}</div>
            </div>
            {selected && <span className={`siteplan-status status-${statusClass(selected.status_kavling)}`}>{selected.status_kavling || 'AVAILABLE'}</span>}
          </div>

          {selected ? (
            <div className="siteplan-detail-body">
              <div className="siteplan-kpi"><span>KAVLING</span><strong>{selected.id_kavling}</strong></div>
              <div className="siteplan-kpi"><span>BLOK</span><strong>{selected.blok || '—'}</strong></div>
              <div className="siteplan-kpi"><span>NO. KAVLING</span><strong>{selected.no_kavling || '—'}</strong></div>
              <div className="siteplan-kpi"><span>TIPE</span><strong>{selected.id_tipe || '—'}</strong></div>
              <div className="siteplan-detail-note">Tahap ini belum mengubah struktur database. Langkah berikutnya adalah pemetaan posisi kavling yang mengikuti gambar Siteplan asli.</div>
            </div>
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
