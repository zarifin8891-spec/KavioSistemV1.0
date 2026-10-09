'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: true, font: 'monospace', fontSize: 12, height: 54, margin: 8, width: 1.6 });
    }
  }, [value]);
  return <svg ref={ref} role="img" aria-label={`Barcode kuitansi ${value}`} />;
}
