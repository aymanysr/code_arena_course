import { DuelPanel } from "./DuelPanel.js";
import { TeamChat } from "./TeamChat.js";
import { TeamPanel } from "./TeamPanel.js";
import type { TeamChatClient } from "../arena/chat.js";
import type { ArenaSnapshot } from "../arena/types.js";

export function MatchPanel({
  snapshot,
  onSetReady,
  chat,
}: {
  snapshot: ArenaSnapshot;
  onSetReady: (value: boolean) => void;
  chat?: TeamChatClient | null;
}) {
  if (snapshot.mode === "2v2") {
    return (
      <div className="space-y-3">
        <TeamPanel alpha={snapshot.alpha} beta={snapshot.beta} ready={snapshot.ready} onSetReady={onSetReady} />
        <TeamChat client={chat} readOnly={snapshot.roundPhase === "MATCH_COMPLETE"} />
      </div>
    );
  }
  return <DuelPanel you={snapshot.you} opponent={snapshot.opponent} />;
}
