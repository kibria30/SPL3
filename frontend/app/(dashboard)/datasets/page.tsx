"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDatasets, type Dataset } from "@/lib/datasets";

const STATUS_STYLES: Record<Dataset["status"], string> = {
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  pending_column_selection: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATUS_LABELS: Record<Dataset["status"], string> = {
  ready: "Ready",
  pending_column_selection: "Select columns",
  error: "Error",
};

const VISIBILITY_LABELS: Record<Dataset["visibility"], string> = { system: "System", private: "Private", public: "Public" };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function DatasetSection({ title, items }: { title: string; items: Dataset[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
        {title} <span className="text-zinc-500 dark:text-zinc-400">({items.length})</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((d) => (
          <Link
            key={d.id}
            href={`/datasets/${d.id}`}
            className="rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900 p-5 transition hover:border-black/30 dark:hover:border-white/30"
          >
            <h3 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{d.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                {VISIBILITY_LABELS[d.visibility]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_STYLES[d.status]}`}>
                {STATUS_LABELS[d.status]}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Fact label="Rows" value={d.rows.toLocaleString()} />
              <Fact label="Columns" value={String(d.selected_columns.length)} />
              <Fact label="Frequency" value={d.frequency} />
              <Fact label="Period" value={String(d.period_length)} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDatasets()
      .then(setDatasets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load datasets"));
  }, []);

  const system = datasets?.filter((d) => d.source === "system") ?? [];
  const mine = datasets?.filter((d) => d.source !== "system") ?? [];

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
      {datasets === null && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}

      {datasets && (
        <>
          <DatasetSection title="System datasets" items={system} />
          <DatasetSection title="Uploaded datasets" items={mine} />
          {datasets.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No datasets yet.</p>}
        </>
      )}
    </div>
  );
}
