"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { listModels, type ForecastingModel } from "@/lib/models";

const FAMILY_STYLES: Record<ForecastingModel["family"], string> = {
  classical: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  trained: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

const FAMILY_EXPLANATION: Record<ForecastingModel["family"], string> = {
  classical:
    "Fits once on all pre-test history and extrapolates forward -- no gradient training, always eligible regardless of how much train data is available.",
  trained:
    "Learns a general seq_len -> pred_len mapping via gradient descent on sliding windows -- needs enough train and validation data to build at least one window of each.",
};

export default function ModelDetailPage() {
  const params = useParams<{ slug: string }>();
  const [model, setModel] = useState<ForecastingModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModels()
      .then((all) => {
        const found = all.find((m) => m.slug === params.slug);
        if (!found) {
          setError(`No model with slug '${params.slug}'`);
        } else {
          setModel(found);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load model"));
  }, [params.slug]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!model) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <Link href="/models" className="mb-4 inline-block text-sm text-zinc-500 dark:text-zinc-400 underline">
        &larr; Back to models
      </Link>

      <div className="mb-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{model.name}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${FAMILY_STYLES[model.family]}`}>
          {model.family}
        </span>
      </div>

      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{FAMILY_EXPLANATION[model.family]}</p>

      {model.description && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{model.description}</p>
        </section>
      )}

      {(model.paper_title || model.publication || model.year || model.authors) && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Paper</h2>
          {model.paper_title && <p className="text-sm text-zinc-900 dark:text-zinc-50">{model.paper_title}</p>}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {[model.authors, model.publication, model.year].filter(Boolean).join(" · ")}
          </p>
          {model.github_url && (
            <a
              href={model.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm text-blue-600 dark:text-blue-400 underline"
            >
              Reference implementation &rarr;
            </a>
          )}
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Default hyperparameters
        </h2>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Editable per experiment when this model is selected in the experiment creation form.
        </p>
        <pre className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 p-3 text-xs text-zinc-900 dark:text-zinc-50">
          {JSON.stringify(model.default_hyperparams, null, 2)}
        </pre>
      </section>
    </div>
  );
}
