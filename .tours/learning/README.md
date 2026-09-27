# Code Arena learning course

This folder is the single start point for understanding and later rewriting the game. The 14 short lessons are tied to the reviewed source snapshot and its dated test evidence. CodeTours take you to files in VS Code; this course asks you to predict behavior, follow a small path, and check what you remember.

## Start here

1. Read [the mission](MISSION.md) so the lessons stay aimed at rebuilding the game yourself.
2. Open [the searchable source map](source-map.html). Lesson citations open a focused, syntax-colored excerpt in place on the lesson page; closing it keeps your lesson step and scroll position. The source map remains the full file inventory, and its file previews show the complete file. Use **Open in VS Code** for the full source file. Highlighting is generated locally for common languages, so the pages work offline; other formats stay readable as plain text. The map includes every recognized source/config/test file under the roots listed there; new files appear automatically.
3. Follow the lessons in order. Each asks you to predict, inspect a short source path and test, then explain the behavior back:
   1. [A click is a request. The Match engine decides what it means.](lessons/0001-follow-one-submit.html) — trace Submit from the editor to judging.
   2. [Closing, cutoff, Reveal: when an in-flight result counts](lessons/0002-reveal-cutoff.html) — distinguish the grace window from the final cutoff.
   3. [What resets each Round—and what decides the Match?](lessons/0003-rounds-and-final-score.html) — follow scoring, Round reset, and the final result.
   4. [The Lobby gathers players; Game creates the Match](lessons/0004-lobby-to-match.html) — see who can start and when the Match exists.
   5. [The problem file becomes an editor prompt—but Run is not Submit](lessons/0005-problem-editor-run.html) — trace problem data into the editor and compare visible Run tests with scored Submit.
   6. [A retry is the same Evaluation only when its identity matches](lessons/0006-evaluation-retries.html) — learn why stable IDs make retries safe and changed requests conflict.
   7. [The Game owns the rules; the Judge runs code—but is it really sealed?](lessons/0007-judge-boundary.html) — separate Game authority, execution sandbox, and hidden-case confidentiality evidence.
   8. [What survives when the Game service restarts?](lessons/0008-persistence-recovery.html) — trace durable Match/Evaluation state and the boot-recovery boundary.
   9. [Reconnecting gives you a fresh snapshot—not a frozen game](lessons/0009-live-connection.html) — separate Match membership, Presence, Player status, and the state rebuilt on reconnect.
   10. [An edit changes the revision—and resets both Ready approvals](lessons/0010-team-collaboration.html) — trace shared 2v2 edits, revision-bound readiness, and the source the server evaluates.
   11. [Team chat is a side channel—not editor state or Match state](lessons/0011-team-chat.html) — distinguish team-room messages, in-memory history, and Match- versus Round-scoped clients.
   12. [The Arena screen is a view of Match state—not another game engine](lessons/0012-arena-screen.html) — follow a snapshot into the visible screen without giving display components game authority.
   13. [The local play script and Compose stack are not the same thing](lessons/0013-running-the-project.html) — learn the safe local paths and the real current roles of Core, Game, Chat, and Nginx.
   14. [A green test is evidence for this repo—not proof of your rewrite](lessons/0014-rewrite-with-tests.html) — group test evidence and turn it into test-first parity gates for a separate rebuild.
4. When you want editor-guided navigation, use CodeTours 1–6 linked from the source map. CodeTour 6 is the detailed behavior-gate checklist for the rewrite; it does not generate code or prove parity by itself.

If the existing local static server is running, open `http://127.0.0.1:4174/.tours/learning/source-map.html`. Otherwise, open the HTML files directly in a browser; all lesson styles and interaction code are embedded in each generated HTML page.

## Keep coverage honest

The map scans `frontend/`, `services/`, `packages/`, `infra/`, `scripts/`, the Judge isolation experiment, and the listed root project files. It lists source-like files outside those roots as **unclassified** unless a path is explicitly excluded with a reason. Dependencies/build output are ignored. Design prototypes and planning notes are not treated as current product behavior.

```sh
node .tours/learning/scripts/build-catalog.mjs
node --test .tours/learning/scripts/*.test.mjs
node .tours/learning/scripts/build-catalog.mjs --check
```

Run the check before studying after the game changes. A new file appears as **Not taught yet**. If an in-scope file or a CodeTour input changes, the check reports the path plus every affected lesson link, CodeTour step, and checksum record. It also rejects lesson template links outside their cited `coverage-map.json` ranges and rejects README/lesson-nav order drift from the single coverage order. It never updates a baseline by itself. Update the affected lesson and source range, review relevant tests and CodeTours, then deliberately freeze the new working-tree state:

```sh
node .tours/learning/scripts/build-catalog.mjs --accept-reviewed-snapshot --reviewed-lessons=0001-submit-journey,0002-reveal-cutoff
```

Listing an affected lesson attests it was updated or checked with no edit needed; the ids are stored as `lessonReviews` in the snapshot. Accept refuses with unreviewed lessons, broken anchors, template-range mismatches, or order drift.

That explicit command records the current content hashes, Git `HEAD`, and date; refreshes the CodeTour checksum list; updates its snapshot note; and rebuilds the source map and every lesson. Ordinary generation and `--check` do not modify any reference baseline. The source hash manifest is `.tours/learning/reference-snapshot.json`; lesson links and their line ranges live in `coverage-map.json`. Git `HEAD` is recorded for context, but the working-tree file hashes define the reference when the tree is dirty.

**A current lesson link is not mastery.** It means only that a lesson names the file and the whole file matches the reviewed snapshot. The generated map also lists TypeScript/JavaScript declarations, common route/socket markers, and test names to make discovery easier; it does not explain every branch. A self-check is only a reminder. We will add a learning record only after you can explain the concept in your own words.

The [CodeTour reference baseline](../reference-baseline.md) hashes the tours' 60 direct inputs. The learning source snapshot covers the broader 178-file game/runtime inventory. Neither promises that the game will never change; they make change visible so we can review and freeze an intentional newer reference. Check `source-map.html` for the live coverage counts; until every in-scope file is linked to a lesson or explicitly support-only, `--check` is expected to fail.

Browser E2E links point to scenario source; they are not proof that a browser run passed on the current snapshot. Each lesson separates tests actually run during course work from tests inspected only. In particular, run service/Postgres restart scenarios only against a verified disposable service and database; the collaboration restart scenario can kill a process listening on TCP 3220.

This workspace does not edit game behavior, the 42-subject compliance matrix, or module sign-off. The 42 requirements and the current matrix remain linked in [RESOURCES.md](RESOURCES.md).
