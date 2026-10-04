"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listModels, type ForecastingModel } from "@/lib/models";
import { getSplitPreview, type SplitPreview } from "@/lib/experiments";
import { comparisonQuery, createComparisonBatch } from "@/lib/compare";

export default function NewComparisonPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ForecastingModel[]>([]);

  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [namePrefix, setNamePrefix] = useState("");
  const [testPeriods, setTestPeriods] = useState(10);
  const [inputPeriods, setInputPeriods] = useState(6);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);  // unticked; empty = all columns
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());

  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listDatasets().then((all) => setDatasets(all.filter((d) => d.status === "ready")));
    listModels().then(setModels);
  }, []);

  useEffect(() => {
    if (datasetId === null || inputPeriods >= testPeriods) {
      setSplitPreview(null);
      return;
    }
    setPreviewError(null);
    getSplitPreview(datasetId, testPeriods, inputPeriods)
      .then(setSplitPreview)
      .catch((e) => {
        setSplitPreview(null);
        setPreviewError(e instanceof Error ? e.message : "Could not compute split preview");
      });
  }, [datasetId, testPeriods, inputPeriods]);

  // Drop any selected model that's no longer eligible when the split changes.
  useEffect(() => {
    if (!splitPreview) return;
    setSelectedSlugs((prev) => {
      const next = new Set([...prev].filter((s) => splitPreview.eligible_model_slugs.includes(s)));
      return next.size === prev.size ? prev : next;
    });
  }, [splitPreview]);

  const selectedDataset = useMemo(() => datasets.find((d) => d.id === datasetId) ?? null, [datasets, datasetId]);

  const selectedColumns = useMemo(
    () => (selectedDataset?.selected_columns ?? []).filter((c) => !excludedColumns.includes(c)),
    [selectedDataset, excludedColumns]
  );

  function toggleColumn(name: string) {
    setExcludedColumns((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  function toggleModel(slug: string) {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectAllEligible() {
    if (!splitPreview) return;
    setSelectedSlugs(new Set(splitPreview.eligible_model_slugs));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!datasetId || selectedSlugs.size === 0 || selectedColumns.length === 0) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createComparisonBatch({
        dataset_id: datasetId,
        experiment_name_prefix: namePrefix,
        test_periods: testPeriods,
        input_periods: inputPeriods,
        model_slugs: [...selectedSlugs],
        selected_columns: selectedColumns,
      });
      // Runs in the background (see ExperimentTracker) -- send the user straight to the
      // comparison view rather than making them wait here.
// Every column checked == "all columns" (the backend stores that as null), so omit the param.
      const allColumns = selectedColumns.length === selectedDataset?.selected_columns.length;
      router.push(`/compare/view?${comparisonQuery(datasetId, testPeriods, inputPeriods, allColumns ? null : selectedColumns)}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create comparison");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">New comparison</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Comparison name
          </label>
          <input
            required
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            placeholder="e.g. ILI baseline sweep"
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dataset</label>
          <select
            required
            value={datasetId ?? ""}
            onChange={(e) => {
              setDatasetId(Number(e.target.value));
              setExcludedColumns([]);  // every column starts checked
            }}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              Select a dataset
            </option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.rows.toLocaleString()} rows, period {d.period_length})
              </option>
            ))}
          </select>
        </div>

        {selectedDataset && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Columns ({selectedColumns.length}/{selectedDataset.selected_columns.length})
              </label>
              <div className="flex gap-3 text-xs text-zinc-500">
                <button type="button" onClick={() => setExcludedColumns([])}>
                  Select all
                </button>
                <button type="button" onClick={() => setExcludedColumns(selectedDataset.selected_columns)}>
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-black/10 dark:border-white/15 p-3 sm:grid-cols-3">
              {selectedDataset.selected_columns.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(name)}
                    onChange={() => toggleColumn(name)}
                  />
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                </label>
              ))}
            </div>
            {selectedColumns.length === 0 && (
              <p className="mt-1 text-sm text-red-600">Select at least one column.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Test window (periods): {testPeriods}
            </label>
            <input
              type="range"
              min={8}
              max={25}
              value={testPeriods}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTestPeriods(v);
                if (inputPeriods >= v) setInputPeriods(v - 1);
              }}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Input window (periods): {inputPeriods}
            </label>
            <input
              type="range"
              min={5}
              max={Math.min(20, testPeriods - 1)}
              value={inputPeriods}
              onChange={(e) => setInputPeriods(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {previewError && <p className="text-sm text-red-600">{previewError}</p>}

        {splitPreview && (
          <div className="rounded-md border border-black/10 dark:border-white/10 p-4 text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Output window: {testPeriods - inputPeriods} periods &middot; seq_len {splitPreview.seq_len} &middot;
              pred_len {splitPreview.pred_len}
            </p>
            <p>
              Train data: {splitPreview.has_train_data ? `${splitPreview.train_len} pts` : "none"} &middot;
              {" "}DL models {splitPreview.dl_eligible ? "eligible" : "NOT eligible"}
            </p>
            {splitPreview.ineligible_reason && (
              <p className="mt-1 text-amber-600 dark:text-amber-400">{splitPreview.ineligible_reason}</p>
            )}
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Models</label>
            {splitPreview && (
              <button
                type="button"
                onClick={selectAllEligible}
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400 underline"
              >
                Select all eligible
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {models.map((m) => {
              const eligible = splitPreview?.eligible_model_slugs.includes(m.slug) ?? false;
              const selected = selectedSlugs.has(m.slug);
              return (
                <label
                  key={m.slug}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-black/10 dark:border-white/15 text-zinc-700 dark:text-zinc-300"
                  } ${eligible ? "cursor-pointer" : "cursor-not-allowed opacity-30"}`}
                >
                  <input
                    type="checkbox"
                    disabled={!eligible}
                    checked={selected}
                    onChange={() => toggleModel(m.slug)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">{m.name}</span>
                    <span className="block text-xs opacity-70">{m.family}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting || !datasetId || selectedSlugs.size === 0 || selectedColumns.length === 0}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating..." : `Run comparison (${selectedSlugs.size} model${selectedSlugs.size === 1 ? "" : "s"})`}
        </button>
      </form>
    </div>
  );
}
