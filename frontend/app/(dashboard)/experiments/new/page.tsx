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

  const selectedModel = useMemo(() => models.find((m) => m.slug === modelSlug) ?? null, [models, modelSlug]);

  useEffect(() => {
    if (selectedModel) {
      setHyperparamsText(JSON.stringify(selectedModel.default_hyperparams, null, 2));
    }
  }, [selectedModel]);

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
      const experiment = await createExperiment({
        dataset_id: datasetId,
        model_slug: modelSlug,
        experiment_name: experimentName,
        test_periods: testPeriods,
        input_periods: inputPeriods,
        hyperparams,
      });
      router.push(`/experiments/${experiment.id}`);
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
            onChange={(e) => setDatasetId(Number(e.target.value))}
            className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
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
          disabled={submitting || !datasetId || !modelSlug}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Run experiment"}
        </button>
      </form>
    </div>
  );
}
