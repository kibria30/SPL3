"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listDatasets, type Dataset } from "@/lib/datasets";
import { listModels, type ForecastingModel } from "@/lib/models";
import { ColumnPicker, Field, FormSection, ModelTile, SplitSection, inputClass } from "@/components/form";
import { clampToLimits, getSplitLimits } from "@/lib/splitLimits";
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
  const [tensorArDecomposition, setTensorArDecomposition] = useState("cp");
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
        hyperparams_by_model: selectedSlugs.has("tensor_ar")
          ? { tensor_ar: { decomposition: tensorArDecomposition } }
          : undefined,
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
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">New comparison</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
        <FormSection title="Dataset">
          <Field label="Comparison name">
            <input
              required
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              placeholder="e.g. ILI baseline sweep"
              className={inputClass}
            />
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

        <FormSection
          title={`Models${selectedSlugs.size > 0 ? ` (${selectedSlugs.size} selected)` : ""}`}
          action={
            splitPreview && (
              <button type="button" onClick={selectAllEligible} className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:underline">
                Select all eligible
              </button>
            )
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {models.map((m) => (
              <ModelTile
                key={m.slug} model={m} multi
                selected={selectedSlugs.has(m.slug)}
                eligible={splitPreview?.eligible_model_slugs.includes(m.slug) ?? false}
                onClick={() => toggleModel(m.slug)}
              />
            ))}
          </div>
          {!splitPreview && <p className="text-sm text-zinc-500 dark:text-zinc-400">Choose a dataset to see which models can run.</p>}

          {selectedSlugs.has("tensor_ar") && (
            <Field label="Tensor-AR decomposition">
              <select
                value={tensorArDecomposition}
                onChange={(e) => setTensorArDecomposition(e.target.value)}
                className={`${inputClass} sm:w-60`}
              >
                <option value="cp">CP</option>
                <option value="cp_puzzle">CP Puzzle</option>
              </select>
            </Field>
          )}
        </FormSection>

        </div>

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !datasetId || selectedSlugs.size === 0 || selectedColumns.length === 0}
            className="rounded-md bg-foreground px-6 py-3 text-base font-medium text-background disabled:opacity-50"
          >
            {submitting ? "Creating..." : `Run comparison (${selectedSlugs.size} model${selectedSlugs.size === 1 ? "" : "s"})`}
          </button>
        </div>
      </form>
    </div>
  );
}
