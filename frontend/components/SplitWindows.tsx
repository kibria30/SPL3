import type { SplitPreview } from "@/lib/experiments";
import { formatSpan as span } from "@/lib/format";

interface SplitWindowsProps {
  preview: SplitPreview;
  testPeriods: number;
  inputPeriods: number;
  frequency: string; // the dataset's frequency, e.g. "hourly", "weekly"
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
