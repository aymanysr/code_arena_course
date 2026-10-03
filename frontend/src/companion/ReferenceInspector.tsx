import { useState, useMemo } from "react";
import { REFERENCE_FILES } from "./referenceFiles.js";

export function ReferenceInspector() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>("All");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const subsystems = useMemo(() => {
    return ["All", "Game Basics", "Game Engine", "Code Runner", "Web Server", "Screen & Network"];
  }, []);

  const filteredFiles = useMemo(() => {
    return REFERENCE_FILES.filter((file) => {
      const matchesSubsystem = selectedSubsystem === "All" || file.subsystem === selectedSubsystem;
      const matchesSearch =
        file.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.keyExports.some((exp) => exp.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSubsystem && matchesSearch;
    });
  }, [searchTerm, selectedSubsystem]);

  const handleCopy = async (code: string, filePath: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedFile(filePath);
      setTimeout(() => setCopiedFile(null), 2000);
    } catch {
      setCopiedFile(filePath);
      setTimeout(() => setCopiedFile(null), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-white">
          Code Arena File Directory
        </h2>
        <p className="text-xs text-neutral-300">
          A plain-English guide to the real files in this project: what each file does, the main functions it exports, and the rules it follows.
          Keep this open next to your IDE while coding.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {subsystems.map((sub) => (
            <button
              key={sub}
              type="button"
              className={`rounded px-2.5 py-1 transition-colors ${
                selectedSubsystem === sub
                  ? "bg-teal-700 text-white font-bold"
                  : "border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
              }`}
              onClick={() => setSelectedSubsystem(sub)}
            >
              {sub}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search files or functions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1 font-mono text-xs text-neutral-200 placeholder-neutral-500 focus:border-teal-600 focus:outline-none"
        />
      </div>

      {/* File Cards */}
      <div className="space-y-6">
        {filteredFiles.map((file) => (
          <div key={file.filePath} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-teal-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {file.subsystem}
                </span>
                <span className="font-mono text-xs font-bold text-white">
                  {file.filePath}
                </span>
              </div>

              <button
                type="button"
                className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 font-mono text-xs text-neutral-200 hover:bg-neutral-700 hover:text-white"
                onClick={() => handleCopy(file.snippet, file.filePath)}
              >
                {copiedFile === file.filePath ? "✓ Copied" : "📋 Copy Code"}
              </button>
            </div>

            <p className="text-xs text-neutral-300 font-sans">
              <strong className="text-white">What this file does: </strong>
              {file.purpose}
            </p>

            {/* Key Exports */}
            <div className="space-y-1">
              <div className="font-mono text-xs font-semibold text-neutral-400">
                Key Functions &amp; Types:
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                {file.keyExports.map((exp) => (
                  <span key={exp} className="rounded border border-neutral-800 bg-neutral-800 px-2 py-0.5 text-teal-600 font-semibold">
                    {exp}
                  </span>
                ))}
              </div>
            </div>

            {/* Invariants */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-3 space-y-1.5 font-mono text-xs">
              <div className="font-bold text-teal-600">
                Rules this file guarantees:
              </div>
              <ul className="list-disc list-inside space-y-1 text-neutral-300">
                {file.invariants.map((inv, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span>{inv}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Code Snippet */}
            <div className="rounded border border-neutral-800 bg-neutral-900 p-3 overflow-x-auto font-mono text-xs text-neutral-300">
              <pre>{file.snippet}</pre>
            </div>
          </div>
        ))}

        {filteredFiles.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center font-mono text-xs text-neutral-500">
            No files matched your search.
          </div>
        )}
      </div>
    </div>
  );
}
