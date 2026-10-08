import type { ReactNode } from "react";

export interface ConfigItem {
  label: string;
  value: ReactNode;
}

export interface ConfigGroup {
  title: string;
  items: ConfigItem[];
  chips?: { label: string; value: string }[]; // e.g. hyperparameters as key = value pills
}

// Read-only summary of how a run was configured: grouped label/value cells instead of a sentence.
export default function ConfigPanel({ groups }: { groups: ConfigGroup[] }) {
  return (
    <section className="mb-6 rounded-lg border border-black/15 shadow-sm dark:border-white/10 dark:shadow-none bg-white dark:bg-zinc-900 p-5">
      <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Configuration
      </h2>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {g.title}
            </h3>
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
                    className="rounded-full border border-black/15 dark:border-white/15 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 font-mono text-sm text-zinc-700 dark:text-zinc-300"
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
