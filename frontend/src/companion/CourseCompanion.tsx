import { useState, useMemo, useEffect } from "react";
import { MILESTONES } from "./curriculum.js";
import { CodeSnippet } from "./CodeSnippet.js";
import { ArchitectureTracer } from "./ArchitectureTracer.js";
import { ReferenceInspector } from "./ReferenceInspector.js";
import { MilestoneVisualizer } from "./MilestoneVisualizer.js";
import { TeammateSetupGuide } from "./TeammateSetupGuide.js";

type ActiveTab = "what-why" | "snippets" | "scaffold" | "c-bridge" | "testing";
type ViewMode = "curriculum" | "teammate-guide" | "reference-directory";

export function CourseCompanion({ onOpenArena }: { onOpenArena?: () => void }) {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>("M03");
  const [activeTab, setActiveTab] = useState<ActiveTab>("what-why");
  const [viewMode, setViewMode] = useState<ViewMode>("curriculum");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [completedMilestones, setCompletedMilestones] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("code_arena_completed_milestones");
      return saved ? JSON.parse(saved) : { M00: true };
    } catch {
      return { M00: true };
    }
  });

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const toggleMilestoneComplete = (id: string) => {
    setCompletedMilestones((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("code_arena_completed_milestones", JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const filteredMilestones = useMemo(() => {
    if (!filterSearch.trim()) return MILESTONES;
    const q = filterSearch.toLowerCase();
    return MILESTONES.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.theWhat.toLowerCase().includes(q) ||
        m.theWhy.toLowerCase().includes(q)
    );
  }, [filterSearch]);

  const activeMilestone = useMemo(() => {
    return MILESTONES.find((m) => m.id === selectedMilestoneId) ?? MILESTONES[0];
  }, [selectedMilestoneId]);

  // Keyboard navigation for milestones
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = MILESTONES.findIndex((m) => m.id === selectedMilestoneId);
      if (e.key === "ArrowDown" || e.key === "j") {
        if (idx < MILESTONES.length - 1) setSelectedMilestoneId(MILESTONES[idx + 1].id);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        if (idx > 0) setSelectedMilestoneId(MILESTONES[idx - 1].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMilestoneId]);

  const completedCount = Object.values(completedMilestones).filter(Boolean).length;

  return (
    <div className="flex h-full flex-col bg-neutral-900 text-neutral-100 font-sans">
      {/* Top Header: Companion Branding & Navigation */}
      <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded bg-teal-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
              GUIDE
            </span>
            <span className="font-bold tracking-tight text-white text-sm">
              Code Arena Guidebook
            </span>
          </div>
          <span className="hidden rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-300 md:inline">
            Keep this open next to your code
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Progress Indicator */}
          <div className="hidden items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-300 sm:flex">
            <span className="text-neutral-500">Done:</span>
            <span className="font-bold text-teal-600">
              {completedCount} / {MILESTONES.length}
            </span>
          </div>

          {/* Directory vs Curriculum vs Teammate Switcher */}
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-semibold transition-colors ${
              viewMode === "teammate-guide"
                ? "bg-teal-700 text-white shadow-sm"
                : "border border-neutral-700 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white"
            }`}
            onClick={() => setViewMode("teammate-guide")}
          >
            <span>Teammate Repo Guide</span>
            <span className="rounded bg-teal-700 px-1.5 py-0.5 font-mono text-xs font-bold text-white uppercase">
              Start Here
            </span>
          </button>

          <button
            type="button"
            className={`rounded px-2.5 py-1 font-semibold transition-colors ${
              viewMode === "curriculum"
                ? "bg-teal-700 text-white"
                : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
            }`}
            onClick={() => setViewMode("curriculum")}
          >
            Steps (M00 to M13)
          </button>

          <button
            type="button"
            className={`rounded px-2.5 py-1 font-semibold transition-colors ${
              viewMode === "reference-directory"
                ? "bg-teal-700 text-white"
                : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
            }`}
            onClick={() => setViewMode("reference-directory")}
          >
            File Directory
          </button>

          {onOpenArena && (
            <button
              type="button"
              className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white"
              onClick={onOpenArena}
            >
              ⚔️ Play Full Game
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      {viewMode === "reference-directory" ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-4xl">
            <ReferenceInspector />
          </div>
        </div>
      ) : viewMode === "teammate-guide" ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-4xl">
            <TeammateSetupGuide />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar: Milestones List */}
          <aside className="w-72 flex-shrink-0 border-r border-neutral-800 bg-neutral-900 p-3 space-y-3 overflow-y-auto">
            {/* Search Box */}
            <input
              type="text"
              placeholder="Search steps, words, or files..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 font-mono text-xs text-neutral-200 placeholder-neutral-500 focus:border-teal-600 focus:outline-none"
            />

            <div className="space-y-1">
              {filteredMilestones.map((m) => {
                const isSelected = m.id === activeMilestone.id;
                const isDone = completedMilestones[m.id];

                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`flex w-full flex-col items-start rounded-lg border p-2.5 text-left font-mono text-xs transition-colors ${
                      isSelected
                        ? "border-teal-600 bg-neutral-800 text-white shadow-sm"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                    }`}
                    onClick={() => setSelectedMilestoneId(m.id)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-bold text-teal-600">{m.id}</span>
                      <span className="text-neutral-500">{m.category}</span>
                    </div>
                    <div className="mt-1 line-clamp-1 font-sans text-xs font-semibold text-neutral-200">
                      {m.title}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                      <span>{isDone ? "✓ Done" : "○ Not done yet"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center/Right Panel: Milestone Deep-Dive */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
              {/* Milestone Header Card */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-teal-700 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                      {activeMilestone.id}
                    </span>
                    <span className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-300">
                      {activeMilestone.act}
                    </span>
                    <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-400">
                      {activeMilestone.category}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`rounded px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                      completedMilestones[activeMilestone.id]
                        ? "bg-teal-700 text-white"
                        : "border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                    onClick={() => toggleMilestoneComplete(activeMilestone.id)}
                  >
                    {completedMilestones[activeMilestone.id] ? "✓ Finished this step" : "Mark as Done"}
                  </button>
                </div>

                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {activeMilestone.title}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-teal-600">
                    {activeMilestone.subtitle}
                  </p>
                </div>

                {/* Subsystem Tab Navigation */}
                <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      activeTab === "what-why"
                        ? "bg-teal-700 text-white font-bold"
                        : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                    onClick={() => setActiveTab("what-why")}
                  >
                    1. What &amp; Why
                  </button>
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      activeTab === "snippets"
                        ? "bg-teal-700 text-white font-bold"
                        : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                    onClick={() => setActiveTab("snippets")}
                  >
                    2. Real Code Examples ({activeMilestone.snippets.length})
                  </button>
                  {activeMilestone.scaffold && (
                    <button
                      type="button"
                      className={`rounded px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                        activeTab === "scaffold"
                          ? "bg-teal-700 text-white font-bold"
                          : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                      }`}
                      onClick={() => setActiveTab("scaffold")}
                    >
                      3. IDE Files &amp; Setup
                    </button>
                  )}
                  {activeMilestone.cBridge && (
                    <button
                      type="button"
                      className={`rounded px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                        activeTab === "c-bridge"
                          ? "bg-teal-700 text-white font-bold"
                          : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                      }`}
                      onClick={() => setActiveTab("c-bridge")}
                    >
                      4. C vs TypeScript
                    </button>
                  )}
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      activeTab === "testing"
                        ? "bg-teal-700 text-white font-bold"
                        : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                    }`}
                    onClick={() => setActiveTab("testing")}
                  >
                    5. How to Test
                  </button>
                </div>
              </div>

              {/* TAB 1: What & Why */}
              {activeTab === "what-why" && (
                <div className="space-y-6">
                  {/* The What */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-2">
                    <div className="font-mono text-xs font-bold text-teal-600">
                      What this part actually does:
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-200">
                      {activeMilestone.theWhat}
                    </p>
                  </div>

                  {/* Interactive Visualizer for this Milestone */}
                  <MilestoneVisualizer milestoneId={activeMilestone.id} />

                  {/* The Why & Golden Rule */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-2">
                      <div className="font-mono text-xs font-bold text-teal-600">
                        Why we build it this way:
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-300">
                        {activeMilestone.theWhy}
                      </p>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-2">
                      <div className="font-mono text-xs font-bold text-teal-600">
                        The Golden Rule (Never break this):
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-300">
                        {activeMilestone.keyInvariant}
                      </p>
                    </div>
                  </div>

                  {/* What breaks if you skip this */}
                  <div className="rounded-xl border border-red-700 bg-neutral-900 p-5 space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-red-700">
                      <span>⚠️ What breaks if you don't do this:</span>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-300">
                      {activeMilestone.catastrophicFailureIfOmitted}
                    </p>
                  </div>

                  {/* Visual Architecture Flow */}
                  <ArchitectureTracer steps={activeMilestone.dataFlow} />
                </div>
              )}

              {/* TAB 2: Production Code Snippets */}
              {activeTab === "snippets" && (
                <div className="space-y-6">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 font-mono text-xs text-neutral-300">
                    <span className="font-bold text-white">Where this code lives: </span>
                    These snippets come directly from the real Code Arena files in this project.
                    You can copy them or use them to see how your own files should look.
                  </div>

                  {activeMilestone.snippets.map((snip, idx) => (
                    <CodeSnippet key={idx} snippet={snip} />
                  ))}
                </div>
              )}

              {/* TAB 3: IDE Files & Scaffolding */}
              {activeTab === "scaffold" && activeMilestone.scaffold && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-6">
                  <div className="border-b border-neutral-800 pb-3">
                    <span className="font-mono text-xs font-bold text-teal-600">
                      Step 3: What to Create in Your Teammate's Repo
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      File &amp; Folder Scaffolding for {activeMilestone.id}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-300">
                      Have your IDE open at the repository root. Run the terminal command below to generate this file, then paste the starter template.
                    </p>
                  </div>

                  {/* Terminal Creation Command */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs text-neutral-400">
                      <span>Run this command in your IDE terminal:</span>
                      <button
                        type="button"
                        className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                        onClick={() => handleCopy("scaffold-cmd-" + activeMilestone.id, activeMilestone.scaffold?.createCommand ?? "")}
                      >
                        {copiedId === "scaffold-cmd-" + activeMilestone.id ? "✓ Copied" : "📋 Copy Command"}
                      </button>
                    </div>
                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 font-mono text-xs text-teal-600 overflow-x-auto">
                      <code>{activeMilestone.scaffold.createCommand}</code>
                    </div>
                  </div>

                  {/* Target File & Purpose Cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 font-mono text-xs">
                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-1.5">
                      <div className="text-neutral-400">Target File Path:</div>
                      <div className="font-bold text-white break-all">{activeMilestone.scaffold.targetFile}</div>
                      <div className="text-neutral-500 text-xs pt-1">
                        Folder: <span className="text-teal-600">{activeMilestone.scaffold.folderPath}</span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-1.5">
                      <div className="text-neutral-400">File Responsibility:</div>
                      <div className="text-neutral-200">{activeMilestone.scaffold.purpose}</div>
                    </div>
                  </div>

                  {/* Starter Code */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-white">
                        Starter Template (Paste into {activeMilestone.scaffold.targetFile}):
                      </span>
                      <button
                        type="button"
                        className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                        onClick={() => handleCopy("scaffold-code-" + activeMilestone.id, activeMilestone.scaffold?.starterBoilerplate ?? "")}
                      >
                        {copiedId === "scaffold-code-" + activeMilestone.id ? "✓ Copied" : "📋 Copy Starter Code"}
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-800 p-4 font-mono text-xs text-neutral-200 leading-relaxed">
                      {activeMilestone.scaffold.starterBoilerplate}
                    </pre>
                  </div>

                  {/* Teammate Seam & Verification Checkpoint */}
                  <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2 font-mono text-xs">
                    <div className="font-bold text-teal-600">💡 Teammate Seam Guarantee:</div>
                    <p className="text-neutral-300 leading-relaxed text-xs">
                      This file lives inside an isolated package. It never conflicts with teammate git branches.
                      Once created in your IDE, verify it passes tests with:
                    </p>
                    <code className="block rounded bg-neutral-900 p-2 text-teal-600">
                      {activeMilestone.testGuide.terminalCommand}
                    </code>
                  </div>
                </div>
              )}

              {/* TAB 4: C to TypeScript Bridge */}
              {activeTab === "c-bridge" && activeMilestone.cBridge && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-5">
                  <div className="border-b border-neutral-800 pb-3">
                    <span className="font-mono text-xs font-bold text-teal-600">
                      Connecting C Knowledge to TypeScript
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      {activeMilestone.cBridge.cConcept} ➔ {activeMilestone.cBridge.tsConcept}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2 font-mono text-xs">
                      <div className="font-bold text-neutral-400">
                        How you do it in C:
                      </div>
                      <p className="leading-relaxed text-neutral-200">
                        {activeMilestone.cBridge.cComparison}
                      </p>
                    </div>

                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-2 font-mono text-xs">
                      <div className="font-bold text-teal-600">
                        How it works in TypeScript:
                      </div>
                      <p className="leading-relaxed text-neutral-200">
                        {activeMilestone.cBridge.whyDiffer}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Terminal Verification & Tests */}
              {activeTab === "testing" && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-6">
                  <div className="border-b border-neutral-800 pb-3">
                    <span className="font-mono text-xs font-bold text-teal-600">
                      Step 5: Testing Your Code in the Terminal
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white">
                      Run This Test Command
                    </h3>
                  </div>

                  {/* Terminal Command */}
                  <div className="space-y-2">
                    <div className="font-mono text-xs font-semibold text-neutral-400">
                      Run this in your terminal:
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-100">
                      <code>{activeMilestone.testGuide.terminalCommand}</code>
                      <button
                        type="button"
                        className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-neutral-300 hover:bg-neutral-700"
                        onClick={() => navigator.clipboard.writeText(activeMilestone.testGuide.terminalCommand)}
                      >
                        Copy Command
                      </button>
                    </div>
                  </div>

                  {/* What it Asserts */}
                  <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-1 font-mono text-xs">
                    <div className="font-bold text-white">What this test checks:</div>
                    <div className="text-neutral-300 leading-relaxed">
                      {activeMilestone.testGuide.whatItAsserts}
                    </div>
                    <div className="pt-2 text-neutral-400">
                      Test file in this repo: <code className="text-teal-600">{activeMilestone.testGuide.testFile}</code>
                    </div>
                  </div>

                  {/* Failure Diagnostics */}
                  <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4 space-y-3 font-mono text-xs">
                    <div className="font-bold text-teal-600">If the test fails, check this:</div>
                    <div>
                      <span className="text-neutral-400">What went wrong: </span>
                      <span className="text-red-700 font-semibold">{activeMilestone.testGuide.commonFailure.symptom}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400">Why it happened: </span>
                      <span className="text-neutral-300">{activeMilestone.testGuide.commonFailure.diagnostic}</span>
                    </div>
                    <div className="border-t border-neutral-700 pt-2">
                      <span className="text-teal-600 font-semibold">How to fix it: </span>
                      <span className="text-neutral-200">{activeMilestone.testGuide.commonFailure.fix}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Navigation: Previous / Next Milestone */}
              <div className="flex items-center justify-between border-t border-neutral-800 pt-4 font-mono text-xs">
                {(() => {
                  const currentIdx = MILESTONES.findIndex((m) => m.id === activeMilestone.id);
                  const prev = currentIdx > 0 ? MILESTONES[currentIdx - 1] : null;
                  const next = currentIdx < MILESTONES.length - 1 ? MILESTONES[currentIdx + 1] : null;

                  return (
                    <>
                      {prev ? (
                        <button
                          type="button"
                          className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-neutral-300 hover:border-neutral-700"
                          onClick={() => setSelectedMilestoneId(prev.id)}
                        >
                          ← {prev.id}: {prev.title}
                        </button>
                      ) : (
                        <div />
                      )}

                      {next ? (
                        <button
                          type="button"
                          className="rounded bg-teal-700 px-4 py-1.5 font-bold text-white hover:bg-teal-600"
                          onClick={() => setSelectedMilestoneId(next.id)}
                        >
                          {next.id}: {next.title} →
                        </button>
                      ) : (
                        <div />
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
