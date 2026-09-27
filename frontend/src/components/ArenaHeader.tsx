import type { ConnectionState } from "../arena/transport.js";
import type { MatchMode } from "../arena/types.js";

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const CONNECTION_VIEW: Record<ConnectionState, { dot: string; label: string }> = {
  connecting: { dot: "bg-neutral-400", label: "Connecting…" },
  connected: { dot: "bg-teal-600", label: "Connected" },
  reconnecting: { dot: "bg-neutral-500", label: "Reconnecting…" },
  offline: { dot: "bg-red-700", label: "Offline" },
};

export function ArenaHeader({
  mode,
  remainingSeconds,
  connection,
}: {
  mode: MatchMode;
  remainingSeconds: number;
  connection?: ConnectionState;
}) {
  const view = CONNECTION_VIEW[connection ?? "connected"];
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
      <h1 className="text-base font-semibold text-neutral-900">Code Arena</h1>
      <span className="rounded border border-neutral-300 px-2 py-0.5 font-mono text-xs text-neutral-600">{mode}</span>
      <span className="flex-1" />
      <span className="font-mono text-sm text-neutral-800" aria-label={`Match clock, ${clock(remainingSeconds)} remaining`}>
        {clock(remainingSeconds)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`inline-block h-2 w-2 rounded-full ${view.dot}`} aria-hidden="true" />
        <span className="font-mono text-xs text-neutral-600" role="status">
          {view.label}
        </span>
      </span>
    </header>
  );
}
