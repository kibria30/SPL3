import type { SplitPreview } from "@/lib/experiments";
import { formatSpan as span } from "@/lib/format";

interface SplitWindowsProps {
  preview: SplitPreview;
  testPeriods: number;
  inputPeriods: number;
  frequency: string; // the dataset's frequency, e.g. "hourly", "weekly"
}

// How the chosen split carves up the selected dataset: training data, then the test window made of
// an input window (history) and a forecast window (what gets scored).
export default function SplitWindows({ preview, testPeriods, inputPeriods, frequency }: SplitWindowsProps) {
  const cells = [
    { label: "Training data", value: span(preview.train_len, frequency), sub: null },
    { label: "Test window", value: span(preview.test_len, frequency), sub: `${testPeriods} periods` },
    { label: "Input window", value: span(preview.seq_len, frequency), sub: `${inputPeriods} periods` },
    { label: "Forecast window", value: span(preview.pred_len, frequency), sub: `${testPeriods - inputPeriods} periods` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border border-black/15 dark:border-white/10 p-4 sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{c.label}</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{c.value}</p>
          {c.sub && <p className="text-sm text-zinc-500 dark:text-zinc-400">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
