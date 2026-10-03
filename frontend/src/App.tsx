import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArenaPage } from "./components/ArenaPage.js";
import { MockArenaTransport } from "./arena/mock.js";
import { SocketArenaTransport } from "./arena/socket.js";
import { LobbyClient } from "./arena/lobby.js";
import type { MatchMode } from "./arena/types.js";
import { CourseCompanion } from "./companion/CourseCompanion.js";

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
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const isTestPreview = typeof window !== "undefined" && window.location.port === "4173";
  const initialTab =
    params.get("tab") === "course" || params.get("course") === "1"
      ? "course"
      : params.get("live") === "1" || params.get("tab") === "arena" || isTestPreview
        ? "arena"
        : "course";
  const [activeTab, setActiveTab] = useState<"course" | "arena">(initialTab);

  return (
    <Suspense
      fallback={
        <p className="p-4 font-mono text-sm text-neutral-400" role="status">
          Loading Code Arena Guide…
        </p>
      }
    >
      <div className="flex h-screen flex-col bg-neutral-900 text-neutral-100">
        {/* Top App Tab Switcher */}
        <div
          className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-1.5"
          role="navigation"
          aria-label="App Navigation"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={activeTab === "course"}
              className={`rounded px-3 py-1 font-mono text-xs font-semibold ${
                activeTab === "course"
                  ? "bg-teal-700 text-white"
                  : "border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              onClick={() => setActiveTab("course")}
            >
              📚 Guidebook
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "arena"}
              className={`rounded px-3 py-1 font-mono text-xs font-semibold ${
                activeTab === "arena"
                  ? "bg-teal-700 text-white"
                  : "border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
              onClick={() => setActiveTab("arena")}
            >
              ⚔️ Play Full Game
            </button>
          </div>
        </div>

        {/* Full-width view for each mode */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "course" ? (
            <CourseCompanion onOpenArena={() => setActiveTab("arena")} />
          ) : (
            <div className="h-full overflow-y-auto bg-white text-neutral-900">
              <AppContent />
            </div>
          )}
        </div>
      </div>
    </Suspense>
  );
}

