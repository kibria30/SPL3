"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listExperiments, type Experiment } from "@/lib/experiments";
import StatusBadge from "@/components/StatusBadge";

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Split</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Status</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
              {experiments.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2">
                    <Link href={`/experiments/${e.id}`} className="font-medium text-zinc-900 dark:text-zinc-50 underline">
                      {e.experiment_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    input {e.input_periods}p / output {e.output_periods}p (test {e.test_periods}p)
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
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
