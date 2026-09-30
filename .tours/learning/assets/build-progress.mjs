import { validateWorkspaceProfile } from "./build-workspaces.mjs";
export const BUILD_PROGRESS_KEY = "code-arena-learning:build:v1";
const WINDOW_NAME_MARKER = "\u001eCODE_ARENA_BUILD_PROGRESS_V1\u001f";
const record = () => ({ position: null, attempts: {}, reports: {}, notes: {} });
const object = (v, label) => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error(`${label}: expected object`);
  return v;
};
const text = (v, label) => {
  if (typeof v !== "string" || v.length > 10000)
    throw Error(`${label}: invalid text`);
  return v;
};
function safeKeys(value) {
  if (value && typeof value === "object")
    for (const key of Object.keys(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw Error("Unsafe data key");
      safeKeys(value[key]);
    }
}
export function emptyProgress(course) {
  return {
    version: 1,
    courseRevision: course.path.revision,
    sourceSnapshotId: course.path.sourceSnapshotId,
    theme: "dusk",
    activeWorkspace: "practice",
    workspaces: { practice: record() },
    profiles: [{ id: "practice", kind: "practice", root: null, mappings: [] }],
  };
}
function validateState(raw, course, imported = false) {
  safeKeys(raw);
  object(raw, "progress");
  if (raw.version !== 1) throw Error("Unsupported progress version");
  if (!["dusk", "light"].includes(raw.theme)) throw Error("Invalid theme");
  text(raw.courseRevision, "revision");
  text(raw.sourceSnapshotId, "snapshot");
  if (!Array.isArray(raw.profiles) || raw.profiles.length > 20)
    throw Error("Invalid profiles");
  const profiles = raw.profiles.map(validateWorkspaceProfile),
    ids = new Set(profiles.map((p) => p.id));
  if (
    ids.size !== profiles.length ||
    !profiles.some((p) => p.id === "practice" && p.kind === "practice") ||
    !ids.has(raw.activeWorkspace)
  )
    throw Error("Invalid active workspace");
  const steps = new Set(
      course.lessons.flatMap((l) => l.steps.map((s) => s.id))
    ),
    checks = new Map(
      course.lessons.flatMap((l) => l.checks.map((c) => [c.id, l]))
    );
  const workspaces = {};
  for (const [id, r] of Object.entries(object(raw.workspaces, "workspaces"))) {
    if (!ids.has(id)) throw Error(`Unknown workspace ${id}`);
    object(r, id);
    if (r.position !== null && !steps.has(r.position))
      throw Error(`Unknown step ${r.position}`);
    const next = { position: r.position, attempts: {}, reports: {}, notes: {} };
    for (const [sid, n] of Object.entries(object(r.attempts, "attempts"))) {
      if (!steps.has(sid) || !Number.isSafeInteger(n) || n < 0)
        throw Error("Invalid attempt");
      next.attempts[sid] = n;
    }
    for (const [sid, n] of Object.entries(object(r.notes, "notes"))) {
      if (!steps.has(sid)) throw Error(`Unknown step ${sid}`);
      next.notes[sid] = text(n, "note");
    }
    for (const [cid, c] of Object.entries(object(r.reports, "reports"))) {
      if (!checks.has(cid)) throw Error(`Unknown check ${cid}`);
      object(c, cid);
      if (
        !["untried", "passed", "failed", "blocked"].includes(c.status) ||
        !["learner-report", "import"].includes(c.source) ||
        typeof c.needsReview !== "boolean" ||
        typeof c.reportedAt !== "string" ||
        !/^\d{4}-\d\d-\d\dT/.test(c.reportedAt) ||
        Number.isNaN(Date.parse(c.reportedAt))
      )
        throw Error(`Invalid report ${cid}`);
      const changed = checks
        .get(cid)
        .references.some((r) => course.changedReferencePaths.includes(r.path));
      next.reports[cid] = {
        status: c.status,
        source: imported ? "import" : c.source,
        note: text(c.note, "note"),
        reportedAt: c.reportedAt,
        courseRevision: text(c.courseRevision, "revision"),
        sourceSnapshotId: text(c.sourceSnapshotId, "snapshot"),
        needsReview:
          imported ||
          c.needsReview ||
          changed ||
          c.courseRevision !== course.path.revision ||
          c.sourceSnapshotId !== course.path.sourceSnapshotId,
      };
    }
    workspaces[id] = next;
  }
  for (const id of ids) workspaces[id] ??= record();
  return {
    version: 1,
    courseRevision: course.path.revision,
    sourceSnapshotId: course.path.sourceSnapshotId,
    theme: raw.theme,
    activeWorkspace: raw.activeWorkspace,
    profiles,
    workspaces,
  };
}
export function reduceProgress(state, event, course) {
  const next = structuredClone(state),
    r = next.workspaces[next.activeWorkspace];
  switch (event.type) {
    case "visit":
      r.position = event.stepId;
      break;
    case "attempt":
      r.attempts[event.stepId] = (r.attempts[event.stepId] ?? 0) + 1;
      break;
    case "report":
      r.reports[event.checkId] = event.report;
      break;
    case "note":
      r.notes[event.stepId] = event.text;
      break;
    case "theme":
      next.theme = event.theme;
      break;
    case "workspace":
      next.activeWorkspace = event.id;
      break;
    case "profile": {
      const p = validateWorkspaceProfile(event.profile),
        old = next.profiles.findIndex((v) => v.id === p.id);
      if (old >= 0) {
        const changed =
          JSON.stringify(next.profiles[old]) !== JSON.stringify(p);
        next.profiles[old] = p;
        if (changed)
          for (const report of Object.values(
            next.workspaces[p.id]?.reports ?? {}
          ))
            report.needsReview = true;
      } else next.profiles.push(p);
      next.workspaces[p.id] ??= record();
      break;
    }
    default:
      throw Error("Unknown progress event");
  }
  return validateState(next, course);
}
function parse(value) {
  if (
    typeof value !== "string" ||
    new TextEncoder().encode(value).length > 1000000
  )
    throw Error("Progress file is too large (maximum 1 MB)");
  const raw = JSON.parse(value);
  safeKeys(raw);
  return raw;
}
export function createWindowNameProgressStorage(win) {
  const envelope = () => {
    const name = String(win?.name ?? ""),
      marker = name.lastIndexOf(WINDOW_NAME_MARKER);
    if (marker < 0) return null;
    try {
      const value = JSON.parse(
        decodeURIComponent(name.slice(marker + WINDOW_NAME_MARKER.length))
      );
      return value &&
        typeof value.originalName === "string" &&
        typeof value.value === "string"
        ? value
        : null;
    } catch {
      return null;
    }
  };
  return {
    getItem(key) {
      const saved = envelope();
      return saved?.key === key ? saved.value : null;
    },
    setItem(key, value) {
      if (typeof value !== "string") throw Error("Progress must be text");
      const current = String(win?.name ?? ""),
        saved = envelope(),
        originalName = saved?.originalName ?? current,
        encoded = encodeURIComponent(
          JSON.stringify({ key, value, originalName })
        );
      win.name = originalName + WINDOW_NAME_MARKER + encoded;
      if (envelope()?.value !== value)
        throw Error("This tab cannot keep a temporary progress copy");
    },
    removeItem(key) {
      const saved = envelope();
      if (saved?.key === key) win.name = saved.originalName;
    },
  };
}
const blockedWarning =
  "Browser storage is blocked. Export progress before leaving this lesson.";
const temporaryWarning =
  "Browser storage is blocked. This tab keeps a temporary copy across course pages; export progress before closing the tab.";
export function createTemporaryProgressStorage(win) {
  let session = null;
  try {
    session = win?.sessionStorage;
  } catch {}
  const name = createWindowNameProgressStorage(win);
  return {
    getItem(key) {
      try {
        const saved = session?.getItem(key);
        if (saved !== null && saved !== undefined) return saved;
      } catch {}
      return name.getItem(key);
    },
    setItem(key, value) {
      try {
        if (!session) throw Error("unavailable");
        session.setItem(key, value);
        return;
      } catch {}
      name.setItem(key, value);
    },
    removeItem(key) {
      try {
        session?.removeItem(key);
      } catch {}
      name.removeItem(key);
    },
  };
}
export function readProgress(storage, course, fallback = null) {
  let saved = null,
    storageUnavailable = false;
  try {
    if (!storage) throw Error("unavailable");
    saved = storage.getItem(BUILD_PROGRESS_KEY);
  } catch {
    storageUnavailable = true;
  }
  if (saved === null || storageUnavailable) {
    let temporary = null;
    try {
      temporary = fallback?.getItem(BUILD_PROGRESS_KEY) ?? null;
    } catch {}
    if (temporary !== null) {
      try {
        return {
          state: validateState(parse(temporary), course),
          warning: temporaryWarning,
        };
      } catch {
        return {
          state: emptyProgress(course),
          warning:
            "The temporary progress copy is corrupt. Export a backup before replacing it.",
        };
      }
    }
  }
  if (storageUnavailable)
    return { state: emptyProgress(course), warning: blockedWarning };
  if (saved === null) return { state: emptyProgress(course), warning: null };
  try {
    return { state: validateState(parse(saved), course), warning: null };
  } catch {
    return {
      state: emptyProgress(course),
      warning:
        "Saved progress is corrupt or from an incompatible course. It has not been overwritten. Export this session or confirm replacing the saved record.",
    };
  }
}
export function saveProgress(storage, state, fallback = null) {
  const saved = exportProgress(state);
  let durable = false,
    temporary = false;
  try {
    if (!storage) throw Error("unavailable");
    storage.setItem(BUILD_PROGRESS_KEY, saved);
    durable = true;
  } catch {}
  try {
    fallback?.setItem(BUILD_PROGRESS_KEY, saved);
    temporary = !!fallback;
  } catch {}
  return durable ? "durable" : temporary ? "temporary" : "unavailable";
}
export function importProgress(value, course) {
  return validateState(parse(value), course, true);
}
export function exportProgress(state) {
  return JSON.stringify(state, null, 2);
}
