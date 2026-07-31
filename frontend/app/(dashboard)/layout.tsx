import Nav from "@/components/Nav";
import ExperimentTracker from "@/components/ExperimentTracker";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Nav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      <ExperimentTracker />
    </div>
  );
}
