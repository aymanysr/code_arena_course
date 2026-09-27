import { useEffect, useState } from "react";
import {
  type TeamChatClient,
  type TeamChatEntry,
  type TeamPing,
  TEAM_PINGS,
  TEAM_PING_LABELS,
} from "../arena/chat.js";

interface FallbackMessage {
  id: string;
  from: string;
  text: string;
  type: "text";
}

export function TeamChat({
  client,
  readOnly = false,
}: {
  client?: TeamChatClient | null;
  readOnly?: boolean;
}) {
  const [entries, setEntries] = useState<TeamChatEntry[]>(() => client?.getMessages() ?? []);
  const [fallbackMessages, setFallbackMessages] = useState<FallbackMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(client?.status ?? "connected");
  const [error, setError] = useState<string | null>(client?.error ?? null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setEntries(client.getMessages());
    setStatus(client.status);
    setError(client.error);

    const unsub = client.subscribe(() => {
      setEntries(client.getMessages());
      setStatus(client.status);
      setError(client.error);
    });
    return unsub;
  }, [client]);

  const currentUserId = client?.options.userId ?? "You";

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const text = draft.trim();
    if (!text) return;

    if (client) {
      try {
        await client.sendMessage(text);
        setDraft("");
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "failed to send message");
      }
    } else {
      // Mock / fallback path
      setFallbackMessages((prev) => [
        ...prev,
        { id: String(Date.now()), from: "You", text, type: "text" },
      ]);
      setDraft("");
    }
  };

  const handleSendPing = async (ping: TeamPing) => {
    setActionError(null);
    if (client) {
      try {
        await client.sendPing(ping);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "failed to send ping");
      }
    }
  };

  const disabled = readOnly || (client !== null && client !== undefined && status !== "connected");

  return (
    <section aria-label="Team chat" className="rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <h4 className="font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Team chat
        </h4>
        {client && (
          <span
            className={`font-mono text-xs ${
              status === "connected"
                ? "text-teal-700"
                : status === "error"
                ? "text-red-700"
                : "text-neutral-500"
            }`}
          >
            {readOnly ? "closed" : status}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          Chat: {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          {actionError}
        </p>
      )}

      <ul aria-live="polite" className="max-h-36 space-y-1.5 overflow-y-auto px-3 py-2">
        {client
          ? entries.map((entry) => {
              const isYou = entry.senderUserId === currentUserId;
              const senderLabel = isYou ? "You" : entry.senderUserId;

              if (entry.type === "ping") {
                return (
                  <li key={entry.id} className="text-xs text-neutral-700 bg-neutral-50 rounded px-1.5 py-0.5 border border-neutral-200">
                    <span className="font-medium text-teal-700">{senderLabel} [PING]: </span>
                    <span className="font-semibold text-neutral-900">
                      {TEAM_PING_LABELS[entry.ping] ?? entry.ping}
                    </span>
                  </li>
                );
              }

              return (
                <li key={entry.id} className="text-xs text-neutral-800 break-words">
                  <span className="font-medium text-neutral-500">{senderLabel}: </span>
                  <span>{entry.text}</span>
                </li>
              );
            })
          : fallbackMessages.map((m) => (
              <li key={m.id} className="text-xs text-neutral-800">
                <span className="font-medium text-neutral-500">{m.from}: </span>
                <span>{m.text}</span>
              </li>
            ))}
      </ul>

      {/* Contextual quick pings */}
      {client && !readOnly && (
        <div className="flex flex-wrap gap-1 border-t border-neutral-200 bg-neutral-50 px-2 py-1.5" role="toolbar" aria-label="Team quick pings">
          {TEAM_PINGS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              className="rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-700 disabled:opacity-50"
              onClick={() => void handleSendPing(p)}
              aria-label={`Ping: ${TEAM_PING_LABELS[p]}`}
            >
              {TEAM_PING_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      <form className="flex gap-2 border-t border-neutral-200 p-2" onSubmit={handleSendText}>
        <input
          aria-label="Team message"
          className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs disabled:bg-neutral-100 disabled:text-neutral-500"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={readOnly ? "Match complete — chat closed" : "Message your team…"}
          disabled={disabled}
          maxLength={500}
        />
        <button
          type="submit"
          className="rounded bg-teal-700 px-2 py-1 text-xs text-white disabled:opacity-50"
          aria-label="Send team message"
          disabled={disabled || !draft.trim()}
        >
          ›
        </button>
      </form>
    </section>
  );
}
