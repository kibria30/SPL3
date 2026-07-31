import { apiFetch } from "./api";

export type DatasetSource = "system" | "user";
export type DatasetVisibility = "system" | "private" | "public";
export type DatasetStatus = "pending_column_selection" | "ready" | "error";

export interface ColumnInfo {
  name: string;
  dtype: string;
}

export interface Dataset {
  id: number;
  owner_id: number | null;
  slug: string | null;
  name: string;
  source: DatasetSource;
  visibility: DatasetVisibility;
  frequency: string;
  period_length: number;
  rows: number;
  available_columns: ColumnInfo[];
  selected_columns: string[];
  status: DatasetStatus;
  uploaded_at: string;
}

export interface DatasetPreview {
  dataset: Dataset;
  preview_rows: Record<string, unknown>[];
}

export function listDatasets() {
  return apiFetch<Dataset[]>("/datasets");
}

export function getDataset(id: number) {
  return apiFetch<Dataset>(`/datasets/${id}`);
}

export function previewDataset(id: number) {
  return apiFetch<DatasetPreview>(`/datasets/${id}/preview`);
}

export async function uploadDataset(
  name: string,
  frequency: string,
  periodLength: number,
  file: File
) {
  const form = new FormData();
  form.append("name", name);
  form.append("frequency", frequency);
  form.append("period_length", String(periodLength));
  form.append("file", file);

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/datasets/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json() as Promise<Dataset>;
}

export function updateDatasetColumns(
  id: number,
  payload: { selected_columns: string[]; frequency?: string; period_length?: number }
) {
  return apiFetch<Dataset>(`/datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
