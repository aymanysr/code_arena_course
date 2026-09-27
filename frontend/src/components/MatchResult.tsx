import type { MatchFinalView, RevealView } from "../arena/types.js";

export function MatchResult({
  reveal,
  round,
  matchFinal,
}: {
  reveal: RevealView;
  round: number;
  matchFinal?: MatchFinalView | null;
}) {
  const you = matchFinal?.you ?? reveal.totals.you;
  const opponent = matchFinal?.opponent ?? reveal.totals.opponent;
  const outcome =
    matchFinal?.outcome ??
    (reveal.totals.you > reveal.totals.opponent
      ? "You win the match."
      : reveal.totals.you < reveal.totals.opponent
        ? "Opponent wins the match."
        : "The match is a draw.");
  return (
    <section aria-label="Match result" className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <h2 className="text-sm font-semibold">Match complete after {round} round{round === 1 ? "" : "s"}</h2>
      <p className="font-mono text-xs text-neutral-700" role="status">
        Final — you {you} · opponent {opponent}. {outcome}
      </p>
    </section>
  );
}
