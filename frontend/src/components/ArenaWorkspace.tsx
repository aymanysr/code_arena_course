import { CodeWorkspace } from "./CodeWorkspace.js";
import { MatchPanel } from "./MatchPanel.js";
import { ProblemPanel } from "./ProblemPanel.js";
import type { ArenaTransport } from "../arena/transport.js";
import type { CollabClient } from "../arena/collab.js";
import type { TeamChatClient } from "../arena/chat.js";
import type { ArenaSnapshot } from "../arena/types.js";

export function ArenaWorkspace({
  snapshot,
  transport,
  code,
  onCode,
  collab,
  chat,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  code: string;
  onCode: (code: string) => void;
  collab?: CollabClient | null;
  chat?: TeamChatClient | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,4fr)]">
      <ProblemPanel problem={snapshot.problem} />
      <CodeWorkspace snapshot={snapshot} transport={transport} code={code} onCode={onCode} collab={collab} />
      {/*
        ponytail: readiness checkbox is optimistic; the authoritative snapshot
        corrects it on the next refresh. Rejections (e.g. stale revision)
        stay silent here so a racing invalidate never pops a console error.
      */}
      <MatchPanel
        snapshot={snapshot}
        onSetReady={(v) => void transport.setReady(v).catch(() => {})}
        chat={chat}
      />
    </div>
  );
}
