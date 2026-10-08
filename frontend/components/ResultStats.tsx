interface ResultStatsProps {
  modelName: string;
  modelFamily: string | null;
  trainingSeconds: number;
  parameters: number | null;
  mse: number | undefined;
  mae: number | undefined;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function Tile({ label, value, tag }: { label: string; value: string; tag?: string | null }) {
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

// The facts a reader looks for first: which model, how long it took, how big it is, how well it did.
export default function ResultStats({ modelName, modelFamily, trainingSeconds, parameters, mse, mae }: ResultStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      <div className="col-span-2 lg:col-span-1">
        <Tile label="Model" value={modelName} tag={modelFamily} />
      </div>
      <Tile label="Training time" value={formatDuration(trainingSeconds)} />
      <Tile label="Parameters" value={parameters !== null ? parameters.toLocaleString() : "—"} />
      <Tile label="MSE" value={mse !== undefined ? mse.toFixed(3) : "—"} />
      <Tile label="MAE" value={mae !== undefined ? mae.toFixed(3) : "—"} />
    </div>
  );
}
