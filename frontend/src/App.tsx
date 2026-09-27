import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArenaPage } from "./components/ArenaPage.js";
import { MockArenaTransport } from "./arena/mock.js";
import { SocketArenaTransport } from "./arena/socket.js";
import { LobbyClient } from "./arena/lobby.js";
import type { MatchMode } from "./arena/types.js";

const LobbyPage = lazy(() =>
  import("./components/LobbyPage.js").then(({ LobbyPage: page }) => ({ default: page })),
);

export const GAME_URL = (import.meta.env.VITE_GAME_URL as string | undefined)?.trim();

function LiveApp({ baseUrl, userId, matchId }: { baseUrl: string; userId: string; matchId: string }) {
  const transport = useMemo(() => new SocketArenaTransport({ baseUrl, userId, matchId }), [baseUrl, userId, matchId]);
  const [state, setState] = useState<"connecting" | "ready" | "failed">("connecting");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined") {
      (window as unknown as { __arenaTransport?: SocketArenaTransport }).__arenaTransport = transport;
    }
    transport
      .connect()
      .then(() => {
        if (!cancelled) setState("ready");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "connect failed");
          setState("failed");
        }
      });
    return () => {
      cancelled = true;
      transport.disconnect();
    };
  }, [transport]);
  if (state === "connecting") return <p className="p-4 font-mono text-sm">Connecting to match…</p>;
  if (state === "failed") return <p role="alert" className="p-4 font-mono text-sm text-red-700">Connection failed: {error}</p>;
  return <ArenaPage transport={transport} />;
}

function AppContent() {
  const [mode, setMode] = useState<MatchMode>("1v1");
  const transport = useMemo(() => new MockArenaTransport(mode), [mode]);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const paramMatchId = params.get("match") ?? "";
  const [liveMatchId, setLiveMatchId] = useState<string>(paramMatchId);

  if (params.get("live") === "1") {
    if (!GAME_URL)
      return <p role="alert" className="p-4 font-mono text-sm">Live mode requested but VITE_GAME_URL is not configured.</p>;
    const userId = params.get("user") ?? "user-a";

    if (liveMatchId) {
      return <LiveApp baseUrl={GAME_URL} userId={userId} matchId={liveMatchId} />;
    }

    const lobbyClient = new LobbyClient(GAME_URL, userId);
    return (
      <LobbyPage
        client={lobbyClient}
        userId={userId}
        initialMode="1v1"
        onMatchFound={(mId) => {
          setLiveMatchId(mId);
          if (typeof window !== "undefined") {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("match", mId);
            window.history.pushState({}, "", nextUrl.toString());
          }
        }}
      />
    );
  }
  return (
    <div>
      <div className="flex gap-2 border-b border-neutral-200 bg-white px-4 py-1" role="group" aria-label="Mode (mock)">
        {(["1v1", "2v2"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            className={`rounded px-2 py-1 font-mono text-xs ${mode === m ? "bg-teal-700 text-white" : "border border-neutral-300"}`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <ArenaPage transport={transport} />
    </div>
  );
}

export function App() {
  return (
    <Suspense
      fallback={
        <p className="p-4 font-mono text-sm" role="status">
          Loading Code Arena…
        </p>
      }
    >
      <AppContent />
    </Suspense>
  );
}
