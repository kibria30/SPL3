import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black px-4 text-center">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Visual TS Forecasting Library
      </h1>
      <p className="mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
        Compare Tensor-AR against DLinear, iTransformer, TimeXer, and TimeMixer on weather,
        traffic, and ILI data -- with proper experiment bookkeeping.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-full bg-foreground text-background px-6 py-2 text-sm font-medium"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-black/10 dark:border-white/15 px-6 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
