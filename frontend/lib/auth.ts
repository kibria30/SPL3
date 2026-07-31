import { apiFetch } from "./api";
import type { User } from "./types";

export function registerUser(name: string, email: string, password: string) {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginUser(email: string, password: string) {
  return apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logoutUser() {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}

export function fetchCurrentUser() {
  return apiFetch<User>("/auth/me");
}
