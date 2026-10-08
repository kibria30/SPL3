"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listModels, type ForecastingModel } from "@/lib/models";
import HyperparamFields from "@/components/HyperparamFields";
import { ColumnPicker, Field, FormSection, ModelTile, SplitSection, inputClass } from "@/components/form";
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
  const [hyperparams, setHyperparams] = useState<Record<string, unknown>>({});
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
      setHyperparams({ ...selectedModel.default_hyperparams });
    }
  }, [selectedModel]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!datasetId || !effectiveSlug) return;
    setSubmitError(null);

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
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">New experiment</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
        <FormSection title="Dataset">
          <Field label="Task">
            <div className="inline-flex overflow-hidden rounded-md border border-black/15 dark:border-white/15">
              {([["forecasting", "Forecasting"], ["anomaly_detection", "Anomaly detection"]] as const).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setTaskType(value)}
                  className={`px-4 py-2 text-base ${
                    taskType === value
                      ? "bg-foreground text-background"
                      : "bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Experiment name">
            <input required value={experimentName} onChange={(e) => setExperimentName(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Dataset">
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
              className={inputClass}
            >
              <option value="" disabled>Select a dataset</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.rows.toLocaleString()} rows, period {d.period_length})
                </option>
              ))}
            </select>
          </Field>

          {selectedDataset && (
            <ColumnPicker
              dataset={selectedDataset}
              selected={selectedColumns}
              onToggle={toggleColumn}
              onSelectAll={() => setExcludedColumns([])}
              onClear={() => setExcludedColumns(selectedDataset.selected_columns)}
            />
          )}
        </FormSection>

        <FormSection title="Split">
          <SplitSection
            dataset={selectedDataset} limits={limits}
            testPeriods={testPeriods} inputPeriods={inputPeriods}
            setTestPeriods={setTestPeriods} setInputPeriods={setInputPeriods}
            preview={splitPreview} previewError={previewError}
          />
        </FormSection>

          </div>

        {isAnomaly ? (
          <FormSection title="Anomaly threshold">
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              Tensor-AR forecasts the output window; points where |actual − predicted| exceeds the threshold are
              flagged. Anomaly runs are not part of model comparison.
            </p>
            <div className="flex gap-6 text-base text-zinc-700 dark:text-zinc-300">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={thresholdMode === "auto"} onChange={() => setThresholdMode("auto")} className="accent-zinc-900 dark:accent-zinc-100" />
                Auto
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="radio" checked={thresholdMode === "manual"} onChange={() => setThresholdMode("manual")} className="accent-zinc-900 dark:accent-zinc-100" />
                Manual
              </label>
            </div>
            {thresholdMode === "auto" ? (
              <Field label="k (threshold = k × robust σ of the residuals, per column)">
                <input type="number" min={0.5} max={20} step={0.5} value={k} onChange={(e) => setK(Number(e.target.value))} className={`${inputClass} sm:w-40`} />
              </Field>
            ) : (
              <Field label="Threshold (normalized units, same for every column)">
                <input type="number" min={0.01} step={0.1} value={manualThreshold} onChange={(e) => setManualThreshold(Number(e.target.value))} className={`${inputClass} sm:w-40`} />
              </Field>
            )}
          </FormSection>
        ) : (
          <FormSection title="Model">
            <div className="grid gap-3 sm:grid-cols-2">
              {models.map((m) => (
                <ModelTile
                  key={m.slug} model={m} multi={false}
                  selected={modelSlug === m.slug}
                  eligible={splitPreview?.eligible_model_slugs.includes(m.slug) ?? false}
                  onClick={() => setModelSlug(m.slug)}
                />
              ))}
            </div>
            {!splitPreview && <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose a dataset to see which models can run.</p>}

            {selectedModel && (
              <HyperparamFields
                values={hyperparams}
                defaults={selectedModel.default_hyperparams}
                onChange={(key, value) => setHyperparams((prev) => ({ ...prev, [key]: value }))}
                onReset={() => setHyperparams({ ...selectedModel.default_hyperparams })}
              />
            )}
          </FormSection>
        )}

        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              submitting || !datasetId || !effectiveSlug || selectedColumns.length === 0 ||
              (isAnomaly && thresholdMode === "manual" && !(manualThreshold > 0))
            }
            className="rounded-md bg-foreground px-6 py-3 text-base font-medium text-background disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Run experiment"}
          </button>
        </div>
      </form>
    </div>
  );
}
