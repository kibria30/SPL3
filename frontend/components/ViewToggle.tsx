import type { ViewMode } from "@/lib/viewMode";

const OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  {
    value: "list",
    label: "List view",
    icon: <path d="M4 6h16M4 12h16M4 18h16" />,
  },
  {
    value: "cards",
    label: "Card view",
    icon: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  },
];

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-black/15 dark:border-white/15" role="group" aria-label="View">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={mode === o.value}
          aria-label={o.label}
          title={o.label}
          className={`flex h-9 w-10 items-center justify-center ${
            mode === o.value
              ? "bg-foreground text-background"
              : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
