"use client";

import { useEffect, useState } from "react";
import { listDatasets, type Dataset, type DatasetVisibility } from "@/lib/datasets";
import { refreshSystemDataset, updateDatasetVisibility, deleteDataset } from "@/lib/admin";
import { ApiError } from "@/lib/api";

const VISIBILITY_OPTIONS: DatasetVisibility[] = ["private", "public"];

export default function AdminDatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    listDatasets()
      .then(setDatasets)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load datasets"));
  }

  useEffect(load, []);

  function handleApiError(e: unknown, fallback: string) {
    if (e instanceof ApiError && e.status === 403) {
      setError("You don't have admin privileges.");
    } else {
      setError(e instanceof Error ? e.message : fallback);
    }
  }

  async function handleRefresh(slug: string) {
    setError(null);
    setRefreshing(slug);
    try {
      await refreshSystemDataset(slug);
      load();
    } catch (e) {
      handleApiError(e, "Refresh failed");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleVisibilityChange(id: number, visibility: DatasetVisibility) {
    setError(null);
    setBusyId(id);
    try {
      await updateDatasetVisibility(id, visibility);
      load();
    } catch (e) {
      handleApiError(e, "Visibility update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete dataset "${name}"? This cannot be undone.`)) return;
    setError(null);
    setBusyId(id);
    try {
      await deleteDataset(id);
      load();
    } catch (e) {
      handleApiError(e, "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  const systemDatasets = datasets?.filter((d) => d.source === "system") ?? [];
  const userDatasets = datasets?.filter((d) => d.source === "user") ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Datasets</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {datasets === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {datasets && (
        <>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-3">System datasets</h2>
          <div className="space-y-3 mb-8">
            {systemDatasets.map((d) => (
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

          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-3">User datasets</h2>
          <div className="space-y-3">
            {userDatasets.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No user-uploaded datasets.</p>
            )}
            {userDatasets.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/10 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{d.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    owner #{d.owner_id} &middot; {d.rows.toLocaleString()} rows &middot; {d.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={d.visibility}
                    disabled={busyId === d.id}
                    onChange={(e) => handleVisibilityChange(d.id, e.target.value as DatasetVisibility)}
                    className="rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 px-2 py-1.5 text-sm"
                  >
                    {VISIBILITY_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(d.id, d.name)}
                    disabled={busyId === d.id}
                    className="rounded-md border border-red-600 text-red-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
