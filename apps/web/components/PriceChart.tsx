'use client';

import { useRef, useState } from 'react';

const COLORS = ['#f5c542', '#3aa3ff', '#28c76f', '#ff8c42', '#b96cff'];

type Pt = { t: number; p: number };
export type ChartSeries = { label: string; price: number; points: Pt[] };

function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function PriceChart({
  series,
  compact = false,
}: {
  series: ChartSeries[];
  compact?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;

  const W = compact ? 360 : 760;
  const H = compact ? 170 : 320;
  const padT = 16;
  const padB = compact ? 22 : 30;
  const padL = 6;
  const padR = 70;

  const ts = all.map((p) => p.t);
  const ps = all.map((p) => p.p);
  const tmin = Math.min(...ts);
  const tmax = Math.max(...ts);
  let pmin = Math.min(...ps);
  let pmax = Math.max(...ps);
  const padP = (pmax - pmin) * 0.18 || 0.05;
  pmin = Math.max(0, pmin - padP);
  pmax = Math.min(1, pmax + padP);

  const x = (t: number) => padL + ((t - tmin) / (tmax - tmin || 1)) * (W - padL - padR);
  const y = (p: number) => padT + (1 - (p - pmin) / (pmax - pmin || 1)) * (H - padT - padB);
  const baseY = H - padB;
  const grid = [pmin, (pmin + pmax) / 2, pmax];
  const fmtTime = (t: number) =>
    new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const mapped = series.map((s) => ({
    ...s,
    xy: s.points.map((pt) => ({ x: x(pt.t), y: y(pt.p) })),
  }));

  // endpoint labels (decluttered)
  const ends = series.map((s, si) => {
    const last = s.points[s.points.length - 1];
    const value = Number.isFinite(s.price) ? s.price : last.p;
    return {
      color: COLORS[si % COLORS.length],
      name: s.label.length > 10 ? `${s.label.slice(0, 9)}…` : s.label,
      pctv: Math.round(value * 100),
      yDot: y(last.p),
      yLabel: y(last.p),
    };
  });
  [...ends].sort((a, b) => a.yLabel - b.yLabel).reduce((prev, e) => {
    e.yLabel = Math.max(e.yLabel, prev + (compact ? 24 : 30));
    return e.yLabel;
  }, -Infinity);

  function onMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const viewX = ratio * W;
    const within = Math.min(1, Math.max(0, (viewX - padL) / (W - padL - padR)));
    setHoverT(tmin + within * (tmax - tmin));
  }

  // hovered point per series
  const hover =
    hoverT != null
      ? series.map((s, si) => {
          let best = s.points[0];
          let bd = Infinity;
          for (const pt of s.points) {
            const d = Math.abs(pt.t - hoverT);
            if (d < bd) {
              bd = d;
              best = pt;
            }
          }
          return { color: COLORS[si % COLORS.length], label: s.label, p: best.p, x: x(best.t), y: y(best.p) };
        })
      : null;
  const hoverX = hoverT != null ? x(hoverT) : 0;
  const tipW = 132;
  const tipX = Math.min(W - padR - tipW, Math.max(padL, hoverX + 8));
  const tipH = 16 + (hover?.length ?? 0) * 14;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      onMouseMove={onMove}
      onMouseLeave={() => setHoverT(null)}
    >
      <defs>
        {series.map((_, si) => (
          <linearGradient key={si} id={`area-${si}-${compact ? 'c' : 'f'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[si % COLORS.length]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COLORS[si % COLORS.length]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* gridlines */}
      {grid.map((p, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 4" />
          <text x={W - padR + 5} y={y(p) + 3} className="fill-white/30" fontSize={compact ? 9 : 11}>
            {Math.round(p * 100)}%
          </text>
        </g>
      ))}

      {/* time labels */}
      {[tmin, (tmin + tmax) / 2, tmax].map((t, i) => (
        <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-white/25" fontSize={compact ? 9 : 10}>
          {fmtTime(t)}
        </text>
      ))}

      {/* areas + lines */}
      {mapped.map((s, si) => {
        const line = smooth(s.xy);
        const areaD = `${line} L ${s.xy[s.xy.length - 1].x.toFixed(1)} ${baseY} L ${s.xy[0].x.toFixed(1)} ${baseY} Z`;
        return (
          <g key={si}>
            <path className="chart-area" d={areaD} fill={`url(#area-${si}-${compact ? 'c' : 'f'})`} />
            <path
              className="chart-line"
              d={line}
              fill="none"
              stroke={COLORS[si % COLORS.length]}
              strokeWidth={compact ? 1.8 : 2.2}
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1}
            />
          </g>
        );
      })}

      {/* glowing endpoints */}
      {ends.map((e, i) => (
        <g key={i}>
          <circle className="chart-pulse" cx={W - padR} cy={e.yDot} r="4" fill={e.color} />
          <circle cx={W - padR} cy={e.yDot} r={compact ? 3.5 : 4.5} fill={e.color} />
          <text x={W - padR + 9} y={e.yLabel - 2} fontSize={compact ? 9 : 10} fill={e.color} opacity="0.85">
            {e.name}
          </text>
          <text x={W - padR + 9} y={e.yLabel + (compact ? 9 : 11)} fontSize={compact ? 12 : 14} fontWeight="700" fill={e.color}>
            {e.pctv}%
          </text>
        </g>
      ))}

      {/* hover crosshair + tooltip */}
      {hover && (
        <g>
          <line x1={hoverX} x2={hoverX} y1={padT} y2={baseY} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="2 3" />
          {hover.map((h, i) => (
            <circle key={i} cx={h.x} cy={h.y} r="3.5" fill={h.color} stroke="#f4f5f7" strokeWidth="1.5" />
          ))}
          <g transform={`translate(${tipX}, ${padT})`}>
            <rect width={tipW} height={tipH} rx="8" fill="rgba(10,10,15,0.92)" stroke="rgba(255,255,255,0.1)" />
            <text x="8" y="12" fontSize="9" className="fill-white/45">
              {new Date((hoverT as number) * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </text>
            {hover.map((h, i) => (
              <g key={i} transform={`translate(8, ${20 + i * 14})`}>
                <circle cx="3" cy="-3" r="3" fill={h.color} />
                <text x="11" y="0" fontSize="10" className="fill-white/80">
                  {h.label.length > 12 ? `${h.label.slice(0, 11)}…` : h.label}
                </text>
                <text x={tipW - 16} y="0" textAnchor="end" fontSize="10" fontWeight="700" fill={h.color}>
                  {Math.round(h.p * 100)}%
                </text>
              </g>
            ))}
          </g>
        </g>
      )}
    </svg>
  );
}
