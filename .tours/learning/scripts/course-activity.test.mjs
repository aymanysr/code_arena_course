import assert from "node:assert/strict";
import test from "node:test";

let activity;
try {
  activity = await import("../assets/course-activity.mjs");
} catch {
  activity = null;
}

const lessonIds = ["lesson-one", "lesson-two", "lesson-three"];
const emptyActivity = () => ({ version: 1, lastLessonId: null, lessons: {} });

function requireActivity(name) {
  assert.equal(typeof activity?.[name], "function", `${name} must be exported from course-activity.mjs`);
  return activity[name];
}

test("reads empty and valid local course activity", () => {
  const { COURSE_ACTIVITY_KEY, readCourseActivity, writeCourseActivity } = activity ?? {};
  assert.equal(typeof readCourseActivity, "function");
  assert.equal(typeof writeCourseActivity, "function");
  assert.equal(COURSE_ACTIVITY_KEY, "code-arena-learning:activity:v1");
  assert.deepEqual(readCourseActivity(null, lessonIds), emptyActivity());
  assert.deepEqual(readCourseActivity({ getItem: () => null }, lessonIds), emptyActivity());

  const saved = {
    version: 1,
    lastLessonId: "lesson-two",
    lessons: { "lesson-one": "self-check-recorded", "lesson-two": "started" },
  };
  assert.deepEqual(readCourseActivity({ getItem: () => JSON.stringify(saved) }, lessonIds), saved);

  let writtenKey;
  let writtenValue;
  const storage = { setItem: (key, value) => { writtenKey = key; writtenValue = value; } };
  assert.equal(writeCourseActivity(storage, saved), true);
  assert.equal(writtenKey, COURSE_ACTIVITY_KEY);
  assert.deepEqual(JSON.parse(writtenValue), saved);
});

test("resets invalid, future, removed-lesson, and inaccessible activity", () => {
  const readCourseActivity = requireActivity("readCourseActivity");
  const invalidRecords = [
    "not JSON",
    JSON.stringify({ version: 2, lastLessonId: "lesson-one", lessons: {} }),
    JSON.stringify({ version: 1, lastLessonId: "lesson-one", lessons: { "lesson-one": "mastered" } }),
    JSON.stringify({ version: 1, lastLessonId: "removed-lesson", lessons: { "removed-lesson": "started" } }),
    JSON.stringify({ version: 1, lastLessonId: "lesson-one", lessons: { "lesson-one": "started", "removed-lesson": "started" } }),
  ];
  for (const stored of invalidRecords) {
    assert.deepEqual(readCourseActivity({ getItem: () => stored }, lessonIds), emptyActivity());
  }
  assert.deepEqual(readCourseActivity({ getItem: () => { throw new Error("denied"); } }, lessonIds), emptyActivity());
  assert.equal(activity.writeCourseActivity({ setItem: () => { throw new Error("quota"); } }, emptyActivity()), false);
  assert.equal(activity.writeCourseActivity(null, emptyActivity()), false);
});

test("records the most recently opened lesson without downgrading a self-check", () => {
  const { markLessonActivity, resolveContinueLesson } = activity ?? {};
  assert.equal(typeof markLessonActivity, "function");
  assert.equal(typeof resolveContinueLesson, "function");
  const lessons = [
    { id: "lesson-one", order: 1, output: "lessons/one.html" },
    { id: "lesson-two", order: 2, output: "lessons/two.html" },
    { id: "lesson-three", order: 3, output: "lessons/three.html" },
  ];
  const empty = emptyActivity();
  const started = markLessonActivity(empty, "lesson-one", "started");
  assert.deepEqual(empty, emptyActivity(), "marking returns a new state");
  assert.deepEqual(started, { version: 1, lastLessonId: "lesson-one", lessons: { "lesson-one": "started" } });
  const selfChecked = markLessonActivity(started, "lesson-one", "self-check-recorded");
  const reopened = markLessonActivity(selfChecked, "lesson-one", "started");
  const openedNext = markLessonActivity(reopened, "lesson-two", "started");
  assert.equal(openedNext.lastLessonId, "lesson-two");
  assert.equal(openedNext.lessons["lesson-one"], "self-check-recorded");
  assert.equal(resolveContinueLesson(openedNext, lessons).id, "lesson-two");
  assert.equal(resolveContinueLesson({ ...openedNext, lastLessonId: "removed-lesson" }, lessons).id, "lesson-one");
});
