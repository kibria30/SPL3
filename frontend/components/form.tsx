import type { ReactNode } from "react";
import SplitWindows from "@/components/SplitWindows";
import type { Dataset } from "@/lib/datasets";
import type { SplitPreview } from "@/lib/experiments";
import { familyLabel, type ForecastingModel } from "@/lib/models";
import type { SplitLimits } from "@/lib/splitLimits";

export const inputClass =
  "w-full rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-950 px-3.5 py-2.5 text-base text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";

const CARD = "rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900";

export function FormSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${CARD} p-6`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        {action}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-base font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

export function ColumnPicker({
  dataset, selected, onToggle, onSelectAll, onClear,
}: {
  dataset: Dataset;
  selected: string[];
  onToggle: (name: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const total = dataset.selected_columns.length;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-base font-medium text-zinc-700 dark:text-zinc-300">
          Columns <span className="text-zinc-500 dark:text-zinc-400">{selected.length} of {total}</span>
        </span>
        <div className="flex gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <button type="button" onClick={onSelectAll} className="hover:underline">Select all</button>
          <button type="button" onClick={onClear} className="hover:underline">Clear</button>
        </div>
      </div>
      <div className="grid max-h-52 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto rounded-md border border-black/15 dark:border-white/15 p-3.5 sm:grid-cols-3">
        {dataset.selected_columns.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 text-base text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={selected.includes(name)} onChange={() => onToggle(name)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
            <span className="truncate" title={name}>{name}</span>
          </label>
        ))}
      </div>
      {selected.length === 0 && <p className="mt-1.5 text-sm text-red-600">Select at least one column.</p>}
    </div>
  );
}

function Slider({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-base font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{value} periods</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900 dark:accent-zinc-100"
      />
      <div className="flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// The two window sliders (ranges follow the dataset), the resulting windows, and whether deep learning models can run.
export function SplitSection({
  dataset, limits, testPeriods, inputPeriods, setTestPeriods, setInputPeriods, preview, previewError,
}: {
  dataset: Dataset | null;
  limits: SplitLimits | null;
  testPeriods: number;
  inputPeriods: number;
  setTestPeriods: (v: number) => void;
  setInputPeriods: (v: number) => void;
  preview: SplitPreview | null;
  previewError: string | null;
}) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2">
        <Slider
          label="Test window" value={testPeriods}
          min={limits?.testMin ?? 3} max={limits?.testMax ?? 25}
          onChange={(v) => {
            setTestPeriods(v);
            if (inputPeriods >= v) setInputPeriods(v - 1);
          }}
        />
        <Slider
          label="Input window" value={inputPeriods}
          min={limits?.inputMin ?? 1} max={limits ? limits.inputMax(testPeriods) : Math.min(20, testPeriods - 1)}
          onChange={setInputPeriods}
        />
      </div>

      {previewError && <p className="text-sm text-red-600">{previewError}</p>}

      {preview && dataset && (
        <div className="space-y-3">
          <SplitWindows preview={preview} testPeriods={testPeriods} inputPeriods={inputPeriods} frequency={dataset.frequency} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <span className="text-zinc-500 dark:text-zinc-400">Deep learning models</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                preview.dl_eligible
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {preview.dl_eligible ? "Eligible" : "Not eligible"}
            </span>
            {!preview.dl_eligible && preview.recommended_test_periods !== null && preview.recommended_input_periods !== null && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Try test {preview.recommended_test_periods}, input {preview.recommended_input_periods}
              </span>
            )}
          </div>
          {preview.ineligible_reason && <p className="text-sm text-amber-700 dark:text-amber-400">{preview.ineligible_reason}</p>}
        </div>
      )}
    </>
  );
}

export function ModelTile({
  model, selected, eligible, onClick, multi,
}: { model: ForecastingModel; selected: boolean; eligible: boolean; onClick: () => void; multi: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={!eligible}
      onClick={onClick}
      title={eligible ? undefined : "Not eligible for this split"}
      className={`flex items-start justify-between gap-3 rounded-lg border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
        selected
          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800"
          : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
      }`}
    >
      <span>
        <span className="block text-base font-semibold text-zinc-900 dark:text-zinc-50">{model.name}</span>
        <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">{familyLabel(model.family)}</span>
      </span>
      <span
        aria-hidden
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-xs ${multi ? "rounded" : "rounded-full"} border-2 ${
          selected
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            : "border-black/25 dark:border-white/30"
        }`}
      >
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}
