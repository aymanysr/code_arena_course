import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

let audit;
try {
  audit = await import("./reference-audit.mjs");
} catch {
  audit = null;
}

function requireExport(name) {
  assert.equal(typeof audit?.[name], "function", `${name} must be exported by reference-audit.mjs`);
  return audit[name];
}

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);
const digestC = "c".repeat(64);

test("parses shasum rows with spaces and rejects malformed or duplicate entries", () => {
  const parseChecksumList = requireExport("parseChecksumList");
  const parsed = parseChecksumList([
    `${digestA}  packages/arena-game/src/engine.ts`,
    "",
    `${digestB}  packages/arena-game/test/submit path.test.ts`,
    "  ",
  ].join("\n"));

  assert.deepEqual([...parsed], [
    ["packages/arena-game/src/engine.ts", digestA],
    ["packages/arena-game/test/submit path.test.ts", digestB],
  ]);
  assert.throws(
    () => parseChecksumList(`${digestA}  same.ts\n${digestB}  same.ts`),
    /line 2.*duplicate|duplicate.*line 2/i,
  );
  assert.throws(() => parseChecksumList(`not-a-digest  broken.ts`), /line 1.*sha-?256|sha-?256.*line 1/i);
});

test("parses and validates a complete frozen source snapshot", () => {
  const createReferenceSnapshot = requireExport("createReferenceSnapshot");
  const parseReferenceSnapshot = requireExport("parseReferenceSnapshot");
  const snapshot = createReferenceSnapshot({
    files: new Map([
      ["packages/arena-game/src/engine.ts", digestA],
      ["packages/arena-game/test/submit path.test.ts", digestB],
    ]),
    recordedAt: "2026-09-26T12:00:00.000Z",
    gitHead: "d".repeat(40),
  });
  const parsed = parseReferenceSnapshot(JSON.stringify(snapshot));

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.recordedAt, snapshot.recordedAt);
  assert.equal(parsed.gitHead, snapshot.gitHead);
  assert.equal(parsed.snapshotId, snapshot.snapshotId);
  assert.deepEqual([...parsed.files], snapshot.files.map(({ path, sha256 }) => [path, sha256]));
  assert.throws(() => parseReferenceSnapshot("{"), /invalid.*json|json.*invalid/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({ ...snapshot, schemaVersion: 99 })), /schema/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({ ...snapshot, recordedAt: undefined })), /recordedAt/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({
    ...snapshot,
    files: [...snapshot.files, { ...snapshot.files[0] }],
  })), /duplicate.*engine\.ts|engine\.ts.*duplicate/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({
    ...snapshot,
    files: [{ path: "packages/arena-game/src/engine.ts", sha256: "xyz" }],
  })), /sha256/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({
    ...snapshot,
    files: [{ path: "../outside.txt", sha256: digestC }],
  })), /path|outside|relative/i);
  assert.throws(() => parseReferenceSnapshot(JSON.stringify({ ...snapshot, snapshotId: "f".repeat(16) })), /snapshotId/i);
});

test("builds a deterministic content snapshot independent of Git HEAD", () => {
  const createReferenceSnapshot = requireExport("createReferenceSnapshot");
  const files = new Map([
    ["packages/arena-game/src/engine.ts", digestA],
    ["frontend/src/arena/socket.ts", digestB],
  ]);
  const first = createReferenceSnapshot({
    files,
    recordedAt: "2026-09-26T12:00:00.000Z",
    gitHead: "d".repeat(40),
  });
  const sameContentAtAnotherHead = createReferenceSnapshot({
    files,
    recordedAt: "2026-09-26T12:30:00.000Z",
    gitHead: "e".repeat(40),
  });
  const changedContentAtSameHead = createReferenceSnapshot({
    files: new Map([...files, ["added.ts", digestC]]),
    recordedAt: "2026-09-26T12:00:00.000Z",
    gitHead: "d".repeat(40),
  });

  assert.equal(first.snapshotId, sameContentAtAnotherHead.snapshotId);
  assert.notEqual(first.snapshotId, changedContentAtSameHead.snapshotId);
  assert.equal(first.gitHead, "d".repeat(40));
  assert.deepEqual(first.files, [
    { path: "frontend/src/arena/socket.ts", sha256: digestB },
    { path: "packages/arena-game/src/engine.ts", sha256: digestA },
  ]);
});

test("loads only top-level CodeTours and normalizes every file anchor", async () => {
  const loadCodeTours = requireExport("loadCodeTours");
  const root = await mkdtemp(path.join(os.tmpdir(), "code-arena-tours-"));
  try {
    await mkdir(path.join(root, ".tours/nested"), { recursive: true });
    await writeFile(path.join(root, ".tours/2-second.tour"), JSON.stringify({
      title: "Second tour",
      steps: [{ title: "Intro" }, { file: "packages/arena-game/src/engine.ts", line: 9, title: "Engine" }],
    }));
    await writeFile(path.join(root, ".tours/1-first.tour"), JSON.stringify({
      title: "First tour",
      steps: [{ file: "frontend/src/arena/socket.ts", line: 21, title: "Socket" }],
    }));
    await writeFile(path.join(root, ".tours/ignored.json"), "{}");
    await writeFile(path.join(root, ".tours/nested/ignored.tour"), JSON.stringify({ title: "Nested", steps: [] }));

    const tours = await loadCodeTours(root);
    assert.deepEqual(tours.map(({ path: tourPath, title }) => [tourPath, title]), [
      [".tours/1-first.tour", "First tour"],
      [".tours/2-second.tour", "Second tour"],
    ]);
    assert.deepEqual(tours[1].steps, [
      { step: 2, file: "packages/arena-game/src/engine.ts", line: 9, title: "Engine" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("parses CodeTour source anchors and ignores title-only steps", () => {
  const parseCodeTour = requireExport("parseCodeTour");
  const parsed = parseCodeTour(JSON.stringify({
    title: "Trace a game action",
    steps: [
      { title: "Start here", description: "Intro only." },
      { file: "packages/arena-game/src/engine.ts", line: 18, title: "Authorize the action" },
    ],
  }), ".tours/one.tour");

  assert.deepEqual(parsed, {
    path: ".tours/one.tour",
    title: "Trace a game action",
    steps: [{ step: 2, file: "packages/arena-game/src/engine.ts", line: 18, title: "Authorize the action" }],
  });
  assert.throws(() => parseCodeTour("{", ".tours/broken.tour"), /tour|json/i);
  assert.throws(() => parseCodeTour(JSON.stringify({
    title: "Bad anchor",
    steps: [{ file: "packages/arena-game/src/engine.ts", line: 0, title: "Invalid" }],
  }), ".tours/bad.tour"), /step 1.*line|line.*step 1/i);
});

test("reports added, changed, and deleted source paths in stable order", () => {
  const compareReferenceFiles = requireExport("compareReferenceFiles");
  const actual = compareReferenceFiles({
    expectedFiles: new Map([
      ["deleted.ts", digestA],
      ["changed.ts", digestB],
    ]),
    currentFiles: new Map([
      ["added.ts", digestC],
      ["changed.ts", digestC],
    ]),
  });

  assert.deepEqual(actual, [
    { path: "added.ts", kind: "added", expectedSha256: null, currentSha256: digestC },
    { path: "changed.ts", kind: "changed", expectedSha256: digestB, currentSha256: digestC },
    { path: "deleted.ts", kind: "deleted", expectedSha256: digestA, currentSha256: null },
  ]);
});

test("returns every lesson, CodeTour, and checksum-baseline consumer of a changed path", () => {
  const findReferenceConsumers = requireExport("findReferenceConsumers");
  const sourcePath = "packages/arena-game/src/engine.ts";
  const consumers = findReferenceConsumers({
    changedPaths: [sourcePath],
    coverageMap: {
      lessons: [
        { id: "0001-submit", title: "Submit", references: [{ path: sourcePath, startLine: 8, endLine: 12, label: "submit" }] },
        { id: "0002-reveal", title: "Reveal", references: [{ path: sourcePath, startLine: 20, endLine: 24, label: "reveal" }] },
      ],
    },
    tours: [
      { path: ".tours/one.tour", title: "One", steps: [{ step: 1, file: sourcePath, line: 9, title: "Submit path" }] },
      { path: ".tours/two.tour", title: "Two", steps: [{ step: 1, file: sourcePath, line: 21, title: "Reveal path" }] },
    ],
    referenceBaseline: {
      path: ".tours/reference-baseline.sha256",
      files: new Map([[sourcePath, digestA]]),
    },
  });

  assert.deepEqual(consumers.lessons.map(({ lessonId, title, startLine }) => [lessonId, title, startLine]), [
    ["0001-submit", "Submit", 8],
    ["0002-reveal", "Reveal", 20],
  ]);
  assert.deepEqual(consumers.tours.map(({ path, title, step, line }) => [path, title, step, line]), [
    [".tours/one.tour", "One", 1, 9],
    [".tours/two.tour", "Two", 1, 21],
  ]);
  assert.deepEqual(consumers.baselineRecords, [
    { sourcePath, baselinePath: ".tours/reference-baseline.sha256" },
  ]);
});
