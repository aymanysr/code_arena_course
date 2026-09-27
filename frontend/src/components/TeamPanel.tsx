import { ReadyState } from "./ReadyState.js";
import { STATUS_LABEL } from "./status.js";
import type { Readiness, TeamView } from "../arena/types.js";

function TeamBlock({ title, team }: { title: string; team: TeamView }) {
  return (
    <div>
      <h4 className="px-3 pt-2 font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
      {team.members.map((m) => (
        <div key={m.name} className="flex items-baseline justify-between gap-2 px-3 py-1.5">
          <p className="text-sm text-neutral-900">{m.name}</p>
          <p className="font-mono text-xs text-neutral-500">
            {STATUS_LABEL[m.status]} · {m.presence}
          </p>
        </div>
      ))}
      <p className="px-3 pb-1 font-mono text-xs text-neutral-500">
        Team submissions: {team.submissions}
        {team.score !== null && ` · Team score: ${team.score}`}
      </p>
    </div>
  );
}

export function TeamPanel({
  alpha,
  beta,
  ready,
  onSetReady,
}: {
  alpha: TeamView;
  beta: TeamView;
  ready: Readiness;
  onSetReady: (value: boolean) => void;
}) {
  return (
    <section aria-label="Teams" className="rounded-md border border-neutral-200 bg-white">
      <TeamBlock title="Your team" team={alpha} />
      <div className="border-t border-neutral-200">
        <ReadyState ready={ready} onSetReady={onSetReady} />
      </div>
      <div className="border-t border-neutral-200 px-3 py-1 font-mono text-xs text-neutral-400">VS</div>
      <TeamBlock title="Other team" team={beta} />
    </section>
  );
}
