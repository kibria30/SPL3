"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ForecastChart from "@/components/ForecastChart";
import StatusBadge from "@/components/StatusBadge";
import ConfigPanel from "@/components/ConfigPanel";
import ResultStats from "@/components/ResultStats";
import { formatSpan } from "@/lib/format";
import { getDataset, type Dataset } from "@/lib/datasets";
import {
  deleteExperiment,
  getExperiment,
  getExperimentResult,
  getExperimentSeries,
  type AnomalyConfig,
  type Experiment,
  type ExperimentResult,
  type SeriesData,
} from "@/lib/experiments";
import { listModels, type ForecastingModel } from "@/lib/models";
import { ApiError } from "@/lib/api";

const METRIC_COLUMNS = ["MSE", "MAE", "RMSE", "MASE", "sMAPE"] as const;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrainingProgress({ experiment }: { experiment: Experiment }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const epoch = experiment.progress_epoch;
  const total = experiment.progress_total_epochs;

  const elapsedSeconds = useMemo(() => {
    if (!experiment.started_at) return null;
    return Math.max(0, Math.round((now - new Date(experiment.started_at).getTime()) / 1000));
  }, [experiment.started_at, now]);

  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [experiment.training_log]);

  return (
    <div className="rounded-md border border-black/10 dark:border-white/10 p-4">
      <div className="mb-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          {epoch && total ? `Epoch ${epoch} / ${total}` : "Starting training..."}
        </span>
        {elapsedSeconds !== null && <span>{formatDuration(elapsedSeconds)} elapsed</span>}
      </div>
      {epoch && total && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${Math.min(100, (epoch / total) * 100)}%` }}
          />
        </div>
      )}
      <div
        ref={logRef}
        className="max-h-48 overflow-y-auto rounded bg-zinc-50 dark:bg-zinc-900 p-2 font-mono text-xs text-zinc-700 dark:text-zinc-300"
      >
        {experiment.training_log.length === 0 ? (
          <p className="text-zinc-400 dark:text-zinc-600">Waiting for the first log line...</p>
        ) : (
          experiment.training_log.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  );
}

function AnomalyPanel({
  experiment, series, onChange,
}: {
  experiment: Experiment;
  series: SeriesData;
  onChange: (cfg: AnomalyConfig) => void;
}) {
  const anomaly = series.anomaly!;
  const saved = (experiment.hyperparams.anomaly ?? {}) as Partial<AnomalyConfig>;
  const [mode, setMode] = useState<"auto" | "manual">(saved.mode ?? "auto");
  const [k, setK] = useState(saved.k ?? 3);
  const [threshold, setThreshold] = useState(saved.threshold ?? 1);

  function apply(next: Partial<{ mode: "auto" | "manual"; k: number; threshold: number }>) {
    const cfg = { mode, k, threshold, ...next };
    if (cfg.mode === "manual" && !(cfg.threshold > 0)) return;
    if (!(cfg.k > 0)) return;
    onChange(cfg);
  }

  const total = series.actual.length * series.feature_names.length;
  const flagged: { step: number; feature: string; actual: number; predicted: number; residual: number }[] = [];
  anomaly.flags.forEach((row, i) =>
    row.forEach((f, j) => {
      if (f) flagged.push({
        step: i, feature: series.feature_names[j], actual: series.actual[i][j],
        predicted: series.predicted[i][j], residual: anomaly.residuals[i][j],
      });
    })
  );
  flagged.sort((a, b) => b.residual - a.residual);

  const inputClass = "w-24 rounded-md border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm";

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700 dark:text-zinc-300">
        <span className="font-medium text-[#d03b3b]">
          {anomaly.count} of {total} points flagged as probable anomalies
        </span>
        <label className="flex items-center gap-1">
          <input type="radio" checked={mode === "auto"} onChange={() => { setMode("auto"); apply({ mode: "auto" }); }} />
          Auto, k =
          <input
            type="number" min={0.5} max={20} step={0.5} value={k} className={inputClass}
            onChange={(e) => { setK(Number(e.target.value)); apply({ mode: "auto", k: Number(e.target.value) }); setMode("auto"); }}
          />
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={mode === "manual"} onChange={() => { setMode("manual"); apply({ mode: "manual" }); }} />
          Manual threshold =
          <input
            type="number" min={0.01} step={0.1} value={threshold} className={inputClass}
            onChange={(e) => { setThreshold(Number(e.target.value)); apply({ mode: "manual", threshold: Number(e.target.value) }); setMode("manual"); }}
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Thresholds (normalized units):{" "}
        {series.feature_names.map((n, j) => `${n} ${anomaly.thresholds[j].toFixed(3)}`).join(" · ")}.
        Changes here preview the flags; they are not saved to the experiment.
      </p>
      {flagged.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                {["Step", "Feature", "Actual", "Predicted", "|Residual|"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
              {flagged.map((f) => (
                <tr key={`${f.step}-${f.feature}`}>
                  <td className="px-3 py-1.5">{f.step}</td>
                  <td className="px-3 py-1.5">{f.feature}</td>
                  <td className="px-3 py-1.5">{f.actual.toFixed(3)}</td>
                  <td className="px-3 py-1.5">{f.predicted.toFixed(3)}</td>
                  <td className="px-3 py-1.5">{f.residual.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listModels().then(setModels).catch(() => {});
  }, []);

  const datasetId = experiment?.dataset_id;
  useEffect(() => {
    if (datasetId === undefined) return;
    getDataset(datasetId).then(setDataset).catch(() => {});
  }, [datasetId]);

  const model = useMemo(
    () => (experiment ? models.find((m) => m.id === experiment.model_id) ?? null : null),
    [models, experiment]
  );

  useEffect(() => {
    function load() {
      getExperiment(id)
        .then((exp) => {
          setExperiment(exp);
          if (exp.status === "completed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
            Promise.all([getExperimentResult(id), getExperimentSeries(id)]).then(([r, s]) => {
              setResult(r);
              setSeries(s);
            });
          } else if (exp.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load experiment"));
    }
    load();
    intervalRef.current = setInterval(load, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!experiment) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  const isAnomaly = experiment.task_type === "anomaly_detection";

  function previewAnomaly(cfg: AnomalyConfig) {
    getExperimentSeries(id, cfg).then(setSeries).catch(() => {});
  }

  const isLive = experiment.status === "pending" || experiment.status === "running";

  async function handleDelete() {
    if (!experiment) return;
    const confirmed = confirm(
      `Delete "${experiment.experiment_name}"? This permanently removes the experiment and its results. ` +
      "This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExperiment(experiment.id);
      router.push("/experiments");
    } catch (e) {
      setDeleting(false);
      setDeleteError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{experiment.experiment_name}</h1>
          <StatusBadge status={experiment.status} />
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting || isLive}
          title={isLive ? "Cannot delete while pending or running" : undefined}
          className="rounded-md border border-red-600 text-red-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? "Deleting..." : "Delete experiment"}
        </button>
      </div>

      {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}

      <ConfigPanel
        groups={[
          {
            title: "Data",
            items: [
              { label: "Dataset", value: dataset?.name ?? `#${experiment.dataset_id}` },
              {
                label: "Columns",
                value: experiment.selected_columns
                  ? `${experiment.selected_columns.length} selected`
                  : dataset ? `all ${dataset.selected_columns.length}` : "all",
                hint: experiment.selected_columns?.join(", "),
              },
              {
                label: "Period length",
                value: formatSpan(experiment.period_length, dataset?.frequency),
                hint: "one natural cycle of the data",
              },
            ],
          },
          {
            title: "Split",
            items: [
              {
                label: "Test window",
                value: formatSpan(experiment.test_periods * experiment.period_length, dataset?.frequency),
                hint: `${experiment.test_periods} periods`,
              },
              {
                label: "Input window",
                value: formatSpan(experiment.seq_len, dataset?.frequency),
                hint: `${experiment.input_periods} periods, history before the forecast`,
              },
              {
                label: "Forecast window",
                value: formatSpan(experiment.pred_len, dataset?.frequency),
                hint: `${experiment.output_periods} periods, what is scored`,
              },
            ],
          },
          {
            title: model?.requires_training ? "Model & training" : "Model",
            items: [
              { label: "Model", value: model?.name ?? `#${experiment.model_id}`, hint: model?.family },
              {
                label: "Training data",
                value: experiment.has_train_data ? "Available data before the test window" : "None (direct forecast only)",
              },
              ...(model?.requires_training ? [{ label: "Validation share", value: `${Math.round(experiment.val_ratio * 100)}% of training data` }] : []),
            ],
            chips: Object.entries(experiment.hyperparams)
              .filter(([k]) => k !== "anomaly")
              .map(([k, v]) => ({ label: k, value: typeof v === "object" ? JSON.stringify(v) : String(v) })),
          },
        ]}
      />

      {experiment.status === "failed" && (
        <p className="mb-6 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          {experiment.error_message}
        </p>
      )}

      {experiment.status === "pending" && (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Waiting to start...</p>
      )}

      {experiment.status === "running" && (
        <div className="mb-6">
          {model?.requires_training ? (
            <TrainingProgress experiment={experiment} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Running...</p>
          )}
        </div>
      )}

      {result && (
        <>
          <ResultStats trainingSeconds={result.training_time_seconds} parameters={result.num_parameters} />

          {series && (
            <>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">
                {isAnomaly ? "Anomaly detection" : "Actual vs. predicted"}
              </h2>
              <div className="mb-4">
                <ForecastChart
                  featureNames={series.feature_names} actual={series.actual} predicted={series.predicted}
                  anomaly={series.anomaly}
                />
              </div>
              {isAnomaly && series.anomaly && (
                <AnomalyPanel experiment={experiment} series={series} onChange={previewAnomaly} />
              )}
              {!isAnomaly && <div className="mb-4" />}
            </>
          )}

          {!isAnomaly && <>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Metrics</h2>
          <div className="mb-6 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Feature</th>
                  {METRIC_COLUMNS.map((m) => (
                    <th key={m} className="px-3 py-2 text-right font-medium text-zinc-600 dark:text-zinc-300">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
                {result.metrics_per_feature.map((row) => (
                  <tr key={row.Feature}>
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">{row.Feature}</td>
                    {METRIC_COLUMNS.map((m) => (
                      <td key={m} className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">
                        {row[m] !== undefined ? row[m]!.toFixed(3) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-zinc-50 dark:bg-zinc-900 font-medium">
                  <td className="px-3 py-2 text-zinc-900 dark:text-zinc-50">Average</td>
                  {METRIC_COLUMNS.map((m) => (
                    <td key={m} className="px-3 py-2 text-right text-zinc-900 dark:text-zinc-50">
                      {result.metrics_avg[m] !== undefined ? result.metrics_avg[m].toFixed(3) : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          </>}
        </>
      )}
    </div>
  );
}
