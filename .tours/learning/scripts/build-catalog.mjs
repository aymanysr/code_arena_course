import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import {
  compareReferenceFiles,
  createReferenceSnapshot,
  findReferenceConsumers,
  loadCodeTours,
  parseChecksumList,
  parseReferenceSnapshot,
} from "./reference-audit.mjs";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const hljs = require("highlight.js/lib/core");
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LEARNING_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");

const HIGHLIGHT_LANGUAGES = [
  "bash", "css", "dockerfile", "ini", "javascript", "json", "makefile",
  "markdown", "scss", "sql", "typescript", "xml", "yaml",
];
for (const language of HIGHLIGHT_LANGUAGES) {
  hljs.registerLanguage(language, require(`highlight.js/lib/languages/${language}`));
}

const SOURCE_LANGUAGE_BY_EXTENSION = new Map([
  [".ts", "typescript"], [".tsx", "typescript"],
  [".js", "javascript"], [".jsx", "javascript"], [".mjs", "javascript"], [".cjs", "javascript"],
  [".json", "json"], [".jsonc", "json"], [".jsonl", "json"],
  [".yaml", "yaml"], [".yml", "yaml"], [".sql", "sql"],
  [".sh", "bash"], [".bash", "bash"], [".zsh", "bash"],
  [".html", "xml"], [".css", "css"], [".scss", "scss"], [".md", "markdown"],
  [".conf", "ini"], [".properties", "ini"], [".env", "ini"], [".example", "ini"],
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc",
  ".yaml", ".yml", ".toml", ".sql", ".sh", ".bash", ".zsh", ".html",
  ".css", ".scss", ".conf", ".properties", ".lock", ".md", ".txt",
  ".jsonl", ".example", ".env",
]);

const GENERATED_DIRECTORIES = new Set([
  ".git", "node_modules", "dist", "build", "coverage", "test-results",
  "playwright-report", ".vite", ".next", ".turbo", "__pycache__",
]);

const SYMBOL_KINDS = new Map([
  [ts.SyntaxKind.FunctionDeclaration, "function"],
  [ts.SyntaxKind.ClassDeclaration, "class"],
  [ts.SyntaxKind.InterfaceDeclaration, "interface"],
  [ts.SyntaxKind.TypeAliasDeclaration, "type"],
  [ts.SyntaxKind.EnumDeclaration, "enum"],
  [ts.SyntaxKind.ModuleDeclaration, "namespace"],
  [ts.SyntaxKind.VariableDeclaration, "variable"],
  [ts.SyntaxKind.MethodDeclaration, "method"],
  [ts.SyntaxKind.MethodSignature, "method"],
]);

const TEST_CALLS = new Set(["describe", "it", "test", "context", "specify"]);
const ROUTE_DECORATORS = new Set(["Get", "Post", "Put", "Patch", "Delete", "SubscribeMessage"]);

const html = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const countLines = (sourceText) => sourceText === ""
  ? 0
  : sourceText.replace(/\r\n?/g, "\n").split("\n").length - (sourceText.endsWith("\n") ? 1 : 0);

function isSourceCandidate(filePath) {
  const basename = path.basename(filePath);
  if (basename === "Dockerfile" || basename === "Makefile") return true;
  if (basename.startsWith(".env.")) return true;
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function listCandidateFiles(root, relativeRoot = "") {
  const current = path.join(root, relativeRoot);
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relativeRoot.split(path.sep).join(path.posix.sep), entry.name);
    if (entry.isDirectory()) {
      if (GENERATED_DIRECTORIES.has(entry.name)) continue;
      files.push(...await listCandidateFiles(root, child));
    } else if (entry.isFile() && isSourceCandidate(child)) {
      files.push(child);
    }
  }
  return files;
}

function literalText(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function callName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return "";
}

function modifiersInclude(node, modifierKind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === modifierKind));
}

function isEffectivelyExported(node) {
  for (let current = node; current; current = current.parent) {
    if (modifiersInclude(current, ts.SyntaxKind.ExportKeyword)) return true;
    if (current !== node && ts.isSourceFile(current)) break;
  }
  return false;
}

function analyzeSource(filePath, sourceText) {
  if (!/\.(?:[cm]?tsx?|[cm]?jsx?)$/i.test(filePath)) {
    return { symbols: [], tests: [], routes: [], events: [] };
  }

  const extension = path.extname(filePath).toLowerCase();
  const scriptKind = extension.endsWith("x") ? ts.ScriptKind.TSX :
    extension === ".js" || extension === ".mjs" || extension === ".cjs" ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const symbols = [];
  const tests = [];
  const routes = [];
  const events = [];

  const visit = (node) => {
    const kind = SYMBOL_KINDS.get(node.kind);
    if (kind && node.name) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (name) {
        const line = source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1;
        symbols.push({ kind, name, line, exported: isEffectivelyExported(node) });
      }
    }

    if (ts.isCallExpression(node)) {
      const name = callName(node.expression);
      const title = literalText(node.arguments[0]);
      if (TEST_CALLS.has(name) && title !== null) tests.push({ kind: name, title, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      if ((name === "emit" || name === "on" || name === "once" || name === "off") && title !== null) {
        events.push({ kind: name, name: title, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
      }
    }

    const decorators = ts.canHaveDecorators?.(node) ? ts.getDecorators(node) ?? [] : [];
    for (const decorator of decorators) {
      if (!ts.isCallExpression(decorator.expression)) continue;
      const decoratorName = callName(decorator.expression.expression);
      if (!ROUTE_DECORATORS.has(decoratorName)) continue;
      const route = literalText(decorator.expression.arguments[0]) ?? "";
      const handler = node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : "handler";
      routes.push({ kind: decoratorName, route, handler, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  const uniqueBy = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];
  return {
    symbols: uniqueBy(symbols, (item) => `${item.kind}:${item.name}:${item.line}`),
    tests: uniqueBy(tests, (item) => `${item.kind}:${item.title}:${item.line}`),
    routes: uniqueBy(routes, (item) => `${item.kind}:${item.route}:${item.handler}:${item.line}`),
    events: uniqueBy(events, (item) => `${item.kind}:${item.name}:${item.line}`),
  };
}

function isWithin(relativePath, rootPath) {
  return relativePath === rootPath || relativePath.startsWith(`${rootPath.replace(/\/$/, "")}/`);
}

function requireText(value, context) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${context} must be non-empty text`);
  return value.trim();
}

function requireRepoPath(value, context) {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/.test(value) || value.includes("\\") ||
      path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error(`${context} must be a repository-relative POSIX path`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..") || path.posix.normalize(value) !== value) {
    throw new Error(`${context} must not escape its repository-relative path`);
  }
  return value;
}

function validateScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw new Error("Coverage map scope must be an object");
  for (const key of ["roots", "files", "excluded"]) {
    if (!Array.isArray(scope[key])) throw new Error(`Coverage map scope.${key} must be an array`);
  }

  const seen = { roots: new Set(), files: new Set(), excluded: new Set() };
  const roots = scope.roots.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Scope root ${index + 1} must be an object`);
    const rootPath = requireRepoPath(item.path, `Scope root ${index + 1} path`);
    const area = requireText(item.area, `Scope root ${rootPath} area`);
    if (seen.roots.has(rootPath)) throw new Error(`Duplicate scope root: ${rootPath}`);
    seen.roots.add(rootPath);
    return { ...item, path: rootPath, area };
  });
  const files = scope.files.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Scope file ${index + 1} must be an object`);
    const filePath = requireRepoPath(item.path, `Scope file ${index + 1} path`);
    const area = requireText(item.area, `Scope file ${filePath} area`);
    if (seen.files.has(filePath)) throw new Error(`Duplicate scope file: ${filePath}`);
    seen.files.add(filePath);
    return { ...item, path: filePath, area };
  });
  const excluded = scope.excluded.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Scope exclusion ${index + 1} must be an object`);
    const excludedPath = requireRepoPath(item.path, `Scope exclusion ${index + 1} path`);
    const reason = requireText(item.reason, `Scope exclusion ${excludedPath} reason`);
    if (seen.excluded.has(excludedPath)) throw new Error(`Duplicate scope exclusion: ${excludedPath}`);
    seen.excluded.add(excludedPath);
    return { ...item, path: excludedPath, reason };
  });
  return { roots, files, excluded };
}

async function validateCoverageMap(coverageMap, learningDir = LEARNING_DIR) {
  if (!coverageMap || typeof coverageMap !== "object" || Array.isArray(coverageMap)) {
    throw new Error("Coverage map must be an object");
  }
  if (coverageMap.version !== 1 && coverageMap.version !== 2) throw new Error(`Unsupported coverage map version: ${coverageMap.version}`);
  const scope = validateScope(coverageMap.scope);
  if (!Array.isArray(coverageMap.lessons)) throw new Error("Coverage map lessons must be an array");
  if (coverageMap.supportingFiles !== undefined && !Array.isArray(coverageMap.supportingFiles)) {
    throw new Error("Coverage map supportingFiles must be an array");
  }

  const lessonIds = new Set();
  const lessonOrders = new Set();
  const lessonOutputs = new Set();
  const referencedPaths = new Set();
  const lessons = [];
  for (const [index, lesson] of coverageMap.lessons.entries()) {
    const context = `Lesson ${index + 1}`;
    if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) throw new Error(`${context} must be an object`);
    const id = requireText(lesson.id, `${context} id`);
    const title = requireText(lesson.title, `Lesson ${id} title`);
    const goal = requireText(lesson.goal, `Lesson ${id} goal`);
    if (!Number.isInteger(lesson.order) || lesson.order < 1) throw new Error(`Lesson ${id} order must be a positive integer`);
    if (lessonIds.has(id)) throw new Error(`Duplicate lesson id: ${id}`);
    if (lessonOrders.has(lesson.order)) throw new Error(`Duplicate lesson order: ${lesson.order}`);
    lessonIds.add(id);
    lessonOrders.add(lesson.order);

    const template = requireRepoPath(lesson.template, `Lesson ${id} template`);
    if (!template.startsWith("templates/")) throw new Error(`Lesson ${id} template must be inside templates/`);
    let templateInfo;
    try {
      templateInfo = await stat(path.join(learningDir, template));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (!templateInfo?.isFile()) throw new Error(`Lesson ${id} template does not exist: ${template}`);

    const output = requireRepoPath(lesson.output, `Lesson ${id} output`);
    if (!output.startsWith("lessons/") || path.posix.extname(output) !== ".html") {
      throw new Error(`Lesson ${id} output must be an HTML page inside lessons/`);
    }
    if (lessonOutputs.has(output)) throw new Error(`Duplicate lesson output: ${output}`);
    lessonOutputs.add(output);
    if (!Array.isArray(lesson.references)) throw new Error(`Lesson ${id} references must be an array`);
    const references = [];
    for (const [referenceIndex, reference] of lesson.references.entries()) {
      if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
        throw new Error(`Lesson ${id} reference ${referenceIndex + 1} must be an object`);
      }
      const referencePath = requireRepoPath(reference.path, `Lesson ${id} reference ${referenceIndex + 1} path`);
      referencedPaths.add(referencePath);
      references.push({ ...reference, path: referencePath });
    }
    lessons.push({ ...lesson, id, title, goal, template, output, references });
  }

  let batches = [];
  if (coverageMap.version === 2) {
    if (!Array.isArray(coverageMap.batches)) throw new Error("Coverage map batches must be an array");
    const batchIds = new Set();
    const batchOrders = new Set();
    const assignedLessons = new Set();
    const lessonIdsById = new Set(lessons.map(({ id }) => id));
    batches = coverageMap.batches.map((batch, index) => {
      const context = `Batch ${index + 1}`;
      if (!batch || typeof batch !== "object" || Array.isArray(batch)) throw new Error(`${context} must be an object`);
      const id = requireText(batch.id, `${context} id`);
      const title = requireText(batch.title, `Batch ${id} title`);
      const description = requireText(batch.description, `Batch ${id} description`);
      if (!Number.isInteger(batch.order) || batch.order < 1) throw new Error(`Batch ${id} order must be a positive integer`);
      if (batchIds.has(id)) throw new Error(`Duplicate batch id: ${id}`);
      if (batchOrders.has(batch.order)) throw new Error(`Duplicate batch order: ${batch.order}`);
      if (!Array.isArray(batch.lessonIds)) throw new Error(`Batch ${id} lessonIds must be an array`);
      batchIds.add(id);
      batchOrders.add(batch.order);

      const lessonIds = batch.lessonIds.map((lessonId, lessonIndex) => {
        const normalizedId = requireText(lessonId, `Batch ${id} lesson ${lessonIndex + 1} id`);
        if (!lessonIdsById.has(normalizedId)) {
          throw new Error(`Batch ${id} refers to unknown lesson: ${normalizedId}`);
        }
        if (assignedLessons.has(normalizedId)) throw new Error(`Lesson ${normalizedId} appears in more than one batch`);
        assignedLessons.add(normalizedId);
        return normalizedId;
      });
      return { ...batch, id, order: batch.order, title, description, lessonIds };
    });

    const omittedLesson = lessons.find(({ id }) => !assignedLessons.has(id));
    if (omittedLesson) throw new Error(`Batches omit lesson: ${omittedLesson.id}`);

    const orderedBatches = [...batches].sort((left, right) => left.order - right.order);
    if (orderedBatches.some((batch, index) => batch.order !== index + 1)) {
      throw new Error("Batch orders must be consecutive starting at 1");
    }
    const flattenedLessonIds = orderedBatches.flatMap(({ lessonIds }) => lessonIds);
    const expectedLessonIds = [...lessons].sort((left, right) => left.order - right.order).map(({ id }) => id);
    if (JSON.stringify(flattenedLessonIds) !== JSON.stringify(expectedLessonIds)) {
      throw new Error("Flattened batch order must match lesson order");
    }
    batches = orderedBatches;
  }

  const supportingFiles = new Map();
  for (const [index, item] of (coverageMap.supportingFiles ?? []).entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Support-only record ${index + 1} must be an object`);
    const filePath = requireRepoPath(item.path, `Support-only record ${index + 1} path`);
    const reason = requireText(item.reason, `Support-only record ${filePath} reason`);
    if (supportingFiles.has(filePath)) throw new Error(`Duplicate support-only path: ${filePath}`);
    if (referencedPaths.has(filePath)) throw new Error(`Path cannot be both lesson-taught and support-only: ${filePath}`);
    supportingFiles.set(filePath, { path: filePath, reason });
  }

  return { scope, batches, lessons, supportingFiles };
}

function getReferenceIndex(coverageMap) {
  const references = new Map();
  for (const lesson of coverageMap.lessons ?? []) {
    for (const reference of lesson.references ?? []) {
      const list = references.get(reference.path) ?? [];
      list.push({ ...reference, lessonId: lesson.id, title: lesson.title });
      references.set(reference.path, list);
    }
  }
  return references;
}

// ponytail: audit-only single source — templates stay hand-written; coverage-map.json owns
// ranges. Ceiling: O(lessons × links) scan; upgrade to generated links if templates churn.
function extractTemplateSourceLinks(templateText) {
  const links = [];
  const pattern = /href="(?:\.\.\/)+([^"#]+)#L(\d+)"/g;
  let match;
  while ((match = pattern.exec(templateText))) links.push({ path: match[1], line: Number(match[2]) });
  return links;
}

function isInScopePath(filePath, scope) {
  const inRoots = (scope?.roots ?? []).some((root) => isWithin(filePath, root.path));
  const inFiles = (scope?.files ?? []).some((file) => file.path === filePath);
  const excluded = (scope?.excluded ?? []).some((item) => isWithin(filePath, item.path));
  return (inRoots || inFiles) && !excluded;
}

export async function auditTemplateLinks({ lessons, scope, learningDir, repoRoot }) {
  const issues = [];
  for (const lesson of lessons ?? []) {
    let templateText;
    try {
      templateText = await readFile(path.join(learningDir, lesson.template), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const link of extractTemplateSourceLinks(templateText)) {
      if (!isInScopePath(link.path, scope)) {
        try {
          await stat(path.join(repoRoot, link.path));
        } catch {
          issues.push({ lessonId: lesson.id, template: lesson.template, path: link.path, line: link.line, issue: "missing doc file" });
        }
        continue;
      }
      const ranges = (lesson.references ?? []).filter((reference) => reference.path === link.path);
      if (!ranges.length) {
        issues.push({ lessonId: lesson.id, template: lesson.template, path: link.path, line: link.line, issue: "no coverage-map record" });
      } else if (!ranges.some((reference) => link.line >= reference.startLine && link.line <= reference.endLine)) {
        issues.push({ lessonId: lesson.id, template: lesson.template, path: link.path, line: link.line, issue: `outside cited range ${ranges.map((r) => `${r.startLine}–${r.endLine}`).join(", ")}` });
      }
    }
  }
  return issues;
}

// ponytail: order is checked, not generated — coverage-map.json owns 1..N.
// Compare lesson destinations exactly; non-lesson links (for example, the final README link) are allowed.
export async function auditCourseOrder({ lessons, learningDir }) {
  const issues = [];
  const ordered = [...(lessons ?? [])].sort((left, right) => left.order - right.order);
  const expectedOrders = ordered.map((_, index) => index + 1);
  const actualOrders = ordered.map((lesson) => lesson.order);
  if (JSON.stringify(actualOrders) !== JSON.stringify(expectedOrders)) {
    issues.push({ kind: "order-gap", detail: `lesson orders must be 1..${ordered.length}, found ${actualOrders.join(",")}` });
  }
  const expectedOutputs = ordered.map((lesson) => lesson.output.split("/").pop());
  let readmeOutputs = [];
  let readmeExists = false;
  try {
    const readme = await readFile(path.join(learningDir, "README.md"), "utf8");
    readmeExists = true;
    readmeOutputs = [...readme.matchAll(/lessons\/([^\s)\]]+\.html)/g)].map((match) => match[1]);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (readmeExists && JSON.stringify(readmeOutputs) !== JSON.stringify(expectedOutputs)) {
    issues.push({ kind: "readme-order", detail: `README lists ${readmeOutputs.join(",")} but coverage order is ${expectedOutputs.join(",")}` });
  }
  for (let index = 0; index < ordered.length; index++) {
    const lesson = ordered[index];
    const prev = index > 0 ? expectedOutputs[index - 1] : null;
    const next = index < ordered.length - 1 ? expectedOutputs[index + 1] : null;
    let templateText;
    try {
      templateText = await readFile(path.join(learningDir, lesson.template), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    const navBlocks = templateText.match(/<p class="nav-row">[\s\S]*?<\/p>/g) ?? [];
    const navHrefs = navBlocks
      .flatMap((block) => [...block.matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
      .filter((href) => href.endsWith(".html"));
    const expectedNav = [prev, next].filter(Boolean);
    if (JSON.stringify(navHrefs) !== JSON.stringify(expectedNav)) {
      issues.push({
        kind: "nav-order",
        lessonId: lesson.id,
        detail: `expected ${expectedNav.join(", ") || "no lesson links"}; found ${navHrefs.join(", ") || "no lesson links"}`,
      });
    }
  }
  return issues;
}

export function missingLessonReviews({ affectedLessons, reviewedLessons }) {
  const reviewed = new Set((reviewedLessons ?? []).map((entry) => String(entry).trim()).filter(Boolean));
  return [...new Set((affectedLessons ?? []).map((lesson) => lesson.lessonId ?? lesson))].filter((id) => !reviewed.has(id));
}

export async function buildCatalogData({
  repoRoot,
  learningDir = LEARNING_DIR,
  coverageMap,
  referenceSnapshot,
  referenceBaseline,
  tours: suppliedTours,
  scopeRoots,
  scopeFiles,
  excludedRoots,
}) {
  const validated = await validateCoverageMap(coverageMap, learningDir);
  const effectiveScopeRoots = (scopeRoots ?? validated.scope.roots).map((item, index) => {
    const rootPath = typeof item === "string" ? item : item?.path;
    const area = typeof item === "string" ? item : item?.area;
    return {
      path: requireRepoPath(rootPath, `Scope root ${index + 1} path`),
      area: requireText(area, `Scope root ${rootPath} area`),
    };
  });
  const effectiveScopeFiles = (scopeFiles ?? validated.scope.files).map((item, index) => {
    const filePath = typeof item === "string" ? item : item?.path;
    const area = typeof item === "string" ? "Root project files" : item?.area;
    return {
      path: requireRepoPath(filePath, `Scope file ${index + 1} path`),
      area: requireText(area, `Scope file ${filePath} area`),
    };
  });
  const exclusions = (excludedRoots ?? validated.scope.excluded).map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Scope exclusion ${index + 1} must be an object`);
    const excludedPath = requireRepoPath(item.path, `Scope exclusion ${index + 1} path`);
    const reason = requireText(item.reason, `Scope exclusion ${excludedPath} reason`);
    return { path: excludedPath, reason };
  });
  const root = path.resolve(repoRoot);
  const scopedPaths = new Map();

  for (const { path: directory, area } of effectiveScopeRoots) {
    const candidates = await listCandidateFiles(root, directory);
    for (const candidate of candidates) {
      if (scopedPaths.has(candidate)) throw new Error(`Source path is included more than once: ${candidate}`);
      scopedPaths.set(candidate, area);
    }
  }

  for (const { path: filePath, area } of effectiveScopeFiles) {
    try {
      if ((await stat(path.join(root, filePath))).isFile()) {
        if (scopedPaths.has(filePath)) throw new Error(`Source path is included more than once: ${filePath}`);
        scopedPaths.set(filePath, area);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  for (const filePath of validated.supportingFiles.keys()) {
    if (!scopedPaths.has(filePath)) throw new Error(`Support-only path is not in the declared inventory: ${filePath}`);
  }

  const references = getReferenceIndex({ lessons: validated.lessons });
  const files = [];
  for (const [filePath, area] of scopedPaths) {
    const sourceText = await readFile(path.join(root, filePath), "utf8");
    const digest = sha256(sourceText);
    const lineCount = countLines(sourceText);
    const matchingReferences = references.get(filePath) ?? [];
    const expectedDigest = referenceSnapshot?.files?.get(filePath);
    const sourceIsCurrent = referenceSnapshot ? expectedDigest === digest : true;
    const supportRecord = validated.supportingFiles.get(filePath);
    const status = matchingReferences.length > 0
      ? sourceIsCurrent ? "current-lesson-reference" : "source-changed-since-lesson"
      : supportRecord ? "support-only" : "uncovered";
    files.push({
      path: filePath,
      sourceId: `source-${sha256(filePath).slice(0, 16)}`,
      area,
      bytes: Buffer.byteLength(sourceText),
      lines: lineCount,
      sha256: digest,
      sourceText,
      status,
      supportReason: supportRecord?.reason ?? null,
      references: matchingReferences,
      ...analyzeSource(filePath, sourceText),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const currentSourceFiles = new Map(files.map((file) => [file.path, file.sha256]));
  const currentSnapshotId = sha256([...currentSourceFiles]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([filePath, digest]) => `${filePath}\0${digest}`)
    .join("\n")).slice(0, 16);
  const snapshotId = referenceSnapshot?.snapshotId ?? currentSnapshotId;
  const sourceChanges = referenceSnapshot
    ? compareReferenceFiles({ expectedFiles: referenceSnapshot.files, currentFiles: currentSourceFiles })
    : [];

  let tours = suppliedTours;
  if (!tours) {
    try {
      tours = await loadCodeTours(root);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      tours = [];
    }
  }
  const invalidTourAnchors = [];
  for (const tour of tours) {
    for (const step of tour.steps) {
      let lineCount;
      try {
        lineCount = countLines(await readFile(path.join(root, step.file), "utf8"));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (lineCount === undefined) {
        invalidTourAnchors.push({ tourPath: tour.path, step: step.step, file: step.file, line: step.line, issue: "missing source" });
      } else if (step.line > lineCount) {
        invalidTourAnchors.push({ tourPath: tour.path, step: step.step, file: step.file, line: step.line, lines: lineCount, issue: "line beyond EOF" });
      }
    }
  }

  let evidenceChanges = [];
  if (referenceBaseline?.files instanceof Map) {
    const evidencePaths = new Set([
      ...referenceBaseline.files.keys(),
      ...tours.map((tour) => tour.path),
    ]);
    const currentEvidenceFiles = new Map();
    for (const filePath of evidencePaths) {
      try {
        currentEvidenceFiles.set(filePath, sha256(await readFile(path.join(root, filePath))));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    evidenceChanges = compareReferenceFiles({
      expectedFiles: referenceBaseline.files,
      currentFiles: currentEvidenceFiles,
    });
  }

  const changedPaths = [...new Set([
    ...sourceChanges.map((change) => change.path),
    ...evidenceChanges.map((change) => change.path),
  ])];
  const affectedArtifacts = findReferenceConsumers({
    changedPaths,
    coverageMap: { lessons: validated.lessons },
    tours,
    referenceBaseline,
  });

  const missingReferences = [];
  const invalidReferences = [];
  for (const [filePath, refs] of references) {
    const sourceFile = files.find((file) => file.path === filePath);
    for (const reference of refs) {
      if (!sourceFile) {
        missingReferences.push({ path: filePath, lessonId: reference.lessonId, title: reference.title });
        continue;
      }
      if (!Number.isInteger(reference.startLine) || !Number.isInteger(reference.endLine) ||
          reference.startLine < 1 || reference.endLine < reference.startLine || reference.endLine > sourceFile.lines) {
        invalidReferences.push({ path: filePath, lessonId: reference.lessonId, startLine: reference.startLine, endLine: reference.endLine });
      }
    }
  }

  const scopedRootPaths = effectiveScopeRoots.map((scope) => scope.path);
  const scopedFilePaths = new Set([...scopedPaths.keys()]);
  const unclassified = [];
  const globallySkipped = new Set([...GENERATED_DIRECTORIES, ".tours", ".agents", ".claude", ".trigger-tree", ".superpowers", ".vscode"]);
  const walkOutside = async (relativeRoot = "") => {
    let entries;
    try {
      entries = await readdir(path.join(root, relativeRoot), { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeRoot.split(path.sep).join(path.posix.sep), entry.name);
      if (entry.isDirectory()) {
        if (globallySkipped.has(entry.name) || exclusions.some((excluded) => isWithin(relativePath, excluded.path))) continue;
        if (scopedRootPaths.some((scopeRoot) => isWithin(relativePath, scopeRoot))) continue;
        await walkOutside(relativePath);
      } else if (entry.isFile() && isSourceCandidate(relativePath) &&
          !scopedFilePaths.has(relativePath) &&
          !exclusions.some((excluded) => isWithin(relativePath, excluded.path))) {
        unclassified.push({ path: relativePath });
      }
    }
  };
  await walkOutside();
  unclassified.sort((a, b) => a.path.localeCompare(b.path));

  const templateLinkIssues = await auditTemplateLinks({ lessons: validated.lessons, scope: validated.scope, learningDir, repoRoot: root });
  const courseOrderIssues = await auditCourseOrder({ lessons: validated.lessons, learningDir });

  const supporting = files.filter((file) => file.status === "support-only");
  const uncoveredFiles = files.filter((file) => file.status === "uncovered");
  const summary = {
    total: files.length,
    current: files.filter((file) => file.status === "current-lesson-reference").length,
    stale: files.filter((file) => file.status === "source-changed-since-lesson").length,
    currentReferences: files.reduce((count, file) => count + (file.status === "current-lesson-reference" ? file.references.length : 0), 0),
    staleReferences: files.reduce((count, file) => count + (file.status === "source-changed-since-lesson" ? file.references.length : 0), 0),
    supporting: supporting.length,
    uncovered: uncoveredFiles.length,
    excluded: exclusions.length,
    notTaught: supporting.length + uncoveredFiles.length,
    unclassified: unclassified.length,
    missingReferences: missingReferences.length,
    invalidReferences: invalidReferences.length,
    templateLinkIssues: templateLinkIssues.length,
    courseOrderIssues: courseOrderIssues.length,
    changedSources: sourceChanges.length,
    changedEvidence: evidenceChanges.length,
    invalidTourAnchors: invalidTourAnchors.length,
  };

  return {
    snapshotId,
    referenceSnapshotId: referenceSnapshot?.snapshotId ?? null,
    currentSnapshotId,
    sourceChanges,
    evidenceChanges,
    affectedArtifacts,
    invalidTourAnchors,
    tours,
    files,
    batches: validated.batches,
    lessons: validated.lessons,
    supportingFiles: supporting.map(({ path: filePath, supportReason: reason }) => ({ path: filePath, reason })),
    uncoveredFiles,
    exclusions,
    unclassified,
    missingReferences,
    invalidReferences,
    templateLinkIssues,
    courseOrderIssues,
    summary,
    scope: { ...validated.scope, roots: effectiveScopeRoots, files: effectiveScopeFiles, excluded: exclusions },
  };
}

function vscodeUrl(repoRoot, filePath, startLine = 1) {
  const absolutePath = path.resolve(repoRoot, filePath).replaceAll("\\", "/");
  const encodedPath = absolutePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return `vscode://file${encodedPath}:${startLine}`;
}

function renderFileRows(data, repoRoot) {
  return data.files.map((file) => {
    const refMarkup = file.references.length
      ? file.references.map((reference) => `<button class="reference-link source-preview-trigger" type="button" data-source-id="${file.sourceId}" data-source-path="${html(file.path)}" data-editor-url="${html(vscodeUrl(repoRoot, file.path, reference.startLine))}" data-start-line="${reference.startLine}" data-end-line="${reference.endLine}" aria-label="Open code preview for ${html(file.path)}, lines ${reference.startLine} to ${reference.endLine}">${html(reference.label ?? reference.title)} · L${reference.startLine}–${reference.endLine}</button>`).join("<br>")
      : "<span class=\"quiet\">No lesson links yet</span>";
    const landmarks = [
      ...file.symbols.map((symbol) => `${symbol.exported ? "export" : symbol.kind} ${symbol.name} · L${symbol.line}`),
      ...file.routes.map((route) => `@${route.kind}(\"${route.route}\") ${route.handler} · L${route.line}`),
      ...file.events.map((event) => `${event.kind}(\"${event.name}\") · L${event.line}`),
      ...file.tests.map((item) => `${item.kind}: ${item.title} · L${item.line}`),
    ];
    const details = landmarks.length
      ? `<details><summary>${landmarks.length} code/test landmarks</summary><ul>${landmarks.map((item) => `<li><code>${html(item)}</code></li>`).join("")}</ul></details>`
      : "<span class=\"quiet\">No named TS/JS landmarks</span>";
    const searchable = [file.path, file.area, ...landmarks, ...file.references.map((reference) => reference.label ?? reference.title)].join(" ").toLowerCase();
    const statusLabels = {
      "current-lesson-reference": "Linked to current lesson",
      "source-changed-since-lesson": "Lesson source changed",
      "support-only": "Supporting reference",
      uncovered: "Uncovered file",
    };
    const statusClass = {
      "current-lesson-reference": "status-current",
      "source-changed-since-lesson": "status-stale",
      "support-only": "status-open",
      uncovered: "status-open",
    }[file.status];
    const supportReason = file.supportReason
      ? `<small>Support-only: ${html(file.supportReason)}</small>`
      : "";
    return `<tr data-status="${file.status}" data-area="${html(file.area)}" data-search="${html(searchable)}">
      <td><span class="status ${statusClass}">${statusLabels[file.status]}</span>${supportReason}</td>
      <td>${html(file.area)}</td>
      <td><button class="file-link source-preview-trigger" type="button" data-source-id="${file.sourceId}" data-source-path="${html(file.path)}" data-editor-url="${html(vscodeUrl(repoRoot, file.path))}" aria-label="Open code preview for ${html(file.path)}"><code>${html(file.path)}</code></button><small>${file.lines} lines · ${file.bytes} bytes · sha256 ${file.sha256.slice(0, 12)}…</small></td>
      <td>${refMarkup}</td>
      <td>${details}</td>
    </tr>`;
  }).join("\n");
}

function renderSourceTemplates(data) {
  return data.files.map((file) => {
    const basename = path.basename(file.path).toLowerCase();
    const language = basename === "dockerfile" ? "dockerfile" :
      basename === "makefile" ? "makefile" :
      basename === ".env" || basename.startsWith(".env.") ? "ini" :
      SOURCE_LANGUAGE_BY_EXTENSION.get(path.extname(file.path).toLowerCase());
    const sourceText = file.sourceText.replace(/\r\n?/g, "\n");
    const sourceMarkup = language
      ? hljs.highlight(sourceText, { language, ignoreIllegals: true }).value
      : html(sourceText);
    return `<template id="${file.sourceId}" data-source-path="${html(file.path)}">${sourceMarkup}</template>`;
  }).join("\n");
}

function renderLessonSourcePreview(files) {
  return `<div id="source-templates" hidden>
    ${renderSourceTemplates({ files })}
  </div>
  <dialog class="source-dialog" id="source-dialog" aria-labelledby="source-dialog-title" aria-describedby="source-dialog-help">
    <header class="source-dialog-header">
      <div class="source-dialog-heading">
        <p class="eyebrow">Code Arena · current source</p>
        <h2 id="source-dialog-title">Source excerpt</h2>
        <p id="source-file-path" class="source-dialog-path"><code></code></p>
        <p id="source-file-summary" class="quiet"></p>
      </div>
      <div class="source-dialog-actions">
        <a class="source-editor-link" id="source-editor-link" href="vscode://file/">Open in VS Code</a>
        <form method="dialog"><button class="secondary-button" id="source-dialog-close" type="submit" autofocus>Close preview</button></form>
      </div>
    </header>
    <p id="source-dialog-help" class="source-dialog-help">A short excerpt around the cited line. The lesson stays open behind this preview.</p>
    <figure class="source-code-figure">
      <figcaption id="source-code-caption">Cited source excerpt with explicit line numbers</figcaption>
      <pre class="source-code" tabindex="0" aria-labelledby="source-code-caption"><code id="source-code-lines"></code></pre>
    </figure>
  </dialog>
  <script>
    (() => {
      const sourceDialog = document.getElementById("source-dialog");
      const sourceTitle = document.getElementById("source-dialog-title");
      const sourcePath = document.querySelector("#source-file-path code");
      const sourceSummary = document.getElementById("source-file-summary");
      const sourceEditorLink = document.getElementById("source-editor-link");
      const sourceCloseButton = document.getElementById("source-dialog-close");
      const sourceCode = document.getElementById("source-code-lines");
      const sourceCodeScroll = sourceCode.closest("pre");
      let sourceOpener = null;

      sourceDialog.addEventListener("close", () => {
        const opener = sourceOpener;
        sourceOpener = null;
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
      sourceDialog.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const focusable = [...sourceDialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
        if (focusable.length === 0) return;
        const currentIndex = focusable.indexOf(document.activeElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
          : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
        event.preventDefault();
        focusable[nextIndex].focus({ preventScroll: true });
      });

      const openSourcePreview = (link, sourceTemplate) => {
        const filePath = link.dataset.sourcePath;
        const citedLine = Number(link.dataset.sourceLine);
        const sourceText = sourceTemplate.content.textContent.replace(/\\r\\n?/g, "\\n");
        const lines = sourceText.length === 0 ? [""] : sourceText.split("\\n");
        if (sourceText.endsWith("\\n")) lines.pop();
        if (lines.length === 0) lines.push("");
        if (!Number.isSafeInteger(citedLine) || citedLine < 1 || citedLine > lines.length) return;

        const highlightedLines = lines.map(() => document.createDocumentFragment());
        let highlightedLineIndex = 0;
        const appendHighlightedText = (value, tokenClasses) => {
          const parts = value.split("\\n");
          for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
            if (parts[partIndex] && highlightedLineIndex < highlightedLines.length) {
              let renderedToken = document.createTextNode(parts[partIndex]);
              for (let classIndex = tokenClasses.length - 1; classIndex >= 0; classIndex -= 1) {
                const token = document.createElement("span");
                token.className = tokenClasses[classIndex];
                token.append(renderedToken);
                renderedToken = token;
              }
              highlightedLines[highlightedLineIndex].append(renderedToken);
            }
            if (partIndex < parts.length - 1) highlightedLineIndex += 1;
          }
        };
        const collectHighlightedText = (node, tokenClasses = []) => {
          if (node.nodeType === Node.TEXT_NODE) {
            appendHighlightedText(node.nodeValue ?? "", tokenClasses);
            return;
          }
          const nextTokenClasses = node.nodeType === Node.ELEMENT_NODE && node.nodeName === "SPAN"
            ? [...tokenClasses, ...[...node.classList].filter((name) => /^hljs-[a-z0-9_-]+$/i.test(name))]
            : tokenClasses;
          node.childNodes.forEach((child) => collectHighlightedText(child, nextTokenClasses));
        };
        sourceTemplate.content.childNodes.forEach((node) => collectHighlightedText(node));

        const firstLine = Math.max(1, citedLine - 5);
        const lastLine = Math.min(lines.length, citedLine + 5);
        const numberWidth = String(lines.length).length;
        const fragment = document.createDocumentFragment();
        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
          const line = document.createElement("span");
          line.className = "source-line";
          if (lineNumber === citedLine) line.classList.add("is-reference-line");

          const number = document.createElement("span");
          number.className = "source-line-number";
          number.setAttribute("aria-hidden", "true");
          number.textContent = String(lineNumber).padStart(numberWidth, " ");

          const text = document.createElement("span");
          text.className = "source-line-text";
          text.append(highlightedLines[lineNumber - 1]);
          line.append(number, text);
          fragment.append(line);
        }

        sourceTitle.textContent = "Code excerpt from " + filePath;
        sourcePath.textContent = filePath;
        sourceSummary.textContent = "Lines " + firstLine + "–" + lastLine + " of " + lines.length;
        sourceEditorLink.href = link.dataset.editorUrl;
        sourceCode.replaceChildren(fragment);
        sourceCodeScroll.scrollTop = 0;
        sourceCodeScroll.scrollLeft = 0;
        sourceOpener = link;
        sourceDialog.showModal();
        sourceCloseButton.focus({ preventScroll: true });
      };

      document.addEventListener("click", (event) => {
        const link = event.target.closest?.("a[data-source-id][data-source-line]");
        if (!link) return;
        const sourceTemplate = document.getElementById(link.dataset.sourceId);
        if (!(sourceTemplate instanceof HTMLTemplateElement)) return;
        event.preventDefault();
        openSourcePreview(link, sourceTemplate);
      });
    })();
  </script>`;
}

function renderUnclassified(data) {
  if (!data.unclassified.length) return "<p>No unclassified source-like files were found outside the declared scope.</p>";
  return `<p>These source-like files sit outside the declared game roots. Classify each as in-scope or intentionally excluded before calling the inventory complete.</p><ul>${data.unclassified.map((item) => `<li><code>${html(item.path)}</code></li>`).join("")}</ul>`;
}

function renderReferenceChecks(data) {
  const problems = [
    ...data.missingReferences.map((item) => `${item.lessonId}: missing ${item.path}`),
    ...data.invalidReferences.map((item) => `${item.lessonId}: invalid lines ${item.startLine}–${item.endLine} in ${item.path}`),
  ];
  if (!problems.length) return "<p>All lesson source paths and line ranges resolve in this snapshot.</p>";
  return `<p>Repair these anchors before using the course as current:</p><ul>${problems.map((item) => `<li><code>${html(item)}</code></li>`).join("")}</ul>`;
}

export function renderCatalogTemplate(template, stylesheet, data, repoRoot = REPO_ROOT) {
  const firstLesson = [...(data.lessons ?? [])].sort((left, right) => left.order - right.order)[0];
  const firstLessonHref = firstLesson
    ? firstLesson.output.split("/").map((segment) => encodeURIComponent(segment)).join("/")
    : "#course-list";
  const status = catalogSnapshotStatus(data);
  const replacements = {
    "<!-- INLINE_COURSE_STYLES -->": `<style>\n${stylesheet}\n</style>`,
    "{{SNAPSHOT_ID}}": data.snapshotId,
    "{{SNAPSHOT_STATUS}}": status.label,
    "{{SNAPSHOT_STATUS_CLASS}}": status.className,
    "{{COUNT_TOTAL}}": String(data.summary.total),
    "{{COUNT_CURRENT}}": String(data.summary.currentReferences),
    "{{COUNT_STALE}}": String(data.summary.staleReferences),
    "{{COUNT_OPEN}}": String(data.summary.notTaught),
    "{{COUNT_SUPPORTING}}": String(data.summary.supporting),
    "{{COUNT_UNCOVERED}}": String(data.summary.uncovered),
    "{{COUNT_EXCLUDED}}": String(data.summary.excluded),
    "{{COUNT_UNCLASSIFIED}}": String(data.summary.unclassified),
    "{{FIRST_LESSON_URL}}": html(firstLessonHref),
    "{{FIRST_LESSON_ACTION}}": firstLesson ? `Start Lesson ${firstLesson.order}` : "Browse lessons",
    "{{LESSON_LIST}}": renderLessonList(data, repoRoot),
    "{{FILE_ROWS}}": renderFileRows(data, repoRoot),
    "{{SOURCE_TEMPLATES}}": renderSourceTemplates(data),
    "{{CODETOUR_1_URL}}": html(vscodeUrl(repoRoot, ".tours/1-code-arena-big-picture.tour")),
    "{{CODETOUR_2_URL}}": html(vscodeUrl(repoRoot, ".tours/2-submission-journey.tour")),
    "{{UNCLASSIFIED}}": renderUnclassified(data),
    "{{REFERENCE_CHECKS}}": renderReferenceChecks(data),
    "{{SCOPE_ROOTS}}": (data.scope?.roots ?? []).map((item) => `<li><code>${html(item.path)}</code> — ${html(item.area)}</li>`).join("\n"),
    "{{EXCLUDED_ROOTS}}": (data.scope?.excluded ?? []).map((item) => `<li><code>${html(item.path)}</code> — ${html(item.reason)}</li>`).join("\n"),
  };
  let result = template;
  for (const [needle, replacement] of Object.entries(replacements)) result = result.replaceAll(needle, replacement);
  return result;
}

function catalogSnapshotStatus(data) {
  const reviewNeeded = data.sourceChanges?.length || data.evidenceChanges?.length || data.invalidTourAnchors?.length ||
    data.summary.stale || data.summary.uncovered || data.summary.missingReferences || data.summary.invalidReferences || data.summary.unclassified ||
    (data.summary.templateLinkIssues ?? 0) || (data.summary.courseOrderIssues ?? 0);
  return reviewNeeded
    ? { label: "Review needed", className: "status-stale" }
    : { label: "Snapshot internally consistent", className: "status-current" };
}

function lessonFreshness(data, lessonId) {
  const referenced = data.files.filter((file) => file.references.some((reference) => reference.lessonId === lessonId));
  const missing = data.missingReferences.filter((reference) => reference.lessonId === lessonId);
  const invalid = data.invalidReferences.filter((reference) => reference.lessonId === lessonId);
  const totalPaths = new Set([
    ...referenced.map((file) => file.path),
    ...missing.map((reference) => reference.path),
    ...invalid.map((reference) => reference.path),
  ]);
  const stalePaths = new Set([
    ...referenced.filter((file) => file.status !== "current-lesson-reference").map((file) => file.path),
    ...missing.map((reference) => reference.path),
    ...invalid.map((reference) => reference.path),
  ]);
  return { current: totalPaths.size - stalePaths.size, stale: stalePaths.size, total: totalPaths.size };
}

function renderLessonList(data, repoRoot) {
  const lessons = [...(data.lessons ?? [])].sort((left, right) => left.order - right.order);
  if (lessons.length === 0) return '<li class="quiet">No lesson pages have been authored yet.</li>';
  return lessons.map((lesson) => {
    const freshness = lessonFreshness(data, lesson.id);
    const statusClass = freshness.stale === 0 ? "status-current" : "status-stale";
    const statusLabel = freshness.stale === 0
      ? `${freshness.current}/${freshness.total} source files current`
      : `${freshness.stale} of ${freshness.total} source files need review`;
    const href = lesson.output.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    return `<li data-lesson-id="${html(lesson.id)}"><a href="${html(href)}">Lesson ${lesson.order}: ${html(lesson.title)}</a><p><span class="status ${statusClass}">${statusLabel}</span></p></li>`;
  }).join("\n");
}

function renderCourseBatches(data) {
  const lessonsById = new Map((data.lessons ?? []).map((lesson) => [lesson.id, lesson]));
  return [...(data.batches ?? [])].sort((left, right) => left.order - right.order).map((batch) => {
    const lessonItems = batch.lessonIds.map((lessonId) => {
      const lesson = lessonsById.get(lessonId);
      const href = lesson.output.split("/").map((segment) => encodeURIComponent(segment)).join("/");
      return `<li class="course-lesson"><a class="course-lesson-link" data-lesson-link="${html(lesson.id)}" href="${html(href)}"><span class="course-lesson-number" aria-hidden="true">${String(lesson.order).padStart(2, "0")}</span><span class="course-lesson-copy">Lesson ${lesson.order}: ${html(lesson.title)}</span><span class="course-lesson-arrow" aria-hidden="true">→</span></a></li>`;
    }).join("\n");
    return `<section class="course-batch" aria-labelledby="course-batch-${batch.order}-title">
      <h2 id="course-batch-${batch.order}-title">${html(batch.title)}</h2>
      <p class="course-batch-description">${html(batch.description)}</p>
      <ol class="course-lesson-list">${lessonItems}</ol>
    </section>`;
  }).join("\n");
}

export function renderCourseHomeTemplate(template, stylesheet, data) {
  const firstLesson = [...(data.lessons ?? [])].sort((left, right) => left.order - right.order)[0];
  const status = catalogSnapshotStatus(data);
  const replacements = {
    "<!-- INLINE_COURSE_STYLES -->": `<style>\n${stylesheet}\n</style>`,
    "{{FIRST_LESSON_URL}}": firstLesson
      ? html(firstLesson.output.split("/").map((segment) => encodeURIComponent(segment)).join("/"))
      : "#course-batches",
    "{{FIRST_LESSON_ACTION}}": firstLesson ? `Start Lesson ${firstLesson.order}` : "Browse lessons",
    "{{SNAPSHOT_STATUS}}": html(status.label),
    "{{SNAPSHOT_STATUS_CLASS}}": html(status.className),
    "{{SNAPSHOT_ID}}": html(data.snapshotId),
    "<!-- COURSE_BATCHES -->": renderCourseBatches(data),
  };
  let result = template;
  for (const [needle, replacement] of Object.entries(replacements)) result = result.replaceAll(needle, replacement);
  return result;
}

export function renderLessonTemplate(template, stylesheet, snapshotId, freshness, lesson = {}, sourceData = { files: [] }, repoRoot = REPO_ROOT) {
  const badge = freshness.stale === 0
    ? `<span class="status status-current">Source references match ${freshness.total} pinned files</span>`
    : `<span class="status status-stale">${freshness.stale} source reference(s) need review</span>`;
  const metadata = {
    id: lesson.id ?? "0001-submit-journey",
    order: lesson.order ?? 1,
    title: lesson.title ?? "Follow one Submit from the editor to the judge",
    goal: lesson.goal ?? "Trace the real Submit path and explain which layer sends, authorizes, and executes the action.",
    output: lesson.output ?? `lessons/${lesson.id ?? "0001-submit-journey"}.html`,
  };
  const lessonSourcePaths = new Set((lesson.references ?? []).map(({ path: filePath }) => filePath));
  const sourceFiles = new Map((sourceData.files ?? []).map((file) => [file.path, file]));
  const sourcePreviewLinks = template.replace(/href="(?:\.\.\/)+([^"#]+)#L(\d+)"/g, (match, filePath, line) => {
    if (!lessonSourcePaths.has(filePath)) return match;
    const sourceFile = sourceFiles.get(filePath);
    const citedLine = Number(line);
    const fallbackHref = `href="../source-map.html?file=${encodeURIComponent(filePath)}&amp;line=${line}"`;
    if (!sourceFile || !Number.isSafeInteger(citedLine) || citedLine < 1 || citedLine > sourceFile.lines) return fallbackHref;
    return `${fallbackHref} data-source-id="${html(sourceFile.sourceId)}" data-source-path="${html(filePath)}" data-source-line="${citedLine}" data-editor-url="${html(vscodeUrl(repoRoot, filePath, citedLine))}"`;
  });
  const rendered = sourcePreviewLinks
    .replace("<!-- INLINE_COURSE_STYLES -->", `<style>\n${stylesheet}\n</style>`)
    .replaceAll("{{SNAPSHOT_ID}}", snapshotId)
    .replace("{{LESSON_FRESHNESS}}", badge)
    .replaceAll("{{LESSON_ID}}", html(metadata.id))
    .replaceAll("{{LESSON_ORDER}}", String(metadata.order))
    .replaceAll("{{LESSON_TITLE}}", html(metadata.title))
    .replaceAll("{{LESSON_GOAL}}", html(metadata.goal));
  const sourcePreview = renderLessonSourcePreview(sourceData.files ?? []);
  return rendered.replace("</body>", `${sourcePreview}\n</body>`);
}

export function formatAuditReport(data) {
  const lines = [
    `Reviewed source snapshot: ${data.referenceSnapshotId ?? "not initialized"}; current source content: ${data.currentSnapshotId}.`,
    `Coverage: ${data.summary.total} in-scope files; ${data.summary.currentReferences} current lesson links; ${data.summary.staleReferences} stale; ${data.summary.supporting} support-only; ${data.summary.uncovered} uncovered; ${data.summary.unclassified} unclassified.`,
    `Source drift: ${data.sourceChanges.length}; CodeTour/evidence drift: ${data.evidenceChanges.length}; invalid CodeTour anchors: ${data.invalidTourAnchors.length}.`,
  ];
  if (!data.referenceSnapshotId) lines.push("This is a proposed initial snapshot; the explicit reviewed-snapshot command will freeze it.");
  if (data.sourceChanges.length) {
    lines.push("Source changes:");
    for (const change of data.sourceChanges) lines.push(`- ${change.path} — ${change.kind}`);
  }
  if (data.evidenceChanges.length) {
    lines.push("CodeTour/evidence baseline changes:");
    for (const change of data.evidenceChanges) lines.push(`- ${change.path} — ${change.kind}`);
  }
  if (data.affectedArtifacts.lessons.length) {
    lines.push("Affected lesson links:");
    for (const item of data.affectedArtifacts.lessons) {
      lines.push(`- Lesson ${item.lessonId}: ${item.path} L${item.startLine}–L${item.endLine} (${item.label || item.title})`);
    }
  }
  if (data.affectedArtifacts.tours.length) {
    lines.push("Affected CodeTour source steps:");
    for (const item of data.affectedArtifacts.tours) {
      lines.push(`- CodeTour ${item.path} · step ${item.step}: ${item.sourcePath} L${item.line} (${item.stepTitle})`);
    }
  }
  if (data.affectedArtifacts.baselineRecords.length) {
    lines.push("Affected checksum records:");
    for (const item of data.affectedArtifacts.baselineRecords) {
      lines.push(`- ${item.baselinePath}: ${item.sourcePath}`);
    }
  }
  if (data.invalidTourAnchors.length) {
    lines.push("Invalid CodeTour anchors:");
    for (const item of data.invalidTourAnchors) {
      lines.push(`- ${item.tourPath} · step ${item.step}: ${item.file} L${item.line} (${item.issue})`);
    }
  }
  if (data.missingReferences.length || data.invalidReferences.length) {
    lines.push("Broken lesson source anchors:");
    for (const item of data.missingReferences) lines.push(`- Lesson ${item.lessonId}: missing ${item.path}`);
    for (const item of data.invalidReferences) lines.push(`- Lesson ${item.lessonId}: invalid lines ${item.startLine}–${item.endLine} in ${item.path}`);
  }
  if ((data.templateLinkIssues ?? []).length) {
    lines.push("Lesson template links outside cited ranges:");
    for (const item of data.templateLinkIssues) lines.push(`- Lesson ${item.lessonId}: ${item.path}#L${item.line} (${item.issue})`);
  }
  if ((data.courseOrderIssues ?? []).length) {
    lines.push("Course order drift (coverage-map.json owns the order):");
    for (const item of data.courseOrderIssues) lines.push(`- ${item.lessonId ? `Lesson ${item.lessonId}: ` : ""}${item.kind} — ${item.detail}`);
  }
  if (data.affectedArtifacts?.lessons?.length) {
    const affectedIds = [...new Set(data.affectedArtifacts.lessons.map((item) => item.lessonId))].sort();
    lines.push(`Affected lessons need recorded review before accept: ${affectedIds.join(", ")}. Pass --reviewed-lessons=${affectedIds.join(",")} once each was updated or checked with no edit needed.`);
  }
  if (data.sourceChanges.length === 0 && data.evidenceChanges.length === 0 && data.invalidTourAnchors.length === 0) {
    lines.push("No source or CodeTour drift detected.");
  }
  return lines.join("\n");
}

export async function writeRenderedOutputs(files) {
  for (const [filePath, content] of files) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
}

function refreshReferenceBaselineText(text, { recordedAt, gitHead, worktreeStatus, tourAnchorCount }) {
  const date = recordedAt.slice(0, 10);
  const replacements = [
    [/^- Recorded: .*$/m, `- Recorded: ${date}`],
    [/^- Git HEAD: .*$/m, `- Git HEAD: \`${gitHead}\``],
    [/^- Git worktree: .*$/m, `- Git worktree: ${worktreeStatus}; the recorded file hashes capture working-tree content independently of HEAD.`],
    [/^- Tour links checked: .*$/m, `- Tour links checked: all ${tourAnchorCount} file-and-line anchors resolve in current files.`],
  ];
  let refreshed = text;
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(refreshed)) throw new Error(`Cannot refresh reference-baseline.md: missing ${pattern}`);
    refreshed = refreshed.replace(pattern, replacement);
  }
  const currentEvidenceHeading = /^## Test evidence captured for this snapshot$/m;
  const historicalEvidenceHeading = /^## Historical test evidence \(not rerun by snapshot refresh\)$/m;
  if (currentEvidenceHeading.test(refreshed)) {
    refreshed = refreshed.replace(currentEvidenceHeading, "## Historical test evidence (not rerun by snapshot refresh)");
  } else if (!historicalEvidenceHeading.test(refreshed)) {
    throw new Error("Cannot refresh reference-baseline.md: missing test evidence heading");
  }

  const originalEvidenceDate = /All commands ran on (\d{4}-\d{2}-\d{2})\./;
  if (originalEvidenceDate.test(refreshed)) {
    refreshed = refreshed.replace(originalEvidenceDate, `These test results were captured on $1. The reference baseline was refreshed on ${date}; tests were not rerun during that refresh.`);
  } else {
    const historicalEvidenceDate = /(These test results were captured on \d{4}-\d{2}-\d{2}\. The reference baseline was refreshed on )\d{4}-\d{2}-\d{2}(; tests were not rerun during that refresh\.)/;
    if (!historicalEvidenceDate.test(refreshed)) {
      throw new Error("Cannot refresh reference-baseline.md: missing test evidence date");
    }
    refreshed = refreshed.replace(historicalEvidenceDate, (_match, prefix, suffix) => `${prefix}${date}${suffix}`);
  }
  return refreshed;
}

export async function acceptReviewedSnapshot({
  repoRoot,
  learningDir = LEARNING_DIR,
  files,
  gitHead,
  recordedAt = new Date().toISOString(),
  auditData,
  worktreeStatus = "not measured",
  reviewedLessons = [],
}) {
  if (!(files instanceof Map)) throw new Error("acceptReviewedSnapshot requires the complete scoped files Map");
  if (!auditData) throw new Error("acceptReviewedSnapshot requires a completed impact review");
  if (auditData.invalidTourAnchors.length || auditData.missingReferences.length || auditData.invalidReferences.length ||
      (auditData.templateLinkIssues ?? []).length || (auditData.courseOrderIssues ?? []).length) {
    throw new Error("Refusing to accept a snapshot with broken lesson or CodeTour source anchors");
  }
  // ponytail: one gate in the shared acceptor, not per caller — listing an
  // affected lesson attests it was updated or checked with no edit needed.
  const lessonsNeedingReview = auditData.referenceSnapshotId === null
    ? (auditData.lessons ?? []).map(({ id }) => id)
    : (auditData.affectedArtifacts?.lessons ?? []);
  const missing = missingLessonReviews({ affectedLessons: lessonsNeedingReview, reviewedLessons });
  if (missing.length) {
    throw new Error(`Refusing to accept with unreviewed lessons: ${missing.join(", ")}. Pass --reviewed-lessons=${missing.join(",")} once reviewed.`);
  }
  const snapshot = createReferenceSnapshot({ files, gitHead, recordedAt, lessonReviews: [...new Set(reviewedLessons.map((entry) => String(entry).trim()).filter(Boolean))].sort() });
  const checksumPath = path.join(repoRoot, ".tours/reference-baseline.sha256");
  let previousChecksums = new Map();
  try {
    previousChecksums = parseChecksumList(await readFile(checksumPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const tours = await loadCodeTours(repoRoot);
  const checksumPaths = new Set([...previousChecksums.keys(), ...tours.map((tour) => tour.path)]);
  const currentChecksums = new Map();
  for (const filePath of checksumPaths) {
    try {
      currentChecksums.set(filePath, sha256(await readFile(path.join(repoRoot, filePath))));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const checksumText = [...currentChecksums]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, digest]) => `${digest}  ${filePath}`)
    .join("\n") + "\n";
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snapshotPath = path.join(learningDir, "reference-snapshot.json");
  const baselineMarkdownPath = path.join(repoRoot, ".tours/reference-baseline.md");
  let baselineMarkdown;
  try {
    const currentMarkdown = await readFile(baselineMarkdownPath, "utf8");
    const tourAnchorCount = tours.reduce((count, tour) => count + tour.steps.length, 0);
    baselineMarkdown = refreshReferenceBaselineText(currentMarkdown, {
      recordedAt,
      gitHead,
      worktreeStatus,
      tourAnchorCount,
    });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, snapshotText);
  await writeFile(checksumPath, checksumText);
  if (baselineMarkdown !== undefined) await writeFile(baselineMarkdownPath, baselineMarkdown);
  return {
    snapshot,
    referenceBaseline: { path: ".tours/reference-baseline.sha256", files: currentChecksums },
    checksumCount: currentChecksums.size,
  };
}

export async function renderCatalogOutputs(repoRoot, learningDir, coverageMap, options = {}) {
  const data = await buildCatalogData({ repoRoot, learningDir, coverageMap, ...options });
  const stylesheet = await readFile(path.join(learningDir, "assets/course.css"), "utf8");
  const catalogTemplate = await readFile(path.join(learningDir, "templates/source-map.template.html"), "utf8");
  const catalog = renderCatalogTemplate(catalogTemplate, stylesheet, data, repoRoot);
  const files = new Map();
  if (data.batches.length) {
    const homeTemplate = await readFile(path.join(learningDir, "templates/course-home.template.html"), "utf8");
    files.set(path.join(learningDir, "index.html"), renderCourseHomeTemplate(homeTemplate, stylesheet, data));
  }
  files.set(path.join(learningDir, "source-map.html"), catalog);
  const orderedLessons = [...data.lessons].sort((left, right) => left.order - right.order);
  for (const lesson of orderedLessons) {
    const lessonTemplate = await readFile(path.join(learningDir, lesson.template), "utf8");
    const page = renderLessonTemplate(
      lessonTemplate,
      stylesheet,
      data.snapshotId,
      lessonFreshness(data, lesson.id),
      lesson,
      { files: data.files.filter((file) => (lesson.references ?? []).some((reference) => reference.path === file.path)) },
      repoRoot,
    );
    files.set(path.join(learningDir, lesson.output), page);
  }
  return {
    data,
    files,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const acceptSnapshot = process.argv.includes("--accept-reviewed-snapshot");
  const reviewedArg = process.argv.find((arg) => arg.startsWith("--reviewed-lessons="));
  const reviewedLessons = reviewedArg ? reviewedArg.slice("--reviewed-lessons=".length).split(",").map((entry) => entry.trim()).filter(Boolean) : [];
  const repoRoot = REPO_ROOT;
  const learningDir = LEARNING_DIR;
  const coverageMap = JSON.parse(await readFile(path.join(learningDir, "coverage-map.json"), "utf8"));
  const tours = await loadCodeTours(repoRoot);
  const snapshotPath = path.join(learningDir, "reference-snapshot.json");
  let referenceSnapshot;
  try {
    referenceSnapshot = parseReferenceSnapshot(await readFile(snapshotPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT" || !acceptSnapshot) throw error;
  }
  const checksumPath = path.join(repoRoot, ".tours/reference-baseline.sha256");
  let referenceBaseline;
  try {
    referenceBaseline = {
      path: ".tours/reference-baseline.sha256",
      files: parseChecksumList(await readFile(checksumPath, "utf8")),
    };
  } catch (error) {
    if (error?.code !== "ENOENT" || !acceptSnapshot) throw error;
  }
  const options = { referenceSnapshot, referenceBaseline, tours };
  const { data, files } = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, options);
  const { summary } = data;

  if (acceptSnapshot) {
    console.log(formatAuditReport(data));
    const gitHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    const worktreeStatus = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim()
      ? "dirty"
      : "clean";
    const accepted = await acceptReviewedSnapshot({
      repoRoot,
      learningDir,
      files: new Map(data.files.map((file) => [file.path, file.sha256])),
      gitHead,
      auditData: data,
      worktreeStatus,
      reviewedLessons,
    });
    const acceptedSnapshot = parseReferenceSnapshot(JSON.stringify(accepted.snapshot));
    const refreshed = await renderCatalogOutputs(repoRoot, learningDir, coverageMap, {
      referenceSnapshot: acceptedSnapshot,
      referenceBaseline: accepted.referenceBaseline,
      tours,
    });
    await writeRenderedOutputs(refreshed.files);
    console.log(`Accepted reviewed source snapshot ${accepted.snapshot.snapshotId} (${accepted.snapshot.files.length} files); refreshed ${accepted.checksumCount} checksum inputs.`);
    console.log(`Generated source map and ${refreshed.data.lessons.length} lesson page(s).`);
    return;
  }

  if (checkOnly) {
    let outdated = false;
    for (const [filePath, expected] of files) {
      let current;
      try {
        current = await readFile(filePath, "utf8");
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        current = "";
      }
      if (current !== expected) {
        console.error(`${path.relative(repoRoot, filePath)} is out of date; run the build command.`);
        outdated = true;
      }
    }
    console.log(formatAuditReport(data));
    console.log(`${summary.total} scoped files; ${summary.currentReferences} current lesson links; ${summary.staleReferences} stale lesson links; ${summary.supporting} support-only; ${summary.uncovered} uncovered; ${summary.excluded} explicit exclusions; ${summary.unclassified} unclassified.`);
    if (summary.missingReferences || summary.invalidReferences) console.error(`Broken lesson anchors: ${summary.missingReferences + summary.invalidReferences}.`);
    if (summary.templateLinkIssues) console.error(`Template links outside cited ranges: ${summary.templateLinkIssues}.`);
    if (summary.courseOrderIssues) console.error(`Course order drift: ${summary.courseOrderIssues}.`);
    if (outdated || data.sourceChanges.length || data.evidenceChanges.length || data.invalidTourAnchors.length || summary.stale || summary.uncovered || summary.unclassified || summary.missingReferences || summary.invalidReferences || summary.templateLinkIssues || summary.courseOrderIssues) process.exitCode = 1;
    return;
  }

  await writeRenderedOutputs(files);
  console.log(`Built source map and ${data.lessons.length} lesson page(s) from snapshot ${data.snapshotId}.`);
  console.log(formatAuditReport(data));
  console.log(`${summary.total} scoped files: ${summary.currentReferences} current lesson links, ${summary.staleReferences} stale; ${summary.supporting} support-only; ${summary.uncovered} uncovered; ${summary.excluded} explicit exclusions.`);
  if (summary.unclassified) console.warn(`${summary.unclassified} source-like files outside scope need classification.`);
  if (summary.unclassified) for (const item of data.unclassified) console.warn(`  ${item.path}`);
  if (summary.missingReferences || summary.invalidReferences) console.warn(`${summary.missingReferences + summary.invalidReferences} lesson source anchors need repair.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
