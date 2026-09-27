import type { PlayerStatus } from "../arena/types.js";

/** Text labels mirror arena-model STATUS_LABEL so status is never color-only. */
export const STATUS_LABEL: Record<PlayerStatus, string> = {
  coding: "Coding",
  running: "Running",
  submitted: "Submitted",
  evaluating: "Evaluating",
  locked: "Locked in",
};
