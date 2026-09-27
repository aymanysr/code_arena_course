import { STATUS_LABEL } from "./status.js";
import type { SideView } from "../arena/types.js";

function SideRow({ side, you }: { side: SideView; you?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-neutral-900">
          {you ? "YOU" : side.name}
        </p>
        <p className="font-mono text-xs text-neutral-500">
          {STATUS_LABEL[side.status]} · {side.presence} · {side.submissions} submission{side.submissions === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

export function DuelPanel({ you, opponent }: { you: SideView; opponent: SideView }) {
  return (
    <section aria-label="Duel" className="rounded-md border border-neutral-200 bg-white">
      <SideRow side={you} you />
      <div className="border-t border-neutral-200 px-3 py-1 font-mono text-xs text-neutral-400">VS</div>
      <SideRow side={opponent} />
    </section>
  );
}
