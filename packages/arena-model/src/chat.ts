export const TEAM_PINGS = [
  "CHECK_EDGE_CASE",
  "RUN_THIS_INPUT",
  "REVIEW_COMPLEXITY",
  "READY",
] as const;

export type TeamPing = (typeof TEAM_PINGS)[number];

export const TEAM_PING_LABELS: Record<TeamPing, string> = {
  CHECK_EDGE_CASE: "Check edge case",
  RUN_THIS_INPUT: "Run this input",
  REVIEW_COMPLEXITY: "Review complexity",
  READY: "Ready?",
};

export function isTeamPing(value: unknown): value is TeamPing {
  return typeof value === "string" && (TEAM_PINGS as readonly string[]).includes(value);
}

export interface TeamChatMessage {
  id: string;
  matchId: string;
  sideId: string;
  senderUserId: string;
  text: string;
  timestamp: number;
  type: "text";
}

export interface TeamChatPing {
  id: string;
  matchId: string;
  sideId: string;
  senderUserId: string;
  ping: TeamPing;
  timestamp: number;
  type: "ping";
}

export type TeamChatEntry = TeamChatMessage | TeamChatPing;

export interface TeamChatAuthContext {
  matchId: string;
  sideId: string;
  userId: string;
  displayName: string;
  roomId: string;
  active: boolean;
  phase: string;
}
