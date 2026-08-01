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
  R2: number;
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

export interface SeriesData {
  feature_names: string[];
  actual: number[][];
  predicted: number[][];
}

export interface SplitPreview {
  seq_len: number;
  pred_len: number;
  train_len: number;
  val_len: number;
  train_fit_len: number;
  has_train_data: boolean;
  dl_eligible: boolean;
  eligible_model_slugs: string[];
  ineligible_reason: string | null;
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

export function getExperimentSeries(id: number) {
  return apiFetch<SeriesData>(`/experiments/${id}/series`);
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
  test_periods: number;
  input_periods: number;
  val_ratio?: number;
  hyperparams?: Record<string, unknown>;
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
