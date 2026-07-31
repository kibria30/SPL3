import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Admin</h1>
      <div className="flex gap-4">
        <Link
          href="/admin/datasets"
          className="rounded-md border border-black/10 dark:border-white/10 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          System datasets
        </Link>
        <Link
          href="/admin/users"
          className="rounded-md border border-black/10 dark:border-white/10 px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50"
        >
          Users
        </Link>
      </div>
    </div>
  );
}
