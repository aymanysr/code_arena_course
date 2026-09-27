import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ArenaEngine } from "../src/engine.js";
import { FileBank } from "../src/file-bank.js";
import { GAME_SCHEMA } from "../src/postgres-store.js";
import { LobbyStore } from "../src/lobby.js";
import { ScriptedJudge } from "./scripted-judge.js";

const url = process.env.DATABASE_URL;
describe.runIf(Boolean(url))("lobby atomicity (isolated PostgreSQL schema)", () => {
  const schema = `lobby_${randomUUID().replaceAll("-", "")}`;
  let admin: Pool;
  let pool: Pool;
  let lobby: LobbyStore;
  let engine: ArenaEngine;
  beforeAll(async () => {
    admin = new Pool({ connectionString: url });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: url, options: `-c search_path=${schema}` });
    await pool.query(GAME_SCHEMA);
    lobby = new LobbyStore(pool);
    await lobby.ensureSchema();
    engine = new ArenaEngine({ judge: new ScriptedJudge([]), bank: new FileBank(), matches: {
      async save(match) { await pool.query("INSERT INTO matches VALUES ($1, $2)", [match.id, match]); },
      async load(id) { return (await pool.query("SELECT data FROM matches WHERE id=$1", [id])).rows[0]?.data; },
      async listIds() { return (await pool.query("SELECT id FROM matches")).rows.map(r => r.id); },
    }});
  });
  beforeEach(async () => { await pool.query("TRUNCATE arena_queue_entries, arena_private_rooms, matches CASCADE"); });
  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin?.end();
  });
  const problems = ["even-ledger", "double-it", "even-ledger"];
  const create: Parameters<LobbyStore["tryMatch"]>[2] = (input, save) => engine.createMatch(input, save);

  it("rolls back the authoritative match when queue linkage fails", async () => {
    await lobby.joinQueue("a", "1v1");
    await lobby.joinQueue("b", "1v1");
    await pool.query("ALTER TABLE arena_queue_entries ADD CONSTRAINT injected_failure CHECK (status <> 'matched')");
    try {
      await expect(lobby.tryMatch("1v1", problems, create)).rejects.toThrow();
      expect((await pool.query("SELECT id FROM matches")).rowCount).toBe(0);
      expect((await lobby.queueStatus("a"))?.status).toBe("waiting");
    } finally { await pool.query("ALTER TABLE arena_queue_entries DROP CONSTRAINT injected_failure"); }
  });

  it("consumes eight users once across concurrent 2v2 matchers", async () => {
    for (let i = 0; i < 8; i++) await lobby.joinQueue(`u${i}`, "2v2");
    const results = await Promise.all([lobby.tryMatch("2v2", problems, create), lobby.tryMatch("2v2", problems, create)]);
    expect(results.every(Boolean)).toBe(true);
    expect(new Set(results.map(r => r!.matchId)).size).toBe(2);
    expect(new Set(results.flatMap(r => r!.entries.map(e => e.userId))).size).toBe(8);
    expect((await pool.query("SELECT id FROM matches")).rowCount).toBe(2);
  });

  it("serializes competing admissions for the same user", async () => {
    const results = await Promise.allSettled([lobby.createPrivateRoom("a", "1v1"), lobby.createPrivateRoom("a", "2v2"), lobby.joinQueue("a", "1v1")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });

  it("completed matches release admission and disappear from recovery", async () => {
    await lobby.joinQueue("a", "1v1");
    await lobby.joinQueue("b", "1v1");
    const result = await lobby.tryMatch("1v1", problems, create);
    await expect(lobby.createPrivateRoom("a", "1v1")).rejects.toThrow("active match");
    await pool.query("UPDATE matches SET data=jsonb_set(data, '{roundPhase}', '\"MATCH_COMPLETE\"') WHERE id=$1", [result!.matchId]);
    expect(await lobby.queueStatus("a")).toBeNull();
    const { room } = await lobby.createPrivateRoom("a", "1v1");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.setRoomMemberReady("a", room.id, true);
    await lobby.setRoomMemberReady("b", room.id, true);
    const match = await lobby.startPrivateRoom("a", room.id, problems, create);
    await pool.query("UPDATE matches SET data=jsonb_set(data, '{roundPhase}', '\"MATCH_COMPLETE\"') WHERE id=$1", [match.matchId]);
    expect(await lobby.userActiveRoom("a")).toBeNull();
  });

  it("expired rooms cannot start and do not block a new admission", async () => {
    const { room } = await lobby.createPrivateRoom("a", "1v1");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.setRoomMemberReady("a", room.id, true);
    await lobby.setRoomMemberReady("b", room.id, true);
    await pool.query("UPDATE arena_private_rooms SET expires_at=0 WHERE id=$1", [room.id]);
    await expect(lobby.startPrivateRoom("a", room.id, problems, create)).rejects.toMatchObject({ code: 410 });
    expect(await lobby.userActiveRoom("a")).toBeNull();
    expect((await lobby.joinQueue("a", "1v1")).status).toBe("waiting");
  });

  it("rolls back private match creation when room linkage fails", async () => {
    const { room } = await lobby.createPrivateRoom("a", "1v1");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.setRoomMemberReady("a", room.id, true);
    await lobby.setRoomMemberReady("b", room.id, true);
    await pool.query("ALTER TABLE arena_private_rooms ADD CONSTRAINT injected_failure CHECK (status <> 'matched')");
    try {
      await expect(lobby.startPrivateRoom("a", room.id, problems, create)).rejects.toThrow();
      expect((await pool.query("SELECT id FROM matches")).rowCount).toBe(0);
      expect((await lobby.getRoomWithMembers(room.id))?.room.status).toBe("open");
    } finally { await pool.query("ALTER TABLE arena_private_rooms DROP CONSTRAINT injected_failure"); }
  });

  it("admits exactly one contender for the final 2v2 slot", async () => {
    const { room } = await lobby.createPrivateRoom("a", "2v2");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.joinPrivateRoom("c", room.code);
    const results = await Promise.allSettled([lobby.joinPrivateRoom("d", room.code), lobby.joinPrivateRoom("e", room.code)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await lobby.getRoomWithMembers(room.id))?.members).toHaveLength(4);
  });

  it("serializes ready changes with concurrent starts", async () => {
    const { room } = await lobby.createPrivateRoom("a", "1v1");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.setRoomMemberReady("a", room.id, true);
    await lobby.setRoomMemberReady("b", room.id, true);
    const [unready, ...starts] = await Promise.allSettled([
      lobby.setRoomMemberReady("b", room.id, false),
      lobby.startPrivateRoom("a", room.id, problems, create),
      lobby.startPrivateRoom("a", room.id, problems, create),
    ]);
    const successfulStarts = starts.filter(r => r.status === "fulfilled").length;
    expect(successfulStarts).toBe(unready.status === "fulfilled" ? 0 : 1);
    expect((await pool.query("SELECT id FROM matches")).rowCount).toBe(successfulStarts);
  });

  it("serializes competing switches into the last side slot", async () => {
    const { room } = await lobby.createPrivateRoom("a", "2v2");
    await lobby.joinPrivateRoom("b", room.code);
    await lobby.joinPrivateRoom("c", room.code);
    const results = await Promise.allSettled([
      lobby.setRoomMemberSide("a", room.id, "right"),
      lobby.setRoomMemberSide("b", room.id, "right"),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await lobby.getRoomWithMembers(room.id))!.members.filter(m => m.sideId === "right")).toHaveLength(2);
  });

  it("cancel wins before matching, and matching wins before cancellation", async () => {
    await lobby.joinQueue("a", "1v1");
    await lobby.joinQueue("b", "1v1");
    expect((await lobby.cancelQueue("a")).cancelled).toBe(true);
    expect(await lobby.tryMatch("1v1", problems, create)).toBeNull();
    await lobby.joinQueue("c", "1v1");
    let release!: () => void;
    let entered!: () => void;
    const started = new Promise<void>(r => { entered = r; });
    const gate = new Promise<void>(r => { release = r; });
    const matching = lobby.tryMatch("1v1", problems, async (input, save) => {
      entered(); await gate; return create(input, save);
    });
    await started;
    const cancelling = lobby.cancelQueue("b");
    release();
    const matched = await matching;
    expect(await cancelling).toEqual({ cancelled: false, matched: true, matchId: matched!.matchId });
  });
});
