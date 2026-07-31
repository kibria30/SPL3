function formatCompact(value: number): string {
  // Auto-compact per the dataviz skill's stat-tile contract (1,284 / 12.9K / 4.2M) --
  // at this app's actual scale these will mostly render as plain integers, which is fine.
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}

interface StatTileProps {
  label: string;
  value: number;
}

export default function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-6 py-8 text-center">
      {/* Hero-figure sizing (>=48px) per the stat-tile spec; proportional figures, not
          tabular-nums -- this is a standalone value, not a column that needs to align. */}
      <p className="text-5xl font-semibold text-zinc-900 dark:text-zinc-50">{formatCompact(value)}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
