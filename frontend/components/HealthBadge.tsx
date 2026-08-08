import type { HealthResponse } from "@/lib/types";

type Status = "checking" | "ok" | "degraded" | "offline";

export function HealthBadge({
  health,
  status,
  onRefresh,
}: {
  health: HealthResponse | null;
  status: Status;
  onRefresh: () => void;
}) {
  const { dot, label } = STATUS_DISPLAY[status];
  return (
    <button
      onClick={onRefresh}
      title="Check backend connectivity"
      className={
        "group inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors " +
        "border-edge bg-raised/80 text-dim hover:border-line hover:text-ink"
      }
    >
      <span className={dot} />
      <span>{label}</span>
      {status !== "checking" && health && (
        <span className="ml-0.5 hidden sm:inline text-faint">
          · {health.model_class ?? "?"}
          {" · "}
          {health.n_features ?? "?"} features
        </span>
      )}
    </button>
  );
}

const STATUS_DISPLAY: Record<Status, { dot: string; label: string }> = {
  checking: { dot: "h-2 w-2 rounded-full bg-faint animate-pulse", label: "Checking…" },
  ok: {
    dot: "h-2 w-2 rounded-full bg-emerald-400",
    label: "API online",
  },
  degraded: {
    dot: "h-2 w-2 rounded-full bg-amber-400",
    label: "Model not loaded",
  },
  offline: { dot: "h-2 w-2 rounded-full bg-stress", label: "API offline" },
};
