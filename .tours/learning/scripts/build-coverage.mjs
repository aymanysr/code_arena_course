const WORKSPACES = new Set([
  "author-rehearsal",
  "reference",
  "learner-practice",
  "team",
]);
const RESULTS = new Set(["passed", "failed", "blocked"]);
const CHECK_KINDS = new Set([
  "explain",
  "unit",
  "service",
  "database",
  "judge",
  "worker",
  "browser",
  "integration",
]);
const text = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Audit authored file and behavior coverage separately from execution evidence.
 * Author rehearsals can establish course readiness; only current team results can
 * establish that the destination implementation is complete.
 */
export function auditBuildCoverage(course, referenceData, evidence) {
  const issues = [];
  const issueKeys = new Set();
  const add = (id, reason, scope = "course") => {
    const key = `${scope}:${id}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push({ id, reason, scope });
  };
  const path = course?.path;
  const courseLessons = Array.isArray(course?.lessons) ? course.lessons : [];
  const manifestLessons = Array.isArray(path?.lessons) ? path.lessons : [];
  const catalogFiles = Array.isArray(referenceData?.files)
    ? referenceData.files
    : [];
  const exclusions = Array.isArray(referenceData?.exclusions)
    ? referenceData.exclusions
    : [];
  const dispositions = Array.isArray(path?.dispositions)
    ? path.dispositions
    : [];
  const behaviors = Array.isArray(path?.behaviors) ? path.behaviors : [];

  if (!path || !Array.isArray(path.lessons))
    add("course-manifest", "The validated course manifest is missing.");
  if (!Array.isArray(referenceData?.files))
    add("source-inventory", "The validated source inventory is missing.");
  if (!Array.isArray(evidence))
    add("evidence-ledger", "The course evidence ledger must be an array.");

  const lessonById = new Map(
    courseLessons.map((lesson) => [lesson.id, lesson])
  );
  const manifestById = new Map(
    manifestLessons.map((lesson) => [lesson.id, lesson])
  );
  for (const lesson of manifestLessons) {
    if (lesson.status !== "ready")
      add(`lesson:${lesson.id}`, "This lesson is still planned.");
    if (!lessonById.has(lesson.id))
      add(
        `lesson:${lesson.id}`,
        "A ready manifest lesson has no authored content."
      );
  }
  for (const lesson of courseLessons) {
    if (manifestById.get(lesson.id)?.status !== "ready")
      add(
        `lesson:${lesson.id}`,
        "Authored lesson content is not marked ready in the manifest."
      );
  }

  const dispositionByPath = new Map();
  for (const [index, disposition] of dispositions.entries()) {
    if (
      !disposition ||
      typeof disposition !== "object" ||
      !text(disposition.path)
    ) {
      add(
        `disposition:${index + 1}`,
        "A file disposition has no valid repository path."
      );
      continue;
    }
    if (dispositionByPath.has(disposition.path)) {
      add(
        `disposition:${disposition.path}`,
        "A path has more than one disposition."
      );
      continue;
    }
    dispositionByPath.set(disposition.path, disposition);
  }
  const inventoryPaths = new Set(
    catalogFiles.map((file) => file.path).filter(text)
  );
  const excludedPaths = new Set(
    exclusions.map((entry) => entry.path).filter(text)
  );

  for (const file of catalogFiles) {
    if (!text(file?.path)) continue;
    const disposition = dispositionByPath.get(file.path);
    if (!disposition) {
      add(
        `file:${file.path}`,
        "This inventoried source file has no reviewed disposition."
      );
      continue;
    }
    if (!["build", "support", "exclude"].includes(disposition.kind)) {
      add(
        `file:${file.path}`,
        "The disposition kind must be build, support, or exclude."
      );
      continue;
    }
    if (!text(disposition.reason))
      add(`file:${file.path}`, "The disposition needs a specific reason.");
    if (file.status === "source-changed-since-lesson") {
      add(
        `file:${file.path}`,
        "The source changed after its lesson reference and needs review."
      );
    }
    if (disposition.kind === "build") {
      const ids = Array.isArray(disposition.lessonIds)
        ? disposition.lessonIds
        : [];
      if (!ids.length)
        add(
          `file:${file.path}`,
          "A build disposition must name at least one course lesson."
        );
      for (const id of ids) {
        const lesson = lessonById.get(id);
        if (!lesson || manifestById.get(id)?.status !== "ready") {
          add(
            `file:${file.path}`,
            `Build lesson ${id} is missing or not ready.`
          );
        } else if (
          !(lesson.references ?? []).some(
            (reference) => reference.path === file.path
          )
        ) {
          add(
            `file:${file.path}`,
            `Build lesson ${id} does not cite this source file; mark it support-only or add the source to that lesson.`
          );
        }
      }
    } else if (
      Array.isArray(disposition.lessonIds) &&
      disposition.lessonIds.length
    ) {
      add(
        `file:${file.path}`,
        "A support or exclusion disposition cannot claim build lessons."
      );
    }
  }

  for (const exclusion of exclusions) {
    if (!text(exclusion?.path)) continue;
    const disposition = dispositionByPath.get(exclusion.path);
    if (!disposition) {
      add(
        `file:${exclusion.path}`,
        "This explicit scope exclusion has not been reviewed in the course disposition list."
      );
    } else if (
      disposition.kind !== "exclude" ||
      !text(disposition.reason) ||
      disposition.reason !== exclusion.reason
    ) {
      add(
        `file:${exclusion.path}`,
        "An explicit scope exclusion needs an exclude disposition that preserves its reviewed reason."
      );
    }
  }
  for (const [filePath, disposition] of dispositionByPath) {
    if (!inventoryPaths.has(filePath) && !excludedPaths.has(filePath)) {
      add(
        `disposition:${filePath}`,
        "This disposition does not match an inventoried or explicitly excluded path."
      );
    }
  }

  const checkById = new Map();
  for (const lesson of courseLessons) {
    for (const check of Array.isArray(lesson.checks) ? lesson.checks : []) {
      if (checkById.has(check.id)) {
        add(`check:${check.id}`, "The check ID is not unique across lessons.");
      } else {
        checkById.set(check.id, { ...check, lessonId: lesson.id });
      }
    }
  }

  const requiredChecks = new Set();
  for (const behavior of behaviors) {
    if (behavior?.scope !== "required") continue;
    const behaviorId = text(behavior.id) ? behavior.id : "unknown";
    const lessonIds = Array.isArray(behavior.lessonIds)
      ? behavior.lessonIds
      : [];
    const checkIds = Array.isArray(behavior.checkIds) ? behavior.checkIds : [];
    if (!checkIds.length) {
      add(
        `behavior:${behaviorId}`,
        "Required behavior has no linked course check."
      );
    }
    let linkedCheckCount = 0;
    for (const id of checkIds) {
      const check = checkById.get(id);
      if (!check) {
        add(`behavior:${behaviorId}`, `Linked check ${id} does not exist.`);
        continue;
      }
      if (!lessonIds.includes(check.lessonId)) {
        add(
          `behavior:${behaviorId}`,
          `Linked check ${id} belongs to ${check.lessonId}, outside this behavior’s lesson list.`
        );
        continue;
      }
      linkedCheckCount++;
    }
    if (checkIds.length && linkedCheckCount === 0) {
      add(
        `behavior:${behaviorId}`,
        "No linked check belongs to a lesson listed for this behavior."
      );
    }
    for (const lessonId of lessonIds) {
      if (
        !lessonById.has(lessonId) ||
        manifestById.get(lessonId)?.status !== "ready"
      ) {
        add(
          `behavior:${behaviorId}`,
          `Behavior lesson ${lessonId} is not authored and ready.`
        );
        continue;
      }
      for (const check of lessonById.get(lessonId).checks ?? []) {
        if (check.kind !== "explain") requiredChecks.add(check.id);
      }
    }
  }
  for (const [checkId, check] of checkById) {
    if (check.kind !== "explain" && !requiredChecks.has(checkId)) {
      add(
        `check:${checkId}`,
        "This executable check is not included in any required behavior."
      );
    }
  }

  if (course?.referenceReviewRequired)
    add(
      "source-review",
      "Reference sources or cited lessons still need review."
    );
  if (path?.sourceSnapshotId !== referenceData?.snapshotId) {
    add(
      "source-snapshot",
      "The course manifest snapshot does not match the current reference catalog."
    );
  }
  if (
    referenceData?.referenceSnapshotId &&
    referenceData.referenceSnapshotId !== referenceData.snapshotId
  ) {
    add(
      "source-snapshot",
      "The reviewed reference snapshot does not match the current catalog snapshot."
    );
  }
  for (const change of [
    ...(referenceData?.sourceChanges ?? []),
    ...(referenceData?.evidenceChanges ?? []),
  ]) {
    add(
      `source-drift:${change.path}`,
      "A source or reference-evidence file changed and needs reviewed regeneration."
    );
  }
  for (const field of [
    "invalidTourAnchors",
    "missingReferences",
    "invalidReferences",
    "templateLinkIssues",
    "courseOrderIssues",
    "unclassified",
  ]) {
    for (const [index, entry] of (referenceData?.[field] ?? []).entries()) {
      const itemPath =
        entry?.path ??
        entry?.file ??
        entry?.tourPath ??
        `${field}-${index + 1}`;
      add(
        `catalog:${field}:${itemPath}`,
        `The source catalog reports ${field}: ${itemPath}.`
      );
    }
  }

  const evidenceRows = Array.isArray(evidence) ? evidence : [];
  const latestByWorkspaceAndCheck = new Map();
  for (const [index, row] of evidenceRows.entries()) {
    const bad = (reason) =>
      add(
        `evidence:${index + 1}`,
        reason,
        row?.workspace === "team" ? "target" : "course"
      );
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      bad("Evidence row must be an object.");
      continue;
    }
    const requiredFields = [
      "lessonId",
      "checkId",
      "workspace",
      "kind",
      "command",
      "cwd",
      "result",
      "observed",
      "checkedAt",
      "revision",
      "sourceSnapshotId",
    ];
    const missingField = requiredFields.find((field) => !text(row[field]));
    if (missingField) {
      bad(`Evidence row is missing ${missingField}.`);
      continue;
    }
    if (
      !WORKSPACES.has(row.workspace) ||
      !RESULTS.has(row.result) ||
      !CHECK_KINDS.has(row.kind)
    ) {
      bad("Evidence row has an unknown workspace, result, or check kind.");
      continue;
    }
    if (
      !/^\d{4}-\d\d-\d\dT/.test(row.checkedAt) ||
      !Number.isFinite(Date.parse(row.checkedAt))
    ) {
      bad("Evidence timestamp is not a valid ISO date-time.");
      continue;
    }
    const check = checkById.get(row.checkId);
    if (!check) {
      bad(`Unknown course check ${row.checkId}; this row was rejected.`);
      continue;
    }
    if (row.lessonId !== check.lessonId || row.kind !== check.kind) {
      bad(
        `Evidence lesson or check kind does not match the authored ${row.checkId} check; this row was rejected.`
      );
      continue;
    }
    if (
      row.revision !== path?.revision ||
      row.sourceSnapshotId !== path?.sourceSnapshotId ||
      row.sourceSnapshotId !== referenceData?.snapshotId
    ) {
      bad(
        `Evidence for ${row.checkId} is stale for the current course revision or source snapshot; rerun the check.`
      );
      continue;
    }
    const key = `${row.workspace}\0${row.checkId}`;
    const prior = latestByWorkspaceAndCheck.get(key);
    const checkedAt = Date.parse(row.checkedAt);
    if (!prior || checkedAt >= prior.checkedAt)
      latestByWorkspaceAndCheck.set(key, { row, checkedAt });
  }

  let courseChecksPass = true;
  let targetChecksPass = true;
  for (const checkId of requiredChecks) {
    const check = checkById.get(checkId);
    const author = latestByWorkspaceAndCheck.get(
      `author-rehearsal\0${checkId}`
    )?.row;
    if (!author || author.result !== "passed") {
      courseChecksPass = false;
      add(
        `author-check:${checkId}`,
        !author
          ? "No current author-rehearsal result exists for this required check."
          : `The latest author-rehearsal result is ${author.result}; rerun and pass this check.`
      );
    }
    const team = latestByWorkspaceAndCheck.get(`team\0${checkId}`)?.row;
    if (!team || team.result !== "passed") {
      targetChecksPass = false;
      add(
        `team-check:${checkId}`,
        !team
          ? "No current check from the actual team repository exists."
          : `The latest team-repository result is ${team.result}; rerun and pass this check.`,
        "target"
      );
    }
  }

  const courseReady =
    !issues.some((issue) => issue.scope === "course") && courseChecksPass;
  if (!courseReady) {
    add(
      "course-gate",
      "Course coverage, source freshness, or required author-rehearsal checks are incomplete.",
      "target"
    );
  }
  const targetComplete =
    courseReady &&
    targetChecksPass &&
    !issues.some((issue) => issue.scope === "target");
  return { courseReady, targetComplete, issues };
}
