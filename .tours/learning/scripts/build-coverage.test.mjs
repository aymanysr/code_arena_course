import path from "node:path";
import { readFile } from "node:fs/promises";
import { buildCatalogData } from "./build-catalog.mjs";
import { loadBuildCourse } from "./build-course.mjs";

import test from "node:test";
import assert from "node:assert/strict";
import { auditBuildCoverage } from "./build-coverage.mjs";

const revision = "guided-test-1";
const snapshot = "snapshot-current";
const checkSpecs = [
  { id: "rule-unit", kind: "unit", command: "npm test", cwd: "." },
  { id: "real-judge", kind: "judge", command: "npm run test:judge", cwd: "." },
];

function makeEvidence(
  check,
  {
    workspace = "author-rehearsal",
    result = "passed",
    checkedAt = "2026-09-29T10:00:00.000Z",
    sourceSnapshotId = snapshot,
    command = check.command,
    cwd = check.cwd,
  } = {}
) {
  return {
    lessonId: "lesson-rule",
    checkId: check.id,
    workspace,
    kind: check.kind,
    command,
    cwd,
    result,
    observed: `${check.id} ${result}`,
    checkedAt,
    revision,
    sourceSnapshotId,
  };
}

function foundationFixture() {
  const checks = structuredClone(checkSpecs);
  const files = [{ path: "src/rule.ts", status: "current-lesson-reference" }];
  const referenceData = {
    snapshotId: snapshot,
    referenceSnapshotId: snapshot,
    files,
    exclusions: [],
    sourceChanges: [],
    evidenceChanges: [],
    invalidTourAnchors: [],
    missingReferences: [],
    invalidReferences: [],
    unclassified: [],
    summary: {
      stale: 0,
      uncovered: 0,
      unclassified: 0,
      missingReferences: 0,
      invalidReferences: 0,
    },
  };
  const course = {
    path: {
      revision,
      sourceSnapshotId: snapshot,
      lessons: [{ id: "lesson-rule", status: "ready" }],
      dispositions: [
        {
          path: "src/rule.ts",
          kind: "build",
          reason: "The learner builds this rule.",
          lessonIds: ["lesson-rule"],
        },
      ],
      behaviors: [
        {
          id: "behavior-rule",
          title: "Rule and Judge result",
          scope: "required",
          lessonIds: ["lesson-rule"],
          checkIds: ["rule-unit", "real-judge"],
          reason: "Keep rule behavior and real execution distinct.",
        },
      ],
    },
    lessons: [
      {
        id: "lesson-rule",
        checks,
        references: [{ path: "src/rule.ts" }],
      },
    ],
    changedReferencePaths: [],
    referenceReviewRequired: false,
  };
  return {
    course,
    referenceData,
    evidence: checks.map((check) => makeEvidence(check)),
  };
}

test("a newly inventoried source file without a disposition blocks course readiness", () => {
  const fixture = foundationFixture();
  fixture.referenceData.files.push({
    path: "src/new-rule.ts",
    status: "uncovered",
  });
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.id === "file:src/new-rule.ts" && issue.scope === "course"
    )
  );
});

test("a mapped build file does not count as behavior coverage without a linked check", () => {
  const fixture = foundationFixture();
  fixture.course.path.behaviors[0].checkIds = [];
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, false);
  assert.ok(
    result.issues.some((issue) => issue.id === "behavior:behavior-rule")
  );
});

test("evidence from an older source snapshot is rejected even when it passed", () => {
  const fixture = foundationFixture();
  fixture.evidence[0].sourceSnapshotId = "snapshot-old";
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, false);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.id.startsWith("evidence:") && /snapshot/i.test(issue.reason)
    )
  );
});

test("a blocked real Judge keeps its check open even when unit mocks pass", () => {
  const fixture = foundationFixture();
  fixture.evidence = [
    makeEvidence(checkSpecs[0]),
    makeEvidence(checkSpecs[1], { checkedAt: "2026-09-29T10:00:00.000Z" }),
    makeEvidence(checkSpecs[1], {
      result: "blocked",
      checkedAt: "2026-09-29T10:05:00.000Z",
    }),
  ];
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, false);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.id === "author-check:real-judge" && /blocked/i.test(issue.reason)
    )
  );
});

test("a passed author rehearsal completes the course gate but cannot complete the team target", () => {
  const fixture = foundationFixture();
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, true);
  assert.equal(result.targetComplete, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.id === "team-check:rule-unit" && issue.scope === "target"
    )
  );
});

test("current team checks complete only the target gate; a newer blocked result reopens it", () => {
  const fixture = foundationFixture();
  const courseOnly = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  const teamEvidence = checkSpecs.map((check) =>
    makeEvidence(check, {
      workspace: "team",
      command: `npm run team:${check.id}`,
      cwd: "apps/game",
    })
  );
  const complete = auditBuildCoverage(fixture.course, fixture.referenceData, [
    ...fixture.evidence,
    ...teamEvidence,
  ]);
  assert.equal(courseOnly.courseReady, true);
  assert.equal(complete.courseReady, courseOnly.courseReady);
  assert.equal(complete.targetComplete, true);

  const reopened = auditBuildCoverage(fixture.course, fixture.referenceData, [
    ...fixture.evidence,
    ...teamEvidence,
    makeEvidence(checkSpecs[1], {
      workspace: "team",
      result: "blocked",
      checkedAt: "2026-09-29T10:10:00.000Z",
    }),
  ]);
  assert.equal(reopened.targetComplete, false);
  assert.ok(
    reopened.issues.some(
      (issue) =>
        issue.id === "team-check:real-judge" && /blocked/i.test(issue.reason)
    )
  );
});

test("malformed and unknown check evidence is rejected instead of counted", () => {
  const fixture = foundationFixture();
  fixture.evidence.push({
    ...makeEvidence(checkSpecs[0]),
    checkId: "invented-check",
  });
  const result = auditBuildCoverage(
    fixture.course,
    fixture.referenceData,
    fixture.evidence
  );
  assert.equal(result.courseReady, false);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.id.startsWith("evidence:") &&
        /unknown|does not match/i.test(issue.reason)
    )
  );
});

test("the authored manifest covers the current source and explicit-exclusion inventories", async () => {
  const learningDir = path.join(process.cwd(), ".tours/learning");
  const coverageMap = JSON.parse(
    await readFile(path.join(learningDir, "coverage-map.json"), "utf8")
  );
  const referenceData = await buildCatalogData({
    repoRoot: process.cwd(),
    learningDir,
    coverageMap,
    tours: [],
  });
  const course = await loadBuildCourse(learningDir, referenceData);
  const evidence = JSON.parse(
    await readFile(path.join(learningDir, "course-evidence.json"), "utf8")
  );
  const result = auditBuildCoverage(course, referenceData, evidence);
  const expectedPaths = new Set([
    ...referenceData.files.map((file) => file.path),
    ...referenceData.exclusions.map((entry) => entry.path),
  ]);
  const dispositionPaths = new Set(
    course.path.dispositions.map((entry) => entry.path)
  );
  assert.deepEqual(dispositionPaths, expectedPaths);
  assert.equal(course.path.dispositions.length, expectedPaths.size);
  for (const behavior of course.path.behaviors.filter(
    (item) => item.scope === "required"
  )) {
    assert.ok(behavior.checkIds.length, `${behavior.id} has a linked check`);
  }
  assert.equal(
    result.issues.some((issue) =>
      /^(file|disposition|behavior):/.test(issue.id)
    ),
    false
  );
});
