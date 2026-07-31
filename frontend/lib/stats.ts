import { apiFetch } from "./api";

export interface PlatformStats {
  dataset_count: number;
  model_count: number;
  experiment_count: number;
  completed_experiment_count: number;
  user_count: number;
}

export function getPlatformStats() {
  return apiFetch<PlatformStats>("/stats");
}
