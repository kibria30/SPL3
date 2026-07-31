"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import ModelComparisonChart from "@/components/ModelComparisonChart";
import EfficiencyBarChart from "@/components/EfficiencyBarChart";
import { getComparisonView, type ComparisonView } from "@/lib/compare";
import { getExperimentSeries, type SeriesData } from "@/lib/experiments";

const METRIC_COLUMNS = ["R2", "MSE", "MAE", "RMSE", "MASE", "sMAPE"] as const;

export default function ComparisonViewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}>
      <ComparisonViewContent />
    </Suspense>
  );
}

function ComparisonViewContent() {
  const params = useSearchParams();
  const datasetId = Number(params.get("dataset_id"));
  const testPeriods = Number(params.get("test_periods"));
  const inputPeriods = Number(params.get("input_periods"));

  const [view, setView] = useState<ComparisonView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seriesByExperimentId, setSeriesByExperimentId] = useState<Record<number, SeriesData>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!datasetId || !testPeriods || !inputPeriods) return;

    function load() {
      getComparisonView(datasetId, testPeriods, inputPeriods)
        .then((v) => {
          setView(v);
          const anyActive = v.entries.some(
            (e) => e.experiment.status === "pending" || e.experiment.status === "running"
          );
          if (!anyActive && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load comparison"));
    }
    load();
    intervalRef.current = setInterval(load, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [datasetId, testPeriods, inputPeriods]);

  // Fetch each completed entry's actual/predicted series once, as they become available.
  useEffect(() => {
    if (!view) return;
    const missing = view.entries.filter(
      (e) => e.experiment.status === "completed" && seriesByExperimentId[e.experiment.id] === undefined
    );
    if (missing.length === 0) return;
    Promise.all(missing.map((e) => getExperimentSeries(e.experiment.id).then((s) => [e.experiment.id, s] as const)))
      .then((pairs) => {
        setSeriesByExperimentId((prev) => {
          const next = { ...prev };
          for (const [id, s] of pairs) next[id] = s;
          return next;
        });
      })
      .catch(() => {
        // Non-fatal -- the leaderboard/metrics still work without the chart.
      });
  }, [view, seriesByExperimentId]);

  const sortedEntries = useMemo(() => {
    if (!view) return [];
    return [...view.entries].sort((a, b) => {
      const aMse = a.result?.metrics_avg.MSE;
      const bMse = b.result?.metrics_avg.MSE;
      if (aMse === undefined && bMse === undefined) {
        return new Date(a.experiment.created_at).getTime() - new Date(b.experiment.created_at).getTime();
      }
      if (aMse === undefined) return 1;
      if (bMse === undefined) return -1;
      return aMse - bMse;
    });
  }, [view]);

  const chartData = useMemo(() => {
    if (!view) return null;
    const withSeries = view.entries.filter((e) => seriesByExperimentId[e.experiment.id] !== undefined);
    if (withSeries.length === 0) return null;
    const featureNames = seriesByExperimentId[withSeries[0].experiment.id].feature_names;
    const actual = seriesByExperimentId[withSeries[0].experiment.id].actual;
    const entries = withSeries.map((e) => ({
      modelSlug: e.model_slug,
      modelName: e.model_name,
      predicted: seriesByExperimentId[e.experiment.id].predicted,
    }));
    return { featureNames, actual, entries };
  }, [view, seriesByExperimentId]);

  const efficiencyTimeEntries = useMemo(
    () =>
      (view?.entries ?? [])
        .filter((e) => e.result !== null)
        .map((e) => ({ modelSlug: e.model_slug, modelName: e.model_name, value: e.result!.training_time_seconds })),
    [view]
  );

  const efficiencyParamsEntries = useMemo(
    () =>
      (view?.entries ?? [])
        .filter((e) => e.result !== null && e.result.num_parameters !== null)
        .map((e) => ({ modelSlug: e.model_slug, modelName: e.model_name, value: e.result!.num_parameters as number })),
    [view]
  );

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!view) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{view.dataset_name}</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        input {view.input_periods}p / output {view.test_periods - view.input_periods}p (test {view.test_periods}p)
        &middot; seq_len {view.seq_len} &middot; pred_len {view.pred_len} &middot; {view.entries.length} models
      </p>

      {view.dataset_slug === "weather" && (
        <p className="mb-6 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          This dataset refreshes live &mdash; experiments created on different dates may reflect
          slightly different historical windows. Check each row&apos;s created time if results look
          surprising.
        </p>
      )}

      {chartData && (
        <>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Actual vs. predicted</h2>
          <div className="mb-8">
            <ModelComparisonChart
              featureNames={chartData.featureNames}
              actual={chartData.actual}
              entries={chartData.entries}
            />
          </div>
        </>
      )}

      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Leaderboard</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Model</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Status</th>
              {METRIC_COLUMNS.map((m) => (
                <th key={m} className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-300">
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-300">Time (s)</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-300">Params</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-300">val_ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
            {sortedEntries.map((e) => (
              <tr key={e.experiment.id}>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">{e.model_name}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={e.experiment.status} />
                </td>
                {METRIC_COLUMNS.map((m) => (
                  <td key={m} className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">
                    {e.result?.metrics_avg[m] !== undefined ? e.result!.metrics_avg[m].toFixed(3) : "—"}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">
                  {e.result ? e.result.training_time_seconds.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">
                  {e.result?.num_parameters?.toLocaleString() ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{e.experiment.val_ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(efficiencyTimeEntries.length > 0 || efficiencyParamsEntries.length > 0) && (
        <>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Efficiency</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <EfficiencyBarChart title="Training time (s)" entries={efficiencyTimeEntries} />
            <EfficiencyBarChart title="Parameters" entries={efficiencyParamsEntries} />
          </div>
        </>
      )}
    </div>
  );
}
