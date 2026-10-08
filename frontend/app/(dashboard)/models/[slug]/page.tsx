"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import StatCard from "@/components/StatCard";
import { familyLabel, listModels, type ForecastingModel } from "@/lib/models";

const FAMILY_STYLES: Record<ForecastingModel["family"], string> = {
  classical: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  trained: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const CARD = "rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900";

export default function ModelDetailPage() {
  const params = useParams<{ slug: string }>();
  const [model, setModel] = useState<ForecastingModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModels()
      .then((all) => {
        const found = all.find((m) => m.slug === params.slug);
        if (!found) setError(`No model with slug '${params.slug}'`);
        else setModel(found);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load model"));
  }, [params.slug]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!model) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  const hyperparams = Object.entries(model.default_hyperparams);
  const hasPaper = model.paper_title || model.publication || model.year || model.authors;

  return (
    <div className="max-w-4xl">
      <Link href="/models" className="mb-3 inline-block text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        &larr; Models
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{model.name}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${FAMILY_STYLES[model.family]}`}>{familyLabel(model.family)}</span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Family" value={familyLabel(model.family)} />
        <StatCard label="Training" value={model.requires_training ? "Required" : "None"} />
        <StatCard label="Published" value={model.publication && model.year ? `${model.publication} ${model.year}` : "—"} />
        <StatCard label="Parameters set" value={hyperparams.length} />
      </div>

      {model.description && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">About</h2>
          <div className={`${CARD} p-5`}>
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">{model.description}</p>
          </div>
        </section>
      )}

      {hasPaper && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Paper</h2>
          <div className={`${CARD} p-5`}>
            {model.paper_title && <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{model.paper_title}</p>}
            <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">
              {[model.authors, model.publication, model.year].filter(Boolean).join(" · ")}
            </p>
            {model.github_url && (
              <a
                href={model.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-md border border-black/15 dark:border-white/15 px-3 py-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Reference implementation &rarr;
              </a>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Default hyperparameters</h2>
        {hyperparams.length === 0 ? (
          <p className="text-base text-zinc-500 dark:text-zinc-400">None</p>
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="min-w-full divide-y divide-black/10 dark:divide-white/10 text-base">
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {hyperparams.map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-1/3 px-5 py-3 text-zinc-500 dark:text-zinc-400">{k}</td>
                    <td className="px-5 py-3 font-mono font-medium text-zinc-900 dark:text-zinc-50">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
