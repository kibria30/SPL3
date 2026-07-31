import { apiFetch } from "./api";

export type ModelFamily = "classical" | "trained";

export interface ForecastingModel {
  id: number;
  slug: string;
  name: string;
  family: ModelFamily;
  requires_training: boolean;
  default_hyperparams: Record<string, unknown>;
  paper_title: string | null;
  publication: string | null;
  year: number | null;
  authors: string | null;
  description: string | null;
  github_url: string | null;
  created_at: string;
}

export function listModels() {
  return apiFetch<ForecastingModel[]>("/models");
}
