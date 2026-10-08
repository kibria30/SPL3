import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  tag?: string | null;
}

// A headline fact: small label over a large value, optional tag underneath.
export default function StatCard({ label, value, tag }: StatCardProps) {
  return (
    <div className="rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900 px-5 py-4">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      {tag && (
        <span className="mt-2 inline-block rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-sm text-zinc-600 dark:text-zinc-300">
          {tag}
        </span>
      )}
    </div>
  );
}
