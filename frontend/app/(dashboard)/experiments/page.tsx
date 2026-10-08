"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import FactBox from "@/components/FactBox";
import StatusBadge from "@/components/StatusBadge";
import ViewToggle from "@/components/ViewToggle";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listExperiments, type Experiment, type ExperimentStatus } from "@/lib/experiments";
import { getModelColor } from "@/lib/modelColors";
import { familyLabel, listModels, type ForecastingModel } from "@/lib/models";
import { useIsDark } from "@/lib/theme";
import { useViewMode } from "@/lib/viewMode";

type Filter = "all" | ExperimentStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const seconds = Math.max(0, ((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 1000);
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.floor(seconds / 60)}m ${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

export default function ExperimentsPage() {
  const router = useRouter();
  const isDark = useIsDark();
  const [view, setView] = useViewMode("experiments-view");
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
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

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: experiments?.length ?? 0 };
    for (const e of experiments ?? []) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [experiments]);

  const shown = useMemo(
    () => [...(experiments ?? [])].filter((e) => filter === "all" || e.status === filter).sort((a, b) => b.id - a.id),
    [experiments, filter]
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Experiments</h1>
        <Link href="/experiments/new" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
          New experiment
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {experiments === null && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}

      {experiments && experiments.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.filter((f) => f.value === "all" || (counts[f.value] ?? 0) > 0).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                  filter === f.value
                    ? "border-transparent bg-foreground text-background"
                    : "border-black/15 bg-white text-zinc-700 hover:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white/30"
                }`}
              >
                {f.label} <span className="opacity-70">{counts[f.value] ?? 0}</span>
              </button>
            ))}
          </div>
          <ViewToggle mode={view} onChange={setView} />
        </div>
      )}

      {experiments && experiments.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/20 bg-white p-10 text-center dark:border-white/20 dark:bg-zinc-900">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No experiments yet</p>
          <Link href="/experiments/new" className="mt-5 inline-block rounded-md bg-foreground px-5 py-2.5 text-base font-medium text-background">
            Run an experiment
          </Link>
        </div>
      )}

      {view === "list" && shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-black/15 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:shadow-none">
          <table className="min-w-full divide-y divide-black/10 text-base dark:divide-white/10">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["Experiment", "Model", "Dataset", "Split", "Status", "Duration", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {shown.map((e) => {
                const model = modelById.get(e.model_id);
                const dataset = datasetById.get(e.dataset_id);
                const color = model ? getModelColor(model.slug, isDark) : null;
                return (
                  <tr
                    key={e.id}
                    onClick={(ev) => {
                      // The name link handles its own clicks (new tab, middle click); the rest of the row navigates too.
                      if ((ev.target as HTMLElement).closest("a")) return;
                      router.push(`/experiments/${e.id}`);
                    }}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/experiments/${e.id}`} className="font-medium text-zinc-900 dark:text-zinc-50">
                        {e.experiment_name}
                      </Link>
                      {e.task_type === "anomaly_detection" && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">anomaly</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {model && color ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100"
                          style={{ backgroundColor: `${color}26`, borderColor: `${color}80` }}
                        >
                          <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          {model.name}
                        </span>
                      ) : (
                        <span className="text-zinc-500">#{e.model_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{dataset?.name ?? `#${e.dataset_id}`}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {e.input_periods}p in &rarr; {e.output_periods}p out
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                      {e.status === "pending" ? "—" : formatDuration(e.started_at, e.completed_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "cards" && (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((e) => {
          const model = modelById.get(e.model_id);
          const dataset = datasetById.get(e.dataset_id);
          const color = model ? getModelColor(model.slug, isDark) : null;
          return (
            <Link
              key={e.id}
              href={`/experiments/${e.id}`}
              className="flex flex-col rounded-lg border border-black/15 bg-white p-5 shadow-sm transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:shadow-none dark:hover:border-white/30"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {e.experiment_name}
                  {e.task_type === "anomaly_detection" && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 align-middle text-sm font-normal text-red-700 dark:bg-red-950 dark:text-red-300">
                      anomaly
                    </span>
                  )}
                </h2>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-0.5 text-base text-zinc-500 dark:text-zinc-400">{dataset?.name ?? `Dataset #${e.dataset_id}`}</p>

              {model && color && (
                <span
                  className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100"
                  style={{ backgroundColor: `${color}26`, borderColor: `${color}80` }}
                >
                  <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  {model.name}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">{familyLabel(model.family)}</span>
                </span>
              )}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <FactBox label="Input" value={`${e.input_periods}p`} tone="violet" />
                <FactBox label="Forecast" value={`${e.output_periods}p`} tone="emerald" />
                <FactBox label="Duration" value={e.status === "pending" ? "—" : formatDuration(e.started_at, e.completed_at)} tone="amber" />
              </div>

              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{new Date(e.created_at).toLocaleString()}</p>
            </Link>
          );
        })}
      </div>
      )}

      {experiments && experiments.length > 0 && shown.length === 0 && (
        <p className="text-base text-zinc-500 dark:text-zinc-400">No experiments with this status.</p>
      )}
    </div>
  );
}
