"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";

// plotly.js touches `window` at import time -- must be client-only, no SSR.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Fixed categorical assignment (dataviz skill's reference palette, slots 1/2): Actual is
// always blue, Predicted is always orange, everywhere in the app -- color follows the entity.
const COLORS = {
  light: { actual: "#2a78d6", predicted: "#eb6834", surface: "#fcfcfb", text: "#0b0b0b", secondary: "#52514e", grid: "#e1e0d9" },
  dark: { actual: "#3987e5", predicted: "#d95926", surface: "#1a1a19", text: "#ffffff", secondary: "#c3c2b7", grid: "#2c2c2a" },
};

interface ForecastChartProps {
  featureNames: string[];
  actual: number[][]; // (pred_len, n_vars)
  predicted: number[][];
}

export default function ForecastChart({ featureNames, actual, predicted }: ForecastChartProps) {
  const [featureIndex, setFeatureIndex] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const colors = isDark ? COLORS.dark : COLORS.light;

  const { data, layout } = useMemo(() => {
    const x = actual.map((_, i) => i);
    const actualY = actual.map((row) => row[featureIndex]);
    const predictedY = predicted.map((row) => row[featureIndex]);

    const traces: Data[] = [
      {
        x, y: actualY, type: "scatter", mode: "lines", name: "Actual",
        line: { color: colors.actual, width: 2 },
      },
      {
        x, y: predictedY, type: "scatter", mode: "lines", name: "Predicted",
        line: { color: colors.predicted, width: 2, dash: "dot" },
      },
    ];

    const layoutSpec: Partial<Layout> = {
      autosize: true,
      height: 400,
      margin: { l: 50, r: 20, t: 20, b: 40 },
      paper_bgcolor: colors.surface,
      plot_bgcolor: colors.surface,
      font: { color: colors.text, family: "system-ui, -apple-system, sans-serif" },
      xaxis: { title: { text: "Time steps into test horizon" }, gridcolor: colors.grid, color: colors.secondary },
      yaxis: { title: { text: featureNames[featureIndex] }, gridcolor: colors.grid, color: colors.secondary },
      legend: { orientation: "h", y: -0.2 },
      hovermode: "x unified",
    };

    return { data: traces, layout: layoutSpec };
  }, [actual, predicted, featureIndex, colors, featureNames]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {featureNames.map((name, i) => (
          <button
            key={name}
            onClick={() => setFeatureIndex(i)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              i === featureIndex
                ? "bg-foreground text-background border-transparent"
                : "border-black/10 dark:border-white/15 text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <Plot data={data} layout={layout} style={{ width: "100%" }} config={{ responsive: true, displaylogo: false }} />
    </div>
  );
}
