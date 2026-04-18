import type { SparklinePoint } from "@/lib/api";

interface SparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, width = 60, height = 20, className }: SparklineProps) {
  // Not enough data → render a muted dash
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden="true">
        <line
          x1={width * 0.1}
          y1={height / 2}
          x2={width * 0.9}
          y2={height / 2}
          stroke="#828282"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const padding = 2;
  const apys = data.map((p) => p.apy);
  const minApy = Math.min(...apys);
  const maxApy = Math.max(...apys);
  const range = maxApy - minApy || 1;

  const stepX = (width - 2 * padding) / (data.length - 1);
  const points = data
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = padding + (1 - (p.apy - minApy) / range) * (height - 2 * padding);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const firstApy = data[0].apy;
  const lastApy = data[data.length - 1].apy;
  let stroke = "#828282"; // flat / mono 200
  if (lastApy > firstApy) stroke = "#51A69A"; // success
  else if (lastApy < firstApy) stroke = "#DD5453"; // destructive

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
