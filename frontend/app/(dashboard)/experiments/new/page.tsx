"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listModels, type ForecastingModel } from "@/lib/models";
import SplitWindows from "@/components/SplitWindows";
import { clampToLimits, getSplitLimits } from "@/lib/splitLimits";
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
  const [taskType, setTaskType] = useState<"forecasting" | "anomaly_detection">("forecasting");
  const [thresholdMode, setThresholdMode] = useState<"auto" | "manual">("auto");
  const [k, setK] = useState(3);
  const [manualThreshold, setManualThreshold] = useState(1);
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

  // Slider ranges follow the selected dataset's size (values are pulled back in range on dataset change).
  const limits = useMemo(
    () => (selectedDataset ? getSplitLimits(selectedDataset.rows, selectedDataset.period_length) : null),
    [selectedDataset]
  );

  const selectedColumns = useMemo(
    () => (selectedDataset?.selected_columns ?? []).filter((c) => !excludedColumns.includes(c)),
    [selectedDataset, excludedColumns]
  );

  function toggleColumn(name: string) {
    setExcludedColumns((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));
  }

  const isAnomaly = taskType === "anomaly_detection";

  // Anomaly detection runs on Tensor-AR only.
  const effectiveSlug = isAnomaly ? "tensor_ar" : modelSlug;

  const selectedModel = useMemo(() => models.find((m) => m.slug === effectiveSlug) ?? null, [models, effectiveSlug]);

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
    if (!datasetId || !effectiveSlug) return;
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
        model_slug: effectiveSlug,
        experiment_name: experimentName,
        task_type: taskType,
        anomaly: isAnomaly
          ? { mode: thresholdMode, k, threshold: thresholdMode === "manual" ? manualThreshold : null }
          : undefined,
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
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Task</label>
          <div className="inline-flex rounded-md border border-black/15 dark:border-white/15 overflow-hidden text-sm">
            {([["forecasting", "Forecasting"], ["anomaly_detection", "Anomaly detection"]] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setTaskType(value)}
                className={`px-3 py-1.5 ${
                  taskType === value ? "bg-foreground text-background" : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Experiment name
          </label>
          <input
            required
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Dataset</label>
          <select
            required
            value={datasetId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setDatasetId(id);
              const d = datasets.find((x) => x.id === id);
              if (d) {
                const { test, input } = clampToLimits(testPeriods, inputPeriods, getSplitLimits(d.rows, d.period_length));
                setTestPeriods(test);
                setInputPeriods(input);
              }
              setExcludedColumns([]);  // every column starts checked
            }}
            className="w-full rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
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
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-black/15 dark:border-white/15 p-3 sm:grid-cols-3">
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
              Test window (periods): {testPeriods}{limits && <span className="font-normal text-zinc-500"> (range {limits.testMin}&ndash;{limits.testMax})</span>}
            </label>
            <input
              type="range"
              min={limits?.testMin ?? 3}
              max={limits?.testMax ?? 25}
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
              Input window (periods): {inputPeriods}{limits && <span className="font-normal text-zinc-500"> (range {limits.inputMin}&ndash;{limits.inputMax(testPeriods)})</span>}
            </label>
            <input
              type="range"
              min={limits?.inputMin ?? 1}
              max={limits ? limits.inputMax(testPeriods) : Math.min(20, testPeriods - 1)}
              value={inputPeriods}
              onChange={(e) => setInputPeriods(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {previewError && <p className="text-sm text-red-600">{previewError}</p>}

        {splitPreview && selectedDataset && (
          <div className="space-y-3">
            <SplitWindows
              preview={splitPreview}
              testPeriods={testPeriods}
              inputPeriods={inputPeriods}
              frequency={selectedDataset.frequency}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
              <span className="text-zinc-500 dark:text-zinc-400">Deep learning models</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                  splitPreview.dl_eligible
                    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {splitPreview.dl_eligible ? "Eligible" : "Not eligible"}
              </span>
              {!splitPreview.dl_eligible &&
                splitPreview.recommended_test_periods !== null &&
                splitPreview.recommended_input_periods !== null && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    Try test {splitPreview.recommended_test_periods}, input {splitPreview.recommended_input_periods}
                  </span>
                )}
            </div>
            {splitPreview.ineligible_reason && (
              <p className="text-sm text-amber-700 dark:text-amber-400">{splitPreview.ineligible_reason}</p>
            )}
          </div>
        )}

        {isAnomaly && (
          <div className="rounded-md border border-black/15 dark:border-white/10 p-4 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tensor-AR forecasts the output window; points where |actual − predicted| exceeds the threshold are
              flagged as probable anomalies. Anomaly runs are not part of model comparison.
            </p>
            <div className="flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
              <label className="flex items-center gap-2">
                <input type="radio" checked={thresholdMode === "auto"} onChange={() => setThresholdMode("auto")} />
                Auto (from the residuals)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={thresholdMode === "manual"} onChange={() => setThresholdMode("manual")} />
                Manual
              </label>
            </div>
            {thresholdMode === "auto" ? (
              <div>
                <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                  k (threshold = k × robust σ of the residuals, per column)
                </label>
                <input
                  type="number" min={0.5} max={20} step={0.5} value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-28 rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-zinc-700 dark:text-zinc-300 mb-1">
                  Threshold (normalized units, same for every column)
                </label>
                <input
                  type="number" min={0.01} step={0.1} value={manualThreshold}
                  onChange={(e) => setManualThreshold(Number(e.target.value))}
                  className="w-28 rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
        )}

        {!isAnomaly && (
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
                      : "border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300"
                  } disabled:opacity-30`}
                >
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs opacity-70">{m.family}</div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {selectedModel?.slug === "tensor_ar" && (
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Decomposition
            </label>
            <select
              value={tensorArDecomposition}
              onChange={(e) => setDecomposition(e.target.value)}
              className="rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
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
              className="w-full rounded-md border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-50"
            />
          </div>
        )}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <button
          type="submit"
          disabled={
            submitting || !datasetId || !effectiveSlug || selectedColumns.length === 0 ||
            (isAnomaly && thresholdMode === "manual" && !(manualThreshold > 0))
          }
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Run experiment"}
        </button>
      </form>
    </div>
  );
}
