import type { ReactNode } from "react";
import { TONE_BOX, type Tone } from "@/lib/tones";

export interface ConfigItem {
  label: string;
  value: ReactNode;
}

export interface ConfigGroup {
  title: string;
  tone: Tone;
  items: ConfigItem[];
  chips?: { label: string; value: string }[]; // e.g. hyperparameters as key = value pills
}

// Read-only summary of how a run was configured: one lightly tinted box per group.
export default function ConfigPanel({ groups }: { groups: ConfigGroup[] }) {
  return (
    <section className="mb-6 rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900 p-5">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Configuration</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className={`rounded-lg border p-4 ${TONE_BOX[g.tone]}`}>
            <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">{g.title}</h3>
            <dl className="space-y-3">
              {g.items.map((item) => (
                <div key={item.label}>
                  <dt className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</dt>
                  <dd className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{item.value}</dd>
                </div>
              ))}
            </dl>
            {g.chips && g.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.chips.map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full border border-black/10 dark:border-white/15 bg-white/70 dark:bg-zinc-900/60 px-2.5 py-1 font-mono text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    {c.label} = {c.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
