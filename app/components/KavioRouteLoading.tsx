export default function KavioRouteLoading() {
  return (
    <main className="kavio-route-loading" aria-busy="true" aria-live="polite">
      <div className="kavio-route-loading-card">
        <span className="kavio-route-loading-spinner" aria-hidden="true" />
        <div>
          <strong>MEMUAT HALAMAN</strong>
          <span>Menyiapkan data KAVIO...</span>
        </div>
      </div>
    </main>
  );
}
