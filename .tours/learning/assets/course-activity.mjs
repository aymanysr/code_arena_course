export const COURSE_ACTIVITY_KEY = "code-arena-learning:activity:v1";

const ACTIVITY_STATUSES = new Set(["started", "self-check-recorded"]);

const emptyActivity = () => ({ version: 1, lastLessonId: null, lessons: {} });

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readCourseActivity(storage, validLessonIds = []) {
  if (!storage || typeof storage.getItem !== "function") return emptyActivity();

  let raw;
  try {
    raw = storage.getItem(COURSE_ACTIVITY_KEY);
  } catch {
    return emptyActivity();
  }
  if (raw === null || raw === undefined || raw === "") return emptyActivity();

  try {
    const parsed = JSON.parse(raw);
    const validIds = new Set(validLessonIds);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.lessons)) return emptyActivity();
    if (parsed.lastLessonId !== null && (typeof parsed.lastLessonId !== "string" || !validIds.has(parsed.lastLessonId))) {
      return emptyActivity();
    }

    const lessons = {};
    for (const [lessonId, status] of Object.entries(parsed.lessons)) {
      if (!validIds.has(lessonId) || !ACTIVITY_STATUSES.has(status)) return emptyActivity();
      lessons[lessonId] = status;
    }
    if (parsed.lastLessonId !== null && !Object.hasOwn(lessons, parsed.lastLessonId)) return emptyActivity();
    return { version: 1, lastLessonId: parsed.lastLessonId, lessons };
  } catch {
    return emptyActivity();
  }
}

export function writeCourseActivity(storage, activity) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(COURSE_ACTIVITY_KEY, JSON.stringify(activity));
    return true;
  } catch {
    return false;
  }
}

export function markLessonActivity(activity, lessonId, status) {
  if (typeof lessonId !== "string" || lessonId.length === 0 || !ACTIVITY_STATUSES.has(status)) return activity;
  const lessons = { ...(isRecord(activity?.lessons) ? activity.lessons : {}) };
  const prior = lessons[lessonId];
  lessons[lessonId] = prior === "self-check-recorded" && status === "started"
    ? prior
    : status;
  return { version: 1, lastLessonId: lessonId, lessons };
}

export function resolveContinueLesson(activity, orderedLessons = []) {
  const ordered = [...orderedLessons].sort((left, right) => left.order - right.order);
  const lastLesson = ordered.find((lesson) => lesson.id === activity?.lastLessonId);
  if (lastLesson && ACTIVITY_STATUSES.has(activity?.lessons?.[lastLesson.id])) return lastLesson;
  return ordered[0] ?? null;
}

function activityLabel(status) {
  if (status === "self-check-recorded") return "Self-check recorded";
  if (status === "started") return "Started";
  return "Not started";
}

function encodePath(output) {
  return String(output).split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export function installCourseActivity(root, storage, orderedLessons = []) {
  const validLessons = [...orderedLessons]
    .filter((lesson) => typeof lesson?.id === "string" && Number.isSafeInteger(lesson.order))
    .sort((left, right) => left.order - right.order);
  const validIds = validLessons.map(({ id }) => id);
  const query = (selector) => root?.querySelector?.(selector) ?? null;
  const queryAll = (selector) => [...(root?.querySelectorAll?.(selector) ?? [])];
  const unavailableTarget = query("[data-course-storage-unavailable]");

  const showUnavailable = () => {
    if (!unavailableTarget) return;
    unavailableTarget.hidden = false;
    unavailableTarget.textContent = "This browser blocked local progress storage. The course still works; lesson links, predictions, and source previews remain available.";
  };

  let storageAvailable = Boolean(storage && typeof storage.getItem === "function" && typeof storage.setItem === "function");
  if (storageAvailable) {
    try {
      storage.getItem(COURSE_ACTIVITY_KEY);
    } catch {
      storageAvailable = false;
    }
  }
  if (!storageAvailable) showUnavailable();

  let activity = readCourseActivity(storage, validIds);
  const save = (nextActivity) => {
    activity = nextActivity;
    if (!writeCourseActivity(storage, activity)) showUnavailable();
  };

  const startLink = query("[data-course-start]");
  if (startLink) {
    const continueLesson = resolveContinueLesson(activity, validLessons);
    if (continueLesson && activity.lastLessonId === continueLesson.id && activity.lessons[continueLesson.id]) {
      startLink.href = encodePath(continueLesson.output);
      startLink.textContent = `Continue Lesson ${continueLesson.order}`;
    }
    for (const statusTarget of queryAll("[data-course-activity-status]")) {
      const status = activity.lessons[statusTarget.dataset.courseActivityStatus];
      statusTarget.textContent = activityLabel(status);
    }
  }

  const bodyLessonId = root?.body?.dataset?.courseLesson ?? query("[data-course-lesson]")?.dataset?.courseLesson;
  if (bodyLessonId && validIds.includes(bodyLessonId)) {
    save(markLessonActivity(activity, bodyLessonId, "started"));
    for (const statusTarget of queryAll("[data-course-self-check-status]")) {
      statusTarget.textContent = activityLabel(activity.lessons[bodyLessonId]);
    }
    for (const selfCheck of queryAll("[data-course-self-check]")) {
      selfCheck.addEventListener("click", () => {
        save(markLessonActivity(activity, bodyLessonId, "self-check-recorded"));
        for (const statusTarget of queryAll("[data-course-self-check-status]")) {
          statusTarget.textContent = activityLabel(activity.lessons[bodyLessonId]);
        }
      });
    }
  }

  return { activity, storageAvailable };
}
