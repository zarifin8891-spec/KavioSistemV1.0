'use client';

export default function PrintButton() {
  return <button type="button" className="kavio-button" onClick={() => window.print()}>CETAK KUITANSI</button>;
}
