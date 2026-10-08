import StatCard from "@/components/StatCard";

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

// The facts a reader looks for first: which model, how long it took, how big it is, how well it did.
export default function ResultStats({ modelName, modelFamily, trainingSeconds, parameters, mse, mae }: ResultStatsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
      <div className="col-span-2 lg:col-span-1">
        <StatCard label="Model" value={modelName} tag={modelFamily} />
      </div>
      <StatCard label="Training time" value={formatDuration(trainingSeconds)} />
      <StatCard label="Parameters" value={parameters !== null ? parameters.toLocaleString() : "—"} />
      <StatCard label="MSE" value={mse !== undefined ? mse.toFixed(3) : "—"} />
      <StatCard label="MAE" value={mae !== undefined ? mae.toFixed(3) : "—"} />
    </div>
  );
}
