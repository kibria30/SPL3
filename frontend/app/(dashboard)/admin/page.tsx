import Link from "next/link";

const SECTIONS = [
  { href: "/admin/datasets", title: "System datasets", text: "Refresh built-in data and manage uploads" },
  { href: "/admin/users", title: "Users", text: "Change roles and review accounts" },
];

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Admin</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-black/15 bg-white p-5 shadow-sm transition hover:border-black/30 dark:border-white/10 dark:bg-zinc-900 dark:shadow-none dark:hover:border-white/30"
          >
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{s.title}</p>
            <p className="mt-0.5 text-base text-zinc-500 dark:text-zinc-400">{s.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
