"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import ExperimentTracker from "@/components/ExperimentTracker";
import StatTile from "@/components/StatTile";
import { fetchCurrentUser } from "@/lib/auth";
import { getPlatformStats, type PlatformStats } from "@/lib/stats";
import type { User } from "@/lib/types";

const SHORTCUTS = [
  { href: "/datasets", label: "Datasets", description: "Browse system datasets or upload your own." },
  { href: "/models", label: "Models", description: "See the 7 forecasting models available for experiments." },
  { href: "/experiments/new", label: "New experiment", description: "Run a model against a dataset with a custom split." },
  { href: "/experiments", label: "Experiments", description: "View results and track running experiments." },
  { href: "/compare/new", label: "New comparison", description: "Run several models on the same split to compare them." },
  { href: "/compare", label: "Compare", description: "Compare multiple models' results side by side." },
];

export default function Home() {
  // Defaults to the logged-out view so a fresh visitor never sees a blank flash -- swaps to the
  // logged-in overview the moment fetchCurrentUser() resolves (same optimistic pattern Nav uses).
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
    getPlatformStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (user) {
    return (
      <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Here&apos;s the overall picture, and shortcuts back to where you left off.
          </p>

          {stats && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile label="Datasets" value={stats.dataset_count} />
              <StatTile label="Forecasting models" value={stats.model_count} />
              <StatTile label="Experiments run" value={stats.experiment_count} />
            </div>
          )}

          <h2 className="mb-4 mt-10 text-lg font-medium text-zinc-900 dark:text-zinc-50">Jump to</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHORTCUTS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 hover:border-black/20 dark:hover:border-white/20"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{s.label}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{s.description}</p>
              </Link>
            ))}
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 hover:border-black/20 dark:hover:border-white/20"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">Admin</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Manage system datasets and user roles.
                </p>
              </Link>
            )}
          </div>
        </main>
        <ExperimentTracker />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Visual TS Forecasting Library
        </h1>
        <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Compare Tensor-AR against DLinear, iTransformer, TimeXer, and TimeMixer on weather,
          traffic, and ILI data &mdash; with proper experiment bookkeeping.
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/login"
            className="rounded-full bg-foreground text-background px-6 py-2 text-sm font-medium"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full border border-black/10 dark:border-white/15 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50"
          >
            Register
          </Link>
        </div>
      </section>

      {stats && (
        <section className="border-t border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-4 py-16">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Datasets" value={stats.dataset_count} />
            <StatTile label="Forecasting models" value={stats.model_count} />
            <StatTile label="Experiments run" value={stats.experiment_count} />
          </div>
        </section>
      )}
    </div>
  );
}
