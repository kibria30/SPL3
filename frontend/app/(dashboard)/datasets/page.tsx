"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDatasets, type Dataset } from "@/lib/datasets";

const STATUS_STYLES: Record<Dataset["status"], string> = {
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  pending_column_selection: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDatasets()
      .then(setDatasets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load datasets"));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Datasets</h1>
        <Link
          href="/datasets/upload"
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
        >
          Upload dataset
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {datasets === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {datasets && (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Source</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Frequency</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Rows</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
              {datasets.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2">
                    <Link href={`/datasets/${d.id}`} className="font-medium text-zinc-900 dark:text-zinc-50 underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                    {d.source} / {d.visibility}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{d.frequency}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{d.rows.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {datasets.length === 0 && (
            <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No datasets yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
