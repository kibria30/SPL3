"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchCurrentUser, logoutUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import type { User } from "@/lib/types";

export default function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await logoutUser();
    router.push("/login");
    router.refresh();
  }

  const links = [
    { href: "/datasets", label: "Datasets" },
    { href: "/models", label: "Models" },
    { href: "/experiments", label: "Experiments" },
    { href: "/compare", label: "Compare" },
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-black/15 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:shadow-none">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href="/" className="mr-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            TS Forecasting Library
          </Link>
          {links.map((l) => {
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-base font-medium ${
                  active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {user.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="hidden text-base font-medium text-zinc-900 dark:text-zinc-50 sm:inline">{user.name}</span>
              {user.role === "admin" && (
                <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                  Admin
                </span>
              )}
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
