"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormSection, inputClass } from "@/components/form";
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
      <div>
        <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Select forecast channels</h1>

        <FormSection title={`${uploaded.name} (${uploaded.rows.toLocaleString()} rows)`}>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Pick the numeric columns to forecast. Non-numeric columns, such as a timestamp, can&apos;t be selected.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uploaded.available_columns.map((c) => {
              const isNumeric = /^(int|uint|float|complex)/.test(c.dtype);
              const checked = selectedColumns.includes(c.name);
              return (
                <label
                  key={c.name}
                  className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-base ${
                    isNumeric ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                  } ${
                    checked
                      ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
                      : "border-black/10 dark:border-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!isNumeric}
                    checked={checked}
                    onChange={() => toggleColumn(c.name)}
                    className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-50" title={c.name}>
                    {c.name}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{c.dtype}</span>
                </label>
              );
            })}
          </div>
        </FormSection>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleConfirmColumns}
            disabled={saving || selectedColumns.length === 0}
            className="rounded-md bg-foreground px-6 py-3 text-base font-medium text-background disabled:opacity-50"
          >
            {saving ? "Saving..." : `Confirm ${selectedColumns.length} channel${selectedColumns.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Upload dataset</h1>
      <form onSubmit={handleUpload} className="space-y-6">
        <FormSection title="Dataset file">
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Name">
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>

            <Field label="Frequency">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputClass}>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="10min">10-minute</option>
              </select>
            </Field>

            <Field label="Period length (timesteps per cycle, e.g. 24 for hourly data)">
              <input
                type="number" min={1} required value={periodLength}
                onChange={(e) => setPeriodLength(Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <Field label="CSV or Excel file">
              <input
                type="file" required accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className={`${inputClass} cursor-pointer file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 dark:file:bg-zinc-800 dark:file:text-zinc-100`}
              />
            </Field>
          </div>
        </FormSection>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-6 py-3 text-base font-medium text-background disabled:opacity-50"
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
