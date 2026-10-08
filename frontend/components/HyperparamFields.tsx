import { inputClass } from "@/components/form";

type Values = Record<string, unknown>;

interface HyperparamFieldsProps {
  values: Values;
  defaults: Values; // the model's defaults: decides each field's type and the "Reset" target
  onChange: (key: string, value: unknown) => void;
  onReset: () => void;
}

const LABELS: Record<string, string> = {
  epochs: "Epochs",
  lr: "Learning rate",
  batch_size: "Batch size",
  patience: "Early-stopping patience",
  rank: "Rank",
  ar_lags: "AR lags",
  decomposition: "Decomposition",
  order: "Order (p, d, q)",
  seasonal_order_pdq: "Seasonal order (P, D, Q)",
};

const OPTIONS: Record<string, { value: string; label: string }[]> = {
  decomposition: [
    { value: "cp", label: "CP" },
    { value: "cp_puzzle", label: "CP Puzzle" },
  ],
};

function labelFor(key: string) {
  if (LABELS[key]) return LABELS[key];
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Integer defaults (epochs, batch size) accept whole numbers only; fractional ones (learning rate) any number.
function parseNumber(raw: string, integer: boolean, fallback: number) {
  if (raw === "") return fallback;
  const n = integer ? parseInt(raw, 10) : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function Control({ k, value, def, onChange }: { k: string; value: unknown; def: unknown; onChange: (v: unknown) => void }) {
  if (OPTIONS[k]) {
    return (
      <select value={String(value ?? def)} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {OPTIONS[k].map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (typeof def === "number") {
    const integer = Number.isInteger(def);
    return (
      <input
        type="number" step={integer ? 1 : "any"} value={typeof value === "number" ? value : def}
        onChange={(e) => onChange(parseNumber(e.target.value, integer, def))}
        className={inputClass}
      />
    );
  }
  if (typeof def === "boolean") {
    return (
      <label className="flex h-[2.9rem] items-center gap-2 text-base text-zinc-700 dark:text-zinc-300">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
        {value ? "On" : "Off"}
      </label>
    );
  }
  if (Array.isArray(def) && def.every((d) => typeof d === "number")) {
    const current = Array.isArray(value) ? (value as number[]) : (def as number[]);
    return (
      <div className="flex gap-2">
        {(def as number[]).map((d, i) => (
          <input
            key={i} type="number" step={1} value={current[i] ?? d}
            onChange={(e) => onChange(current.map((c, j) => (j === i ? parseNumber(e.target.value, true, d) : c)))}
            className={inputClass}
          />
        ))}
      </div>
    );
  }
  // Anything else (nested objects, mixed arrays) is edited as text.
  return (
    <input
      type="text" value={typeof value === "string" ? value : JSON.stringify(value)}
      onChange={(e) => {
        try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
      }}
      className={`${inputClass} font-mono text-sm`}
    />
  );
}

// Hyperparameters as labelled fields (numbers, choices, small tuples) instead of a JSON box.
export default function HyperparamFields({ values, defaults, onChange, onReset }: HyperparamFieldsProps) {
  const keys = Object.keys(defaults);
  if (keys.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-medium text-zinc-700 dark:text-zinc-300">Hyperparameters</span>
        <button type="button" onClick={onReset} className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:underline">
          Reset to defaults
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((k) => (
          <div key={k}>
            <label className="mb-1.5 block text-sm text-zinc-500 dark:text-zinc-400">{labelFor(k)}</label>
            <Control k={k} value={values[k]} def={defaults[k]} onChange={(v) => onChange(k, v)} />
          </div>
        ))}
      </div>
    </div>
  );
}
