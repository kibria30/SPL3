"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDataset, updateDatasetColumns, type Dataset } from "@/lib/datasets";

export default function UploadDatasetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("hourly");
  const [periodLength, setPeriodLength] = useState(24);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [uploaded, setUploaded] = useState<Dataset | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const dataset = await uploadDataset(name, frequency, periodLength, file);
      setUploaded(dataset);
      // Default-select every numeric column so the user just has to deselect what they don't want.
      setSelectedColumns(
        dataset.available_columns.filter((c) => /^(int|uint|float|complex)/.test(c.dtype)).map((c) => c.name)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  function toggleColumn(name: string) {
    setSelectedColumns((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  async function handleConfirmColumns() {
    if (!uploaded) return;
    setError(null);
    setSaving(true);
    try {
      await updateDatasetColumns(uploaded.id, { selected_columns: selectedColumns });
      router.push(`/datasets/${uploaded.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save column selection");
    } finally {
      setSaving(false);
    }
  }

  if (uploaded) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          Select forecast channels
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          {uploaded.name} &mdash; {uploaded.rows.toLocaleString()} rows. Pick the numeric columns to
          forecast. Non-numeric columns (e.g. a timestamp) can&apos;t be selected.
        </p>

        <div className="space-y-2 mb-6">
          {uploaded.available_columns.map((c) => {
            const isNumeric = /^(int|uint|float|complex)/.test(c.dtype);
            return (
              <label
                key={c.name}
                className={`flex items-center gap-3 rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm ${
                  isNumeric ? "" : "opacity-40"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!isNumeric}
                  checked={selectedColumns.includes(c.name)}
                  onChange={() => toggleColumn(c.name)}
                />
                <span className="text-zinc-900 dark:text-zinc-50">{c.name}</span>
                <span className="ml-auto text-zinc-500 dark:text-zinc-400">{c.dtype}</span>
              </label>
            );
          })}
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleConfirmColumns}
          disabled={saving || selectedColumns.length === 0}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : `Confirm ${selectedColumns.length} channel(s)`}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Upload dataset</h1>
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Name
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="10min">10-minute</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Period length (timesteps per natural cycle, e.g. 24 for hourly data)
          </label>
          <input
            type="number"
            min={1}
            required
            value={periodLength}
            onChange={(e) => setPeriodLength(Number(e.target.value))}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            CSV or Excel file
          </label>
          <input
            type="file"
            required
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-900 dark:text-zinc-50"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  );
}
