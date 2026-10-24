const W = 600;
const H = 120;

/** A small dependency-free chart: a line, or bars with bars={true}. */
export default function Sparkline({ values, bars = false }: { values: number[]; bars?: boolean }) {
  if (values.length < 2) {
    return <div className="chart-empty muted">Waiting for data…</div>;
  }
  const max = Math.max(...values, 1);
  const min = bars ? 0 : Math.min(...values);
  const span = max - min || 1;
  const step = W / (values.length - 1);
  const barStep = W / values.length;
  const y = (v: number) => H - ((v - min) / span) * (H - 8) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart" role="img">
      {bars ? (
        values.map((v, i) => (
          <rect key={i} x={i * barStep + barStep * 0.15} width={barStep * 0.7} y={y(v)} height={H - y(v)} rx={2} />
        ))
      ) : (
        <polyline points={values.map((v, i) => `${i * step},${y(v)}`).join(' ')} fill="none" strokeWidth={2.5} />
      )}
    </svg>
  );
}
