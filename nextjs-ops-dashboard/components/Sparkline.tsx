const W = 600;
const H = 120;

/** A small dependency-free line chart. */
export default function Sparkline({ values, empty }: { values: number[]; empty: string }) {
  if (values.length < 2) {
    return <div className="chart-empty muted">{empty}</div>;
  }
  const max = Math.max(...values, 1) * 1.25;
  const step = W / (WINDOW_POINTS - 1);
  const y = (v: number) => H - (v / max) * (H - 8) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart" role="img">
      <polyline points={values.map((v, i) => `${i * step},${y(v)}`).join(' ')} fill="none" strokeWidth={2.5} />
    </svg>
  );
}

const WINDOW_POINTS = 60;
