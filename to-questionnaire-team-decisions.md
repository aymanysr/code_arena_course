# ft_transcendence Team Architecture & Game Vote

**Purpose:** Lock a team vote on the 8 core decisions (game, theme, topology, frontend, auth, media, qa-service, module scope) so alignment is settled before any spec is written.

**From:** Project Team Member — **To:** 3 teammates (unequal stack expertise — your comfort votes weight the stack picks) — **How your answers will be used:** Votes are recorded as resolutions in `.scratch/ft-transcendence-wayfinder/` (map + issues). No code or scaffolding comes out of this — `/to-spec` happens after the map clears.

---

## Context

We have 4 members and need **14 mandatory points** (aiming for **17 points** to have a 3-point safety buffer, with an absolute subject cap at 19). We reviewed the initial 8-microservice blueprint and campus hardware constraints (memory quotas and the 5-minute live defense code drill). We need to cast our 8 votes below so we can write the spec without second-guessing.

## How to answer

* **Effort:** ~10–15 minutes for all 9 questions (Q0 first — it weights the stack picks).
* **Deadline:** none — answer when free. Partial answers and "I don't know" count; flag unsure instead of skipping.
* **Format:** vote with Discord reactions (🅰️ / 🅱️ / 🅲) or reply with your letter per question number (e.g. `Q1: A — Pong, because…`). One-line reason per vote helps break ties.

---

## About you (weights the stack votes)

### 0. What is your comfort level per stack area?
_Why this matters: expertise is unequal — comfort votes decide React vs Vue and how we split the 4-way commit balance._

Rate each 1–3 (1 = never used, 2 = shipped something, 3 = confident reviewer): React / Vue / Next.js / NestJS / Docker Compose / WebSockets.

> Answer (e.g. React 3, Vue 1, Next 1, NestJS 2, Compose 2, WS 2 + hours/week available):

---

## Game & Creative Direction

### 1. Which core game should we build?
_Why this matters: It anchors our WebSocket loop, tournament brackets, and evaluator expectations._

* **🅰️ 2D Pong with Modifiers:** The canonical 42 game. Predictable 60 Hz server tick, easiest tournament brackets, zero evaluator confusion.
* **🅱️ Competitive Speed Chess:** Discrete turn-based moves. Eliminates 60 Hz physics jitter and Wi-Fi ball desync, but board AI is harder to code and defend.
* **🅲 Fast-Paced Multiplayer Trivia / Quiz Arena:** 3+ players native room play, live buzzers, highly interactive to demo.

> Answer: 

---

### 2. What visual theme & universe should the game have?
_Why this matters: Chapter VIII evaluators want to see custom work by students with unique identity, not generic templates._

* **🅰️ Cyberpunk / Retro Synthwave Arcade:** Neon glow, CRT scanlines, customizable paddle skins, energetic synth sound/feel.
* **🅱️ Clean Neo-Brutalist / Minimalist Swiss:** Monochrome, high-contrast typography, strict layout, dark/light mode toggle.
* **🅲 42 School Campus Lore:** 42-themed easter eggs, cluster maps, intra-style dark UI.
* Or propose your own in one line (free text beats forcing A/B/C).

> Answer: 

---

## Architecture & Infrastructure

### 3. How should our backend services be structured?
_Why this matters: An 8-service setup runs 14 containers (~3GB RAM) and risks OOM crashes on campus iMacs during defense. A 3-service setup keeps the 2-point Microservices score while booting in seconds._

* **🅰️ Grouped 3-Service Microservices:** `core-service` (Users, Auth, Avatars), `game-service` (Pong, Tournaments, Bots), `chat-service` (Chat, DMs, Alerts). Full 2-point Microservices module, 6 containers total, fast cold-start.
* **🅱️ Full 8-Service Topology:** 8 individual NestJS containers (from the initial `miw-omega` diagram). High enterprise isolation, but high memory and build-time risk during evaluation.
* **🅲 Modular Monolith:** 1 unified NestJS backend. Zero network latency, easiest defense, but forfeits the 2-point Microservices module (must compensate with 3D or Blockchain).

> Answer: 

---

### 4. Which frontend framework and routing model?
_Why this matters: Evaluators test a live code change in minutes during defense; instant Hot Module Replacement (HMR) is critical._

* **🅰️ React + Vite + TypeScript + Tailwind CSS:** Pure Single-Page Application (SPA). Near-instant hot reload, simple WebSocket management, no SSR hydration bugs.
* **🅱️ Next.js (Full-Stack / SSR):** Server-side rendering, but subject warns SSR can conflict with certain modules and live WebSocket state.
* **🅲 Vue 3 + Vite + Tailwind CSS:** Lightweight and clean reactivity, if team prefers Vue over React.

> Answer: 

---

### 5. How should services verify user identity?
_Why this matters: Synchronous internal auth calls on every WebSocket move or chat message cause severe latency and single-point-of-failure bottlenecks._

* **🅰️ Stateless JWT Verification:** `user-service` signs JWTs. Nginx and microservices verify the token signature locally with zero network calls.
* **🅱️ Centralized Internal Auth RPC:** Downstream services make an internal HTTP/RPC request to `user-service` on every incoming packet.

> Answer: 

---

### 6. Where should uploaded avatars and attachments be stored?
_Why this matters: Running a MinIO container consumes ~150–200 MB extra RAM on memory-constrained campus machines._

* **🅰️ Shared Docker Volume + Nginx Static Serving:** Files saved to disk, Nginx serves `/uploads/` directly. Zero extra container memory overhead.
* **🅱️ Dedicated MinIO S3 Object Storage Container:** Emulates AWS S3 APIs, but adds another persistent container.

> Answer: 

---

## Scope & Catalogue Management

### 7. What should we do with `qa-service` (Q&A / Forum)?
_Why this matters: Subject v21.2 has no Q&A module. Keeping it as a separate forum requires defending it as a custom Module of Choice under strict scrutiny._

* **🅰️ Drop it and focus on the Core 17 Points:** Zero deadweight overhead. All team energy goes into a polished game, chat, and tournaments.
* **🅱️ Rebrand as a Second Game: Multiplayer Quiz (Major: 2 pts):** Turn it into an official catalogue module ("Add another game with history and matchmaking").
* **🅲 Keep as Module of Choice (Major: 2 pts):** Defend a full StackOverflow-style code forum in our README.

> Answer: 

---

### 8. Do you approve the recommended 17-point module package?
_Why this matters: locks scope — but read the ⚠️ first: research found this list miscounts (OAuth and 2FA are Majors not Minors, Tournament has no Minor, WebSockets/GameEngine Majors don't exist in the subject, AI bot is missing). A corrected tally scores ~13–14, so this vote is "approve direction, fix numbers" not "approve exact points"._

* **Package as proposed:**
  * Backend Framework (2) + Frontend Framework (1) + PostgreSQL (1) + WebSockets (2) = **6 pts**
  * Microservices Architecture (2) = **2 pts**
  * Standard User Mgmt (2) + 42 OAuth (1) + 2FA TOTP (1) = **4 pts**
  * Web Game (2) + Remote 1v1 (2) + Tournament System (1) = **5 pts**
  * **Total: Exactly 17 Points**
* **🅰️ Yes, approve direction + fix the point values**
* **🅱️ Modify the scope (state what you want to swap — e.g. add AI bot Major 2, Live Chat Major 2, drop a phantom):**

> Answer: 

---

## Anything else?

Any specific technical preference, tool, or constraint you want the team to commit to before we scaffold?

> 

