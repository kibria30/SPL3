"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getComparisonGroups, type ComparisonGroup } from "@/lib/compare";

export default function ComparePage() {
  const [groups, setGroups] = useState<ComparisonGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getComparisonGroups()
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load comparisons"));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compare</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Models compared on the same dataset with the same split config.
          </p>
        </div>
        <Link
          href="/compare/new"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          New comparison
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {groups === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {groups && groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 p-10 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No comparable groups yet. Run 2+ models against the same dataset with the same split to
            see them compared here &mdash; either by starting a new comparison, or by running
            individual experiments that happen to share a dataset and split.
          </p>
          <Link href="/compare/new" className="mt-4 inline-block text-sm font-medium underline">
            Start a new comparison
          </Link>
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Link
              key={`${g.dataset_id}-${g.test_periods}-${g.input_periods}-${g.period_length}`}
              href={`/compare/view?dataset_id=${g.dataset_id}&test_periods=${g.test_periods}&input_periods=${g.input_periods}`}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 hover:border-black/20 dark:hover:border-white/20"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{g.dataset_name}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                input {g.input_periods}p / test {g.test_periods}p &middot; {g.model_slugs.length} models
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {g.model_slugs.map((slug) => (
                  <span
                    key={slug}
                    className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-300"
                  >
                    {slug}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                {g.completed_count}/{g.experiment_count} completed &middot; last run{" "}
                {new Date(g.latest_created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
