import { TONE_BOX, type Tone } from "@/lib/tones";

// A label over a value in a lightly tinted box; used on the dataset, compare and experiment cards.
export default function FactBox({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${TONE_BOX[tone]}`}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
