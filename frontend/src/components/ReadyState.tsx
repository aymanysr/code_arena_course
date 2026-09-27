import type { Readiness } from "../arena/types.js";

export function ReadyState({
  ready,
  onSetReady,
}: {
  ready: Readiness;
  onSetReady: (value: boolean) => void;
}) {
  return (
    <div className="px-3 py-2" role="group" aria-label="Team readiness">
      <label className="flex items-center gap-2 text-sm text-neutral-800">
        <input type="checkbox" checked={ready.you} onChange={(e) => onSetReady(e.target.checked)} />
        You are ready
      </label>
      <p className="mt-1 font-mono text-xs text-neutral-600" role="status">
        Teammate: {ready.mate ? "Ready" : "Not ready"}
      </p>
      <p className="font-mono text-xs font-medium text-neutral-800" role="status">
        {ready.you && ready.mate ? "Both teammates ready." : "Waiting for teammate readiness…"}
      </p>
    </div>
  );
}
