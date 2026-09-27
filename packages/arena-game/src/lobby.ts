import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { saveMatchTx } from "./postgres-store.js";
import type { MatchStore } from "./store.js";
import type { MatchRecord } from "./records.js";
import type { MatchMode } from "arena-model";

// ─── Types ──────────────────────────────────────────────────────────────────

export type QueueStatus = "waiting" | "matched" | "cancelled";
export type PrivateRoomStatus = "open" | "matched" | "expired" | "closed";
export type LobbySideId = "left" | "right";

export interface QueueEntry {
  id: string;
  userId: string;
  mode: MatchMode;
  status: QueueStatus;
  joinedAt: number;
  matchedMatchId: string | null;
  cancelledAt: number | null;
}

export interface PrivateRoom {
  id: string;
  code: string;
  mode: MatchMode;
  ownerUserId: string;
  status: PrivateRoomStatus;
  createdAt: number;
  expiresAt: number;
  matchId: string | null;
}

export interface PrivateRoomMember {
  roomId: string;
  userId: string;
  sideId: LobbySideId;
  ready: boolean;
  joinedAt: number;
}

export interface RoomWithMembers {
  room: PrivateRoom;
  members: PrivateRoomMember[];
}

// ─── Schema ─────────────────────────────────────────────────────────────────

export const LOBBY_SCHEMA = `
CREATE TABLE IF NOT EXISTS arena_queue_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  joined_at BIGINT NOT NULL,
  matched_match_id TEXT,
  cancelled_at BIGINT
);
ALTER TABLE arena_queue_entries ADD COLUMN IF NOT EXISTS queue_order BIGSERIAL;
CREATE INDEX IF NOT EXISTS ix_queue_fifo ON arena_queue_entries (mode, joined_at, queue_order) WHERE status = 'waiting';
CREATE UNIQUE INDEX IF NOT EXISTS uq_queue_active_user
  ON arena_queue_entries (user_id) WHERE status = 'waiting';

CREATE TABLE IF NOT EXISTS arena_private_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  match_id TEXT
);

CREATE TABLE IF NOT EXISTS arena_private_room_members (
  room_id TEXT NOT NULL REFERENCES arena_private_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  side_id TEXT NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at BIGINT NOT NULL,
  PRIMARY KEY (room_id, user_id)
);
`;

// ─── Error helpers ──────────────────────────────────────────────────────────

export class LobbyError extends Error {
  constructor(
    message: string,
    readonly code: number = 400,
  ) {
    super(message);
    this.name = "LobbyError";
  }
}

// ─── Invite code ────────────────────────────────────────────────────────────

/** Six characters from a 32-character alphabet (30 bits of entropy). */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[bytes[i]! % chars.length];
  return code;
}

export function capacityFor(mode: MatchMode): number {
  return mode === "1v1" ? 2 : 4;
}

export function perSideCapacity(mode: MatchMode): number {
  return mode === "1v1" ? 1 : 2;
}

// ─── Problem selection ──────────────────────────────────────────────────────

/**
 * ponytail: server-owned problem selection — clients never choose.
 * Picks 3 problem version IDs from the available bank. Deterministic
 * when a seed is provided (tests), otherwise random shuffle.
 */
export function selectProblems(
  available: string[],
  count: number = 3,
  rng: () => number = Math.random,
): string[] {
  if (available.length === 0) throw new LobbyError("no problems in bank");
  const shuffled = [...available].sort(() => rng() - 0.5);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(shuffled[i % shuffled.length]!);
  return out;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ILobbyStore {
  ensureSchema(): Promise<void>;
  joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry>;
  cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }>;
  queueStatus(userId: string): Promise<QueueEntry | null>;
  tryMatch(
    mode: MatchMode,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string; entries: QueueEntry[] } | null>;
  createPrivateRoom(userId: string, mode: MatchMode, expiryMs?: number): Promise<RoomWithMembers>;
  joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }>;
  leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }>;
  setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers>;
  setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers>;
  startPrivateRoom(
    userId: string,
    roomId: string,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string }>;
  getRoomByCode(code: string): Promise<RoomWithMembers | null>;
  getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null>;
  userActiveRoom(userId: string): Promise<RoomWithMembers | null>;
}

// ─── Postgres Implementation ────────────────────────────────────────────────

export class LobbyStore implements ILobbyStore {
  constructor(
    private readonly pool: Pool,
    private readonly clock: () => number = Date.now,
    private readonly uuid: () => string = randomUUID,
  ) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(LOBBY_SCHEMA);
  }

  // ── Queue ──

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    if (mode !== "1v1" && mode !== "2v2") throw new LobbyError("invalid mode");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize this user's admissions across queue and room tables.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`lobby:user:${userId}`]);

      const existing = await client.query(
        `SELECT id FROM arena_queue_entries WHERE user_id = $1 AND status = 'waiting'`,
        [userId],
      );
      if ((existing.rowCount ?? 0) > 0) throw new LobbyError("already in queue", 409);

      const inRoom = await client.query(
        `SELECT r.id FROM arena_private_rooms r
         JOIN arena_private_room_members m ON m.room_id = r.id
         WHERE m.user_id = $1 AND r.status = 'open' AND r.expires_at > $2`,
        [userId, this.clock()],
      );
      if ((inRoom.rowCount ?? 0) > 0) throw new LobbyError("already in a private room", 409);

      const activeMatch = await client.query(
        `SELECT m.id FROM matches m, jsonb_array_elements(m.data->'participants') p
         WHERE p->>'userId' = $1 AND m.data->>'roundPhase' != 'MATCH_COMPLETE'
         LIMIT 1`,
        [userId],
      );
      if ((activeMatch.rowCount ?? 0) > 0) throw new LobbyError("already in an active match", 409);

      const entry: QueueEntry = {
        id: this.uuid(),
        userId,
        mode,
        status: "waiting",
        joinedAt: this.clock(),
        matchedMatchId: null,
        cancelledAt: null,
      };

      await client.query(
        `INSERT INTO arena_queue_entries (id, user_id, mode, status, joined_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [entry.id, entry.userId, entry.mode, entry.status, entry.joinedAt],
      );

      await client.query("COMMIT");
      return entry;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const res = await client.query(
        `SELECT id, status, matched_match_id FROM arena_queue_entries
         WHERE user_id = $1 AND status IN ('waiting', 'matched')
         ORDER BY joined_at DESC, queue_order DESC LIMIT 1
         FOR UPDATE`,
        [userId],
      );

      if ((res.rowCount ?? 0) === 0) {
        await client.query("COMMIT");
        return { cancelled: false, matched: false };
      }

      const row = res.rows[0];
      if (row.status === "matched") {
        await client.query("COMMIT");
        return { cancelled: false, matched: true, matchId: row.matched_match_id };
      }

      await client.query(
        `UPDATE arena_queue_entries SET status = 'cancelled', cancelled_at = $1 WHERE id = $2`,
        [this.clock(), row.id],
      );
      await client.query("COMMIT");
      return { cancelled: true, matched: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    const res = await this.pool.query(
      `SELECT id, user_id, mode, status, joined_at, matched_match_id, cancelled_at
       FROM arena_queue_entries
       WHERE user_id = $1 AND (status = 'waiting' OR (status = 'matched' AND EXISTS (SELECT 1 FROM matches WHERE id = matched_match_id AND data->>'roundPhase' <> 'MATCH_COMPLETE')))
       ORDER BY joined_at DESC, queue_order DESC LIMIT 1`,
      [userId],
    );
    if ((res.rowCount ?? 0) === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id, userId: r.user_id, mode: r.mode, status: r.status,
      joinedAt: Number(r.joined_at), matchedMatchId: r.matched_match_id, cancelledAt: r.cancelled_at ? Number(r.cancelled_at) : null,
    };
  }

  // ── Matchmaker ──

  async tryMatch(
    mode: MatchMode,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    const n = capacityFor(mode);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // ponytail: one short matcher transaction per mode; shard only if measured contention warrants it.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`lobby:mode:${mode}`]);

      const res = await client.query(
        `SELECT id, user_id, mode, status, joined_at
         FROM arena_queue_entries
         WHERE mode = $1 AND status = 'waiting'
         ORDER BY joined_at ASC, queue_order ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
        [mode, n],
      );

      if ((res.rowCount ?? 0) < n) {
        await client.query("ROLLBACK");
        return null;
      }

      const rows = res.rows;
      const participants: Array<{ userId: string; sideId: string }> = [];
      if (mode === "1v1") {
        participants.push({ userId: rows[0].user_id, sideId: "left" });
        participants.push({ userId: rows[1].user_id, sideId: "right" });
      } else {
        participants.push({ userId: rows[0].user_id, sideId: "left" });
        participants.push({ userId: rows[1].user_id, sideId: "left" });
        participants.push({ userId: rows[2].user_id, sideId: "right" });
        participants.push({ userId: rows[3].user_id, sideId: "right" });
      }

      const matchId = await createMatchFn({ mode, participants, problemVersionIds }, (match) => saveMatchTx(client, match));

      const ids = rows.map((r: { id: string }) => r.id);
      await client.query(
        `UPDATE arena_queue_entries SET status = 'matched', matched_match_id = $1 WHERE id = ANY($2)`,
        [matchId, ids],
      );

      await client.query("COMMIT");

      return {
        matchId,
        entries: rows.map((r: any) => ({
          id: r.id, userId: r.user_id, mode: r.mode, status: "matched" as const,
          joinedAt: Number(r.joined_at), matchedMatchId: matchId, cancelledAt: null,
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // ── Private Rooms ──

  async createPrivateRoom(userId: string, mode: MatchMode, expiryMs: number = 20 * 60 * 1000): Promise<RoomWithMembers> {
    if (mode !== "1v1" && mode !== "2v2") throw new LobbyError("invalid mode");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize this user's admissions across queue and room tables.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`lobby:user:${userId}`]);

      const inQueue = await client.query(
        `SELECT id FROM arena_queue_entries WHERE user_id = $1 AND status = 'waiting'`, [userId],
      );
      if ((inQueue.rowCount ?? 0) > 0) throw new LobbyError("already in queue", 409);

      const inRoom = await client.query(
        `SELECT r.id FROM arena_private_rooms r
         JOIN arena_private_room_members m ON m.room_id = r.id
         WHERE m.user_id = $1 AND r.status = 'open' AND r.expires_at > $2`, [userId, this.clock()],
      );
      if ((inRoom.rowCount ?? 0) > 0) throw new LobbyError("already in a private room", 409);

      const activeMatch = await client.query(
        `SELECT m.id FROM matches m, jsonb_array_elements(m.data->'participants') p
         WHERE p->>'userId' = $1 AND m.data->>'roundPhase' != 'MATCH_COMPLETE'
         LIMIT 1`, [userId],
      );
      if ((activeMatch.rowCount ?? 0) > 0) throw new LobbyError("already in an active match", 409);

      const now = this.clock();
      const room: PrivateRoom = {
        id: this.uuid(),
        code: generateInviteCode(),
        mode,
        ownerUserId: userId,
        status: "open",
        createdAt: now,
        expiresAt: now + expiryMs,
        matchId: null,
      };

      await client.query(
        `INSERT INTO arena_private_rooms (id, code, mode, owner_user_id, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [room.id, room.code, room.mode, room.ownerUserId, room.status, room.createdAt, room.expiresAt],
      );

      const creatorMember: PrivateRoomMember = {
        roomId: room.id,
        userId,
        sideId: "left",
        ready: false,
        joinedAt: now,
      };

      await client.query(
        `INSERT INTO arena_private_room_members (room_id, user_id, side_id, ready, joined_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [creatorMember.roomId, creatorMember.userId, creatorMember.sideId, creatorMember.ready, creatorMember.joinedAt],
      );

      await client.query("COMMIT");
      return { room, members: [creatorMember] };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize this user's admissions across queue and room tables.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`lobby:user:${userId}`]);

      const inQueue = await client.query(
        `SELECT id FROM arena_queue_entries WHERE user_id = $1 AND status = 'waiting'`, [userId],
      );
      if ((inQueue.rowCount ?? 0) > 0) throw new LobbyError("already in queue", 409);

      const inRoom = await client.query(
        `SELECT r.id FROM arena_private_rooms r
         JOIN arena_private_room_members m ON m.room_id = r.id
         WHERE m.user_id = $1 AND r.status = 'open' AND r.code != $2 AND r.expires_at > $3`, [userId, inviteCode.toUpperCase().trim(), this.clock()],
      );
      if ((inRoom.rowCount ?? 0) > 0) throw new LobbyError("already in a private room", 409);

      const activeMatch = await client.query(
        `SELECT m.id FROM matches m, jsonb_array_elements(m.data->'participants') p
         WHERE p->>'userId' = $1 AND m.data->>'roundPhase' != 'MATCH_COMPLETE'
         LIMIT 1`, [userId],
      );
      if ((activeMatch.rowCount ?? 0) > 0) throw new LobbyError("already in an active match", 409);

      const roomRes = await client.query(
        `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
         FROM arena_private_rooms WHERE code = $1 FOR UPDATE`,
        [inviteCode.toUpperCase().trim()],
      );
      if ((roomRes.rowCount ?? 0) === 0) throw new LobbyError("invalid invite code", 404);

      const r = roomRes.rows[0];

      if (r.status === "open" && Number(r.expires_at) < this.clock()) {
        await client.query(`UPDATE arena_private_rooms SET status = 'expired' WHERE id = $1`, [r.id]);
        await client.query("COMMIT");
        throw new LobbyError("room has expired", 410);
      }

      if (r.status === "matched") throw new LobbyError("room has already started", 409);
      if (r.status !== "open") throw new LobbyError(`room is ${r.status}`, 409);

      const memberRes = await client.query(
        `SELECT room_id, user_id, side_id, ready, joined_at
         FROM arena_private_room_members WHERE room_id = $1 ORDER BY joined_at ASC`,
        [r.id],
      );

      const members: PrivateRoomMember[] = memberRes.rows.map((m: any) => ({
        roomId: m.room_id,
        userId: m.user_id,
        sideId: m.side_id as LobbySideId,
        ready: Boolean(m.ready),
        joinedAt: Number(m.joined_at),
      }));

      const existing = members.find((m) => m.userId === userId);
      const cap = capacityFor(r.mode);
      if (existing) throw new LobbyError("already in this private room", 409);

      if (members.length >= cap) throw new LobbyError("room is full", 409);

      // Auto-assign side
      const sideCap = perSideCapacity(r.mode);
      const leftCount = members.filter((m) => m.sideId === "left").length;
      const assignedSide: LobbySideId = leftCount < sideCap ? "left" : "right";

      const newMember: PrivateRoomMember = {
        roomId: r.id,
        userId,
        sideId: assignedSide,
        ready: false,
        joinedAt: this.clock(),
      };

      await client.query(
        `INSERT INTO arena_private_room_members (room_id, user_id, side_id, ready, joined_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [newMember.roomId, newMember.userId, newMember.sideId, newMember.ready, newMember.joinedAt],
      );

      members.push(newMember);
      const full = members.length >= cap;

      await client.query("COMMIT");

      return {
        room: {
          id: r.id, code: r.code, mode: r.mode, ownerUserId: r.owner_user_id,
          status: r.status, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), matchId: r.match_id,
        },
        members,
        full,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const roomRes = await client.query(
        `SELECT id, status, owner_user_id FROM arena_private_rooms WHERE id = $1 FOR UPDATE`,
        [roomId],
      );
      if ((roomRes.rowCount ?? 0) === 0 || roomRes.rows[0].status !== "open") {
        await client.query("COMMIT");
        return { left: false, closed: false };
      }

      await client.query(
        `DELETE FROM arena_private_room_members WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId],
      );

      let closed = false;
      if (roomRes.rows[0].owner_user_id === userId) {
        await client.query(`UPDATE arena_private_rooms SET status = 'closed' WHERE id = $1`, [roomId]);
        closed = true;
      }

      await client.query("COMMIT");
      return { left: true, closed };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    if (sideId !== "left" && sideId !== "right") throw new LobbyError("invalid side");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const roomRes = await client.query(
        `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
         FROM arena_private_rooms WHERE id = $1 FOR UPDATE`,
        [roomId],
      );
      if ((roomRes.rowCount ?? 0) === 0) throw new LobbyError("room not found", 404);
      const r = roomRes.rows[0];
      if (r.status === "open" && Number(r.expires_at) <= this.clock()) throw new LobbyError("room has expired", 410);
      if (r.status !== "open") throw new LobbyError(`room is ${r.status}`, 409);

      const memberRes = await client.query(
        `SELECT room_id, user_id, side_id, ready, joined_at
         FROM arena_private_room_members WHERE room_id = $1 FOR UPDATE`,
        [roomId],
      );

      const targetMember = memberRes.rows.find((m: any) => m.user_id === userId);
      if (!targetMember) throw new LobbyError("not a member of this room", 403);

      if (targetMember.side_id === sideId) {
        // Already on this side
        await client.query("COMMIT");
        return {
          room: {
            id: r.id, code: r.code, mode: r.mode, ownerUserId: r.owner_user_id,
            status: r.status, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), matchId: r.match_id,
          },
          members: memberRes.rows.map((m: any) => ({
            roomId: m.room_id, userId: m.user_id, sideId: m.side_id, ready: Boolean(m.ready), joinedAt: Number(m.joined_at),
          })),
        };
      }

      const sideCap = perSideCapacity(r.mode);
      const onSideCount = memberRes.rows.filter((m: any) => m.side_id === sideId).length;
      if (onSideCount >= sideCap) throw new LobbyError("side is full", 409);

      // Change-clears-ready semantics: changing side resets ready to false!
      await client.query(
        `UPDATE arena_private_room_members SET side_id = $1, ready = FALSE WHERE room_id = $2 AND user_id = $3`,
        [sideId, roomId, userId],
      );

      const updatedMembers = await client.query(
        `SELECT room_id, user_id, side_id, ready, joined_at
         FROM arena_private_room_members WHERE room_id = $1 ORDER BY joined_at ASC`,
        [roomId],
      );

      await client.query("COMMIT");

      return {
        room: {
          id: r.id, code: r.code, mode: r.mode, ownerUserId: r.owner_user_id,
          status: r.status, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), matchId: r.match_id,
        },
        members: updatedMembers.rows.map((m: any) => ({
          roomId: m.room_id, userId: m.user_id, sideId: m.side_id as LobbySideId, ready: Boolean(m.ready), joinedAt: Number(m.joined_at),
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const roomRes = await client.query(
        `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
         FROM arena_private_rooms WHERE id = $1 FOR UPDATE`,
        [roomId],
      );
      if ((roomRes.rowCount ?? 0) === 0) throw new LobbyError("room not found", 404);
      const r = roomRes.rows[0];
      if (r.status === "open" && Number(r.expires_at) <= this.clock()) throw new LobbyError("room has expired", 410);
      if (r.status !== "open") throw new LobbyError(`room is ${r.status}`, 409);

      const updateRes = await client.query(
        `UPDATE arena_private_room_members SET ready = $1 WHERE room_id = $2 AND user_id = $3`,
        [ready, roomId, userId],
      );
      if ((updateRes.rowCount ?? 0) === 0) throw new LobbyError("not a member of this room", 403);

      const memberRes = await client.query(
        `SELECT room_id, user_id, side_id, ready, joined_at
         FROM arena_private_room_members WHERE room_id = $1 ORDER BY joined_at ASC`,
        [roomId],
      );

      await client.query("COMMIT");

      return {
        room: {
          id: r.id, code: r.code, mode: r.mode, ownerUserId: r.owner_user_id,
          status: r.status, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), matchId: r.match_id,
        },
        members: memberRes.rows.map((m: any) => ({
          roomId: m.room_id, userId: m.user_id, sideId: m.side_id as LobbySideId, ready: Boolean(m.ready), joinedAt: Number(m.joined_at),
        })),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async startPrivateRoom(
    userId: string,
    roomId: string,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const roomRes = await client.query(
        `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
         FROM arena_private_rooms WHERE id = $1 FOR UPDATE`,
        [roomId],
      );
      if ((roomRes.rowCount ?? 0) === 0) throw new LobbyError("room not found", 404);
      const r = roomRes.rows[0];

      if (r.status === "open" && Number(r.expires_at) <= this.clock()) throw new LobbyError("room has expired", 410);
      if (r.owner_user_id !== userId) throw new LobbyError("only the lobby host can start the match", 403);
      if (r.status === "matched") throw new LobbyError("room has already started", 409);
      if (r.status !== "open") throw new LobbyError(`room is ${r.status}`, 409);

      const memberRes = await client.query(
        `SELECT room_id, user_id, side_id, ready, joined_at
         FROM arena_private_room_members WHERE room_id = $1 ORDER BY joined_at ASC`,
        [roomId],
      );

      const members: PrivateRoomMember[] = memberRes.rows.map((m: any) => ({
        roomId: m.room_id, userId: m.user_id, sideId: m.side_id as LobbySideId, ready: Boolean(m.ready), joinedAt: Number(m.joined_at),
      }));

      const cap = capacityFor(r.mode);
      const sideCap = perSideCapacity(r.mode);
      const leftMembers = members.filter((m) => m.sideId === "left");
      const rightMembers = members.filter((m) => m.sideId === "right");

      if (members.length !== cap || leftMembers.length !== sideCap || rightMembers.length !== sideCap) {
        throw new LobbyError(`cannot start: sides must be full (${sideCap} per side)`, 400);
      }

      const notReady = members.filter((m) => !m.ready);
      if (notReady.length > 0) {
        throw new LobbyError("cannot start: all players must be ready", 400);
      }

      const participants = members.map((m) => ({ userId: m.userId, sideId: m.sideId }));
      const matchId = await createMatchFn({ mode: r.mode, participants, problemVersionIds }, (match) => saveMatchTx(client, match));

      await client.query(
        `UPDATE arena_private_rooms SET status = 'matched', match_id = $1 WHERE id = $2`,
        [matchId, roomId],
      );

      await client.query("COMMIT");
      return { matchId };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getRoomByCode(code: string): Promise<RoomWithMembers | null> {
    const res = await this.pool.query(
      `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
       FROM arena_private_rooms WHERE code = $1`,
      [code.toUpperCase().trim()],
    );
    if ((res.rowCount ?? 0) === 0) return null;
    return this.getRoomWithMembers(res.rows[0].id);
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    const res = await this.pool.query(
      `SELECT id, code, mode, owner_user_id, status, created_at, expires_at, match_id
       FROM arena_private_rooms WHERE id = $1`,
      [roomId],
    );
    if ((res.rowCount ?? 0) === 0) return null;
    const r = res.rows[0];
    const memberRes = await this.pool.query(
      `SELECT room_id, user_id, side_id, ready, joined_at
       FROM arena_private_room_members WHERE room_id = $1 ORDER BY joined_at ASC`,
      [roomId],
    );
    return {
      room: {
        id: r.id, code: r.code, mode: r.mode, ownerUserId: r.owner_user_id,
        status: r.status, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at), matchId: r.match_id,
      },
      members: memberRes.rows.map((m: any) => ({
        roomId: m.room_id, userId: m.user_id, sideId: m.side_id as LobbySideId, ready: Boolean(m.ready), joinedAt: Number(m.joined_at),
      })),
    };
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    const res = await this.pool.query(
      `SELECT r.id FROM arena_private_rooms r
       JOIN arena_private_room_members m ON m.room_id = r.id
       WHERE m.user_id = $1 AND ((r.status = 'open' AND r.expires_at > $2) OR (r.status = 'matched' AND EXISTS (SELECT 1 FROM matches WHERE id = r.match_id AND data->>'roundPhase' <> 'MATCH_COMPLETE')))
       ORDER BY r.created_at DESC LIMIT 1`,
      [userId, this.clock()],
    );
    if ((res.rowCount ?? 0) === 0) return null;
    return this.getRoomWithMembers(res.rows[0].id);
  }
}

// ─── In-Memory Implementation (Tests) ───────────────────────────────────────

export class InMemoryLobbyStore implements ILobbyStore {
  private queue = new Map<string, QueueEntry>();
  private rooms = new Map<string, PrivateRoom>();
  private members = new Map<string, PrivateRoomMember[]>();

  constructor(
    private readonly clock: () => number = Date.now,
    private readonly uuid: () => string = randomUUID,
    private readonly matches?: MatchStore,
  ) {}

  private pending: Promise<unknown> = Promise.resolve();

  // ponytail: the test/dev store serializes mutations; production uses PostgreSQL row locks.
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.pending.then(work);
    this.pending = result.catch(() => {});
    return result;
  }

  private async assertAvailable(userId: string, sameRoomId?: string): Promise<void> {
    for (const q of this.queue.values()) {
      if (q.userId === userId && q.status === "waiting") throw new LobbyError("already in queue", 409);
    }
    for (const room of this.rooms.values()) {
      if (room.id !== sameRoomId && room.status === "open" && room.expiresAt > this.clock() &&
          this.members.get(room.id)?.some(m => m.userId === userId)) {
        throw new LobbyError("already in a private room", 409);
      }
    }
    for (const id of await this.matches?.listIds() ?? []) {
      const match = await this.matches!.load(id);
      if (match && match.roundPhase !== "MATCH_COMPLETE" && match.participants.some(p => p.userId === userId)) {
        throw new LobbyError("already in an active match", 409);
      }
    }
  }

  private async completed(matchId: string | null): Promise<boolean> {
    return Boolean(matchId && (await this.matches?.load(matchId))?.roundPhase === "MATCH_COMPLETE");
  }

  async ensureSchema(): Promise<void> {}

  async joinQueue(userId: string, mode: MatchMode): Promise<QueueEntry> {
    return this.exclusive(async () => {
      if (mode !== "1v1" && mode !== "2v2") throw new LobbyError("invalid mode");
      await this.assertAvailable(userId);
      const entry: QueueEntry = {
        id: this.uuid(),
        userId,
        mode,
        status: "waiting",
        joinedAt: this.clock(),
        matchedMatchId: null,
        cancelledAt: null,
      };
      this.queue.set(entry.id, entry);
      return entry;
    });
  }

  async cancelQueue(userId: string): Promise<{ cancelled: boolean; matched: boolean; matchId?: string }> {
    return this.exclusive(async () => {
      for (const q of [...this.queue.values()].reverse().sort((a, b) => b.joinedAt - a.joinedAt)) {
        if (q.userId === userId && (q.status === "waiting" || q.status === "matched")) {
          if (q.status === "matched") return { cancelled: false, matched: true, matchId: q.matchedMatchId ?? undefined };
          q.status = "cancelled";
          q.cancelledAt = this.clock();
          return { cancelled: true, matched: false };
        }
      }
      return { cancelled: false, matched: false };
    });
  }

  async queueStatus(userId: string): Promise<QueueEntry | null> {
    for (const q of [...this.queue.values()].reverse().sort((a, b) => b.joinedAt - a.joinedAt)) {
      if (q.userId === userId && (q.status === "waiting" || q.status === "matched")) {
        if (await this.completed(q.matchedMatchId)) continue;
        return { ...q };
      }
    }
    return null;
  }

  async tryMatch(
    mode: MatchMode,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string; entries: QueueEntry[] } | null> {
    return this.exclusive(async () => {
      const n = capacityFor(mode);
      const waiting = [...this.queue.values()]
        .filter((q) => q.mode === mode && q.status === "waiting")
        .sort((a, b) => a.joinedAt - b.joinedAt);

      if (waiting.length < n) return null;

      const matchedEntries = waiting.slice(0, n);
      const participants: Array<{ userId: string; sideId: string }> = [];
      if (mode === "1v1") {
        participants.push({ userId: matchedEntries[0].userId, sideId: "left" });
        participants.push({ userId: matchedEntries[1].userId, sideId: "right" });
      } else {
        participants.push({ userId: matchedEntries[0].userId, sideId: "left" });
        participants.push({ userId: matchedEntries[1].userId, sideId: "left" });
        participants.push({ userId: matchedEntries[2].userId, sideId: "right" });
        participants.push({ userId: matchedEntries[3].userId, sideId: "right" });
      }

      const matchId = await createMatchFn({ mode, participants, problemVersionIds });

      for (const entry of matchedEntries) {
        entry.status = "matched";
        entry.matchedMatchId = matchId;
      }

      return { matchId, entries: matchedEntries.map((e) => ({ ...e })) };
    });
  }

  async createPrivateRoom(userId: string, mode: MatchMode, expiryMs: number = 20 * 60 * 1000): Promise<RoomWithMembers> {
    return this.exclusive(async () => {
      if (mode !== "1v1" && mode !== "2v2") throw new LobbyError("invalid mode");
      await this.assertAvailable(userId);
      const now = this.clock();
      const room: PrivateRoom = {
        id: this.uuid(),
        code: generateInviteCode(),
        mode,
        ownerUserId: userId,
        status: "open",
        createdAt: now,
        expiresAt: now + expiryMs,
        matchId: null,
      };
      this.rooms.set(room.id, room);

      const creator: PrivateRoomMember = {
        roomId: room.id,
        userId,
        sideId: "left",
        ready: false,
        joinedAt: now,
      };
      this.members.set(room.id, [creator]);
      return { room: { ...room }, members: [{ ...creator }] };
    });
  }

  async joinPrivateRoom(userId: string, inviteCode: string): Promise<RoomWithMembers & { full: boolean }> {
    return this.exclusive(async () => {
      const code = inviteCode.toUpperCase().trim();
      let room: PrivateRoom | undefined;
      for (const r of this.rooms.values()) {
        if (r.code === code) {
          room = r;
          break;
        }
      }
      if (!room) throw new LobbyError("invalid invite code", 404);
      await this.assertAvailable(userId, room.id);

      if (room.status === "open" && room.expiresAt < this.clock()) {
        room.status = "expired";
        throw new LobbyError("room has expired", 410);
      }
      if (room.status === "matched") throw new LobbyError("room has already started", 409);
      if (room.status === "open" && room.expiresAt <= this.clock()) throw new LobbyError("room has expired", 410);
      if (room.status !== "open") throw new LobbyError(`room is ${room.status}`, 409);

      const mems = this.members.get(room.id) ?? [];
      const existing = mems.find((m) => m.userId === userId);
      const cap = capacityFor(room.mode);
      if (existing) throw new LobbyError("already in this private room", 409);

      if (mems.length >= cap) throw new LobbyError("room is full", 409);

      const sideCap = perSideCapacity(room.mode);
      const leftCount = mems.filter((m) => m.sideId === "left").length;
      const assignedSide: LobbySideId = leftCount < sideCap ? "left" : "right";

      const newMember: PrivateRoomMember = {
        roomId: room.id,
        userId,
        sideId: assignedSide,
        ready: false,
        joinedAt: this.clock(),
      };
      mems.push(newMember);
      this.members.set(room.id, mems);

      return {
        room: { ...room },
        members: mems.map((m) => ({ ...m })),
        full: mems.length >= cap,
      };
    });
  }

  async leavePrivateRoom(userId: string, roomId: string): Promise<{ left: boolean; closed: boolean }> {
    return this.exclusive(async () => {
      const room = this.rooms.get(roomId);
      if (!room || room.status !== "open") return { left: false, closed: false };

      let mems = this.members.get(roomId) ?? [];
      mems = mems.filter((m) => m.userId !== userId);
      this.members.set(roomId, mems);

      let closed = false;
      if (room.ownerUserId === userId) {
        room.status = "closed";
        closed = true;
      }
      return { left: true, closed };
    });
  }

  async setRoomMemberSide(userId: string, roomId: string, sideId: LobbySideId): Promise<RoomWithMembers> {
    return this.exclusive(async () => {
      const room = this.rooms.get(roomId);
      if (!room) throw new LobbyError("room not found", 404);
      if (room.status === "open" && room.expiresAt <= this.clock()) throw new LobbyError("room has expired", 410);
      if (room.status !== "open") throw new LobbyError(`room is ${room.status}`, 409);

      const mems = this.members.get(roomId) ?? [];
      const target = mems.find((m) => m.userId === userId);
      if (!target) throw new LobbyError("not a member of this room", 403);

      if (target.sideId === sideId) {
        return { room: { ...room }, members: mems.map((m) => ({ ...m })) };
      }

      const sideCap = perSideCapacity(room.mode);
      const onSide = mems.filter((m) => m.sideId === sideId).length;
      if (onSide >= sideCap) throw new LobbyError("side is full", 409);

      target.sideId = sideId;
      target.ready = false; // change-clears-ready
      return { room: { ...room }, members: mems.map((m) => ({ ...m })) };
    });
  }

  async setRoomMemberReady(userId: string, roomId: string, ready: boolean): Promise<RoomWithMembers> {
    return this.exclusive(async () => {
      const room = this.rooms.get(roomId);
      if (!room) throw new LobbyError("room not found", 404);
      if (room.status === "open" && room.expiresAt <= this.clock()) throw new LobbyError("room has expired", 410);
      if (room.status !== "open") throw new LobbyError(`room is ${room.status}`, 409);

      const mems = this.members.get(roomId) ?? [];
      const target = mems.find((m) => m.userId === userId);
      if (!target) throw new LobbyError("not a member of this room", 403);

      target.ready = ready;
      return { room: { ...room }, members: mems.map((m) => ({ ...m })) };
    });
  }

  async startPrivateRoom(
    userId: string,
    roomId: string,
    problemVersionIds: string[],
    createMatchFn: (input: { mode: MatchMode; participants: Array<{ userId: string; sideId: string }>; problemVersionIds: string[] }, save?: (match: MatchRecord) => Promise<void>) => Promise<string>,
  ): Promise<{ matchId: string }> {
    return this.exclusive(async () => {
      const room = this.rooms.get(roomId);
      if (!room) throw new LobbyError("room not found", 404);
      if (room.ownerUserId !== userId) throw new LobbyError("only the lobby host can start the match", 403);
      if (room.status === "matched") throw new LobbyError("room has already started", 409);
      if (room.status === "open" && room.expiresAt <= this.clock()) throw new LobbyError("room has expired", 410);
      if (room.status !== "open") throw new LobbyError(`room is ${room.status}`, 409);

      const mems = this.members.get(roomId) ?? [];
      const cap = capacityFor(room.mode);
      const sideCap = perSideCapacity(room.mode);
      const left = mems.filter((m) => m.sideId === "left");
      const right = mems.filter((m) => m.sideId === "right");

      if (mems.length !== cap || left.length !== sideCap || right.length !== sideCap) {
        throw new LobbyError(`cannot start: sides must be full (${sideCap} per side)`, 400);
      }

      if (mems.some((m) => !m.ready)) {
        throw new LobbyError("cannot start: all players must be ready", 400);
      }

      const participants = mems.map((m) => ({ userId: m.userId, sideId: m.sideId }));
      const matchId = await createMatchFn({ mode: room.mode, participants, problemVersionIds });

      room.status = "matched";
      room.matchId = matchId;
      return { matchId };
    });
  }

  async getRoomByCode(code: string): Promise<RoomWithMembers | null> {
    const c = code.toUpperCase().trim();
    for (const r of this.rooms.values()) {
      if (r.code === c) return this.getRoomWithMembers(r.id);
    }
    return null;
  }

  async getRoomWithMembers(roomId: string): Promise<RoomWithMembers | null> {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const mems = this.members.get(roomId) ?? [];
    return { room: { ...room }, members: mems.map((m) => ({ ...m })) };
  }

  async userActiveRoom(userId: string): Promise<RoomWithMembers | null> {
    for (const r of this.rooms.values()) {
      if ((r.status === "open" && r.expiresAt > this.clock()) || (r.status === "matched" && !(await this.completed(r.matchId)))) {
        const mems = this.members.get(r.id) ?? [];
        if (mems.some((m) => m.userId === userId)) return { room: { ...r }, members: mems.map((m) => ({ ...m })) };
      }
    }
    return null;
  }
}
