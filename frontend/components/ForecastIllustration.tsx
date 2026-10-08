"use client";

import { useMemo } from "react";
import { getPaletteMode } from "@/lib/palette";
import { useIsDark } from "@/lib/theme";

const W = 640;
const H = 340;
const PAD = { l: 16, r: 16, t: 24, b: 40 };
const SPLIT = 0.56; // share of the width that is history; the rest is the forecast window
const N = 120;

// Illustrative seasonal series -- not real results.
function actual(t: number) {
  return Math.sin(t * 0.34) + 0.45 * Math.sin(t * 0.09 + 1) + 0.0035 * t;
}

type Fn = (t: number, base: number) => number;

const forecasts: { key: "orange" | "magenta" | "yellow"; name: string; fn: Fn; delay: number }[] = [
  { key: "orange", name: "Tensor-AR", fn: (t, a) => a + 0.12 * Math.sin(t * 0.5), delay: 0.5 },
  { key: "magenta", name: "DLinear", fn: (t, a) => 0.55 * a + 0.35 + 0.00 * t, delay: 0.7 },
  { key: "yellow", name: "ETS", fn: (t, a) => a - 0.016 * (t - N * SPLIT) * 1.4, delay: 0.9 },
];

export default function ForecastIllustration() {
  const isDark = useIsDark();
  const c = getPaletteMode(isDark);

  const { history, future, forecastPaths, splitX } = useMemo(() => {
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const xs = (i: number) => PAD.l + (i / (N - 1)) * plotW;
    const ys = (v: number) => PAD.t + plotH - ((v + 1.9) / 4.2) * plotH;
    const cut = Math.round(N * SPLIT);
    const line = (from: number, to: number, f: (i: number) => number) =>
      Array.from({ length: to - from + 1 }, (_, k) => {
        const i = from + k;
        return `${k === 0 ? "M" : "L"}${xs(i).toFixed(1)} ${ys(f(i)).toFixed(1)}`;
      }).join(" ");
    return {
      history: line(0, cut, (i) => actual(i)),
      future: line(cut, N - 1, (i) => actual(i)),
      forecastPaths: forecasts.map((m) => ({ ...m, d: line(cut, N - 1, (i) => m.fn(i, actual(i))) })),
      splitX: xs(cut),
    };
  }, []);

  const gridYs = [0.2, 0.4, 0.6, 0.8].map((p) => PAD.t + p * (H - PAD.t - PAD.b));

  return (
    <figure
      className="rounded-xl border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none p-5"
      style={{ backgroundColor: c.surface }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustration: actual series with three diverging forecasts" className="w-full">
        {gridYs.map((y) => (
          <line key={y} x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={c.grid} strokeWidth="1" />
        ))}

        {/* forecast window */}
        <rect x={splitX} y={PAD.t} width={W - PAD.r - splitX} height={H - PAD.t - PAD.b} fill={c.grid} opacity="0.35" />
        <line x1={splitX} x2={splitX} y1={PAD.t} y2={H - PAD.b} stroke={c.secondary} strokeWidth="1" strokeDasharray="4 4" />
        <text x={splitX + 10} y={PAD.t + 16} fill={c.secondary} fontSize="13">Forecast window</text>
        <text x={PAD.l + 4} y={PAD.t + 16} fill={c.secondary} fontSize="13">Input window</text>

        <path d={history} fill="none" stroke={c.blue} strokeWidth="2.5" strokeLinejoin="round" />
        <path d={future} fill="none" stroke={c.blue} strokeWidth="2.5" strokeLinejoin="round" />
        {forecastPaths.map((m) => (
          <path
            key={m.name}
            d={m.d}
            pathLength={1}
            fill="none"
            stroke={c[m.key]}
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="draw-line"
            style={{ animationDelay: `${m.delay}s` }}
          />
        ))}

        <text x={PAD.l} y={H - 12} fill={c.secondary} fontSize="13">Time</text>
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-2"><i className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: c.blue }} />Actual</span>
        {forecasts.map((m) => (
          <span key={m.name} className="flex items-center gap-2">
            <i className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: c[m.key] }} />
            {m.name}
          </span>
        ))}
        <span className="ml-auto text-zinc-500 dark:text-zinc-400">Illustration</span>
      </figcaption>
    </figure>
  );
}
