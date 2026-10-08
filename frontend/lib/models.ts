import { apiFetch } from "./api";

export type ModelFamily = "classical" | "trained";

// The database value stays "trained" (it means "fit by gradient descent"); the UI says "Deep learning"
// because "trained" reads as "pre-trained".
export function familyLabel(family: string): string {
  return family === "trained" ? "Deep learning" : family === "classical" ? "Classical" : family;
}

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
