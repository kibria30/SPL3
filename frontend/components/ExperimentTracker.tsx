"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { listExperiments, type Experiment } from "@/lib/experiments";

interface Toast {
  id: number;
  experimentId: number;
  name: string;
  status: "completed" | "failed";
}

const POLL_INTERVAL_MS = 3000;
const TOAST_TTL_MS = 6000;

/** Mounted once in the dashboard layout so background experiments stay visible (as a floating
 * card panel) and their completion is announced (as a toast) no matter which page the user is
 * on -- not just while sitting on that experiment's own detail page.
 */
export default function ExperimentTracker() {
  const [activeJobs, setActiveJobs] = useState<Experiment[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const prevActiveIdsRef = useRef<Set<number>>(new Set());
  const toastCounterRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      let all: Experiment[];
      try {
        all = await listExperiments();
      } catch {
        return; // e.g. logged out or backend briefly unreachable -- next tick retries
      }
      if (cancelled) return;

      const active = all.filter((e) => e.status === "pending" || e.status === "running");
      const activeIds = new Set(active.map((e) => e.id));

      // Anything active in the previous poll but not this one just reached a terminal state.
      const justFinished = [...prevActiveIdsRef.current].filter((id) => !activeIds.has(id));
      const newToasts: Toast[] = [];
      for (const id of justFinished) {
        const exp = all.find((e) => e.id === id);
        if (exp && (exp.status === "completed" || exp.status === "failed")) {
          toastCounterRef.current += 1;
          newToasts.push({ id: toastCounterRef.current, experimentId: exp.id, name: exp.experiment_name, status: exp.status });
        }
      }
      if (newToasts.length > 0) {
        setToasts((prev) => [...prev, ...newToasts]);
        newToasts.forEach((t) => {
          setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), TOAST_TTL_MS);
        });
      }

      prevActiveIdsRef.current = activeIds;
      setActiveJobs(active);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <Link
            key={t.id}
            href={`/experiments/${t.experimentId}`}
            className={`block w-80 rounded-md border px-4 py-3 text-sm shadow-lg ${
              t.status === "completed"
                ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300"
                : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300"
            }`}
          >
            <p className="font-medium">{t.status === "completed" ? "Experiment completed" : "Experiment failed"}</p>
            <p className="opacity-80">{t.name}</p>
          </Link>
        ))}
      </div>

      {activeJobs.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 w-72">
          <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                Running ({activeJobs.length})
              </span>
              <span className="text-zinc-400">{collapsed ? "▲" : "▼"}</span>
            </button>
            {!collapsed && (
              <div className="max-h-64 space-y-1 overflow-y-auto border-t border-black/10 dark:border-white/10 p-2">
                {activeJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/experiments/${job.id}`}
                    className="block rounded-md px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{job.experiment_name}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">{job.status}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
