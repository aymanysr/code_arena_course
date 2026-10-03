import { useState } from "react";
import type { RealSnippet } from "./types.js";

export function CodeSnippet({ snippet }: { snippet: RealSnippet }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lines = snippet.code.split("\n");

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      {/* Snippet Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-white">{snippet.title}</span>
          <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-400">
            {snippet.filePath} (lines {snippet.lines})
          </span>
        </div>

        <button
          type="button"
          className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 font-mono text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white"
          onClick={handleCopy}
        >
          {copied ? "✓ Copied to Clipboard" : "📋 Copy Code"}
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="p-3 overflow-x-auto font-mono text-xs leading-relaxed text-neutral-200 bg-neutral-900">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-neutral-800">
                <td className="w-10 select-none pr-3 text-right text-neutral-600">
                  {idx + 1}
                </td>
                <td className="whitespace-pre pl-2 text-neutral-200">
                  {line}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Why It Matters Callout */}
      <div className="border-t border-neutral-800 bg-neutral-800 p-3 text-xs leading-relaxed text-neutral-300">
        <span className="font-mono font-bold text-teal-600">Why this code matters: </span>
        <span>{snippet.whyItMatters}</span>
      </div>
    </div>
  );
}
