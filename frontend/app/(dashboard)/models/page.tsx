"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { familyLabel, listModels, type ForecastingModel } from "@/lib/models";

const FAMILY_STYLES: Record<ForecastingModel["family"], string> = {
  classical: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  trained: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const FAMILY_TITLES: Record<ForecastingModel["family"], string> = {
  classical: "Classical models",
  trained: "Deep learning models",
};

function hyperparamChips(m: ForecastingModel) {
  return Object.entries(m.default_hyperparams).map(([k, v]) => `${k} = ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
}

function ModelCard({ m }: { m: ForecastingModel }) {
  const chips = hyperparamChips(m);
  return (
    <Link
      href={`/models/${m.slug}`}
      className="flex flex-col rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900 p-5 transition hover:border-black/30 dark:hover:border-white/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-50">{m.name}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium ${FAMILY_STYLES[m.family]}`}>{familyLabel(m.family)}</span>
      </div>
      {m.publication && m.year && (
        <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {m.publication} {m.year}
          {m.authors ? ` · ${m.authors}` : ""}
        </p>
      )}
      {m.description && <p className="mt-3 line-clamp-2 text-base text-zinc-600 dark:text-zinc-400">{m.description}</p>}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-0.5 font-mono text-sm text-zinc-700 dark:text-zinc-300">
              {c}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

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
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Models</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {models === null && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>}

      {models &&
        (["classical", "trained"] as const).map((family) => {
          const items = models.filter((m) => m.family === family);
          if (items.length === 0) return null;
          return (
            <section key={family} className="mb-8">
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
                {FAMILY_TITLES[family]} <span className="text-zinc-500 dark:text-zinc-400">({items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((m) => (
                  <ModelCard key={m.slug} m={m} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
