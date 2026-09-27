import { useEffect, useState } from "react";
import type { ArenaTransport } from "./transport.js";
import type { ArenaSnapshot } from "./types.js";

/** Subscribes to the transport's authoritative snapshot. Local UI state stays in components. */
export function useArena(transport: ArenaTransport): ArenaSnapshot {
  const [snapshot, setSnapshot] = useState<ArenaSnapshot>(() => transport.snapshot());
  useEffect(() => transport.subscribe(() => setSnapshot(transport.snapshot())), [transport]);
  return snapshot;
}
