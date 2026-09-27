import { useState } from "react";
import type { TestView } from "../arena/types.js";

const DOT: Record<TestView["status"], string> = {
  idle: "bg-neutral-300",
  running: "bg-amber-400",
  passed: "bg-teal-600",
  failed: "bg-red-500",
};

const LABEL: Record<TestView["status"], string> = {
  idle: "Not run",
  running: "Running examples…",
  passed: "Passed",
  failed: "Failed",
};

export function TestPanel({ tests }: { tests: TestView[] }) {
  const [customInput, setCustomInput] = useState("");
  return (
    <section aria-label="Visible tests" className="border-t border-neutral-200">
      <h3 className="px-3 pt-2 font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">Visible tests</h3>
      <ul className="divide-y divide-neutral-100">
        {tests.map((t) => (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2">
            <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${DOT[t.status]}`} />
            <span className="font-mono text-xs font-medium">{t.id}</span>
            <span className="text-xs text-neutral-700" role="status">
              {LABEL[t.status]}
            </span>
            {t.output !== null && (
              <span className="w-full font-mono text-xs text-neutral-600">
                output: {t.output}
                {t.ms !== null && ` · ${t.ms}ms`}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="px-3 pb-3">
        <label className="font-mono text-xs text-neutral-600">
          Custom input (visible behavior only)
          <textarea
            className="mt-1 h-16 w-full rounded-md border border-neutral-300 p-2 font-mono text-xs"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="nums = [4, 5]"
          />
        </label>
      </div>
    </section>
  );
}
