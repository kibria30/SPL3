import type { SplitPreview } from "@/lib/experiments";

interface SplitWindowsProps {
  preview: SplitPreview;
  testPeriods: number;
  inputPeriods: number;
  frequency: string; // the dataset's frequency, e.g. "hourly", "weekly"
}

const UNITS: Record<string, string> = { hourly: "hours", daily: "days", weekly: "weeks", monthly: "months" };

// "312 hours (13 days)" for hourly data, "312 weeks" otherwise; unknown frequencies fall back to "pts".
function span(points: number, frequency: string) {
  const unit = UNITS[frequency.toLowerCase()] ?? "pts";
  const extra = frequency.toLowerCase() === "hourly" && points >= 48 ? ` (${(points / 24).toFixed(points % 24 === 0 ? 0 : 1)} days)` : "";
  return `${points.toLocaleString()} ${unit}${extra}`;
}

// How the chosen split carves up the selected dataset: the held-out test window is the input window
// (history the model sees right before the forecast) plus the forecast window (what gets scored).
export default function SplitWindows({ preview, testPeriods, inputPeriods, frequency }: SplitWindowsProps) {
  const outputPeriods = testPeriods - inputPeriods;
  const rows: { label: string; points: number; periods: number | null; note: string }[] = [
    { label: "Training data", points: preview.train_len, periods: null, note: "everything before the test window" },
    { label: "Input window", points: preview.seq_len, periods: inputPeriods, note: "history right before the forecast" },
    { label: "Forecast window", points: preview.pred_len, periods: outputPeriods, note: "what the models predict and are scored on" },
  ];

  return (
    <div className="rounded-md border border-black/10 dark:border-white/10 p-4 text-sm text-zinc-600 dark:text-zinc-400">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">
        Test window: {span(preview.test_len, frequency)} ({testPeriods} periods) = input window + forecast window
      </p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{r.label}:</span> {span(r.points, frequency)}
            {r.periods !== null && ` (${r.periods} periods)`} <span className="text-xs">&mdash; {r.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
