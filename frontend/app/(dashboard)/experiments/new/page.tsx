"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listModels, type ForecastingModel } from "@/lib/models";
import { createExperiment, getSplitPreview, type SplitPreview } from "@/lib/experiments";

export default function NewExperimentPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<ForecastingModel[]>([]);

  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [experimentName, setExperimentName] = useState("");
  const [testPeriods, setTestPeriods] = useState(10);
  const [inputPeriods, setInputPeriods] = useState(6);
  const [modelSlug, setModelSlug] = useState<string | null>(null);
  const [hyperparamsText, setHyperparamsText] = useState("{}");
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);  // unticked; empty = all columns

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

  const selectedDataset = useMemo(() => datasets.find((d) => d.id === datasetId) ?? null, [datasets, datasetId]);

  const selectedColumns = useMemo(
    () => (selectedDataset?.selected_columns ?? []).filter((c) => !excludedColumns.includes(c)),
    [selectedDataset, excludedColumns]
  );

  function toggleColumn(name: string) {
    setExcludedColumns((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  const selectedModel = useMemo(() => models.find((m) => m.slug === modelSlug) ?? null, [models, modelSlug]);

  useEffect(() => {
    if (selectedModel) {
      setHyperparamsText(JSON.stringify(selectedModel.default_hyperparams, null, 2));
    }
  }, [selectedModel]);

  // Keeps the dropdown and the JSON box in sync: the dropdown edits the JSON's "decomposition" key.
  let tensorArDecomposition = "cp";
  try {
    tensorArDecomposition = String(JSON.parse(hyperparamsText).decomposition ?? "cp");
  } catch {
    // Invalid JSON mid-edit -- keep the default; submit surfaces the parse error.
  }

  function setDecomposition(value: string) {
    try {
      setHyperparamsText(JSON.stringify({ ...JSON.parse(hyperparamsText), decomposition: value }, null, 2));
    } catch {
      setHyperparamsText(JSON.stringify({ decomposition: value }, null, 2));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!datasetId || !modelSlug) return;
    setSubmitError(null);

    let hyperparams: Record<string, unknown>;
    try {
      hyperparams = JSON.parse(hyperparamsText);
    } catch {
      setSubmitError("Hyperparameters must be valid JSON.");
      return;
    }

    setSubmitting(true);
    try {
      await createExperiment({
        dataset_id: datasetId,
        model_slug: modelSlug,
        experiment_name: experimentName,
        test_periods: testPeriods,
        input_periods: inputPeriods,
        hyperparams,
        selected_columns: selectedColumns,
      });
      // Runs in the background (see ExperimentTracker in the dashboard layout) -- send the user
      // to the list rather than making them sit on this one experiment's detail page.
      router.push("/experiments");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create experiment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">New experiment</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Experiment name
          </label>
          <input
            required
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Model</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {models.map((m) => {
              const eligible = splitPreview?.eligible_model_slugs.includes(m.slug) ?? false;
              return (
                <button
                  type="button"
                  key={m.slug}
                  disabled={!eligible}
                  onClick={() => setModelSlug(m.slug)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${
                    modelSlug === m.slug
                      ? "border-foreground bg-foreground text-background"
                      : "border-black/10 dark:border-white/15 text-zinc-700 dark:text-zinc-300"
                  } disabled:opacity-30`}
                >
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs opacity-70">{m.family}</div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedModel?.slug === "tensor_ar" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Decomposition
            </label>
            <select
              value={tensorArDecomposition}
              onChange={(e) => setDecomposition(e.target.value)}
              className="rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
            >
              <option value="cp">CP</option>
              <option value="cp_puzzle">CP Puzzle</option>
            </select>
          </div>
        )}

        {selectedModel && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Hyperparameters (JSON)
            </label>
            <textarea
              value={hyperparamsText}
              onChange={(e) => setHyperparamsText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-50"
            />
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting || !datasetId || !modelSlug || selectedColumns.length === 0}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Run experiment"}
        </button>
      </form>
    </div>
  );
}
