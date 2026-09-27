import { useEffect, useRef } from "react";
import type { RevealView } from "../arena/types.js";

export function RoundScoreReveal({ reveal, round }: { reveal: RevealView; round: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [round]);
  return (
    <section
      ref={ref}
      id="reveal-section"
      tabIndex={-1}
      aria-label={`Round ${round} score reveal`}
      className="rounded-md border border-teal-700 bg-white focus-visible:outline-2 focus-visible:outline-teal-700"
    >
      <h2 className="border-b border-neutral-200 px-3 py-2 text-sm font-semibold">
        Round {round}: {reveal.roundScore} / 100
      </h2>
      <table className="w-full font-mono text-xs">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="px-3 py-1 font-medium">Group</th>
            <th className="px-3 py-1 font-medium">Weight</th>
            <th className="px-3 py-1 font-medium">Earned</th>
          </tr>
        </thead>
        <tbody>
          {reveal.groups.map((g) => (
            <tr key={g.name} className="border-t border-neutral-100">
              <td className="px-3 py-1">{g.name}</td>
              <td className="px-3 py-1">{g.weight}</td>
              <td className="px-3 py-1">{g.earned}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 font-mono text-xs text-neutral-700" role="status">
        Match totals — you {reveal.totals.you} · opponent {reveal.totals.opponent}
      </p>
    </section>
  );
}
