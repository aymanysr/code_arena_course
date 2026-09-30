# Code Arena learning course

This course guides a learner who knows C but is new to TypeScript and web development through the current Code Arena game. Its 68 authored lessons are arranged across milestones M00–M13. Each step explains why a part exists, shows how it changes, and names the practice file and check.

The course teaches you to build your own version. It does not provide a finished game or run code from this browser.

## Start here

- [Build route](index.html) — start at M00 or continue on this browser.
- [Reference lessons](reference.html) — start with “Before Lesson 1,” then trace the current game through its source and tests.
- [Teammate repo map](reference.html#build-path) — see the ordered build dependencies, example locations, patterns, and checks.
- [Mission](MISSION.md) — what you are learning and how to tell what is proved.
- [Explore code](source-map.html) — search the reference files and tests. This is a library, not the guided route.
- [Resources](RESOURCES.md) — official references, project requirements, and known limits.
- [Maintain the course](MAINTAINING.md) — authoring, freshness, coverage, and evidence rules.

Start at M00 even if you are comfortable with C. It explains the destination and the three different places you may work: the reference game, a separate practice folder, and—after inspection—the teammate repository.

## Before you code

Before you write anything, understand the path in plain English:

- Reference game: read only. Use it to inspect behavior and patterns.
- Practice folder: this is where you write your own small version while you learn.
- Team repo: inspect it later, after your teammate confirms the real folders, scripts, and commands.

Do not treat the team repo as ready just because the reference game is open. A saved browser path is not a real repo check, and it does not prove a command works.

## Use the workspaces safely

The reference game is read-only. Practice is where you write now. The Team workspace becomes useful after you and your teammate inspect its folders and commands. The browser saves only paths and mappings that you enter; it does not inspect a folder, create a file, or run a command. A practice pass never becomes a Team pass.

When you map a team check, record the command and working folder your teammate confirms. The result stays **unverified** until that command is run in the actual team repository and its output is reviewed.

## What the status means

`learning-path.json` currently marks all 68 lessons ready to read. That says the lesson content exists. It does not say every author check passed, the learner completed a walkthrough, or the game was rebuilt in the teammate repository.

The catalog reports two separate checks:

- `courseReady` requires reviewed file and behavior coverage plus current author-rehearsal results for required checks.
- `targetComplete` requires current results from the actual Team workspace. Reference and disposable-fixture results cannot satisfy it.

The foundation walkthrough still needs real learner feedback. The teammate repository has not been supplied, and live database, Judge, and multiplayer checks remain blockers. See the current [compliance record](../../prototype/game-ui/42-subject-compliance.md) and run the strict audit before reporting completion.
