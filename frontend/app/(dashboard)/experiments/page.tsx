"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listExperiments, type Experiment } from "@/lib/experiments";
import StatusBadge from "@/components/StatusBadge";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { formatSpan } from "@/lib/format";
import { listModels, type ForecastingModel } from "@/lib/models";

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const seconds = Math.max(0, ((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 1000);
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

export default function ExperimentsPage() {
  const router = useRouter();
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listModels().then(setModels).catch(() => {});
    listDatasets().then(setDatasets).catch(() => {});
  }, []);

  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const datasetById = useMemo(() => new Map(datasets.map((d) => [d.id, d])), [datasets]);

  useEffect(() => {
    function load() {
      listExperiments()
        .then(setExperiments)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load experiments"));
    }
    load();
    // Poll while anything is still pending/running -- matches the plan's "frontend polls every
    // ~2s until status is terminal" approach.
    intervalRef.current = setInterval(load, 2500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Experiments</h1>
        <Link
          href="/experiments/new"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          New experiment
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {experiments === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {experiments && (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["Experiment", "Model", "Dataset", "Split", "Status", "Duration", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
              {[...experiments].sort((x, y) => y.id - x.id).map((e) => {
                const model = modelById.get(e.model_id);
                const dataset = datasetById.get(e.dataset_id);
                return (
                  <tr
                    key={e.id}
                    onClick={(ev) => {
                      // The name link handles its own clicks (new tab, middle click); the rest of the row navigates too.
                      if ((ev.target as HTMLElement).closest("a")) return;
                      router.push(`/experiments/${e.id}`);
                    }}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="p-0">
                      <Link
                        href={`/experiments/${e.id}`}
                        className="block px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50"
                      >
                        {e.experiment_name}
                        {e.task_type === "anomaly_detection" && (
                          <span className="ml-2 rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-sm font-normal text-red-700 dark:text-red-300">
                            anomaly
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{model?.name ?? `#${e.model_id}`}</p>
                      {model && (
                        <span className="mt-0.5 inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                          {model.family}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{dataset?.name ?? `#${e.dataset_id}`}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <p>{e.input_periods}p in &rarr; {e.output_periods}p out</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        forecast {formatSpan(e.pred_len, dataset?.frequency)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {e.status === "pending" ? "—" : formatDuration(e.started_at, e.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {experiments.length === 0 && (
            <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No experiments yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
