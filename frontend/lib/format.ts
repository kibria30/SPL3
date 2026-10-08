const UNITS: Record<string, string> = { hourly: "hours", daily: "days", weekly: "weeks", monthly: "months" };

// "312 hours (13 days)" for hourly data, "312 weeks" otherwise; unknown frequencies fall back to "pts".
export function formatSpan(points: number, frequency: string | null | undefined): string {
  const freq = (frequency ?? "").toLowerCase();
  const unit = UNITS[freq] ?? "pts";
  const days = freq === "hourly" && points >= 48 ? ` (${(points / 24).toFixed(points % 24 === 0 ? 0 : 1)} days)` : "";
  return `${points.toLocaleString()} ${unit}${days}`;
}
