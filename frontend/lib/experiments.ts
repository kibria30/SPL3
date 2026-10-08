import { apiFetch } from "./api";

export type ExperimentStatus = "pending" | "running" | "completed" | "failed";

export interface Experiment {
  id: number;
  user_id: number;
  model_id: number;
  dataset_id: number;
  experiment_name: string;
  task_type: string;
  test_periods: number;
  input_periods: number;
  output_periods: number;
  period_length: number;
  seq_len: number;
  pred_len: number;
  val_ratio: number;
  hyperparams: Record<string, unknown>;
  selected_columns: string[] | null;
  has_train_data: boolean;
  status: ExperimentStatus;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  progress_epoch: number | null;
  progress_total_epochs: number | null;
  progress_updated_at: string | null;
  training_log: string[];
}

export interface FeatureMetrics {
  Feature: string;
  MSE: number;
  MAE: number;
  RMSE: number;
  MASE?: number;
  sMAPE?: number;
}

export interface ExperimentResult {
  training_time_seconds: number;
  num_parameters: number | null;
  metrics_per_feature: FeatureMetrics[];
  metrics_avg: Record<string, number>;
  actual_sequence_path: string;
  predicted_sequence_path: string;
}

export interface AnomalyConfig {
  mode: "auto" | "manual";
  k: number;
  threshold?: number | null; // manual mode, z-scored units
}

export interface AnomalyData {
  mode: string;
  k: number;
  thresholds: number[]; // per feature
  residuals: number[][];
  flags: boolean[][];
  count: number;
}

export interface SeriesData {
  feature_names: string[];
  actual: number[][];
  predicted: number[][];
  anomaly: AnomalyData | null;
}

export interface SplitPreview {
  seq_len: number;
  pred_len: number;
  train_len: number;
  val_len: number;
  train_fit_len: number;
  test_len: number;
  train_windows: number;
  has_train_data: boolean;
  dl_eligible: boolean;
  eligible_model_slugs: string[];
  ineligible_reason: string | null;
  recommended_test_periods: number | null;
  recommended_input_periods: number | null;
}

export function listExperiments() {
  return apiFetch<Experiment[]>("/experiments");
}

export function getExperiment(id: number) {
  return apiFetch<Experiment>(`/experiments/${id}`);
}

export function getExperimentResult(id: number) {
  return apiFetch<ExperimentResult>(`/experiments/${id}/result`);
}

export function getExperimentSeries(id: number, override?: AnomalyConfig) {
  const qs = new URLSearchParams();
  if (override) {
    qs.set("mode", override.mode);
    qs.set("k", String(override.k));
    if (override.mode === "manual" && override.threshold != null) qs.set("threshold", String(override.threshold));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<SeriesData>(`/experiments/${id}/series${suffix}`);
}

export function getSplitPreview(datasetId: number, testPeriods: number, inputPeriods: number) {
  return apiFetch<SplitPreview>(
    `/datasets/${datasetId}/split-preview?test_periods=${testPeriods}&input_periods=${inputPeriods}`
  );
}

export interface CreateExperimentPayload {
  dataset_id: number;
  model_slug: string;
  experiment_name: string;
  task_type?: "forecasting" | "anomaly_detection";
  anomaly?: AnomalyConfig;
  test_periods: number;
  input_periods: number;
  val_ratio?: number;
  hyperparams?: Record<string, unknown>;
  selected_columns?: string[] | null;
}

export function createExperiment(payload: CreateExperimentPayload) {
  return apiFetch<Experiment>("/experiments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteExperiment(id: number) {
  return apiFetch<void>(`/experiments/${id}`, { method: "DELETE" });
}
