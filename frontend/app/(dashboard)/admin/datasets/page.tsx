"use client";

import { useEffect, useState } from "react";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { refreshSystemDataset } from "@/lib/admin";
import { ApiError } from "@/lib/api";

export default function AdminDatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  function load() {
    listDatasets()
      .then((all) => setDatasets(all.filter((d) => d.source === "system")))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load datasets"));
  }

  useEffect(load, []);

  async function handleRefresh(slug: string) {
    setError(null);
    setRefreshing(slug);
    try {
      await refreshSystemDataset(slug);
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError("You don't have admin privileges.");
      } else {
        setError(e instanceof Error ? e.message : "Refresh failed");
      }
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">System datasets</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {datasets === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {datasets && (
        <div className="space-y-3">
          {datasets.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/10 px-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{d.name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {d.rows.toLocaleString()} rows &middot; {d.frequency} &middot; {d.status}
                </p>
              </div>
              <button
                onClick={() => d.slug && handleRefresh(d.slug)}
                disabled={refreshing === d.slug}
                className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {refreshing === d.slug ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
