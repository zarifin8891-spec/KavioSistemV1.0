'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { formatKavioDate } from '../lib/date-format';
import { SITEPLAN_MAP, SITEPLAN_VIEWBOX } from './siteplan-map';

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

type SavedMapping = { id_kavling: string; polygon: [number, number][]; label?: [number, number] | null };

type Props = {
  kavlings: Kavling[];
  sales: Sale[];
  spks: Spk[];
  progressUpdates: ProgressUpdate[];
  savedMappings: SavedMapping[];
};

const STATUS_LIST = ['AVAILABLE', 'BOOKING', 'BUILDING', 'READY_STOCK', 'SOLD', 'COMPLETED'] as const;

function statusClass(status?: string | null) {
  return (status || 'AVAILABLE').toLowerCase();
}

function formatDate(value?: string | null) { return formatKavioDate(value); }

function formatMoney(value?: number | string | null) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value));
}

function polygonPoints(points: [number, number][]) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export default function SiteplanClient({ kavlings, sales, spks, progressUpdates, savedMappings }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [mappingMode, setMappingMode] = useState(false);
  const [mappingPoints, setMappingPoints] = useState<[number, number][]>([]);
  const [mappingNotice, setMappingNotice] = useState('');
  const [zoom, setZoom] = useState(1);
  const [polygonFinished, setPolygonFinished] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const savedMap = useMemo(() => Object.fromEntries(savedMappings.map((row) => [row.id_kavling, row])), [savedMappings]);
  const activeMap = useMemo(() => ({ ...SITEPLAN_MAP, ...savedMap }), [savedMap]);
  const rows = useMemo(() => kavlings.filter((row) => Boolean(activeMap[row.id_kavling])), [kavlings, activeMap]);
  const unmappedRows = useMemo(() => kavlings.filter((row) => !activeMap[row.id_kavling]), [kavlings, activeMap]);
  const selected = selectedId ? kavlings.find((row) => row.id_kavling === selectedId) ?? null : null;

  const selectedSale = selected ? sales.find((row) => row.id_kavling === selected.id_kavling) : null;
  const selectedSpk = selected ? spks.find((row) => row.id_kavling === selected.id_kavling) : null;
  const selectedProgress = selectedSpk
    ? progressUpdates.filter((row) => row.id_spk === selectedSpk.id_spk).sort((a, b) => String(b.tanggal_update || '').localeCompare(String(a.tanggal_update || '')))[0]
    : null;

  const visibleRows = useMemo(
    () => rows.filter((row) => filter === 'ALL' || row.status_kavling === filter),
    [rows, filter],
  );
  const listRows = mappingMode ? kavlings : visibleRows;

  const counts = useMemo(
    () => STATUS_LIST.reduce<Record<string, number>>((acc, status) => {
      acc[status] = rows.filter((row) => row.status_kavling === status).length;
      return acc;
    }, {}),
    [rows],
  );

  const handleMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mappingMode || !selectedId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SITEPLAN_VIEWBOX.width;
    const y = ((event.clientY - rect.top) / rect.height) * SITEPLAN_VIEWBOX.height;
    setMappingPoints((points) => [...points, [Math.round(x), Math.round(y)]]);
    setPolygonFinished(false);
  };

  const resetMapping = () => { setMappingPoints([]); setPolygonFinished(false); };

  const finishPolygon = () => {
    if (mappingPoints.length >= 3) setPolygonFinished(true);
  };

  const loadCurrentMapping = () => {
    if (!selectedId) return;
    setMappingPoints(activeMap[selectedId]?.polygon ?? []);
  };

  const undoMappingPoint = () => {
    setMappingPoints((points) => points.slice(0, -1));
  };

  const saveMapping = async () => {
    if (!selectedId || mappingPoints.length < 3) return;
    const label = mappingPoints.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]).map((value) => Math.round(value / mappingPoints.length)) as [number, number];
    const supabase = createClient();
    setMappingNotice('Menyimpan...');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('siteplan_kavling_mapping').upsert({ id_kavling: selectedId, polygon: mappingPoints, label, updated_by: user?.id ?? null, updated_at: new Date().toISOString() });
    setMappingNotice(error ? `Gagal menyimpan: ${error.message}` : `Mapping ${selectedId} berhasil disimpan.`);
  };

  const exportMapping = async () => {
    if (!selectedId || mappingPoints.length < 3) return;
    const payload = JSON.stringify({
      id_kavling: selectedId,
      polygon: mappingPoints,
      label: mappingPoints.reduce(
        (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0],
      ).map((value) => Math.round(value / mappingPoints.length)),
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      window.prompt('Salin hasil mapping ini:', payload);
    }
  };

  const handlePolygonKey = (event: React.KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedId(id);
    }
  };

  return (
    <main className="siteplan-page">
      <section className="siteplan-toolbar kavio-panel">
        <div>
          <h2 className="kavio-panel-title">SITEPLAN INTERAKTIF</h2>
          <div className="kavio-panel-note">Siteplan terbaru sebagai dasar visual. Polygon kavling dipetakan manual dan terhubung ke Sales, SPK, dan Progress berdasarkan id_kavling.</div>
        </div>
        <div className="siteplan-toolbar-actions"><button type="button" className={`kavio-button ${mappingMode ? 'primary' : 'secondary'}`} onClick={() => { setMappingMode((value) => !value); setMappingPoints([]); }}>{mappingMode ? 'KELUAR MAPPING MODE' : 'MAPPING MODE'}</button></div>
        <div className="siteplan-legend">
          {STATUS_LIST.map((status) => (
            <button key={status} type="button" className={`siteplan-legend-item status-${status.toLowerCase()} ${filter === status ? 'is-active' : ''}`} onClick={() => setFilter(filter === status ? 'ALL' : status)}>
              <i />{status.replace('_', ' ')} <strong>{counts[status] || 0}</strong>
            </button>
          ))}
        </div>
      </section>

      {unmappedRows.length > 0 && (
        <div className="siteplan-mapping-alert">
          <strong>{unmappedRows.length} kavling belum memiliki mapping Siteplan.</strong>
          <span>{unmappedRows.map((row) => row.id_kavling).join(', ')}</span>
        </div>
      )}

      <section className="siteplan-summary">
        <div className="siteplan-summary-item"><span>TERMAPPING</span><strong>{rows.length}</strong></div>
        <div className="siteplan-summary-item"><span>TERSEDIA</span><strong>{counts.AVAILABLE || 0}</strong></div>
        <div className="siteplan-summary-item"><span>BOOKING</span><strong>{counts.BOOKING || 0}</strong></div>
        <div className="siteplan-summary-item"><span>BUILDING</span><strong>{counts.BUILDING || 0}</strong></div>
      </section>

      <section className="siteplan-layout">
        <div className="siteplan-canvas kavio-panel">
          <div className="siteplan-viewport">
            <div className="siteplan-zoom-controls">
              <button type="button" className="kavio-button secondary" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}>+</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" className="kavio-button secondary" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))}>−</button>
              <button type="button" className="kavio-button secondary" onClick={() => setZoom(1)}>RESET</button>
            </div>
            <div className="siteplan-stage" style={{ width: `${zoom * 100}%`, aspectRatio: `${SITEPLAN_VIEWBOX.width} / ${SITEPLAN_VIEWBOX.height}` }}>
            <img src="/siteplan/siteplan-clean-source.png" alt="Siteplan terbaru" className="siteplan-image" />
            <svg ref={svgRef} className={`siteplan-overlay ${mappingMode ? 'is-mapping' : ''}`} viewBox={`0 0 ${SITEPLAN_VIEWBOX.width} ${SITEPLAN_VIEWBOX.height}`} preserveAspectRatio="none" aria-label="Mapping kavling Siteplan" onClick={handleMapClick}>
              {rows.map((row) => {
                const map = activeMap[row.id_kavling];
                const status = row.status_kavling || 'AVAILABLE';
                const hidden = filter !== 'ALL' && status !== filter;
                const selectedClass = selectedId === row.id_kavling ? 'is-selected' : '';
                return (
                  <g
                    key={row.id_kavling}
                    className={`siteplan-polygon status-${statusClass(status)} ${selectedClass} ${hidden ? 'is-dimmed' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Pilih kavling ${row.id_kavling}`}
                    onClick={(event) => { if (mappingMode) return; setSelectedId(row.id_kavling); }}
                    onKeyDown={(event) => handlePolygonKey(event, row.id_kavling)}
                  >
                    <polygon points={mappingMode && selectedId === row.id_kavling && mappingPoints.length >= 3 ? polygonPoints(mappingPoints) : polygonPoints(map.polygon)} />
                    {map.label && <text x={map.label[0]} y={map.label[1]} textAnchor="middle">{row.id_kavling}</text>}
                    {mappingMode && (selectedId === row.id_kavling ? mappingPoints : map.polygon).map(([x, y], pointIndex) => <circle key={pointIndex} cx={x} cy={y} r="7" className="siteplan-map-point" />)}
                  </g>
                );
              })}
            </svg>
            </div>
          </div>
        </div>

        <aside className="siteplan-detail kavio-panel">
          <div className="kavio-panel-head">
            <div>
              <h2 className="kavio-panel-title">{selected ? `KAVLING ${selected.no_kavling || selected.id_kavling}` : 'PILIH KAVLING'}</h2>
              <div className="kavio-panel-note">{selected ? 'Data operasional yang terkait dengan kavling ini.' : 'Klik polygon kavling pada siteplan atau pilih dari daftar.'}</div>
            </div>
            {selected && <span className={`siteplan-status status-${statusClass(selected.status_kavling)}`}>{selected.status_kavling || 'AVAILABLE'}</span>}
          </div>

          {mappingMode ? (
            <div className="siteplan-mapping-panel">
              <div className="siteplan-related-title">CALIBRATION / MAPPING</div>
              <p>Pilih kavling, lalu klik titik-titik sudut kavling langsung pada gambar. Titik yang dibuat menjadi polygon kerja sementara.</p>
              <div className="siteplan-mapping-selected">KAVLING: <strong>{selected?.id_kavling || '—'}</strong></div>
              <div className="siteplan-mapping-coords">{mappingPoints.length ? mappingPoints.map(([x, y], i) => <span key={i}>P{i + 1}: {x}, {y}</span>) : <span>Belum ada titik. Klik sudut kavling pada gambar.</span>}</div>
              <div className="siteplan-mapping-actions">
                <button type="button" className="kavio-button secondary" onClick={loadCurrentMapping} disabled={!selectedId}>MUAT POLYGON SAAT INI</button>
                <button type="button" className="kavio-button secondary" onClick={finishPolygon} disabled={mappingPoints.length < 3}>SELESAI POLYGON</button>
                <button type="button" className="kavio-button secondary" onClick={undoMappingPoint} disabled={!mappingPoints.length}>UNDO</button>
                <button type="button" className="kavio-button secondary" onClick={resetMapping} disabled={!mappingPoints.length}>MULAI ULANG</button>
                <button type="button" className="kavio-button primary" onClick={saveMapping} disabled={!selectedId || mappingPoints.length < 3 || !polygonFinished}>SIMPAN MAPPING</button>
                <button type="button" className="kavio-button secondary" onClick={exportMapping} disabled={!selectedId || mappingPoints.length < 3}>SALIN DATA</button>
              </div>
              <div className="siteplan-mapping-selected">TITIK: <strong>{mappingPoints.length}</strong> · Minimal 3 titik. {polygonFinished ? 'Polygon siap disimpan.' : 'Tambahkan titik mengikuti batas kavling.'}</div>
              {mappingNotice && <div className="siteplan-mapping-notice">{mappingNotice}</div>}
            </div>
          ) : selected ? (
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
                    <div className="siteplan-related-actions"><Link href={`/master/sales/detail?id=${selectedSale.id_sales}`} className="kavio-button secondary">DETAIL SALES</Link></div>
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
                    <div className="siteplan-related-actions">
                      <Link href={`/master/spk/detail/${selectedSpk.id_spk}`} className="kavio-button secondary">DETAIL SPK</Link>
                      <Link href={`/progress?spk=${selectedSpk.id_spk}`} className="kavio-button secondary">PROGRESS</Link>
                    </div>
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
              <small>{listRows.length} data</small>
            </div>
            {listRows.map((row) => (
              <button key={row.id_kavling} type="button" className={`siteplan-list-row ${selectedId === row.id_kavling ? 'is-selected' : ''}`} onClick={() => { setSelectedId(row.id_kavling); if (mappingMode) { const current = activeMap[row.id_kavling]?.polygon ?? []; setMappingPoints(current); setPolygonFinished(current.length >= 3); } }}>
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
