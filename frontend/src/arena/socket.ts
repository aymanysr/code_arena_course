import { io, type Socket } from "socket.io-client";
import { TransportSession, type ArenaTransport, type ConnectionState, type RunReceipt, type SubmitReceipt } from "./transport.js";
import type { ArenaSnapshot, MatchFinalView, RevealView, SideView, TeamView } from "./types.js";

export interface SocketTransportOptions {
  baseUrl: string;
  userId: string;
  matchId: string;
}

/** A non-idempotent command was rejected against a newer Match snapshot. */
export class StaleCommandError extends Error {
  readonly code = 409;

  constructor(message: string) {
    super(message);
    this.name = "StaleCommandError";
  }
}

/** Server RevealSnapshot (game-owned): per-side scores/groups/totals. Never rendered directly. */
export interface ServerReveal {
  round: number;
  roundId: string;
  scores: Record<string, number>;
  groups: Record<string, Array<{ name: string; weight: number; earned: number }>>;
  totals: Record<string, number>;
  publishedAt: number;
}

interface ServerSnapshot {
  mode: "1v1" | "2v2";
  roundPhase: ArenaSnapshot["roundPhase"];
  round: number;
  totalRounds: number;
  remainingMs: number;
  problem: Omit<ArenaSnapshot["problem"], "id"> & { id?: string; problemVersionId?: string };
  tests: ArenaSnapshot["tests"];
  mySide: string;
  sides: Record<string, { status: SideView["status"]; submissions: number; presence: SideView["presence"] }>;
  teams?: Array<{
    side: string;
    activity: SideView["status"];
    submissions: number;
    members: Array<{ userId: string; presence: SideView["presence"]; ready: boolean; readyRevision: number | null }>;
    documentRevision: number | null;
    language: string | null;
  }>;
  reveal: ServerReveal | null;
  revision: number;
  pendingEvaluation: boolean;
  final: {
    scores: Record<string, number>;
    outcome: "left" | "right" | "draw";
    winner: string | null;
    forfeit: { winner: string; loser: string; reason: string } | null;
  } | null;
}

/** Server terminal result -> viewer-relative final view (score sums + forfeit override). */
export function adaptFinal(
  final: ServerSnapshot["final"],
  mySide: string,
  otherId: string,
): MatchFinalView | null {
  const f = final;
  if (!f) return null;
  const you = f.scores?.[mySide] ?? 0;
  const opponent = f.scores?.[otherId] ?? 0;
  if (f.forfeit) {
    return {
      you,
      opponent,
      outcome: f.forfeit.winner === mySide ? "You win by forfeit." : "Opponent wins by forfeit.",
    };
  }
  return {
    you,
    opponent,
    outcome:
      you > opponent ? "You win the match." : you < opponent ? "Opponent wins the match." : "The match is a draw.",
  };
}

/**
 * Stale-update guard (ticket 11 §3/§9): every refresh fetches current server
 * truth, so applying is normally safe; this drops only provably stale
 * responses (older revision than already applied) and skips fetches for
 * events from an older round than the applied snapshot.
 */
export function shouldApplyUpdate(
  applied: { revision: number; round: number },
  incoming: { revision?: number; round?: number },
): boolean {
  if (incoming.revision !== undefined && incoming.revision < applied.revision) return false;
  if (
    incoming.round !== undefined &&
    incoming.revision !== undefined &&
    incoming.round < applied.round &&
    incoming.revision <= applied.revision
  )
    return false;
  return true;
}

/**
 * Server RevealSnapshot -> client RevealView: pick the viewer's side for the
 * round score and group breakdown; totals become you/opponent. The server
 * shape (per-side maps) is never rendered directly — passing it through
 * crashes RoundScoreReveal (`groups.map is not a function`).
 */
export function adaptReveal(server: ServerReveal | null, mySide: string, otherId: string): RevealView | null {
  if (!server) return null;
  const mine = Array.isArray(server.groups?.[mySide]) ? server.groups[mySide] : [];
  return {
    roundScore: server.scores?.[mySide] ?? 0,
    groups: mine.map((g) => ({ name: g.name, weight: g.weight, earned: g.earned })),
    totals: { you: server.totals?.[mySide] ?? 0, opponent: server.totals?.[otherId] ?? 0 },
  };
}

/** Server SealedSnapshot -> client ArenaSnapshot (units, side views, 2v2 teams). */
function adapt(server: ServerSnapshot, language: string, userId: string): ArenaSnapshot {
  const mine = server.sides[server.mySide] ?? { status: "coding" as const, submissions: 0, presence: "online" as const };
  const otherId = Object.keys(server.sides).find((k) => k !== server.mySide) ?? "right";
  const other = server.sides[otherId] ?? mine;
  const you: SideView = { name: "You", status: mine.status, presence: mine.presence, submissions: mine.submissions };
  const opponent: SideView = { name: "Opponent", status: other.status, presence: other.presence, submissions: other.submissions };
  // 2v2: real team state (alpha = own team, beta = opponents). 1v1 keeps the
  // legacy shape with the readiness shim off.
  const ownTeam = server.teams?.find((t) => t.members.some((m) => m.userId === userId));
  const otherTeam = server.teams?.find((t) => t !== ownTeam);
  const toTeamView = (t: NonNullable<ServerSnapshot["teams"]>[number]): TeamView => ({
    id: t.side,
    members: [
      {
        name: t.members[0]?.userId ?? "?",
        status: t.activity,
        presence: t.members[0]?.presence ?? "offline",
        submissions: t.submissions,
      },
      {
        name: t.members[1]?.userId ?? "?",
        status: t.activity,
        presence: t.members[1]?.presence ?? "offline",
        submissions: t.submissions,
      },
    ],
    score: null,
    submissions: t.submissions,
  });
  const youRec = ownTeam?.members.find((m) => m.userId === userId);
  const mateRec = ownTeam?.members.find((m) => m.userId !== userId);
  return {
    mode: server.mode,
    roundPhase: server.roundPhase,
    round: server.round,
    totalRounds: server.totalRounds,
    remainingSeconds: Math.max(0, Math.ceil(server.remainingMs / 1000)),
    problem: {
      ...server.problem,
      id: server.problem.id ?? server.problem.problemVersionId ?? "unknown-problem",
    },
    language: ownTeam?.language ?? language,
    tests: server.tests,
    you,
    opponent,
    alpha: ownTeam
      ? toTeamView(ownTeam)
      : {
          id: "alpha",
          members: [you, { name: "Mate", status: "coding", presence: "online", submissions: 0 }],
          score: null,
          submissions: you.submissions,
        },
    beta: otherTeam
      ? toTeamView(otherTeam)
      : {
          id: "beta",
          members: [opponent, { name: "Rival 2", status: "coding", presence: "online", submissions: 0 }],
          score: null,
          submissions: opponent.submissions,
        },
    ready: ownTeam
      ? { you: youRec?.ready === true, mate: mateRec?.ready === true }
      : { you: false, mate: false },
    docRevision: ownTeam?.documentRevision ?? null,
    readyRevision: ownTeam
      ? { you: youRec?.readyRevision ?? null, mate: mateRec?.readyRevision ?? null }
      : null,
    reveal: adaptReveal(server.reveal, server.mySide, otherId),
    notice: null,
    revision: server.revision ?? 0,
    matchFinal: adaptFinal(server.final, server.mySide, otherId),
  };
}

/**
 * SocketArenaTransport: the real transport behind the ArenaTransport seam.
 * Actions go over HTTP; the socket carries game-owned events, each of which
 * triggers a fresh authoritative snapshot fetch (never incremental patching).
 * Identity: DEV_PRINCIPAL seam (x-dev-user-id header + socket auth) until the
 * auth owner lands; see docs/auth-game-contract.md. No competitive values are
 * ever computed client-side.
 */
export class SocketArenaTransport implements ArenaTransport {
  private socket: Socket | null = null;
  private snap: ArenaSnapshot | null = null;
  private readonly session = new TransportSession("connecting");
  private language = "Python";
  /** Latest authoritative team-doc revision (2v2 submit gate + setReady binding). */
  private lastDocRevision: number | null = null;
  /**
   * Keep one unconfirmed submit's identifiers across a lost HTTP response.
   * A successful submit clears this record, so a deliberate later resubmit
   * receives fresh ids and keeps the server's last-wins semantics.
   */
  private pendingSubmit: {
    key: string;
    submissionId: string;
    evaluationId: string;
  } | null = null;
  private connected = false;
  private connectError: string | null = null;
  /** Last applied server revision/round (§3 stale-drop). */
  private appliedRevision = -1;
  private appliedRound = 0;
  private reopening = false;
  /** Browser reported a network outage since the last baseline. */
  private browserOffline = false;

  constructor(private readonly options: SocketTransportOptions) {}

  get connectionError(): string | null {
    return this.connectError;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connection(): ConnectionState {
    return this.session.connection();
  }

  scopeKey(): string {
    return `live:${this.options.baseUrl}:${this.options.matchId}`;
  }

  /** Identity for the separate collaboration socket (2v2 team document). */
  collabConfig(): { baseUrl: string; userId: string; matchId: string } {
    return { baseUrl: this.options.baseUrl, userId: this.options.userId, matchId: this.options.matchId };
  }

  /** Identity for the separate team chat socket (2v2 team chat and quick pings). */
  chatConfig(): { baseUrl: string; userId: string; matchId: string } | null {
    if (this.snap?.mode !== "2v2") return null;
    return { baseUrl: this.options.baseUrl, userId: this.options.userId, matchId: this.options.matchId };
  }

  private setConn(next: ConnectionState): void {
    if (this.session.setConnection(next)) this.session.notify();
  }

  async connect(): Promise<void> {
    this.setConn("connecting");
    const snap = (await this.get("/snapshot")) as ServerSnapshot;
    this.applySnapshot(snap);
    this.attachFreshSocket();
    await this.awaitBaseline(this.socket!);
    this.connected = true;
    this.setConn("connected");
    this.emit();
  }

  /**
   * Manual re-handshake (ticket 11 §2): socket.io does not reliably
   * self-heal after a real network outage, so the browser `online` signal
   * (and any rejoin path) tears the stale socket down and rejoins the
   * authorized room for ONE fresh authoritative baseline. The server's
   * per-user socket counting absorbs the overlap: presence stays correct and
   * the stale server-side socket ages out on heartbeat timeout.
   */
  private async reopen(): Promise<void> {
    if (this.session.connection() === "connected" || this.reopening || !this.socket) return;
    this.reopening = true;
    try {
      this.socket.disconnect();
      this.socket = null;
      this.setConn("connecting");
      this.emit();
      this.attachFreshSocket();
      await this.awaitBaseline(this.socket!);
      this.browserOffline = false;
      this.connected = true;
      this.setConn("connected");
    } catch {
      this.connected = false;
      this.setConn("reconnecting");
    } finally {
      this.reopening = false;
      this.emit();
    }
  }

  private attachFreshSocket(): void {
    const socket = io(this.options.baseUrl, {
      auth: { userId: this.options.userId, matchId: this.options.matchId },
    });
    this.socket = socket;
    for (const event of [
      "phase.changed",
      "player.statusChanged",
      "player.presenceChanged",
      "readiness.changed",
      "tests.updated",
      "reveal.published",
      "round.advanced",
      "match.clock",
      "match.ended",
    ]) {
      socket.on(event, (payload: unknown) => {
        const p = payload as { revision?: number; round?: number } | null;
        void this.refresh({ revision: p?.revision, round: p?.round }).catch(() => {});
      });
    }
    socket.on("disconnect", () => {
      this.connected = false;
      // socket.io retries by itself: reconnecting until re-established.
      this.setConn("reconnecting");
      this.emit();
    });
    socket.io.on("reconnect", () => {
      // Re-baseline on the authoritative socket snapshot, then refresh.
      this.connected = true;
      this.setConn("connected");
      void this.refresh().catch(() => {});
      this.emit();
    });
    this.wireBrowserSignalsOnce();
  }

  private browserSignalsWired = false;

  private wireBrowserSignalsOnce(): void {
    if (this.browserSignalsWired) return;
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    this.browserSignalsWired = true;
    // Browser-level signal fires far sooner than the socket heartbeat
    // timeout (~20s): go visibly reconnecting at once and re-handshake on
    // return. Never mark connected here — only the server baseline does.
    window.addEventListener("offline", () => {
      // The socket object itself may still report connected until its
      // heartbeat times out (~45s); the browser signal is authoritative here.
      this.browserOffline = true;
      this.connected = false;
      this.setConn("reconnecting");
      this.emit();
    });
    window.addEventListener("online", () => {
      if (this.browserOffline || !this.socket?.connected) void this.reopen();
      else void this.refresh().catch(() => {});
    });
  }

  private awaitBaseline(socket: Socket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("socket connect timeout")), 10000);
      socket.once("snapshot", (s) => {
        clearTimeout(timer);
        this.applySnapshot(s as ServerSnapshot);
        resolve();
      });
      socket.once("connect_error", (error: Error) => {
        clearTimeout(timer);
        this.connectError = error.message;
        reject(error);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.setConn("offline");
    this.emit();
  }

  /** Apply a fetched server snapshot unless provably stale (§3). */
  private applySnapshot(server: ServerSnapshot): boolean {
    if (!this.snap) {
      this.snap = adapt(server, this.language, this.options.userId);
      this.appliedRevision = this.snap.revision;
      this.appliedRound = this.snap.round;
      this.lastDocRevision = this.snap.docRevision;
      return true;
    }
    if (server.revision !== undefined && server.revision < this.appliedRevision) return false;
    this.snap = adapt(server, this.language, this.options.userId);
    this.appliedRevision = this.snap.revision;
    this.appliedRound = this.snap.round;
    this.lastDocRevision = this.snap.docRevision;
    return true;
  }

  snapshot(): ArenaSnapshot {
    if (!this.snap) throw new Error("not connected");
    // Fresh reference every call: connectivity-only transitions (offline →
    // reconnecting) carry no new game state but must still re-render.
    return { ...this.snap };
  }

  subscribe(listener: () => void): () => void {
    return this.session.subscribe(listener);
  }

  async startRound(): Promise<void> {
    this.requireConnected("start");
    await this.post("/start", {});
    await this.refresh();
  }

  async beginCoding(): Promise<void> {
    this.requireConnected("begin");
    await this.post("/begin", {});
    await this.refresh();
  }

  async setLanguage(language: string): Promise<void> {
    if (this.snap?.mode === "2v2") {
      // Authoritative team switch: bumps the doc revision and invalidates
      // both approvals server-side (the refresh carries the new revision).
      this.requireConnected("language");
      await this.post("/language", { language });
      await this.refresh();
      return;
    }
    this.language = language;
    void this.refresh();
  }

  async run(input: { code: string; language: string }): Promise<RunReceipt> {
    this.requireConnected("run");
    await this.post("/run", input);
    await this.refresh();
    return { ok: true };
  }

  async submit(input: { code: string; language: string; documentRevision?: number }): Promise<SubmitReceipt> {
    this.requireConnected("submit");
    const documentRevision = input.documentRevision ?? this.lastDocRevision ?? undefined;
    const request = this.submitRequest(input, documentRevision);
    const receipt = (await this.post("/submit", {
      ...input,
      documentRevision,
      submissionId: request.submissionId,
      evaluationId: request.evaluationId,
    })) as SubmitReceipt;
    await this.refresh();
    this.pendingSubmit = null;
    return receipt;
  }

  /**
   * Revision-bound readiness (2v2): approves the latest authoritative
   * revision this client has seen. The server re-checks currency — a stale
   * approval throws and the snapshot (source of truth) corrects the UI.
   */
  async setReady(value: boolean): Promise<void> {
    const sock = this.socket;
    if (!sock) return;
    const payload = { value, documentRevision: this.lastDocRevision ?? undefined };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("setReady timed out")), 5000);
      sock.emit("setReady", payload, (res: { ok: boolean; error?: string } | undefined) => {
        clearTimeout(timer);
        if (res?.ok) resolve();
        else reject(new Error(res?.error ?? "setReady rejected"));
      });
    });
  }

  async advance(): Promise<void> {
    this.requireConnected("advance");
    await this.post("/advance", {});
    await this.refresh();
  }

  async leave(): Promise<void> {
    this.requireConnected("leave");
    await this.post("/leave", {});
    await this.refresh();
  }

  private requireConnected(action: string): void {
    const connection = this.session.connection();
    if (connection !== "connected") throw new Error(`${action} unavailable while ${connection}`);
  }

  private async refresh(trigger?: { revision?: number; round?: number }): Promise<void> {
    if (
      trigger &&
      !shouldApplyUpdate(
        { revision: this.appliedRevision, round: this.appliedRound },
        { revision: trigger.revision, round: trigger.round },
      )
    ) {
      return;
    }
    const snap = (await this.get("/snapshot")) as ServerSnapshot;
    if (this.applySnapshot(snap)) this.emit();
  }

  private submitRequest(input: { code: string; language: string; documentRevision?: number }, documentRevision: number | undefined): {
    submissionId: string;
    evaluationId: string;
  } {
    const key = JSON.stringify([this.appliedRound, input.code, input.language, documentRevision ?? null]);
    if (this.pendingSubmit?.key === key) return this.pendingSubmit;

    this.pendingSubmit = {
      key,
      submissionId: this.requestId("submission"),
      evaluationId: this.requestId("evaluation"),
    };
    return this.pendingSubmit;
  }

  private requestId(prefix: string): string {
    const randomUuid = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : null;
    return `${prefix}-${randomUuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  }

  private emit(): void {
    this.session.notify();
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.options.baseUrl}/matches/${this.options.matchId}${path}`, {
      headers: { "x-dev-user-id": this.options.userId },
    });
    if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
    return res.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.options.baseUrl}/matches/${this.options.matchId}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-user-id": this.options.userId },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 409) {
        const conflict = new StaleCommandError(payload?.error ?? `${path} rejected against a newer Match revision`);
        await this.refresh().catch(() => {});
        throw conflict;
      }
      throw new Error(payload?.error ?? `${path} failed with ${res.status}`);
    }
    return res.json();
  }
}
