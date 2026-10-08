"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
import { useIsDark } from "@/lib/theme";
import { getPaletteMode } from "@/lib/palette";
import { getModelColor } from "@/lib/modelColors";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface EfficiencyBarEntry {
  modelSlug: string;
  modelName: string;
  value: number;
}

interface EfficiencyBarChartProps {
  title: string;
  entries: EfficiencyBarEntry[];
  valueSuffix?: string;
}

// Bars, not a scatter -- a colored scatter with up to 7 hued points is an all-pairs chart form,
// capped at 3 safely-distinguishable colors by the dataviz palette; bars are an adjacent-pair
// form, gate-safe across all 8 slots, so this sidesteps the cap entirely.
export default function EfficiencyBarChart({ title, entries, valueSuffix = "" }: EfficiencyBarChartProps) {
  const isDark = useIsDark();

  const colors = getPaletteMode(isDark);

  const { data, layout } = useMemo(() => {
    const trace: Data = {
      type: "bar",
      x: entries.map((e) => e.modelName),
      y: entries.map((e) => e.value),
      marker: { color: entries.map((e) => getModelColor(e.modelSlug, isDark)) },
      text: entries.map((e) => `${e.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${valueSuffix}`),
      textposition: "outside",
      hoverinfo: "x+y",
    };

    const layoutSpec: Partial<Layout> = {
      autosize: true,
      height: 300,
      margin: { l: 50, r: 20, t: 30, b: 60 },
      paper_bgcolor: colors.surface,
      plot_bgcolor: colors.surface,
      font: { color: colors.text, size: 15, family: "system-ui, -apple-system, sans-serif" },
      title: { text: title, font: { size: 16, color: colors.secondary } },
      xaxis: { gridcolor: colors.grid, color: colors.secondary },
      yaxis: { gridcolor: colors.grid, color: colors.secondary },
      showlegend: false,
    };

    return { data: [trace], layout: layoutSpec };
  }, [entries, colors, isDark, valueSuffix, title]);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none p-2 overflow-hidden" style={{ backgroundColor: colors.surface }}>
      <Plot data={data} layout={layout} style={{ width: "100%" }} config={{ responsive: true, displaylogo: false }} />
    </div>
  );
}
