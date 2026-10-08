"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import { deleteDataset, previewDataset, type DatasetPreview } from "@/lib/datasets";
import { fetchCurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

const ROW_OPTIONS = [10, 25, 50, 100, 250, 500, 1000];
const CARD = "rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900";

function fmt(value: number | null): string {
  if (value === null) return "—";
  return Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(Number(value.toPrecision(4)));
}

export default function DatasetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DatasetPreview | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState(10);
  const [fromEnd, setFromEnd] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    previewDataset(Number(params.id), rows, fromEnd)
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dataset"))
      .finally(() => setLoadingRows(false));
  }, [params.id, rows, fromEnd]);

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  const { dataset, preview_rows, total_rows, row_offset, column_stats } = data;
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
      setDeleteError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <Link href="/datasets" className="mb-3 inline-block text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        &larr; Datasets
      </Link>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{dataset.name}</h1>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-sm text-zinc-600 dark:text-zinc-300">
            {dataset.source === "system" ? "System" : dataset.visibility === "public" ? "Public" : "Private"}
          </span>
        </div>
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

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Rows" value={dataset.rows.toLocaleString()} />
        <StatCard label="Columns" value={dataset.selected_columns.length} />
        <StatCard label="Frequency" value={dataset.frequency} />
        <StatCard label="Period length" value={dataset.period_length} />
      </div>

      {column_stats.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Columns</h2>
          <div className={`overflow-x-auto ${CARD}`}>
            <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-800">
                <tr>
                  {["Column", "Missing", "Mean", "Std", "Min", "Max"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-300 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {column_stats.map((c) => (
                  <tr key={c.name}>
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">{c.name}</td>
                    <td className={`px-4 py-2 text-right ${c.missing > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-400"}`}>{c.missing}</td>
                    {[c.mean, c.std, c.min, c.max].map((v, i) => (
                      <td key={i} className="px-4 py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{fmt(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Data</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-black/15 dark:border-white/15">
              {([false, true] as const).map((end) => (
                <button
                  key={String(end)}
                  type="button"
                  onClick={() => { if (end !== fromEnd) { setLoadingRows(true); setFromEnd(end); } }}
                  className={`px-3 py-1.5 text-sm ${
                    fromEnd === end ? "bg-foreground text-background" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {end ? "Last rows" : "First rows"}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Rows
              <select
                value={rows}
                onChange={(e) => { setLoadingRows(true); setRows(Number(e.target.value)); }}
                className="rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-50"
              >
                {ROW_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          Rows {(row_offset + 1).toLocaleString()}&ndash;{(row_offset + preview_rows.length).toLocaleString()} of{" "}
          {total_rows.toLocaleString()}
          {loadingRows && " · loading…"}
        </p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <div className={`max-h-[32rem] overflow-auto ${CARD}`}>
          <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400">#</th>
                {columns.map((c) => (
                  <th key={c} className="px-3 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-300">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {preview_rows.map((row, i) => (
                <tr key={i} className="odd:bg-zinc-50/60 dark:odd:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400 dark:text-zinc-500">{row_offset + i + 1}</td>
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 tabular-nums text-zinc-700 dark:text-zinc-300">{String(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
