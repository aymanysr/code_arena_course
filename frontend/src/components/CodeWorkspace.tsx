import { useEffect, useRef, useState } from "react";
import { EditorAdapter, type EditorAdapterHandle } from "./EditorAdapter.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { TestPanel } from "./TestPanel.js";
import type { ArenaTransport } from "../arena/transport.js";
import type { CollabClient } from "../arena/collab.js";
import type { ArenaSnapshot } from "../arena/types.js";

export function CodeWorkspace({
  snapshot,
  transport,
  code,
  onCode,
  collab,
}: {
  snapshot: ArenaSnapshot;
  transport: ArenaTransport;
  code: string;
  onCode: (code: string) => void;
  /** 2v2 live only: team Y.Doc provider. Absent = local document (1v1/mock). */
  collab?: CollabClient | null;
}) {
  const editorRef = useRef<EditorAdapterHandle>(null);
  const [fontSize, setFontSize] = useState(13);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Re-render on collab sync/connection transitions (read-only + gating).
  const [collabTick, setCollabTick] = useState(0);
  useEffect(() => {
    if (!collab) return;
    return collab.subscribe(() => setCollabTick((t) => t + 1));
  }, [collab]);
  void collabTick;

  const isTeam = snapshot.mode === "2v2";
  const canEditBase = snapshot.roundPhase === "CODING" && snapshot.you.status === "coding";
  // Ticket 15 §20: collab disconnected -> shared editor read-only, actions
  // paused. The game socket still owns Run/Submit gating via `connected`.
  const collabLive = !collab || collab.connection() === "connected";
  const canEdit = canEditBase && collabLive;
  // Ticket 14: team gate needs both approvals bound to the CURRENT team-doc
  // revision (server re-checks; this is UX only). Ticket 15 keeps this gate
  // and binds the revision to real Yjs updates; the editor itself stays a
  // local mock source until then (no collaborative text claimed).
  const revisionGate =
    snapshot.docRevision === null ||
    (snapshot.readyRevision?.you === snapshot.docRevision && snapshot.readyRevision?.mate === snapshot.docRevision);
  const readyGate = !isTeam || (snapshot.ready.you && snapshot.ready.mate && revisionGate);
  // Ticket 11 §14: actions need a live transport; the editor stays locally
  // editable while offline so no draft is lost, but nothing can succeed.
  // In collab mode the shared doc replaces the draft: paused until synced.
  const connected = transport.connection() === "connected" && collabLive;
  const canSubmit = canEdit && readyGate;
  // Run/Submit always read the freshest source: shared Y.Text in collab mode.
  const liveCode = collab ? collab.getSource() : code;

  async function guard(fn: () => Promise<unknown>, action: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Code workspace" className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <EditorToolbar
        language={snapshot.language}
        languages={Object.keys(snapshot.problem.starters)}
        canEdit={canEdit}
        canSubmit={canSubmit}
        busy={busy}
        connected={connected}
        isTeam={isTeam}
        submitHint={isTeam && !readyGate ? "Team submit needs both teammates ready." : snapshot.you.status === "coding" ? "" : `You are ${snapshot.you.status}.`}
        onLanguage={(l) => {
          // 1v1: local-only. 2v2: authoritative team switch (may throw when
          // the round disallows it); failures surface in the workspace error.
          transport.setLanguage(l).catch((e: unknown) => setError(e instanceof Error ? e.message : "language switch failed"));
        }}
        onFontBigger={() => setFontSize((f) => Math.min(20, f + 1))}
        onFontSmaller={() => setFontSize((f) => Math.max(10, f - 1))}
        onRun={() => void guard(() => transport.run({ code: liveCode, language: snapshot.language }), "Run")}
        onSubmit={() => {
          if (snapshot.you.submissions > 0 || snapshot.alpha.submissions > 0) {
            // The prominent warning already sits beside the button; confirm inline, never a tooltip.
            if (!window.confirm("Submitting again replaces your current scored result for this round. Continue?")) return;
          }
          void guard(() => transport.submit({ code: liveCode, language: snapshot.language, documentRevision: snapshot.docRevision ?? undefined }), "Submit");
        }}
      />
      {collab && (
        <p role="status" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-neutral-600">
          {collab.connection() === "connected"
            ? `Shared doc r${collab.revision ?? "?"} · live`
            : "Shared doc reconnecting — editing paused until synced."}
        </p>
      )}
      {error && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="p-3">
        <EditorAdapter
          // ponytail: collab binding is round-scoped (fresh team Y.Doc per
          // round) — remount the editor on round change so old-round content
          // can never merge into the new document. Local mode never remounts.
          key={collab ? `collab-${snapshot.round}` : "local"}
          ref={editorRef}
          language={snapshot.language}
          code={code}
          readOnly={!canEdit}
          fontSize={fontSize}
          onChange={onCode}
          collab={collab ?? undefined}
        />
      </div>
      <TestPanel tests={snapshot.tests} />
    </section>
  );
}
