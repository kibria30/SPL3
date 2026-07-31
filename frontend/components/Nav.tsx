"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchCurrentUser, logoutUser } from "@/lib/auth";
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
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <nav className="border-b border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
            TS Forecasting Library
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname?.startsWith(l.href)
                  ? "text-sm font-medium text-zinc-900 dark:text-zinc-50"
                  : "text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              }
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {user.name} {user.role === "admin" && "(admin)"}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
