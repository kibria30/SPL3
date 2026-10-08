"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import { useIsDark } from "@/lib/theme";
import { getPaletteMode } from "@/lib/palette";
import type { AnomalyData } from "@/lib/experiments";

const ANOMALY_COLOR = "#d03b3b"; // fixed status 'critical' red, distinct from any model color

// plotly.js touches `window` at import time -- must be client-only, no SSR.
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Fixed categorical assignment (dataviz skill's reference palette, slots 1/2): Actual is
// always blue, Predicted is always orange, everywhere in the app -- color follows the entity.

interface ForecastChartProps {
  featureNames: string[];
  actual: number[][]; // (pred_len, n_vars)
  predicted: number[][];
  anomaly?: AnomalyData | null; // anomaly-detection experiments: mark flagged points
}

export default function ForecastChart({ featureNames, actual, predicted, anomaly }: ForecastChartProps) {
  const [featureIndex, setFeatureIndex] = useState(0);
  const isDark = useIsDark();

  const colors = getPaletteMode(isDark);

  const { data, layout } = useMemo(() => {
    const x = actual.map((_, i) => i);
    const actualY = actual.map((row) => row[featureIndex]);
    const predictedY = predicted.map((row) => row[featureIndex]);

    const traces: Data[] = [
      {
        x, y: actualY, type: "scatter", mode: "lines", name: "Actual",
        line: { color: colors.blue, width: 2 },
      },
      {
        x, y: predictedY, type: "scatter", mode: "lines", name: "Predicted",
        line: { color: colors.orange, width: 2, dash: "dot" },
      },
    ];

    if (anomaly) {
      const t = anomaly.thresholds[featureIndex];
      const band = (sign: number) => predictedY.map((v) => v + sign * t);
      traces.push(
        {
          x, y: band(1), type: "scatter", mode: "lines", name: "Threshold band",
          line: { color: ANOMALY_COLOR, width: 1, dash: "dash" }, opacity: 0.5, legendgroup: "band",
          hoverinfo: "skip",
        },
        {
          x, y: band(-1), type: "scatter", mode: "lines", name: "Threshold band",
          line: { color: ANOMALY_COLOR, width: 1, dash: "dash" }, opacity: 0.5, legendgroup: "band",
          showlegend: false, hoverinfo: "skip",
        },
      );
      const idx = x.filter((i) => anomaly.flags[i][featureIndex]);
      traces.push({
        x: idx, y: idx.map((i) => actualY[i]), type: "scatter", mode: "markers", name: "Probable anomaly",
        marker: { color: ANOMALY_COLOR, size: 10, symbol: "circle-open", line: { width: 2, color: ANOMALY_COLOR } },
      });
    }

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
  }, [actual, predicted, anomaly, featureIndex, colors, featureNames]);

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
