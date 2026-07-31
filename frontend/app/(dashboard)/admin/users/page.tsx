"use client";

import { useEffect, useState } from "react";
import { listUsers, updateUserRole } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);

  function load() {
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
  }

  useEffect(load, []);

  async function handleRoleChange(userId: number, role: UserRole) {
    setError(null);
    setUpdating(userId);
    try {
      await updateUserRole(userId, role);
      load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError("You don't have admin privileges.");
      } else {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Users</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {users === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {users && (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Name</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Email</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600 dark:text-zinc-300">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10 bg-white dark:bg-zinc-950">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{u.name}</td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      disabled={updating === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="rounded-md border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm text-zinc-900 dark:text-zinc-50"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
