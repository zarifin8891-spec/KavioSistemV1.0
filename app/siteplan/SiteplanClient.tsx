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

const areas = [
  { x: 25.5, y: 7.2, w: 8.2, h: 6.3 }, { x: 33.9, y: 8.0, w: 8.0, h: 6.3 },
  { x: 42.0, y: 9.0, w: 8.0, h: 6.3 }, { x: 18.0, y: 18.2, w: 8.0, h: 6.0 },
  { x: 26.1, y: 19.2, w: 8.0, h: 6.0 }, { x: 34.4, y: 20.2, w: 8.0, h: 6.0 },
  { x: 18.2, y: 29.5, w: 8.0, h: 6.0 }, { x: 26.3, y: 30.5, w: 8.0, h: 6.0 },
  { x: 34.5, y: 31.5, w: 8.0, h: 6.0 }, { x: 42.7, y: 32.5, w: 8.0, h: 6.0 },
];

const fallback = Array.from({ length: 10 }, (_, i) => ({
  id_kavling: `DEMO-${String(i + 1).padStart(2, '0')}`,
  blok: 'DEMO',
  no_kavling: String(i + 1),
  status_kavling: ['AVAILABLE','BOOKING','SOLD','BUILDING','READY_STOCK'][i % 5],
}));

export default function SiteplanClient({ kavlings }: Props) {
  const rows = useMemo(() => (kavlings.length ? kavlings.slice(0, 10) : fallback), [kavlings]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex == null ? null : rows[selectedIndex];

  return (
    <main className="siteplan-page">
      <section className="siteplan-toolbar kavio-panel">
        <div>
          <h2 className="kavio-panel-title">SITEPLAN INTERAKTIF</h2>
          <div className="kavio-panel-note">Prototype layer interaktif di atas Siteplan Cibodas. Klik area kavling untuk membuka ringkasan.</div>
        </div>
        <div className="siteplan-legend">
          {['AVAILABLE','BOOKING','SOLD','BUILDING','READY_STOCK'].map((status) => (
            <span key={status} className={`siteplan-legend-item status-${status.toLowerCase()}`}><i />{status.replace('_',' ')}</span>
          ))}
        </div>
      </section>

      <section className="siteplan-layout">
        <div className="siteplan-canvas kavio-panel">
          <div className="siteplan-stage">
            <img src={SITEPLAN_IMAGE} alt="Siteplan Cibodas" className="siteplan-image" />
            {rows.map((row, index) => {
              const area = areas[index];
              const status = row.status_kavling || 'AVAILABLE';
              return (
                <button
                  key={row.id_kavling}
                  type="button"
                  className={`siteplan-hotspot status-${status.toLowerCase()} ${selectedIndex === index ? 'is-selected' : ''}`}
                  style={{ left: area.x + '%', top: area.y + '%', width: area.w + '%', height: area.h + '%' }}
                  onClick={() => setSelectedIndex(index)}
                  aria-label={`Pilih kavling ${row.id_kavling}`}
                >
                  <span>{row.no_kavling || row.id_kavling}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="siteplan-detail kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">{selected ? `KAVLING ${selected.no_kavling || selected.id_kavling}` : 'PILIH KAVLING'}</h2>
              <div className="kavio-panel-note">{selected ? 'Ringkasan data kavling aktif.' : 'Klik salah satu area pada siteplan.'}</div>
            </div>
            {selected && <span className={`siteplan-status status-${(selected.status_kavling || 'AVAILABLE').toLowerCase()}`}>{selected.status_kavling || 'AVAILABLE'}</span>}
          </div>

          {selected ? (
            <div className="siteplan-detail-body">
              <div className="siteplan-kpi"><span>KAVLING</span><strong>{selected.id_kavling}</strong></div>
              <div className="siteplan-kpi"><span>BLOK</span><strong>{selected.blok || '—'}</strong></div>
              <div className="siteplan-kpi"><span>NO. KAVLING</span><strong>{selected.no_kavling || '—'}</strong></div>
              <div className="siteplan-kpi"><span>TIPE</span><strong>{selected.id_tipe || '—'}</strong></div>
              <div className="siteplan-detail-note">Tahap prototype: hotspot dan status sudah interaktif. Integrasi detail Sales → SPK → Progress akan memakai id_kavling yang sama.</div>
            </div>
          ) : (
            <div className="siteplan-empty">Belum ada kavling dipilih.</div>
          )}
        </aside>
      </section>
    </main>
  );
}
