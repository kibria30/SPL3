interface ResultStatsProps {
  trainingSeconds: number;
  parameters: number | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

// Fit time and model size, shown as headline tiles above the chart rather than a footnote.
export default function ResultStats({ trainingSeconds, parameters }: ResultStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Tile label="Training time" value={formatDuration(trainingSeconds)} hint="time to fit the model" />
      <Tile
        label="Model parameters"
        value={parameters !== null ? parameters.toLocaleString() : "—"}
        hint={parameters !== null ? "fitted values in the model" : "not reported for this model"}
      />
    </div>
  );
}
