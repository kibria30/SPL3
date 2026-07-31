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
  dataset_slug: string | null;
  test_periods: number;
  input_periods: number;
  period_length: number;
  seq_len: number;
  pred_len: number;
  entries: ComparisonEntry[];
}

export interface ComparisonGroup {
  dataset_id: number;
  dataset_name: string;
  test_periods: number;
  input_periods: number;
  period_length: number;
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
}

export function createComparisonBatch(payload: CreateComparisonBatchPayload) {
  return apiFetch<ExperimentBatch>("/experiments/compare-batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getComparisonView(datasetId: number, testPeriods: number, inputPeriods: number) {
  return apiFetch<ComparisonView>(
    `/experiments/compare?dataset_id=${datasetId}&test_periods=${testPeriods}&input_periods=${inputPeriods}`
  );
}

export function getComparisonGroups() {
  return apiFetch<ComparisonGroup[]>("/experiments/compare/groups");
}
