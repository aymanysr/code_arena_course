# Code Arena learning experience: research and redesign direction

Date: 2026-09-26  
Status: Research/design recommendation only. No course UI or behavior was changed.

## Finding

The course has a sound teaching intent—start with a real player action, predict, trace source and tests, then recall—but the learner has to navigate a collection of artifacts rather than one focused learning experience. Keep the 14-lesson curriculum and exact-source safeguards; separate the learner's path from codebase exploration and course-maintenance work.

## What is scattered today

- The README asks a beginner to read the Mission, open the source map, then choose a lesson, while also carrying course-refresh commands and snapshot rules ([README](../.tours/learning/README.md#L5), [maintenance workflow](../.tours/learning/README.md#L28)).
- The source map is both course index and repository audit: its first screen emphasizes six coverage metrics, followed by lessons and a searchable inventory of source/config/test files ([source-map template](../.tours/learning/templates/source-map.template.html#L13), [inventory](../.tours/learning/templates/source-map.template.html#L34)). A beginner looking to learn “what happens when I click Submit?” is placed beside maintenance concepts like unclassified files and hash freshness.
- Lesson pages are individually navigable, but Lesson 1 has a different interaction and content shape from later lessons. It gates the trace behind a multiple-choice answer and adds a “why this is a good first slice” section; later lessons use a prediction, terms/evidence, trace, and rewrite-test prompt ([Lesson 1 template](../.tours/learning/templates/0001-submit-journey.template.html#L28), [Lesson 2 template](../.tours/learning/templates/0002-reveal-cutoff.template.html#L28)).
- Progress/resume is only wired to Lesson 1: both its template and the source map use the hard-coded `0001-follow-one-submit` local-storage key ([lesson storage](../.tours/learning/templates/0001-submit-journey.template.html#L167), [map status](../.tours/learning/templates/source-map.template.html#L268)). The other lesson templates have no matching saved progress, so the apparent course path does not provide a consistent “where was I?” experience.
- The approved course design already specifies short, behavior-sized lessons and four curriculum batches. The redesign should improve the way this plan is presented, not replace the curriculum or its reference-baseline safeguards ([approved design](superpowers/specs/2026-09-26-code-arena-learning-course-design.md#curriculum-shape-and-teaching-order)).

## Evidence and limits

These sources support instructional choices; none evaluated this course or proves that one particular interface will work for this learner.

1. **Reduce unstructured search for novices.** Sweller’s original problem-solving study found that conventional means–ends problem solving can consume capacity that would otherwise support schema acquisition. This supports starting with a bounded, worked path before asking a beginner to explore the whole repository. The study was not about software architecture or this UI, so applying it here is a design inference. ([Sweller, “Cognitive Load During Problem Solving: Effects on Learning,” 1988](https://doi.org/10.1207/s15516709cog1202_4))
2. **Keep code tracing scaffolded, but do not force heavy guidance.** A programming code-tracing tutor study with 97 learners found outcomes depended on help level and ordering: reduced scaffolding did better across all participants, while moderate assistance was best only within the subgroup that improved. This argues against one rigid, heavily guided interface; offer a clear path with optional help and adjust only if a learner needs it. The experiment used short Python tracing tasks in an introductory course, so applying it to this codebase is a design inference. ([“When Does Scaffolding Provide Too Much Assistance? A Code-Tracing Tutor Investigation,” 2021](https://doi.org/10.1007/s40593-020-00217-z))
3. **Ask the learner to retrieve, not only reread.** In two experiments using prose passages, repeated retrieval improved delayed retention over repeated study at 2 days and 1 week, though repeated study did better on the immediate 5-minute test. Use low-stakes “explain the path from memory” prompts and revisit important ideas later; transfer from prose recall to learning this codebase is an inference. ([Roediger & Karpicke, “Test-Enhanced Learning,” 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x))
4. **Make orientation predictable and perceivable.** WCAG 2.2 requires headings/labels to describe topic or purpose and repeated navigation to keep a consistent relative order (SC 2.4.6 and 3.2.3, Level AA). This is an accessibility standard, not evidence that a specific dashboard improves learning. ([W3C, WCAG 2.2, 2023](https://www.w3.org/TR/WCAG22/))

## Proposed learner-centered information architecture

Keep three modes distinct, with **Learn** as the default:

1. **Learn — course home:** one clear “Start” or “Continue” action, a visible 14-lesson path grouped into the four approved batches, a small current-reference/freshness indicator, and honest activity status (not a mastery score).
2. **Learn — lesson reader:** one consistent layout: goal and scenario → make a prediction → follow a small number of source steps → inspect the relevant test and its limits → explain the behavior from memory → say what the rewrite test must assert → previous/next. Keep the exact source snapshot available as quiet context, not competing lesson content. Make hints optional and never block access to the explanation.
3. **Explore code:** keep the source map as a powerful, separate lookup tool for files, symbols, routes, socket events, tests, coverage, and CodeTours. From a lesson, links should return the learner to that lesson; from the map, each result should make its related lesson obvious.
4. **Maintain the course:** keep snapshot acceptance, coverage audits, generator commands, and teaching-author notes in maintainer documentation. Link this mode for future updates, but do not put its workflow in the beginner’s primary path.

**Session flow:** open course home → continue the next small behavior → answer one prediction → trace each boundary in order in the editor → check the test that supports the explanation and what it does not prove → retell the behavior without looking → finish with one rewrite-test prompt → continue or pause. Persist only “not started / started / self-check recorded” if useful; never label that as understanding or parity.

## Low-risk changes to test first

1. **Prototype the course home and split navigation before changing lesson content.** Present the four existing batches and one primary Start/Continue action; move the full source inventory behind “Explore code.” Test whether the learner can answer “what should I do next?” without opening README, Mission, and map in sequence.
2. **Use Lesson 1 as a consistency pilot.** Align its visible order and navigation with Lessons 2–14, preserve its Submit-path teaching content, and make the source freshness detail secondary. Do not force a wrong answer before showing the trace; keep prediction useful but non-blocking.
3. **Test one whole study session, not just visual preference.** Ask the learner to complete Lesson 1, pause, return, and explain (a) who authorizes Submit and (b) what to inspect next. Record points of confusion and whether they can resume. This is a small usability check, not a learning-outcome study.
4. **Then add consistent cross-lesson activity tracking**, only if the pilot shows “where was I?” is still a problem. Keep it local/offline-compatible and clearly distinguish activity from mastery.

## Do not build yet

Do not add a new framework, login/cloud sync, a large LMS, AI tutoring, adaptive mastery scoring, or rewrite the 14 lessons wholesale. First validate the information architecture and one lesson with the existing static/offline approach. Preserve source hashes, affected-lesson review, test evidence dates, and the distinction between reference-code tests and rewrite parity.

## Assumptions and open questions

- Assumption: the main goal is to understand this exact implementation well enough to rewrite it later, not to present it or browse every file during each lesson.
- Assumption: the course remains a local, self-guided tool in VS Code/browser and should continue working offline.
- Open: should “Continue” remember only the last lesson, or also the current stage within it? Start with the last lesson unless the pilot demonstrates stage-resume is valuable.
- Open: should learner notes be kept in a simple local file, or is an explain-it-to-the-teacher prompt enough for now? Avoid collecting a note system before the learner tests the basic flow.

## Sources

- John Sweller, “Cognitive Load During Problem Solving: Effects on Learning,” *Cognitive Science* 12(2), 1988. https://doi.org/10.1207/s15516709cog1202_4
- “When Does Scaffolding Provide Too Much Assistance? A Code-Tracing Tutor Investigation,” *International Journal of Artificial Intelligence in Education*, 2021. https://doi.org/10.1007/s40593-020-00217-z
- Henry L. Roediger III and Jeffrey D. Karpicke, “Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention,” *Psychological Science* 17(3), 2006. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation, 5 October 2023. https://www.w3.org/TR/WCAG22/
