import type { RoundPhase } from "../arena/types.js";

const MESSAGE: Record<RoundPhase, string> = {
  MATCH_FOUND: "Match found. Get ready.",
  ROUND_INTRO: "Round intro. Start the round to begin coding.",
  CODING: "Coding. Run visible examples, then submit for sealed evaluation.",
  SCORE_REVEAL: "Scores revealed. Review group breakdown below.",
  ROUND_COMPLETE: "Round complete.",
  MATCH_COMPLETE: "Match complete.",
};

export function PhaseBanner({ phase, round, totalRounds }: { phase: RoundPhase; round: number; totalRounds: number }) {
  return (
    <div role="status" className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
      <span className="font-mono text-xs text-neutral-500">
        Round {round}/{totalRounds} · {phase}
      </span>
      <p className="mt-0.5">{MESSAGE[phase]}</p>
    </div>
  );
}
