import { apiFetch } from "./api";
import type { Dataset, DatasetVisibility } from "./datasets";
import type { User, UserRole } from "./types";

export function refreshSystemDataset(slug: string) {
  return apiFetch<Dataset>(`/admin/datasets/system/${slug}/refresh`, { method: "POST" });
}

export function updateDatasetVisibility(datasetId: number, visibility: DatasetVisibility) {
  return apiFetch<Dataset>(`/admin/datasets/${datasetId}/visibility`, {
    method: "PATCH",
    body: JSON.stringify({ visibility }),
  });
}

export function deleteDataset(datasetId: number) {
  return apiFetch<void>(`/admin/datasets/${datasetId}`, { method: "DELETE" });
}

export function listUsers() {
  return apiFetch<User[]>("/admin/users");
}

export function updateUserRole(userId: number, role: UserRole) {
  return apiFetch<User>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
