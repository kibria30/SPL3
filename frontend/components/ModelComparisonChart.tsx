"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import { getPaletteMode } from "@/lib/palette";
import { getActualColor, getModelColor } from "@/lib/modelColors";

// plotly.js touches `window` at import time -- must be client-only, no SSR.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface ComparisonSeriesEntry {
  modelSlug: string;
  modelName: string;
  predicted: number[][]; // (pred_len, n_vars)
}

interface ModelComparisonChartProps {
  featureNames: string[];
  actual: number[][]; // (pred_len, n_vars)
  entries: ComparisonSeriesEntry[]; // only entries with a completed result
}

export default function ModelComparisonChart({ featureNames, actual, entries }: ModelComparisonChartProps) {
  const [featureIndex, setFeatureIndex] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const colors = getPaletteMode(isDark);

  const { data, layout } = useMemo(() => {
    const x = actual.map((_, i) => i);
    const actualY = actual.map((row) => row[featureIndex]);

    const traces: Data[] = [
      {
        x, y: actualY, type: "scatter", mode: "lines", name: "Actual",
        line: { color: getActualColor(isDark), width: 2 },
      },
      ...entries.map((entry): Data => ({
        x,
        y: entry.predicted.map((row) => row[featureIndex]),
        type: "scatter",
        mode: "lines",
        name: entry.modelName,
        line: { color: getModelColor(entry.modelSlug, isDark), width: 2, dash: "dot" },
      })),
    ];

    const layoutSpec: Partial<Layout> = {
      autosize: true,
      height: 440,
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
  }, [actual, entries, featureIndex, colors, featureNames, isDark]);

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
