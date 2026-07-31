"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listModels, type ForecastingModel } from "@/lib/models";

const FAMILY_STYLES: Record<ForecastingModel["family"], string> = {
  classical: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  trained: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export default function ModelsPage() {
  const [models, setModels] = useState<ForecastingModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModels()
      .then(setModels)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load models"));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Models</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        The 7 forecasting models available for experiments -- Tensor-AR is the paper this app
        exists to demonstrate; the rest are baselines it&apos;s compared against.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {models === null && !error && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      )}

      {models && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <Link
              key={m.slug}
              href={`/models/${m.slug}`}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 p-4 hover:border-black/20 dark:hover:border-white/20"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{m.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_STYLES[m.family]}`}>
                  {m.family}
                </span>
              </div>
              {m.publication && m.year && (
                <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {m.publication} {m.year}
                </p>
              )}
              {m.description && (
                <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{m.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
