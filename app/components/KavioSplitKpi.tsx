type SplitKpiProps = {
  label: string;
  total: number;
  parts: { label: string; value: number }[];
};

/** Foundation KPI: a main total beside its component counts. */
export default function KavioSplitKpi({ label, total, parts }: SplitKpiProps) {
  return <section className="kavio-kpi kavio-split-kpi" aria-label={label}>
    <div className="kavio-split-kpi-total">
      <span className="kavio-kpi-label">{label}</span>
      <strong className="kavio-kpi-value">{total.toLocaleString('id-ID')}</strong>
    </div>
    <dl className="kavio-split-kpi-parts">
      {parts.map(part=><div className="kavio-split-kpi-part" key={part.label}>
        <dt>{part.label}</dt><dd>{part.value.toLocaleString('id-ID')}</dd>
      </div>)}
    </dl>
  </section>;
}
