"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ForecastChart from "@/components/ForecastChart";
import StatusBadge from "@/components/StatusBadge";
import {
  deleteExperiment,
  getExperiment,
  getExperimentResult,
  getExperimentSeries,
  type Experiment,
  type ExperimentResult,
  type SeriesData,
} from "@/lib/experiments";
import { listModels, type ForecastingModel } from "@/lib/models";
import { ApiError } from "@/lib/api";

const METRIC_COLUMNS = ["R2", "MSE", "MAE", "RMSE", "MASE", "sMAPE"] as const;

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

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listModels().then(setModels).catch(() => {});
  }, []);

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

      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        input {experiment.input_periods}p / output {experiment.output_periods}p (test {experiment.test_periods}p)
        &middot; seq_len {experiment.seq_len} &middot; pred_len {experiment.pred_len} &middot;{" "}
        {experiment.has_train_data ? "trained on available data" : "no train data (direct-forecast only)"}
      </p>

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
          {series && (
            <>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Actual vs. predicted</h2>
              <div className="mb-8">
                <ForecastChart featureNames={series.feature_names} actual={series.actual} predicted={series.predicted} />
              </div>
            </>
          )}

          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50 mb-2">Metrics</h2>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Training time {result.training_time_seconds.toFixed(2)}s
            {result.num_parameters !== null && ` · ${result.num_parameters.toLocaleString()} parameters`}
          </p>
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
        </>
      )}
    </div>
  );
}
