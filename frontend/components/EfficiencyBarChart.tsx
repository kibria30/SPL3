"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Data, Layout } from "plotly.js";
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
      font: { color: colors.text, family: "system-ui, -apple-system, sans-serif" },
      title: { text: title, font: { size: 13, color: colors.secondary } },
      xaxis: { gridcolor: colors.grid, color: colors.secondary },
      yaxis: { gridcolor: colors.grid, color: colors.secondary },
      showlegend: false,
    };

    return { data: [trace], layout: layoutSpec };
  }, [entries, colors, isDark, valueSuffix, title]);

  if (entries.length === 0) return null;

  return <Plot data={data} layout={layout} style={{ width: "100%" }} config={{ responsive: true, displaylogo: false }} />;
}
