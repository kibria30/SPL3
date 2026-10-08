"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { comparisonQuery, deleteComparison, getComparisonGroups, type ComparisonGroup } from "@/lib/compare";
import { listModels, type ForecastingModel } from "@/lib/models";
import { getModelColor } from "@/lib/modelColors";
import { useIsDark } from "@/lib/theme";
import FactBox from "@/components/FactBox";

export default function ComparePage() {
  const [groups, setGroups] = useState<ComparisonGroup[] | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isDark = useIsDark();
  const nameBySlug = useMemo(() => new Map(models.map((m) => [m.slug, m.name])), [models]);

  async function handleDelete(g: ComparisonGroup) {
    const confirmed = confirm(
      `Delete ${g.experiment_count} experiments compared on "${g.dataset_name}"?\nThis cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await deleteComparison(g.dataset_id, g.test_periods, g.input_periods, g.selected_columns);
      setGroups((prev) => prev && prev.filter((x) => x !== g));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  useEffect(() => {
    listModels().then(setModels).catch(() => {});
    getComparisonGroups()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load comparisons"));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compare</h1>
        <Link href="/compare/new" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
          New comparison
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {groups === null && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}

      {groups && groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/20 bg-white p-10 text-center dark:border-white/20 dark:bg-zinc-900">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No comparisons yet</p>
          <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">Run two or more models on the same dataset and split.</p>
          <Link href="/compare/new" className="mt-5 inline-block rounded-md bg-foreground px-5 py-2.5 text-base font-medium text-background">
            Start a comparison
          </Link>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const pct = g.experiment_count > 0 ? Math.round((100 * g.completed_count) / g.experiment_count) : 0;
            const done = g.completed_count === g.experiment_count;
            return (
              <Link
                key={`${g.dataset_id}-${g.test_periods}-${g.input_periods}-${g.period_length}-${g.selected_columns?.join("|") ?? "all"}`}
                href={`/compare/view?${comparisonQuery(g.dataset_id, g.test_periods, g.input_periods, g.selected_columns)}`}
                className="flex flex-col rounded-lg border border-black/15 bg-white p-5 shadow-sm transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:shadow-none dark:hover:border-white/30"
              >
                <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {g.comparison_name ?? g.dataset_name}
                </h2>
                <p className="mt-0.5 text-base text-zinc-500 dark:text-zinc-400">
                  {g.comparison_name ? `${g.dataset_name} · ` : ""}
                  {g.selected_columns ? `${g.selected_columns.length} columns` : "all columns"}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <FactBox label="Models" value={String(g.model_slugs.length)} tone="amber" />
                  <FactBox label="Input" value={`${g.input_periods}p`} tone="violet" />
                  <FactBox label="Forecast" value={`${g.test_periods - g.input_periods}p`} tone="emerald" />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {g.model_slugs.map((slug) => (
                    <span
                      key={slug}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-100"
                      style={{
                        backgroundColor: `${getModelColor(slug, isDark)}26`,
                        borderColor: `${getModelColor(slug, isDark)}80`,
                      }}
                    >
                      <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: getModelColor(slug, isDark) }} />
                      {nameBySlug.get(slug) ?? slug}
                    </span>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={done ? "text-green-700 dark:text-green-400" : "text-zinc-600 dark:text-zinc-400"}>
                      {done ? "Completed" : `${g.completed_count} of ${g.experiment_count} done`}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">{new Date(g.latest_created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div className={`h-full rounded-full ${done ? "bg-green-600" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(g);
                    }}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
