// Very light tints used to tell neighbouring boxes apart at a glance. Class names are written out in
// full so Tailwind can see them.
export type Tone = "sky" | "violet" | "amber" | "emerald";

export const TONE_BOX: Record<Tone, string> = {
  sky: "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/30",
  violet: "border-violet-200 bg-violet-50 dark:border-violet-900/60 dark:bg-violet-950/30",
  amber: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
};
