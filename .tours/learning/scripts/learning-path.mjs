const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const requiredText = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(label + " must be non-empty text");
  }
  return value.trim();
};

const safePath = (value, label) => {
  const result = requiredText(value, label);
  if (
    result.startsWith("/") ||
    result.includes("\\") ||
    result.split("/").some((part) => part === "." || part === ".." || part === "")
  ) {
    throw new Error("Unsafe path: " + result);
  }
  return result;
};

export function validateLearningPath(raw, lessons, scopedFiles) {
  if (!isRecord(raw) || raw.version !== 1) {
    throw new Error("Learning path version must be 1");
  }
  if (!isRecord(raw.orientation)) {
    throw new Error("Learning path orientation is required");
  }

  const orientation = {
    output: safePath(raw.orientation.output, "Orientation output"),
    title: requiredText(raw.orientation.title, "Orientation title"),
  };
  if (orientation.output !== "lessons/0000-before-lesson-one.html") {
    throw new Error("Unexpected orientation output");
  }
  if (!Array.isArray(lessons) || !Array.isArray(scopedFiles)) {
    throw new Error("Learning path lesson and source inventories are required");
  }
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error("Learning path steps are required");
  }

  const knownLessons = new Set(lessons.map((item) => item.id));
  const knownFiles = new Set(scopedFiles.map((item) => item.path));
  const ids = new Set();
  const orders = new Set();
  const steps = raw.steps.map((item) => {
    if (!isRecord(item)) throw new Error("Learning path step must be an object");

    const id = requiredText(item.id, "Step ID");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error("Unsafe step ID: " + id);
    }
    if (ids.has(id)) throw new Error("Duplicate step: " + id);
    ids.add(id);

    if (!Number.isInteger(item.order) || item.order < 0 || orders.has(item.order)) {
      throw new Error("Invalid or duplicate step order: " + item.order);
    }
    orders.add(item.order);
    if (!Array.isArray(item.requires) || !Array.isArray(item.lessonIds)) {
      throw new Error("Step links must be arrays: " + id);
    }

    const requires = item.requires.map((dependency) => requiredText(dependency, "Prerequisite ID"));
    const lessonIds = item.lessonIds.map((lessonId) => requiredText(lessonId, "Lesson ID"));
    const sourcePath = safePath(item.sourcePath, "Source path");
    const testPath = safePath(item.testPath, "Test path");
    if (!knownFiles.has(sourcePath)) throw new Error("Unknown source: " + sourcePath);
    if (!knownFiles.has(testPath)) throw new Error("Unknown test: " + testPath);
    for (const lessonId of lessonIds) {
      if (!knownLessons.has(lessonId)) throw new Error("Unknown lesson: " + lessonId);
    }

    return {
      id,
      order: item.order,
      title: requiredText(item.title, "Step title"),
      why: requiredText(item.why, "Step reason"),
      requires,
      lessonIds,
      deliverable: requiredText(item.deliverable, "Deliverable"),
      placement: requiredText(item.placement, "Placement"),
      pattern: requiredText(item.pattern, "Pattern"),
      check: requiredText(item.check, "Check"),
      sourcePath,
      testPath,
    };
  }).sort((left, right) => left.order - right.order);

  if (steps.some((item, index) => item.order !== index)) {
    throw new Error("Step orders must start at 0 and have no gaps");
  }

  const byId = new Map(steps.map((item) => [item.id, item]));
  for (const item of steps) {
    for (const dependency of item.requires) {
      if (!byId.has(dependency)) throw new Error("Unknown prerequisite: " + dependency);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error("Learning path cycle at " + id);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).requires) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const item of steps) visit(item.id);

  for (const item of steps) {
    for (const dependency of item.requires) {
      if (byId.get(dependency).order >= item.order) {
        throw new Error("Prerequisite order must come before step: " + dependency + " → " + item.id);
      }
    }
  }

  return { version: 1, orientation, steps };
}
