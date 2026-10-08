"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import ConfigPanel from "@/components/ConfigPanel";
import { formatSpan } from "@/lib/format";
import { familyLabel } from "@/lib/models";
import { getDataset, type Dataset } from "@/lib/datasets";
import ModelComparisonChart from "@/components/ModelComparisonChart";
import EfficiencyBarChart from "@/components/EfficiencyBarChart";
import { deleteComparison, getComparisonView, type ComparisonView } from "@/lib/compare";
import { ApiError } from "@/lib/api";
import { getExperimentSeries, type SeriesData } from "@/lib/experiments";

const METRIC_COLUMNS = ["MSE", "MAE", "RMSE", "MASE", "sMAPE"] as const;

export default function ComparisonViewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}>
      <ComparisonViewContent />
    </Suspense>
  );
}

function ComparisonViewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const datasetId = Number(params.get("dataset_id"));
  const testPeriods = Number(params.get("test_periods"));
  const inputPeriods = Number(params.get("input_periods"));
  const columnsKey = JSON.stringify(params.getAll("columns"));  // stable dep; [] = all columns

  const [view, setView] = useState<ComparisonView | null>(null);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [seriesByExperimentId, setSeriesByExperimentId] = useState<Record<number, SeriesData>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!datasetId || !testPeriods || !inputPeriods) return;

    function load() {
      const columns: string[] = JSON.parse(columnsKey);
      getComparisonView(datasetId, testPeriods, inputPeriods, columns.length ? columns : null)
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
  }, [datasetId, testPeriods, inputPeriods, columnsKey]);

  useEffect(() => {
    if (!datasetId) return;
    getDataset(datasetId).then(setDataset).catch(() => {});
  }, [datasetId]);

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

  const isLive = view.entries.some(
    (e) => e.experiment.status === "pending" || e.experiment.status === "running"
  );

  async function handleDelete() {
    if (!view) return;
    const confirmed = confirm(
      `Delete ${view.entries.length} experiments compared on "${view.dataset_name}"?\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      const columns: string[] = JSON.parse(columnsKey);
      await deleteComparison(datasetId, testPeriods, inputPeriods, columns.length ? columns : null);
      router.push("/compare");
    } catch (e) {
      setDeleting(false);
      setDeleteError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <Link href="/compare" className="mb-3 inline-block text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        &larr; Compare
      </Link>

      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{view.comparison_name ?? view.dataset_name}</h1>
        <button
          onClick={handleDelete}
          disabled={deleting || isLive}
          title={isLive ? "Cannot delete while experiments are pending or running" : undefined}
          className="rounded-md border border-red-600 text-red-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting..." : "Delete comparison"}
        </button>
      </div>
      {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
      <ConfigPanel
        groups={[
          {
            title: "Data",
            tone: "sky",
            items: [
              { label: "Dataset", value: view.dataset_name },
              {
                label: "Columns",
                value: dataset
                  ? `${view.selected_columns?.length ?? dataset.selected_columns.length} of ${dataset.selected_columns.length}`
                  : `${view.selected_columns?.length ?? "all"}`,
              },
              { label: "Period length", value: formatSpan(view.period_length, dataset?.frequency) },
            ],
          },
          {
            title: "Split",
            tone: "violet",
            items: [
              {
                label: "Test window",
                value: `${formatSpan(view.test_periods * view.period_length, dataset?.frequency)} · ${view.test_periods} periods`,
              },
              { label: "Input window", value: `${formatSpan(view.seq_len, dataset?.frequency)} · ${view.input_periods} periods` },
              { label: "Forecast window", value: `${formatSpan(view.pred_len, dataset?.frequency)} · ${view.test_periods - view.input_periods} periods` },
            ],
          },
          {
            title: "Models",
            tone: "amber",
            items: [{ label: "Compared", value: String(view.entries.length) }],
            chips: view.entries.map((e) => ({ label: e.model_name, value: familyLabel(e.model_family) })),
          },
        ]}
      />

      {view.dataset_slug === "weather" && (
        <p className="mb-6 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-300">
          This dataset refreshes live, so experiments created on different dates may reflect
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
      <div className="mb-8 overflow-x-auto rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none">
        <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-800">
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
          <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-900">
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
