"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteDataset, previewDataset, type DatasetPreview } from "@/lib/datasets";
import { fetchCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DatasetPreview | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    previewDataset(Number(params.id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dataset"));
    fetchCurrentUser().then(setUser).catch(() => {});
  }, [params.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  const { dataset, preview_rows } = data;
  const columns = preview_rows.length > 0 ? Object.keys(preview_rows[0]) : dataset.selected_columns;
  const isOwner = user !== null && dataset.owner_id === user.id;

  async function handleDelete() {
    const confirmed = confirm(
      `Delete "${dataset.name}"? This permanently removes the dataset and its uploaded file. ` +
      "This cannot be undone. If any experiments still use this dataset, deletion will be blocked " +
      "until those experiments are deleted first."
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDataset(dataset.id);
      router.push("/datasets");
    } catch (e) {
      setDeleting(false);
      if (e instanceof ApiError) {
        setDeleteError(e.message);
      } else {
        setDeleteError(e instanceof Error ? e.message : "Delete failed");
      }
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{dataset.name}</h1>
        {isOwner && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-600 text-red-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete dataset"}
          </button>
        )}
      </div>
      {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}
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
