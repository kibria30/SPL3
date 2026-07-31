import type { ExperimentStatus } from "@/lib/experiments";

const STATUS_STYLES: Record<ExperimentStatus, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function StatusBadge({ status }: { status: ExperimentStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{status}</span>
  );
}
