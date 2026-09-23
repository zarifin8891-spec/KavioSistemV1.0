'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { formatKavioDate } from '../lib/date-format';
import { SITEPLAN_MAP, SITEPLAN_VIEWBOX } from './siteplan-map';
import { detectLotPolygon } from './siteplan-mapping-engine';

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

type SavedMapping = { id_kavling: string; polygon: [number, number][]; label?: [number, number] | null; siteplan_version_id?: string | null };

type ActiveSiteplan = { id: string; nama_siteplan: string; versi: string; file_name: string; image_width?: number | null; image_height?: number | null };

type Props = {
  kavlings: Kavling[];
  sales: Sale[];
  spks: Spk[];
  progressUpdates: ProgressUpdate[];
  savedMappings: SavedMapping[];
  activeSiteplan: ActiveSiteplan | null;
  siteplanSrc: string;
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

export default function SiteplanClient({ kavlings, sales, spks, progressUpdates, savedMappings, activeSiteplan, siteplanSrc }: Props) {
  const router = useRouter();
  const siteplanWidth = activeSiteplan?.image_width || SITEPLAN_VIEWBOX.width;
  const siteplanHeight = activeSiteplan?.image_height || SITEPLAN_VIEWBOX.height;
  const siteplanAspect = `${siteplanWidth} / ${siteplanHeight}`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [mappingMode, setMappingMode] = useState(false);
  const [mappingPoints, setMappingPoints] = useState<[number, number][]>([]);
  const [mappingNotice, setMappingNotice] = useState('');
  const [polygonFinished, setPolygonFinished] = useState(false);
  const [autoDetectArmed, setAutoDetectArmed] = useState(false);
  const [localSavedMappings, setLocalSavedMappings] = useState(savedMappings);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingSiteplan, setUploadingSiteplan] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const savedMap = useMemo(() => Object.fromEntries(localSavedMappings.map((row) => [row.id_kavling, row])), [localSavedMappings]);
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

  const handleAutoDetect = async (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mappingMode || !selectedId || !svgRef.current || !imageRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const seedX = normalizedX * imageRef.current.naturalWidth;
    const seedY = normalizedY * imageRef.current.naturalHeight;
    try {
      setMappingNotice('Mendeteksi batas kavling otomatis...');
      const result = await detectLotPolygon(imageRef.current, seedX, seedY);
      const scaleX = siteplanWidth / imageRef.current.naturalWidth;
      const scaleY = siteplanHeight / imageRef.current.naturalHeight;
      const polygon = result.polygon.map(([x, y]) => [Math.round(x * scaleX), Math.round(y * scaleY)] as [number, number]);
      const label = [Math.round(result.label[0] * scaleX), Math.round(result.label[1] * scaleY)] as [number, number];
      setMappingPoints(polygon);
      setPolygonFinished(true);
      setAutoDetectArmed(false);
      setMappingNotice(`AUTO MAPPING ${selectedId} berhasil. Confidence ${result.confidence}% · ${polygon.length} titik. Silakan cek lalu SIMPAN MAPPING.`);
    } catch (error) {
      setMappingNotice(error instanceof Error ? error.message : 'Auto mapping gagal. Coba klik lebih ke tengah kavling.');
    }
  };

  const handleMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!mappingMode || !selectedId || !svgRef.current) return;
    if (autoDetectArmed) {
      void handleAutoDetect(event);
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * siteplanWidth;
    const y = ((event.clientY - rect.top) / rect.height) * siteplanHeight;
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

    const uploadNewSiteplan = async () => {
    if (!uploadFile) return;
    if (!/^image\/(png|jpeg|webp)$/.test(uploadFile.type)) {
      setMappingNotice('Untuk upload langsung ke Siteplan KAVIO, gunakan PNG, JPG/JPEG, atau WEBP.');
      return;
    }

    setUploadingSiteplan(true);
    setMappingNotice('Mengunggah Siteplan baru...');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Sesi login tidak ditemukan.');

      const { count } = await supabase
        .from('siteplan_versions')
        .select('id', { count: 'exact', head: true });
      const version = `REV.${String((count ?? 0) + 1).padStart(2, '0')}`;
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
      const filePath = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('siteplans')
        .upload(filePath, uploadFile, { contentType: uploadFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(uploadFile);
        img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ukuran gambar Siteplan tidak dapat dibaca.')); };
        img.src = url;
      });

      await supabase.from('siteplan_versions').update({ is_active: false }).eq('is_active', true);
      const { error: insertError } = await supabase.from('siteplan_versions').insert({
        nama_siteplan: uploadFile.name.replace(/\.[^.]+$/, ''),
        versi: version,
        file_name: uploadFile.name,
        file_path: filePath,
        mime_type: uploadFile.type,
        file_size: uploadFile.size,
        image_width: dimensions.width,
        image_height: dimensions.height,
        is_active: true,
        uploaded_by: user.id,
        activated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      setUploadFile(null);
      setMappingNotice(`Siteplan ${version} berhasil diaktifkan. Mapping lama tetap aman karena sekarang terikat ke versi sebelumnya.`);
      router.refresh();
    } catch (error) {
      setMappingNotice(error instanceof Error ? error.message : 'Upload Siteplan gagal.');
    } finally {
      setUploadingSiteplan(false);
    }
  };

  const saveMapping = async () => {
    if (!selectedId || mappingPoints.length < 3) return;
    const label = mappingPoints.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]).map((value) => Math.round(value / mappingPoints.length)) as [number, number];
    const supabase = createClient();
    setMappingNotice('Menyimpan...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setMappingNotice('Sesi login tidak ditemukan. Silakan login ulang sebelum menyimpan mapping.');
      return;
    }
    const payload = { id_kavling: selectedId, polygon: mappingPoints, label, updated_by: user.id, updated_at: new Date().toISOString(), siteplan_version_id: activeSiteplan?.id ?? null };
    const { data, error } = await supabase
      .from('siteplan_kavling_mapping')
      .upsert(payload)
      .select('id_kavling,polygon,label')
      .single();
    if (error) {
      setMappingNotice(`Gagal menyimpan: ${error.message}`);
      return;
    }
    if (data) {
      setLocalSavedMappings((current) => [
        ...current.filter((row) => row.id_kavling !== data.id_kavling),
        data as SavedMapping,
      ]);
    }
    setMappingNotice(`Mapping ${selectedId} berhasil disimpan.`);
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
      <section className="siteplan-summary kavio-kpi-grid siteplan-kpi-grid" aria-label="KPI Siteplan">
        <div className="kavio-kpi kavio-dashboard-kpi">
          <div className="kavio-kpi-icon kavio-dashboard-kpi-icon" aria-hidden="true">⌗</div>
          <div className="kavio-kpi-label kavio-dashboard-kpi-label">TERMAPPING</div>
          <div className="kavio-kpi-value kavio-dashboard-kpi-value">{rows.length}</div>
          <div className="kavio-kpi-note kavio-dashboard-kpi-note">Kavling sudah terhubung ke Siteplan</div>
        </div>
        <div className="kavio-kpi kavio-dashboard-kpi">
          <div className="kavio-kpi-icon kavio-dashboard-kpi-icon" aria-hidden="true">◇</div>
          <div className="kavio-kpi-label kavio-dashboard-kpi-label">TERSEDIA</div>
          <div className="kavio-kpi-value kavio-dashboard-kpi-value">{counts.AVAILABLE || 0}</div>
          <div className="kavio-kpi-note kavio-dashboard-kpi-note">Kavling status AVAILABLE</div>
        </div>
        <div className="kavio-kpi kavio-dashboard-kpi">
          <div className="kavio-kpi-icon kavio-dashboard-kpi-icon" aria-hidden="true">▣</div>
          <div className="kavio-kpi-label kavio-dashboard-kpi-label">BOOKING</div>
          <div className="kavio-kpi-value kavio-dashboard-kpi-value">{counts.BOOKING || 0}</div>
          <div className="kavio-kpi-note kavio-dashboard-kpi-note">Kavling status BOOKING</div>
        </div>
        <div className="kavio-kpi kavio-dashboard-kpi">
          <div className="kavio-kpi-icon kavio-dashboard-kpi-icon" aria-hidden="true">⌂</div>
          <div className="kavio-kpi-label kavio-dashboard-kpi-label">BUILDING</div>
          <div className="kavio-kpi-value kavio-dashboard-kpi-value">{counts.BUILDING || 0}</div>
          <div className="kavio-kpi-note kavio-dashboard-kpi-note">Kavling sedang dibangun</div>
        </div>
      </section>

      <section className="siteplan-layout">
        <div className="siteplan-canvas kavio-panel">
          <div className="siteplan-viewport">
            <div className="siteplan-stage" style={{ width: '100%', aspectRatio: siteplanAspect }}>
              <div className="siteplan-map-layer">
              <img ref={imageRef} src={siteplanSrc} alt={activeSiteplan?.nama_siteplan || 'Siteplan aktif'} className="siteplan-image" />
            <svg ref={svgRef} className={`siteplan-overlay ${mappingMode ? 'is-mapping' : ''} ${autoDetectArmed ? 'is-auto-detect' : ''}`} viewBox={`0 0 ${siteplanWidth} ${siteplanHeight}`} preserveAspectRatio="none" aria-label="Mapping kavling Siteplan" onClick={handleMapClick}>
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
        </div>


      <section className="siteplan-toolbar kavio-panel">
        <div>
          <h2 className="kavio-panel-title">SITEPLAN INTERAKTIF</h2>
          <div className="kavio-panel-note">{activeSiteplan ? `${activeSiteplan.nama_siteplan} · ${activeSiteplan.versi}` : 'Siteplan bawaan KAVIO. Upload Siteplan baru dari panel ini untuk membuat versi proyek baru.'}</div>
          <div className="siteplan-upload-row">
            <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
            <button type="button" className="kavio-button primary" onClick={uploadNewSiteplan} disabled={!uploadFile || uploadingSiteplan}>{uploadingSiteplan ? 'MENGUNGGAH...' : 'UPLOAD & AKTIFKAN'}</button>
          </div>
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
                <button type="button" className={`kavio-button ${autoDetectArmed ? 'primary' : 'secondary'}`} onClick={() => { setAutoDetectArmed((value) => !value); setMappingNotice(autoDetectArmed ? 'Auto Detect dibatalkan.' : 'AUTO DETECT aktif. Klik sekali di bagian putih/tengah kavling yang dipilih.'); }} disabled={!selectedId}>AUTO DETECT POLYGON</button>
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
              <button key={row.id_kavling} type="button" className={`siteplan-list-row ${selectedId === row.id_kavling ? 'is-selected' : ''}`} onClick={() => { setSelectedId(row.id_kavling); setAutoDetectArmed(false); if (mappingMode) { const current = activeMap[row.id_kavling]?.polygon ?? []; setMappingPoints(current); setPolygonFinished(current.length >= 3); } }}>
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
