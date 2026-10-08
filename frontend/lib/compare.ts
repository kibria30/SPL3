import { apiFetch } from "./api";
import type { Experiment, ExperimentResult } from "./experiments";

export interface SkippedModel {
  model_slug: string;
  reason: string;
}

export interface ExperimentBatch {
  dataset_id: number;
  test_periods: number;
  input_periods: number;
  val_ratio: number;
  created: Experiment[];
  skipped: SkippedModel[];
}

export interface ComparisonEntry {
  experiment: Experiment;
  model_slug: string;
  model_name: string;
  model_family: string;
  result: ExperimentResult | null;
}

export interface ComparisonView {
  dataset_id: number;
  dataset_name: string;
  comparison_name: string | null;
  dataset_slug: string | null;
  test_periods: number;
  input_periods: number;
  period_length: number;
  seq_len: number;
  pred_len: number;
  selected_columns: string[] | null;
  entries: ComparisonEntry[];
}

export interface ComparisonGroup {
  dataset_id: number;
  dataset_name: string;
  comparison_name: string | null;
  test_periods: number;
  input_periods: number;
  period_length: number;
  selected_columns: string[] | null;
  model_slugs: string[];
  experiment_count: number;
  completed_count: number;
  latest_created_at: string;
}

export interface CreateComparisonBatchPayload {
  dataset_id: number;
  experiment_name_prefix: string;
  test_periods: number;
  input_periods: number;
  val_ratio?: number;
  model_slugs: string[];
  selected_columns?: string[] | null;
  hyperparams_by_model?: Record<string, Record<string, unknown>>;
}

export function createComparisonBatch(payload: CreateComparisonBatchPayload) {
  return apiFetch<ExperimentBatch>("/experiments/compare-batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Query string shared by the compare view URL and its API call; omit columns = all columns.
export function comparisonQuery(
  datasetId: number, testPeriods: number, inputPeriods: number, columns: string[] | null
) {
  const q = new URLSearchParams({
    dataset_id: String(datasetId),
    test_periods: String(testPeriods),
    input_periods: String(inputPeriods),
  });
  columns?.forEach((c) => q.append("columns", c));
  return q.toString();
}

export function getComparisonView(
  datasetId: number, testPeriods: number, inputPeriods: number, columns: string[] | null = null
) {
  return apiFetch<ComparisonView>(`/experiments/compare?${comparisonQuery(datasetId, testPeriods, inputPeriods, columns)}`);
}

export function getComparisonGroups() {
  return apiFetch<ComparisonGroup[]>("/experiments/compare/groups");
}

export function deleteComparison(
  datasetId: number, testPeriods: number, inputPeriods: number, columns: string[] | null = null
) {
  return apiFetch<void>(`/experiments/compare?${comparisonQuery(datasetId, testPeriods, inputPeriods, columns)}`, {
    method: "DELETE",
  });
}
