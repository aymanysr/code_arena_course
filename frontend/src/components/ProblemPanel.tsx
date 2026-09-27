import type { ArenaProblem } from "../arena/types.js";

export function ProblemPanel({ problem }: { problem: ArenaProblem }) {
  return (
    <section aria-label="Problem" className="rounded-md border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-neutral-900">{problem.title}</h2>
        <p className="font-mono text-xs text-neutral-500">{problem.id}</p>
      </div>
      <p className="px-3 py-2 text-sm text-neutral-800">{problem.description}</p>
      <h3 className="px-3 font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">Examples</h3>
      <ul className="space-y-2 px-3 py-2">
        {problem.examples.map((e) => (
          <li key={e.id} className="rounded border border-neutral-200 bg-neutral-50 p-2 font-mono text-xs">
            <div>
              <span className="text-neutral-500">in&nbsp;&nbsp;</span>
              {e.input}
            </div>
            <div>
              <span className="text-neutral-500">out&nbsp;</span>
              {e.expected}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
