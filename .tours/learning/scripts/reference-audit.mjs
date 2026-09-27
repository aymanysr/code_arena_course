import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const GIT_HEAD_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const SNAPSHOT_ID_PATTERN = /^[a-f0-9]{16}$/i;

function fail(message) {
  throw new Error(message);
}

function validateRelativePath(value, context) {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/.test(value)) {
    fail(`${context} must be a non-empty relative path`);
  }
  if (value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    fail(`${context} must use a relative POSIX path`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === ".." || segment === "") || path.posix.normalize(value) !== value) {
    fail(`${context} must not escape its repository-relative path`);
  }
  return value;
}

function validateDigest(value, context) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(`${context} must be a 64-character SHA-256 digest`);
  }
  return value.toLowerCase();
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function snapshotIdForFiles(files) {
  if (!(files instanceof Map)) fail("snapshotIdForFiles requires a files Map");
  const serialized = [...files]
    .sort(([left], [right]) => comparePaths(left, right))
    .map(([filePath, digest]) => `${filePath}\0${digest}`)
    .join("\n");
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

export function createReferenceSnapshot({ files, recordedAt, gitHead, lessonReviews = [] }) {
  if (!(files instanceof Map)) fail("Reference snapshot files must be a Map");
  if (typeof recordedAt !== "string" || Number.isNaN(Date.parse(recordedAt))) {
    fail("Reference snapshot recordedAt must be a valid date-time string");
  }
  if (typeof gitHead !== "string" || !GIT_HEAD_PATTERN.test(gitHead)) {
    fail("Reference snapshot gitHead must be a 40- or 64-character Git object ID");
  }
  // ponytail: reviews are an attestation list, not content — snapshotId hashes files only.
  // Ceiling: free-text ids; upgrade to per-lesson status/outcome if review needs more than presence.
  if (!Array.isArray(lessonReviews)) fail("Reference snapshot lessonReviews must be an array");
  const normalizedReviews = [...new Set(lessonReviews.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "" || /\s/.test(entry)) {
      fail(`Reference snapshot lessonReviews entry ${index + 1} must be a non-empty id without whitespace`);
    }
    return entry.trim();
  }))].sort(comparePaths);

  const normalizedFiles = new Map();
  for (const [filePath, digest] of files) {
    const normalizedPath = validateRelativePath(filePath, "Reference snapshot path");
    if (normalizedFiles.has(normalizedPath)) fail(`Duplicate reference snapshot path: ${normalizedPath}`);
    normalizedFiles.set(normalizedPath, validateDigest(digest, `Reference snapshot sha256 for ${normalizedPath}`));
  }
  const sortedFiles = [...normalizedFiles].sort(([left], [right]) => comparePaths(left, right));
  const sortedMap = new Map(sortedFiles);
  return {
    schemaVersion: 1,
    recordedAt,
    gitHead: gitHead.toLowerCase(),
    snapshotId: snapshotIdForFiles(sortedMap),
    files: sortedFiles.map(([filePath, sha256]) => ({ path: filePath, sha256 })),
    ...(normalizedReviews.length ? { lessonReviews: normalizedReviews } : {}),
  };
}

export function parseChecksumList(text) {
  if (typeof text !== "string") fail("Checksum list must be text");

  const files = new Map();
  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trim() === "") continue;

    const match = /^([a-f0-9]{64})[ \t]{2,}(.*)$/i.exec(line);
    if (!match || match[2].length === 0) {
      fail(`Invalid SHA-256 checksum on line ${index + 1}`);
    }

    const filePath = validateRelativePath(match[2], `Checksum path on line ${index + 1}`);
    if (files.has(filePath)) fail(`Duplicate checksum path on line ${index + 1}: ${filePath}`);
    files.set(filePath, match[1].toLowerCase());
  }
  return files;
}

export function parseReferenceSnapshot(text) {
  if (typeof text !== "string") fail("Reference snapshot must be JSON text");

  let snapshot;
  try {
    snapshot = JSON.parse(text);
  } catch (error) {
    fail(`Invalid reference snapshot JSON: ${error.message}`);
  }

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    fail("Reference snapshot must be a JSON object");
  }
  if (snapshot.schemaVersion !== 1) fail(`Unsupported reference snapshot schemaVersion: ${snapshot.schemaVersion}`);
  if (typeof snapshot.recordedAt !== "string" || Number.isNaN(Date.parse(snapshot.recordedAt))) {
    fail("Reference snapshot recordedAt must be a valid date-time string");
  }
  if (typeof snapshot.gitHead !== "string" || !GIT_HEAD_PATTERN.test(snapshot.gitHead)) {
    fail("Reference snapshot gitHead must be a 40- or 64-character Git object ID");
  }
  if (typeof snapshot.snapshotId !== "string" || !SNAPSHOT_ID_PATTERN.test(snapshot.snapshotId)) {
    fail("Reference snapshot snapshotId must be a 16-character hexadecimal identifier");
  }
  if (!Array.isArray(snapshot.files)) fail("Reference snapshot files must be an array");

  const files = new Map();
  for (const [index, entry] of snapshot.files.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`Reference snapshot file entry ${index + 1} must be an object`);
    }
    const filePath = validateRelativePath(entry.path, `Reference snapshot path at entry ${index + 1}`);
    if (files.has(filePath)) fail(`Duplicate reference snapshot path: ${filePath}`);
    files.set(filePath, validateDigest(entry.sha256, `Reference snapshot sha256 for ${filePath}`));
  }
  const expectedSnapshotId = snapshotIdForFiles(files);
  if (snapshot.snapshotId.toLowerCase() !== expectedSnapshotId) {
    fail(`Reference snapshot snapshotId does not match its file contents (expected ${expectedSnapshotId})`);
  }
  let lessonReviews = [];
  if (snapshot.lessonReviews !== undefined) {
    if (!Array.isArray(snapshot.lessonReviews)) fail("Reference snapshot lessonReviews must be an array");
    lessonReviews = [...new Set(snapshot.lessonReviews.map((entry, index) => {
      if (typeof entry !== "string" || entry.trim() === "" || /\s/.test(entry)) {
        fail(`Reference snapshot lessonReviews entry ${index + 1} must be a non-empty id without whitespace`);
      }
      return entry.trim();
    }))].sort(comparePaths);
  }

  return {
    schemaVersion: snapshot.schemaVersion,
    recordedAt: snapshot.recordedAt,
    gitHead: snapshot.gitHead.toLowerCase(),
    snapshotId: snapshot.snapshotId.toLowerCase(),
    files,
    lessonReviews,
  };
}

export function compareReferenceFiles({ expectedFiles, currentFiles }) {
  if (!(expectedFiles instanceof Map) || !(currentFiles instanceof Map)) {
    fail("compareReferenceFiles requires expectedFiles and currentFiles Maps");
  }

  const changed = [];
  const paths = new Set([...expectedFiles.keys(), ...currentFiles.keys()]);
  for (const filePath of [...paths].sort(comparePaths)) {
    const expectedSha256 = expectedFiles.get(filePath) ?? null;
    const currentSha256 = currentFiles.get(filePath) ?? null;
    if (expectedSha256 === null) {
      changed.push({ path: filePath, kind: "added", expectedSha256: null, currentSha256 });
    } else if (currentSha256 === null) {
      changed.push({ path: filePath, kind: "deleted", expectedSha256, currentSha256: null });
    } else if (expectedSha256 !== currentSha256) {
      changed.push({ path: filePath, kind: "changed", expectedSha256, currentSha256 });
    }
  }
  return changed;
}

export function parseCodeTour(text, tourPath) {
  const normalizedTourPath = validateRelativePath(tourPath, "CodeTour path");
  let tour;
  try {
    tour = JSON.parse(text);
  } catch (error) {
    fail(`Invalid CodeTour JSON in ${normalizedTourPath}: ${error.message}`);
  }
  if (!tour || typeof tour !== "object" || Array.isArray(tour) || !Array.isArray(tour.steps)) {
    fail(`Invalid CodeTour document in ${normalizedTourPath}: steps must be an array`);
  }

  const steps = [];
  for (const [index, step] of tour.steps.entries()) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      fail(`Invalid CodeTour step ${index + 1} in ${normalizedTourPath}`);
    }
    if (step.file === undefined) continue;
    const file = validateRelativePath(step.file, `CodeTour step ${index + 1} file`);
    if (!Number.isInteger(step.line) || step.line < 1) {
      fail(`CodeTour step ${index + 1} must have a positive line number`);
    }
    steps.push({
      step: index + 1,
      file,
      line: step.line,
      title: typeof step.title === "string" ? step.title : "",
    });
  }

  return {
    path: normalizedTourPath,
    title: typeof tour.title === "string" ? tour.title : "",
    steps,
  };
}

export async function loadCodeTours(repoRoot) {
  const toursDirectory = path.join(repoRoot, ".tours");
  const entries = await readdir(toursDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tour"))
    .sort((left, right) => comparePaths(left.name, right.name));
  const tours = [];
  for (const entry of files) {
    const tourPath = `.tours/${entry.name}`;
    tours.push(parseCodeTour(await readFile(path.join(toursDirectory, entry.name), "utf8"), tourPath));
  }
  return tours;
}

export function findReferenceConsumers({ changedPaths, coverageMap, tours, referenceBaseline }) {
  const changed = new Set([...new Set(changedPaths ?? [])].map((value) => validateRelativePath(value, "Changed path")));
  const lessons = [];
  for (const lesson of coverageMap?.lessons ?? []) {
    for (const reference of lesson.references ?? []) {
      if (!changed.has(reference.path)) continue;
      lessons.push({
        path: reference.path,
        lessonId: lesson.id,
        title: lesson.title,
        startLine: reference.startLine,
        endLine: reference.endLine,
        label: reference.label ?? "",
      });
    }
  }

  const tourConsumers = [];
  for (const tour of tours ?? []) {
    for (const step of tour.steps ?? []) {
      if (!changed.has(step.file)) continue;
      tourConsumers.push({
        path: tour.path,
        title: tour.title,
        step: step.step,
        line: step.line,
        sourcePath: step.file,
        stepTitle: step.title ?? "",
      });
    }
  }

  const baselineRecords = [];
  const baselineFiles = referenceBaseline?.files;
  if (baselineFiles instanceof Map) {
    for (const sourcePath of changed) {
      if (baselineFiles.has(sourcePath)) {
        baselineRecords.push({ sourcePath, baselinePath: referenceBaseline.path });
      }
    }
  }

  return { lessons, tours: tourConsumers, baselineRecords };
}
