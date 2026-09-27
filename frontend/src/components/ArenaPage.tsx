import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArenaHeader } from "./ArenaHeader.js";
import { MatchResult } from "./MatchResult.js";
import { PhaseBanner } from "./PhaseBanner.js";
import { RoundScoreReveal } from "./RoundScoreReveal.js";
import type { CollabClient } from "../arena/collab.js";
import type { TeamChatClient } from "../arena/chat.js";
import { createArenaSidecarLifecycle, type LiveClientConfig } from "../arena/sidecars.js";
import type { ArenaTransport } from "../arena/transport.js";
import { useArena } from "../arena/useArena.js";

const ArenaWorkspace = lazy(() =>
  import("./ArenaWorkspace.js").then(({ ArenaWorkspace: workspace }) => ({ default: workspace })),
);

/**
 * Local draft key (ticket 11 §5): server state and the unsent editor draft
 * are different things. The draft lives in this browser only, scoped to the
 * exact round/problem/language so a stale reconnect never carries round-1
 * code into round 2. Hard refresh restores it; a new device starts from the
 * starter. The server never sees the draft — only explicit Run/Submit
 * payloads leave the browser.
 */
function draftKey(transport: ArenaTransport, round: number, problem: string, language: string): string {
  return `arena-draft:${transport.scopeKey()}:${round}:${problem}:${language}`;
}

function loadDraft(transport: ArenaTransport, round: number, problem: string, language: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(transport, round, problem, language));
  } catch {
    return null;
  }
}

export function ArenaPage({ transport }: { transport: ArenaTransport }) {
  const snapshot = useArena(transport);
  const starter = snapshot.problem.starters[snapshot.language as "Python"] ?? "";
  const [code, setCode] = useState(() => loadDraft(transport, snapshot.round, snapshot.problem.id, snapshot.language) ?? starter);
  const [actionError, setActionError] = useState<string | null>(null);
  const fixtureControls = transport.fixtureControls?.() ?? null;
  const terminal = snapshot.roundPhase === "MATCH_COMPLETE";
  const sidecarLifecycle = useMemo(() => createArenaSidecarLifecycle(), []);

  // Ticket 15: live 2v2 binds the team Y.Doc (one provider per round —
  // round-scoped so old-round state can never merge forward). 1v1 and mocks
  // keep the local controlled document.
  const collabConfig: LiveClientConfig | null = useMemo(() => {
    if (snapshot.mode !== "2v2" || typeof transport.collabConfig !== "function") return null;
    return transport.collabConfig();
  }, [transport, snapshot.mode, snapshot.round]);

  const chatConfig: LiveClientConfig | null = useMemo(() => {
    if (snapshot.mode !== "2v2" || typeof transport.chatConfig !== "function") return null;
    return transport.chatConfig();
  }, [transport, snapshot.mode]);

  const sidecarScope = useMemo(
    () => ({ transportKey: transport, round: snapshot.round, collabConfig, chatConfig }),
    [transport, snapshot.round, collabConfig, chatConfig],
  );

  const [collab, setCollab] = useState<CollabClient | null>(null);
  const [chat, setChat] = useState<TeamChatClient | null>(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCollabError(null);

    const pending = sidecarLifecycle.sync(sidecarScope);
    const current = sidecarLifecycle.getState();
    setCollab(current.collab);
    setChat(current.chat);
    setClientsLoading(sidecarScope.collabConfig !== null || sidecarScope.chatConfig !== null);

    void pending
      .then((next) => {
        if (cancelled || !next) return;
        setCollab(next.collab);
        setChat(next.chat);
        setClientsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setClientsLoading(false);
        setCollabError(error instanceof Error ? error.message : "Unable to load live collaboration.");
      });

    return () => {
      cancelled = true;
    };
  }, [sidecarLifecycle, sidecarScope]);

  useEffect(() => () => sidecarLifecycle.dispose(), [sidecarLifecycle]);

  useEffect(() => {
    if (!collab) return;
    setCollabError(null);
    let cancelled = false;
    collab
      .connect()
      .then(() => {
        if (!cancelled) setCode(collab.getSource());
      })
      .catch((e: unknown) => {
        if (!cancelled) setCollabError(e instanceof Error ? e.message : "shared doc unavailable");
      });
    const unsub = collab.subscribe(() => setCode(collab.getSource()));
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaCollab?: CollabClient | null }).__arenaCollab = collab;
    }
    return () => {
      cancelled = true;
      unsub();
      if (typeof window !== "undefined") {
        (window as unknown as { __arenaCollab?: CollabClient | null }).__arenaCollab = null;
      }
    };
  }, [collab]);

  // Ticket 16: live 2v2 binds the team chat client. 1v1 and mocks keep null.
  useEffect(() => {
    if (!chat) return;
    chat.connect().catch(() => {});
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaChat?: TeamChatClient | null }).__arenaChat = chat;
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as unknown as { __arenaChat?: TeamChatClient | null }).__arenaChat = null;
      }
    };
  }, [chat]);

  useEffect(() => {
    // 2v2 shared doc: the server is the truth — a stale localStorage draft
    // must never overwrite it on hard refresh (§26D).
    if (collab) return;
    setCode(loadDraft(transport, snapshot.round, snapshot.problem.id, snapshot.language) ?? starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport, collab, snapshot.round, snapshot.problem.id, snapshot.language]);

  useEffect(() => {
    if (collab) return;
    try {
      window.localStorage.setItem(draftKey(transport, snapshot.round, snapshot.problem.id, snapshot.language), code);
    } catch {
      // Storage full/blocked: draft stays in memory for the session.
    }
  }, [transport, collab, snapshot.round, snapshot.problem.id, snapshot.language, code]);

  function act(fn: () => Promise<unknown>): () => void {
    return () => {
      setActionError(null);
      fn().catch((e: unknown) => setActionError(e instanceof Error ? e.message : "action failed"));
    };
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <a href="#arena-main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2">
        Skip to arena
      </a>
      <ArenaHeader mode={snapshot.mode} remainingSeconds={snapshot.remainingSeconds} connection={transport.connection()} />
      <main id="arena-main" className="mx-auto max-w-7xl space-y-3 p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <PhaseBanner phase={snapshot.roundPhase} round={snapshot.round} totalRounds={snapshot.totalRounds} />
          </div>
          {!terminal && (
            <button
              type="button"
              className="rounded border border-neutral-300 bg-white px-2 py-1 font-mono text-xs text-neutral-600"
              onClick={() => {
                // Deliberate leave only (§15): immediate forfeit. Socket loss
                // never routes here.
                if (window.confirm("Leave the match? Leaving forfeits immediately.")) {
                  act(() => transport.leave())();
                }
              }}
            >
              Leave match
            </button>
          )}
        </div>
        {snapshot.notice && (
          <p role="status" className="rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs">
            {snapshot.notice}
          </p>
        )}
        {(snapshot.roundPhase === "ROUND_INTRO" || snapshot.roundPhase === "MATCH_FOUND") && (
          <button
            type="button"
            className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
            onClick={act(async () => {
              if (snapshot.roundPhase === "MATCH_FOUND") await transport.startRound();
              await transport.beginCoding();
            })}
          >
            Start round
          </button>
        )}
        {actionError && (
          <p role="alert" className="rounded-md border border-red-700 bg-white px-3 py-2 font-mono text-xs text-red-700">
            {actionError}
          </p>
        )}
        {collabError && (
          <p role="alert" className="rounded-md border border-red-700 bg-white px-3 py-2 font-mono text-xs text-red-700">
            Shared editor: {collabError}
          </p>
        )}
        {(snapshot.roundPhase === "CODING" || snapshot.roundPhase === "SCORE_REVEAL") &&
          (clientsLoading || (collabConfig !== null && collab === null) ? (
            <p className="rounded border border-neutral-200 bg-white p-4 font-mono text-sm text-neutral-500" role="status">
              {clientsLoading ? "Loading shared workspace…" : "The shared workspace is unavailable."}
            </p>
          ) : (
            <Suspense
              fallback={
                <p className="rounded border border-neutral-200 bg-white p-4 font-mono text-sm text-neutral-500" role="status">
                  Loading editor…
                </p>
              }
            >
              <ArenaWorkspace snapshot={snapshot} transport={transport} code={code} onCode={setCode} collab={collab} chat={chat} />
            </Suspense>
          ))}
        {snapshot.roundPhase === "SCORE_REVEAL" && snapshot.reveal && (
          <>
            <RoundScoreReveal reveal={snapshot.reveal} round={snapshot.round} />
            <button
              type="button"
              className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
              onClick={act(() => transport.advance())}
            >
              {snapshot.round < snapshot.totalRounds ? "Next round" : "See final result"}
            </button>
          </>
        )}
        {snapshot.roundPhase === "MATCH_COMPLETE" && snapshot.reveal && (
          <MatchResult reveal={snapshot.reveal} round={snapshot.round} matchFinal={snapshot.matchFinal} />
        )}
        {fixtureControls && (
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-2" aria-label="Mock controls">
            <span className="font-mono text-xs text-neutral-500">mock:</span>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
              onClick={() => fixtureControls.publishReveal()}
            >
              publish reveal
            </button>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
              onClick={() => fixtureControls.nextRound()}
            >
              next round
            </button>
            <button
              type="button"
              className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
              onClick={() => fixtureControls.setMateReady(true)}
            >
              mate ready
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
