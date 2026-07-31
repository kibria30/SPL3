"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { previewDataset, type DatasetPreview } from "@/lib/datasets";

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DatasetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previewDataset(Number(params.id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dataset"));
  }, [params.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  const { dataset, preview_rows } = data;
  const columns = preview_rows.length > 0 ? Object.keys(preview_rows[0]) : dataset.selected_columns;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{dataset.name}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        {dataset.source} / {dataset.visibility} &middot; {dataset.frequency} &middot;{" "}
        {dataset.rows.toLocaleString()} rows &middot; period length {dataset.period_length} &middot;{" "}
        {dataset.selected_columns.length} channel(s)
      </p>

      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Preview (first 10 rows)</h2>
      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
            {preview_rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                    {String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
