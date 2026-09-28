# UX references for learning from an existing codebase

Date: 2026-09-28
Status: Comparative research and design recommendations. No course behavior or game behavior was changed.

## The question this review answers

The learner needs to understand how the existing Code Arena game works in a teammate's repository, then build a similar game in their own project. They need plain-English guidance on what comes first, why it comes first, which ideas depend on earlier ideas, where to look in the existing repository, which files or folders to create in their project, and how to recognize a local pattern. The learning flow should teach transfer and independent decisions instead of supplying code to copy.

There is no universal “best learning platform.” This is a shortlist of useful design references for that specific job. The first-party public lesson pages, help documents, and curriculum-contributor docs below describe the patterns. I did not evaluate private or logged-in screens, conduct a visual usability study, or test screen-reader/keyboard behavior on these platforms. Their descriptions are evidence of what they document, not proof of improved learning outcomes. Marketing statements about success or effectiveness are not used as evidence.

## How I compared them

I looked for six things: can a new learner find the first step; does the platform explain why the steps are in that order; can the learner see what they have done and what comes next; does practice happen in a real or realistic coding task; are the files, folders, and checks described clearly; and can the learner get help without being handed the finished answer. “Best fit” below is my design judgment against those needs, not a measured platform ranking. The review uses public first-party pages and documentation rather than a side-by-side usability test.

## Shortlist

| Reference | Strongest fit for this learner | Main limit |
| --- | --- | --- |
| [The Odin Project](https://www.theodinproject.com/paths) | A visible route from foundations into ordered technical paths, with project work in a local repository | A broad web-development curriculum, rather than a guided tour of one existing game codebase |
| [Exercism](https://exercism.org/docs/building/tracks/syllabus) | A concept map, explicit prerequisites, small practice steps, tests, and optional help | Primarily focused exercises and language fluency rather than a full game architecture |
| [GitHub Skills](https://github.com/SKILLS) | Guided work inside a real repository workflow, with small tasks and automated feedback | Best for GitHub workflows; it does not teach a learner the whole application architecture |
| [freeCodeCamp](https://contribute.freecodecamp.org/how-to-work-on-coding-challenges/) | A repeatable mix of explanation, guided practice, independent labs, review, and checks | Its curriculum is general-purpose, not linked to a learner's teammate repository |
| [Frontend Mentor](https://www.frontendmentor.io/guides/how-to-start-a-challenge) | Clear project briefs, visible difficulty, room for implementation choices, and reflection | It does not supply the prerequisite map a beginner needs to understand a game codebase |
| [Khan Academy](https://support.khanacademy.org/hc/en-us/articles/360015623271-Khan-Academy-s-accessibility-settings) | Documented accessibility preferences that can inform course controls | A general learning platform, not a software-project workflow reference |

### 1. The Odin Project: best backbone for order and real-project guidance

The paths page starts with Foundations and then presents two named paths whose courses should be taken in displayed order. Its “How This Course Will Work” lesson explains what the foundation enables and what comes next. It also states that later portions build on earlier ones, making the reason for sequence explicit. ([Paths](https://www.theodinproject.com/paths), [How This Course Will Work](https://www.theodinproject.com/lessons/foundations-how-this-course-will-work))

Its project lessons connect a lesson to a build. The Node lesson names JavaScript as a prerequisite, lists the new topics, names the pages the learner will build, and tells them to watch for useful material while studying. The Foundations project guidance starts from a design and encourages looking things up or returning to earlier lessons instead of expecting memorization. ([Node.js lesson](https://www.theodinproject.com/lessons/nodejs-getting-started), [Landing Page project](https://www.theodinproject.com/lessons/foundations-landing-page))

The Recipes project gives concrete repository steps: create and clone a named repository, work inside the project folder, add a README that says what skills the project demonstrates, and commit meaningful changes. It also warns learners to complete their attempt before opening other students' solutions, explaining that working through the problem builds research and problem-solving practice. ([Recipes project](https://www.theodinproject.com/lessons/foundations-recipes))

**Borrow for Code Arena:** make every lesson answer “why now?”, “what should I already understand?”, “what behavior will I trace?”, and “what should I build after I understand it?” In the project section, name the reference repository path and symbol, tell the learner whether to read, edit, or create each file in their own project, and link to the earlier lesson that introduced the needed concept. Keep the build as the learner's own implementation.

### 2. Exercism: best model for dependencies, small steps, and useful hints

Exercism documents a syllabus shown as a concept map. Its concept exercises teach focused ideas using concepts introduced earlier; its tree structure shows that later ideas depend on earlier ones. Separate practice exercises reuse the concepts already learned. Practice exercise metadata can name prerequisites, which appear in the UI as an explanation of what to learn before an exercise becomes available. ([Building Tracks](https://exercism.org/docs/building/tracks), [Syllabus](https://exercism.org/docs/building/tracks/syllabus), [Practice Exercises](https://exercism.org/docs/building/tracks/practice-exercises))

The exercise structure is also unusually useful for repo-specific course design. Exercism describes separate introduction, instructions, hints, design notes, tests, and implementation files. In the browser, hints are shown on request; the docs say hints should help the learner get unstuck without spelling out the solution. Exercise docs can stay alongside the exercise while shared instructions cover common test and help procedures. ([Practice Exercises](https://exercism.org/docs/building/tracks/practice-exercises), [Presentation](https://exercism.org/docs/building/tracks/presentation))

The user-facing flow adds test feedback and a request for mentor help after a learner gets stuck. Its docs describe tests as a way to iterate and report whether a solution passes. ([Getting Started](https://exercism.org/docs/using/getting-started), [Test Runners](https://exercism.org/docs/building/tooling/test-runners))

**Borrow for Code Arena:** map the behavior dependencies as a small tree, and distinguish “learn this concept” from “practice a concept in a new behavior.” Keep hints layered: first point to the idea, then the relevant source/test path, then a debugging question. Avoid giving the completed implementation. Give every lesson a clear “what this test proves / what it does not prove” note.

### 3. GitHub Skills: best model for doing guided work in a repository

GitHub Skills describes exercises that teach through GitHub Issues and Actions, in the learner's own copy of a project, with instructions and feedback. The Introduction to GitHub exercise states its audience, learning goals, result, and lack of prerequisites, then lists four concrete actions: create a branch, commit a file, open a pull request, and merge it. ([GitHub Skills overview](https://github.com/SKILLS), [Introduction to GitHub exercise](https://github.com/skills/introduction-to-github))

This is the closest reference for moving from a learning screen into repository work: one small task is tied to a visible result in a real tool. Its first-party GitHub docs also break onboarding into account setup, local tools, collaboration, automation, and secure building, and explain how local repositories connect to GitHub. ([GitHub account onboarding](https://docs.github.com/en/get-started/onboarding/getting-started-with-your-github-account))

**Borrow for Code Arena:** phrase each practical activity as a small, verifiable task in the learner's own project branch. For example: “Trace how a submitted answer reaches the judge,” then “in your project, identify or create the matching boundary,” followed by a test or runtime check. Show the repository location and completion signal before the learner leaves the course page. Keep a resettable practice branch or a clearly described safe starting point so the activity cannot accidentally disturb a teammate's work.

**Limit:** GitHub Skills teaches a narrow set of GitHub tasks. Its flow is a useful delivery pattern, but it cannot supply Code Arena's domain map by itself.

### 4. freeCodeCamp: best model for changing activity as a learner advances

The freeCodeCamp curriculum guide describes a sequence of content types: short theory lessons, workshops for guided practice, labs for problem-solving and project building, review pages that collect a module's concepts, and quizzes before moving on. The guide also treats those content types as separate curriculum components with their own tools and style rules. ([Curriculum challenge guide](https://contribute.freecodecamp.org/how-to-work-on-coding-challenges/))

**Borrow for Code Arena:** use a predictable lesson rhythm while varying how much support remains: orient and explain; trace a small code path together; practice with a new example; complete one independent transfer task; review the key ideas; check understanding. A whole lesson does not need to be a long article or a quiz. Keep one primary action visible at a time.

### 5. Frontend Mentor: best model for independent builds with open choices

Frontend Mentor's challenge guide describes filters for difficulty and challenge format, a challenge brief, an in-progress dashboard, and a four-step route from starting through submission, improvement, and review. Its submission guide asks learners what they are proud of, what they would change, what challenges they met, and what help they want. ([Starting a Challenge](https://www.frontendmentor.io/guides/how-to-start-a-challenge), [Submitting Solutions](https://www.frontendmentor.io/guides/how-to-submit-solutions))

The same guide shows a concrete package layout for its Product Challenges: `spec/` holds the requirements, `guidance/` holds visual and accessibility guidance, `data/` holds sample data, and `starter/` holds starter CSS. That separation makes it easier to tell what the learner must build from the examples and styling help they can use. ([Starting a Challenge](https://www.frontendmentor.io/guides/how-to-start-a-challenge))

Its FAQ says there is no official solution because challenges can be implemented in more than one way; it invites learners to compare community code and asks them to request focused feedback. ([Frontend Mentor FAQ](https://www.frontendmentor.io/faqs))

**Borrow for Code Arena:** state required behavior separately from implementation choices. Give a short rubric and explicit checks, then ask the learner to explain their directory, module, and pattern choices in a retrospective. Show examples of different approaches only after the learner has tried, and label their trade-offs rather than presenting one as copy-ready canonical code. For each task, show the reference path in the teammate repo, the suggested path in the learner project, whether to create or edit a file, the local pattern to follow, and the check to run. If the learner project uses a different structure, explain how to find its matching place instead of insisting on one folder name.

### 6. Khan Academy: useful accessibility patterns to verify in our own UI

Khan Academy's help center documents user controls for content that relies on visual presentation, reduced motion, video captions, and color treatment. The article says its visually independent option prioritizes material for learners using screen readers such as NVDA, JAWS, or VoiceOver. ([Accessibility settings](https://support.khanacademy.org/hc/en-us/articles/360015623271-Khan-Academy-s-accessibility-settings))

**Borrow for Code Arena:** make the course usable with keyboard and assistive technology, preserve text explanations for diagrams and source maps, and respect reduced-motion preferences. The help article describes available settings; it does not demonstrate that Khan Academy or this project passes an independent accessibility audit. Use WCAG 2.2 as the verification baseline, including keyboard operation, visible focus, and descriptive headings and labels. ([WCAG 2.2](https://www.w3.org/TR/WCAG22/))

## What to combine in the Code Arena learning platform

The best fit is a combination of these patterns, not a full copy of one product:

1. **Start with an orientation map.** Show the finished destination, the sequence, and why each early step unlocks the next. Use a simple dependency view like Exercism's concept tree and an ordered route like The Odin Project's paths.
2. **Keep each lesson tied to a visible behavior.** State what the player does, what the system decides, and what the lesson will let the learner explain. Use short steps with one main action at a time.
3. **Separate the two repositories in the instructions.** Label reference paths as “read this in the teammate repo.” Label learner paths as “create or change this in your project.” For each target file, explain its job, the local pattern to follow, and the test or runtime check that shows the behavior works.
4. **Teach the route through the code, not a detached solution.** Ask the learner to follow a user action across the current game's UI, service, data, and test boundaries. Then ask them to map equivalent responsibilities into their own game before they write code.
5. **Make the independent task open-ended but testable.** Give behavior requirements, inputs and outcomes, boundaries to preserve, and checks. Let the learner choose names, file boundaries, and implementation details in their own project. Ask them to explain those decisions afterward.
6. **Show assistance only when needed.** Offer small hints that point to a concept, path, or question. Put complete explanations and alternatives after the learner has tried. Keep tests close to the task and say exactly what their result proves.
7. **Keep navigation predictable and accessible.** Always show the learner where they are, what prerequisite they have completed, what comes next, and a route back to the map. Verify keyboard access, focus visibility, text alternatives, and reduced motion.

This synthesis is a design recommendation from documented product patterns. It is not evidence that any of these patterns will improve outcomes for this particular learner; a short usability session with the actual course is still the way to find confusing steps.

## Compliance and scope note

Repository instructions and `prototype/game-ui/42-subject-compliance.md` were reviewed. The matrix says course content and focused course tests do not change a subject-module claim. This comparative note describes learning-platform patterns and proposed course UX; it changes no game scope, requirement evidence, assumptions about implementation, or module status. No row in the compliance matrix was changed, and this report is not evidence that a 42 subject requirement is met.

## Sources

- The Odin Project: [All Paths](https://www.theodinproject.com/paths); [How This Course Will Work](https://www.theodinproject.com/lessons/foundations-how-this-course-will-work); [Node.js: Getting Started](https://www.theodinproject.com/lessons/nodejs-getting-started); [Foundations: Landing Page](https://www.theodinproject.com/lessons/foundations-landing-page); [Foundations: Recipes](https://www.theodinproject.com/lessons/foundations-recipes).
- Exercism: [Building Tracks](https://exercism.org/docs/building/tracks); [Syllabus](https://exercism.org/docs/building/tracks/syllabus); [Practice Exercises](https://exercism.org/docs/building/tracks/practice-exercises); [Presentation](https://exercism.org/docs/building/tracks/presentation); [Getting Started](https://exercism.org/docs/using/getting-started); [Test Runners](https://exercism.org/docs/building/tooling/test-runners).
- GitHub Skills and GitHub Docs: [GitHub Skills overview](https://github.com/SKILLS); [Introduction to GitHub exercise](https://github.com/skills/introduction-to-github); [Getting started with your GitHub account](https://docs.github.com/en/get-started/onboarding/getting-started-with-your-github-account).
- freeCodeCamp: [How to work on coding challenges](https://contribute.freecodecamp.org/how-to-work-on-coding-challenges/).
- Frontend Mentor: [Starting a Challenge](https://www.frontendmentor.io/guides/how-to-start-a-challenge); [Complete Guide to Submitting Solutions](https://www.frontendmentor.io/guides/how-to-submit-solutions); [FAQs](https://www.frontendmentor.io/faqs).
- Khan Academy: [Accessibility settings](https://support.khanacademy.org/hc/en-us/articles/360015623271-Khan-Academy-s-accessibility-settings).
- W3C: [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/).
