"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ForecastChart from "@/components/ForecastChart";
import StatusBadge from "@/components/StatusBadge";
import {
  getExperiment,
  getExperimentResult,
  getExperimentSeries,
  type Experiment,
  type ExperimentResult,
  type SeriesData,
} from "@/lib/experiments";

const METRIC_COLUMNS = ["R2", "MSE", "MAE", "RMSE", "MASE", "sMAPE"] as const;

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{experiment.experiment_name}</h1>
        <StatusBadge status={experiment.status} />
      </div>

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

      {(experiment.status === "pending" || experiment.status === "running") && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {experiment.status === "pending" ? "Waiting to start..." : "Running..."}
        </p>
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
