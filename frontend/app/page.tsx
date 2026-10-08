"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import ExperimentTracker from "@/components/ExperimentTracker";
import ForecastIllustration from "@/components/ForecastIllustration";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchCurrentUser } from "@/lib/auth";
import { listExperiments, type Experiment } from "@/lib/experiments";
import { listModels, type ForecastingModel } from "@/lib/models";
import { getPlatformStats, type PlatformStats } from "@/lib/stats";
import type { User } from "@/lib/types";

const CARD = "rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900";

const FEATURES = [
  { title: "Same split for every model", text: "Each model forecasts the same window, so the scores can be compared." },
  { title: "Your data or ours", text: "Upload a CSV, or start with Traffic, ILI and live weather." },
  { title: "One leaderboard", text: "Error, training time and model size side by side." },
];

const MODEL_GROUPS = [
  { title: "Classical", models: ["Tensor-AR", "SARIMA", "ETS"] },
  { title: "Deep learning", models: ["DLinear", "iTransformer", "TimeXer", "TimeMixer"] },
];

const SHORTCUTS = [
  { href: "/datasets", label: "Datasets", text: "Browse and upload data" },
  { href: "/models", label: "Models", text: "Compare what each model does" },
  { href: "/experiments", label: "Experiments", text: "Track every run" },
  { href: "/compare", label: "Compare", text: "Models on one split" },
];

function Overview({ user, stats }: { user: User; stats: PlatformStats | null }) {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [models, setModels] = useState<ForecastingModel[]>([]);

  useEffect(() => {
    listExperiments().then(setExperiments).catch(() => setExperiments([]));
    listModels().then(setModels).catch(() => {});
  }, []);

  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const recent = useMemo(() => [...(experiments ?? [])].sort((a, b) => b.id - a.id).slice(0, 5), [experiments]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-100 dark:bg-black">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back, {user.name}
          </h1>
          <div className="flex gap-3">
            <Link href="/compare/new" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
              New comparison
            </Link>
            <Link
              href="/experiments/new"
              className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium text-zinc-900 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
            >
              New experiment
            </Link>
          </div>
        </div>

        {stats && (
          <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Datasets" value={stats.dataset_count} />
            <StatCard label="Models" value={stats.model_count} />
            <StatCard label="Experiments run" value={stats.experiment_count} />
          </div>
        )}

        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Recent experiments</h2>
            <Link href="/experiments" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">View all</Link>
          </div>
          <div className={`overflow-hidden ${CARD}`}>
            {experiments === null ? (
              <p className="p-5 text-base text-zinc-500 dark:text-zinc-400">Loading...</p>
            ) : recent.length === 0 ? (
              <div className="p-6">
                <p className="text-base text-zinc-700 dark:text-zinc-300">No experiments yet.</p>
                <Link href="/compare/new" className="mt-3 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
                  Run your first comparison
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {recent.map((e) => {
                  const model = modelById.get(e.model_id);
                  return (
                    <li key={e.id}>
                      <Link href={`/experiments/${e.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/5">
                        <span className="min-w-0 flex-1 truncate text-base font-medium text-zinc-900 dark:text-zinc-50">{e.experiment_name}</span>
                        <span className="text-base text-zinc-700 dark:text-zinc-300">
                          {model?.name ?? `#${e.model_id}`}
                        </span>
                        <StatusBadge status={e.status} />
                        <span className="w-40 text-right text-sm text-zinc-500 dark:text-zinc-400">{new Date(e.created_at).toLocaleDateString()}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Go to</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <Link key={s.href} href={s.href} className={`${CARD} p-4 transition hover:border-black/30 dark:hover:border-white/30`}>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{s.label}</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{s.text}</p>
              </Link>
            ))}
            {user.role === "admin" && (
              <Link href="/admin" className={`${CARD} p-4 transition hover:border-black/30 dark:hover:border-white/30`}>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Admin</p>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Datasets and user roles</p>
              </Link>
            )}
          </div>
        </section>
      </main>
      <ExperimentTracker />
    </div>
  );
}

function Landing({ stats }: { stats: PlatformStats | null }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-100 dark:bg-black">
      <ThemeToggle floating />

      <header className="mx-auto w-full max-w-6xl px-6 pt-6">
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">TS Forecasting Library</span>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_1.15fr] lg:py-20">
        <div>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Find out which forecasting model works on your data
          </h1>
          <p className="mt-5 max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
            Run Tensor-AR, SARIMA, ETS and four deep learning models on the same split, then compare their errors, speed and size.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-md bg-foreground px-5 py-2.5 text-base font-medium text-background">
              Create an account
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-black/20 bg-white px-5 py-2.5 text-base font-medium text-zinc-900 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-50"
            >
              Log in
            </Link>
          </div>
        </div>
        <ForecastIllustration />
      </section>

      {stats && (
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 pb-14 sm:grid-cols-3">
          <StatCard label="Datasets" value={stats.dataset_count} />
          <StatCard label="Models" value={stats.model_count} />
          <StatCard label="Experiments run" value={stats.experiment_count} />
        </section>
      )}

      <section className="border-y border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-y-8 px-6 py-12 md:grid-cols-3 md:divide-x md:divide-black/10 dark:md:divide-white/10">
          {FEATURES.map((f) => (
            <div key={f.title} className="md:px-8 md:first:pl-0 md:last:pr-0">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{f.title}</h2>
              <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-14">
        <h2 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Seven models, one place</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {MODEL_GROUPS.map((g) => (
            <div key={g.title} className={`${CARD} p-5`}>
              <h3 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">{g.title}</h3>
              <div className="flex flex-wrap gap-2">
                {g.models.map((m) => (
                  <span key={m} className="rounded-full border border-black/10 bg-zinc-50 px-3 py-1 text-base text-zinc-800 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  // Defaults to the logged-out view so a fresh visitor never sees a blank flash -- swaps to the
  // logged-in overview the moment fetchCurrentUser() resolves (same optimistic pattern Nav uses).
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetchCurrentUser().then(setUser).catch(() => setUser(null));
    getPlatformStats().then(setStats).catch(() => setStats(null));
  }, []);

  return user ? <Overview user={user} stats={stats} /> : <Landing stats={stats} />;
}
