# AI Development Log — CollabBoard

**Purpose:** Document AI agent architecture, pre-search decisions, implementations tried, and outcomes for the CollabBoard collaborative whiteboard (G4 Week 1 submission).

---

## 1. Goals & constraints (from requirements and pre-search)

- **Requirements (G4):** 6+ distinct AI commands (Creation, Manipulation, Layout, Complex); tool schema including `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `getBoardState`; shared AI state (all users see results in real time); **response &lt;2s** for simple commands; multi-step execution for templates.
- **Pre-search:** Claude 4.5 Sonnet for multi-step reasoning and tool-calling; &lt;2s latency target; serverless backend; API key kept server-side.
- **PRD:** Supabase Edge Function as AI proxy; JWT validation before calling Claude; 13 tools; templates: SWOT, user journey map, retrospective; domain-appropriate labels (e.g. Strengths/Weaknesses, Awareness/Consideration).

---

## 2. Architecture (current)

| Layer | Role |
|-------|------|
| **Client** | `src/ai/claudeAgent.ts`: `runAICommand(userMessage, currentObjects, boardId)`. Refreshes session, sends JWT + payload to Edge Function. Heuristic (creation/complex/object-ref) decides whether to send full `currentObjects` or `[]` to reduce payload. |
| **Client policy (mirror)** | `src/ai/aiCommandPolicy.ts`: `getAiCommandPolicy(message)` — same regex heuristics as edge for tests and consistency; mode `simple` \| `compound` \| `complex`, `allowGetBoardState`, `forcedToolName`. |
| **Edge Function** | `supabase/functions/ai-command/index.ts`: Validates JWT, reads `userMessage`, `currentObjects`, `boardId`; calls `getPolicyForMessage(userMessage)` from `policy.ts`; builds tool list; single model per request (Haiku or Sonnet); runs Claude loop with sequential tool execution; compound tool handlers execute all Supabase inserts server-side; returns `{ text }` or error. |
| **Edge policy** | `supabase/functions/ai-command/policy.ts`: `getPolicyForMessage(userMessage)` → `AiPolicy`: `modelTier` ('fast'\|'smart'), `maxTurns`, `maxTokens`, `allowGetBoardState`, `forcedToolName`, `returnAfterToolExecution`. Three tiers: simple creation → fast/Haiku; compound templates → smart/Sonnet, 1 turn, forced tool; ops/complex → smart/Sonnet, 3–8 turns, getBoardState allowed. |

**Tools (edge):** `getBoardState`, `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `createText`, `moveObject`, `resizeObject`, `rotateObject`, `updateText`, `changeColor`, `deleteObject`, `arrangeInGrid`, **`createQuadrant`**, **`createColumnLayout`**, **`clearBoard`**, **`createBulkObjects`**, **`createFlowchart`**, **`batchModify`**.

**Models:** Simple path → `claude-haiku-4-5-20251001` (env `ANTHROPIC_MODEL_SIMPLE`); compound + complex path → `claude-sonnet-4-20250514` (env `ANTHROPIC_MODEL_COMPLEX`).

---

## 3. Implementations tried

### 3.1 Initial setup

- Single model (Sonnet), full tool set, system prompt: "Call getBoardState first, then execute changes."
- Client sent full board state in request body; edge inlined it in the first user message.
- **Result:** Simple commands (e.g. "Add a blue sticky") took ~6–10s+; complex (SWOT, journey map) ~14–29s. Target &lt;2s for simple commands was missed.

### 3.2 Latency diagnosis

- Supabase logs showed delay was **server-side** (e.g. `execution_time_ms` ~10.8s), not only cold start.
- Cause: multiple Claude round-trips — model often called `getBoardState` first, then tools, then an extra "narration" turn after tool execution.

### 3.3 Simple-command optimization (shipped)

- **Policy:** Classify by message (creation/ops vs template/complex). Simple commands use:
  - `maxTurns: 1`
  - No `getBoardState` in tool list (`allowGetBoardState: false`)
  - `returnAfterToolExecution: true` — edge returns immediately after running tools (no extra Claude turn).
- **Model routing:** Simple → Haiku, complex → Sonnet.
- **System prompt:** "If the request is simple, make the change in a single tool call. Only call getBoardState if the board state is missing or you need to disambiguate."
- **Result:** Simple commands (e.g. "Add a blue sticky-note") ~1.7–2s, meeting G4 &lt;2s.

### 3.4 Complex-command optimization — Option 2 (tried and reverted)

- **Idea:** When client sends non-empty `currentObjects`, omit `getBoardState` from the tool list to avoid a redundant round-trip.
- **Result:** Latency improved but **template output regressed**: e.g. "Create a SWOT analysis template" produced four separate sticky-style cards instead of the expected single grouped template. Without `getBoardState`, the model did not produce the correct layout.
- **Decision:** Reverted. For template-style commands, `getBoardState` is required for correct structure.

### 3.5 Other complex-command ideas (not shipped)

- **Option 1:** Prompt line asking Claude to output all template tool calls in a single response.
- **Option 3:** Run independent create tools in parallel with an ordering barrier.
- Both tried in combination with Option 2; latency and/or correctness regressed, so all reverted.

### 3.6 Client payload behavior

- Client sends full or minimal `currentObjects` by command type (creation/complex/object-ref). Edge inlines whatever is sent; policy controls whether `getBoardState` is *available* as a tool.

### 3.7 Ops path regression (identified and fixed)

- **Problem discovered in testing:** Manipulation commands ("move the sticky", "change color", "resize") were classified as "simple" — Haiku, 1 turn, no `getBoardState`. They failed because Claude had no object IDs to act on, and responded with clarifying questions instead of executing tools.
- **Root cause:** The ops bucket (`move|delete|resize|rotate|change|update`) was placed on the simple path, which assumes Claude doesn't need to look up existing objects. This assumption is wrong — all manipulation commands require knowing which object ID to target.
- **Fix:** Moved ops to a new **complex/ops path**: Sonnet, 3 turns, `getBoardState` allowed, no forced tool. This allows Claude to call `getBoardState`, identify the target object, and execute the mutation in one flow.

### 3.8 Compound Tool Strategy (shipped — primary complex-command solution)

- **Problem:** Template commands (SWOT, retro board, journey map) required 7+ sequential Claude tool calls, each a full LLM round-trip (~2s each), totalling 13–29s. The `maxTurns: 8` limit also caused partial output for "clear the board" style commands.
- **Approach:** Move layout logic **server-side** into single atomic compound tools. Claude makes one LLM call to decide *what* to build; the edge function handles all element creation and positioning internally via sequential Supabase inserts.
- **Three compound tools added:**

| Tool | Replaces | Elements created per call |
|------|----------|--------------------------|
| `createQuadrant` | 7+ calls for SWOT / 2×2 matrix | Outer frame + 4 inner frames (colored headers) + sticky notes |
| `createColumnLayout` | 5+ calls for retro / kanban / journey map | Outer frame + N inner frames (colored headers) + sticky notes |
| `clearBoard` | N sequential deleteObject calls | Deletes all board objects in one query |

- **Layout approach — nested frames:** Each quadrant/column is a `frame` type object nested inside the outer frame (`parent_id = outer_frame.id`). The canvas (`BoardObjects.tsx`) automatically renders the colored header bar + dashed border for each frame, matching the visual style users expect. Stickies are grandchildren (`parent_id = inner_frame.id`), rendered correctly at 3 levels deep.
- **Policy tier added:** Compound commands detected by keyword before the generic complex check:
  - `clear|wipe|reset|delete all` → `clearBoard`, Sonnet, 1 turn, no `getBoardState`, return after tools
  - `swot|quadrant|2x2` → `createQuadrant`, Sonnet, 1 turn, no `getBoardState`, return after tools
  - `retro|kanban|journey map` → `createColumnLayout`, Sonnet, 1 turn, no `getBoardState`, return after tools
- **Result:** Complex templates complete in ~2–3s (single LLM call) vs 13–29s previously. All users see elements appear together via Supabase Realtime. Minimum frame height (380px) ensures visual usability even with no content items specified.

### 3.9 getBoardState context cap (shipped)

- **Problem:** At 500+ objects, `getBoardState` would return everything — slow query, large JSON, potentially exceeding Claude's useful context window.
- **Fix:** If object count > 200, return only `frame` type objects + a summary count string. Structural objects (frames) give Claude enough layout context for most operations without sending every sticky note.

### 3.10 System prompt — agent behavior fix (shipped)

- **Problem:** Claude was behaving like a chatbot for manipulation commands, responding with questions like "What is the rectangle's ID and what dimensions do you want?" instead of calling `getBoardState` and acting directly.
- **Fix:** Added explicit "CRITICAL RULES" block to the system prompt:
  - "Never ask the user for object IDs, coordinates, dimensions, or any other values."
  - "If the inline board state is empty but the command operates on existing objects, call `getBoardState` first."
  - "When size or position is not specified, make a reasonable choice."

### 3.12 Bulk creation — `createBulkObjects` compound tool (shipped)

- **Problem:** Asking the AI to "create 50 sticky notes" (or any bulk creation of any object type) would hit the Anthropic 30,000 input-token-per-minute rate limit. Root causes were two-fold:
  1. All creation commands matched `isCreationCommand` in `claudeAgent.ts`, so the full board state (potentially thousands of tokens) was sent even when unnecessary.
  2. `forcedToolName: 'createStickyNote'` (singular tool) meant Claude created 1 object and stopped. The user would retry, each retry a fresh full LLM call — multiple rapid retries together exceeded the per-minute token cap.
- **Approach:** Same compound tool pattern as `createQuadrant`/`createColumnLayout`. Claude provides intent (objectType, count, optional items/topic/layout); the Edge Function computes all coordinates and executes a **single batch `supabase.from(TABLE).insert([...rows])`** — one DB round-trip regardless of N.
- **New tool `createBulkObjects`:** Covers all object types (sticky, rect, circle, frame, text). Accepts `count` (max 500), `items` (optional text per object), `topic` (auto-labels as "topic 1", "topic 2"), `color`, `layout` (grid or scattered), `startX/Y`. Grid layout uses `columns = ceil(sqrt(count))` to produce a square-ish arrangement.
- **Policy:** New `BULK_QUANTITY_RE` + `BULK_OBJECT_TYPE_RE` detects bulk intent (digit ≥ 3 or number word + object type word). Checked **before** the simple creation branch so "create 50 stickies" never falls into the singular forced-tool path. Routes to Haiku, 1 turn, no board state, `returnAfterToolExecution: true`.
- **Board state stripping:** `isBulkCreation` flag in `claudeAgent.ts` sets `objectsToSend = []` for bulk commands only. All other creation paths (including "create a sticky next to the blue frame") still send board state — the strip is scoped precisely to the bulk path.
- **Plural handling:** `BULK_OBJECT_TYPE_RE` uses `rectangles?`, `circles?`, `squares?` etc. to match both singular and plural object type words.
- **Result (measured):**

| Request | Time | Objects created | LLM calls | Input tokens |
|---|---|---|---|---|
| Add 20 rectangles | 1.28s | 20 | 1 | ~2,390 |
| Create 50 sticky notes | 2.47s | 50 | 1 | ~2,400 |
| Create 500 sticky notes | 1.50s | 500 | 1 | ~2,400 |

500 objects in 1.50s with a single batch insert — zero rate-limit risk (~12 bulk requests/minute headroom at 30k token cap).

### 3.13 Clean user-facing response text — `getFriendlySummary` (shipped)

- **Problem:** The `returnAfterToolExecution` path joined raw tool result strings directly into the response shown to users: "Created rect with id edaf3133-79c0-476d-a227-a7fd264c6c3f Created rect with id c0eaa2dd-..." — internal UUIDs leaking into the UI.
- **Root cause:** Tool handlers return UUID-bearing strings (e.g. `"Created sticky note with id ${id}"`) so Claude can reference objects by ID in subsequent multi-turn steps. This is correct for multi-turn paths but wrong for the final user-facing response.
- **Fix:** Added `getFriendlySummary(toolName, input, rawResult)` helper in `index.ts`. Called only in the `returnAfterToolExecution` branch — the raw UUID strings are still used as tool results passed back to Claude in multi-turn paths. Clean messages:
  - `createStickyNote` → `Added sticky note: "your text here"`
  - `createShape` → `Rect created` / `Circle created`
  - `createFrame` → `Frame "Sprint" created`
  - `createText` → `Text added: "..."`
  - Compound tools → pass through their already-clean summary strings
  - Default fallback → UUID regex strip on any unhandled tool

### 3.14 Board query commands — `isQueryCommand` (shipped)

- **Problem:** After creating 500 sticky notes, asking "How many objects are there in the board?" returned "0 objects — the board is currently empty." The query matched none of the client routing regexes (`isCreationCommand`, `isObjectRefCommand`, `isComplexCommand`), so `objectsToSend = []`. Claude trusted the empty inline board state and answered without calling `getBoardState`.
- **Fix (Part 1 — client):** Added `isQueryCommand` in `claudeAgent.ts`: matches when message contains a query-intent word (`how many`, `count`, `list`, `what`, `describe`, `show me`, `tell me`) AND an object-type word (`objects?`, `sticky`, `frame`, `board`, `canvas`, etc.). When matched, `objectsToSend = currentObjects` — board state is sent so Claude has real data or recognises a mismatch and calls `getBoardState`.
- **Fix (Part 2 — system prompt):** Added safety-net rule: "If the user is asking about existing objects (counting, listing, describing) and the inline board state is empty, always call `getBoardState` first before answering." Handles cases where the client regex misses a query variant.
- **Result:** "How many objects are there in the board?" with 500 objects on canvas → correct count answer in 5.73s (includes `getBoardState` round-trip; `BOARD_STATE_OBJECT_CAP` returns frame summary only for large boards).

- **Problem:** Commands like "space elements evenly" weren't sending `currentObjects` to the edge function because "space" wasn't in the client's `isComplexCommand` regex. Claude received `"Current board state: []"` and concluded the board was empty.
- **Fix:** Added `space|align|distribute|kanban` to `isComplexCommand`; broadened `isObjectRefCommand` to capture `resize|rotate|rename|change|update|color`. Both ensure the full board state is included in the request for any command that needs to operate on existing objects.

### 3.15 `createFlowchart` compound tool (shipped)

- **Problem:** Asking "Create a flowchart for user onboarding" routed to the generic complex path — multiple Claude turns, slow, and produced inconsistent results. Flowcharts have a predictable vertical-stack structure: one LLM call to decide the steps, then server-side layout.
- **Approach:** New `createFlowchart` compound tool. Claude provides a `title` and `steps` array (each with `label` and optional `type`: `start` | `process` | `decision` | `end`). Edge function computes all positions and batch-inserts: one outer `frame`, N colored `rect` nodes inside it, and N-1 `connector` objects linking consecutive nodes.
- **Node color encoding:** `start` → green (`#86efac`), `process` → blue (`#93c5fd`), `decision` → yellow (`#fde68a`), `end` → red (`#fca5a5`). Node type defaults: first step → `start`, last step → `end`, all others → `process`.
- **Detection regex:** `FLOWCHART_RE = /\b(flowchart|flow[\s-]chart|flow[\s-]diagram|process[\s-]flow)\b/i` — covers "flowchart", "flow chart", "flow diagram", "process flow".
- **Policy:** Sonnet, 1 turn, no `getBoardState`, `returnAfterToolExecution: true`. Checked before the generic complex path in both `policy.ts` and `aiCommandPolicy.ts`.
- **Result:** Flowchart for 6 steps completes in ~2–3s (same tier as SWOT/retro). All nodes and connectors appear simultaneously via Supabase Realtime.

### 3.16 `batchModify` tool for bulk mutations (shipped)

- **Problem:** Commands like "move all pink stickies to the left" or "delete all blue rectangles" required Claude to loop `moveObject` / `deleteObject` individually — one LLM tool call + one DB write per object, causing both latency and `maxTurns` exhaustion for boards with many matching objects.
- **Approach:** New `batchModify` tool. Accepts `objectIds` (array), `action` (`update` | `delete`), and an `updates` map. For `delete`: single `supabase.from(TABLE).delete().in('id', ids)` — one DB round-trip regardless of N. For `update`: single `supabase.from(TABLE).update(fields).in('id', ids)`.
- **Usage pattern:** Claude first calls `getBoardState` to collect matching IDs, then calls `batchModify` once. Tool description explicitly instructs "Never loop individual move/delete/changeColor calls for batch operations."
- **Placement cache sync:** After a `batchModify delete`, the `placementObjects` array is updated in-memory to remove deleted IDs so subsequent placement calls in the same request remain accurate.
- **Result:** "Delete all blue rectangles" (50 objects) — one `getBoardState` call + one `batchModify delete` call vs. 50 individual `deleteObject` calls. All deletions reflected atomically via Realtime.

### 3.17 Server-side placement engine — `placement.ts` (shipped)

- **Problem:** Objects created by AI commands were placed at fixed coordinates (e.g. `x: 100, y: 100`) regardless of what was already on the board — new stickies appeared on top of existing content.
- **Approach:** New `supabase/functions/ai-command/placement.ts` module with pure placement math:
  - `resolvePlacement(candidate, objects, viewport)` — single-object placement: returns candidate position if clear; tries center of viewport, right-third, bottom-third; falls back to 12px grid scan; finally places outside the existing cluster.
  - `resolveBulkPlacement(startX, startY, layoutW, layoutH, objects, viewport)` — layout-box placement for compound tools: same strategy but operates on the full bounding box of a template, so the whole SWOT / retro / flowchart lands without overlap.
  - `doesRectOverlapAny` — AABB overlap check with configurable padding.
  - `findEmptyPositionOutsideCluster` — fallback that places to the right of the existing cluster bounding box.
- **Integration:** All creation tools (`createStickyNote`, `createShape`, `createFrame`, `createText`, `createConnector`, `createBulkObjects`, `createQuadrant`, `createColumnLayout`, `createFlowchart`) now call `resolvePlacement` or `resolveBulkPlacement` before inserting. The `placementObjects` array is updated after each tool execution so subsequent tools in the same multi-turn request don't overlap each other either.
- **Lazy DB load:** If `placementObjects` is empty when a placement-aware tool runs, the edge function fetches the board's bounding boxes from Supabase (`id,x,y,width,height`, capped at 200 rows) rather than requiring the client to send them in every request.

### 3.18 Viewport bounds pass-through + `createdCenter` response (shipped)

- **Viewport bounds:** Client (`claudeAgent.ts`) now includes `viewport.bounds` (`x, y, width, height`) in the request body when provided. `runAICommand` accepts a fourth optional `viewport` argument. Edge function uses `viewportBounds` as the first candidate region in `resolvePlacement` / `resolveBulkPlacement`, so new objects land inside the user's visible area when possible.
- **`createdCenter` in response:** Edge function now returns `createdCenter: { x, y }` — the center point of the created object or template — alongside `text`. `RunAIResult` type extended to include `createdCenter?: { x, y }`. The canvas (`BoardPage.tsx`) can use this to pan/zoom to the newly created content so users don't have to hunt for what the AI just made.
- **Implementation detail:** `lastCreatedCenter` is tracked across tool turns; all creation tool helpers return `{ content, createdCenter }` alongside their result string. Final response (both `returnAfterToolExecution` and multi-turn) includes the last non-null `createdCenter`.

### 3.19 Selective session refresh — avoid redundant Auth round-trips (shipped)

- **Problem:** `runAICommand` called `supabase.auth.refreshSession()` unconditionally before every AI command. A session token is valid for 3600s; forcing a refresh on every command added ~100–200ms of Auth latency and an unnecessary network round-trip.
- **Fix:** Check `session.expires_at` before deciding to refresh. If the token expires more than 60 seconds from now, reuse it directly. Only call `refreshSession()` when the token is close to expiry or missing. A 401 retry loop (already present) handles the edge case where the token expires mid-flight.
- **Result:** Typically saves one Auth network call per AI command. On simple creation commands (~1.5–2s total) this is a measurable fraction of the round-trip.

### 3.20 `boardStateForPlacementOnly` flag — reduce prompt tokens for creation (shipped)

- **Problem:** Simple creation commands (e.g. "Add a blue sticky note") were sending the full `currentObjects` array in the Claude prompt, even though Claude only needs `x/y` for placement — it doesn't need to know about existing objects to create a single new one. For boards with hundreds of objects this added significant input tokens and latency.
- **Fix:** Added `boardStateForPlacementOnly: true` flag in the request body for two paths:
  1. `isSimpleCreation` — single-object creation commands.
  2. `isBulkCreation` — bulk creation commands.
  When true, the edge function uses `currentObjects` only for `placementObjects` (overlap avoidance), but sets `objectsForPrompt = []` so the Claude prompt receives `"Current board state: []"`. The full board state never enters the Anthropic API call.
- **Result:** Simple creation commands on large boards: prompt tokens drop from ~10k+ to ~400 (just the system prompt + user message). No correctness regression — placement still avoids overlap, and forced tool names mean Claude doesn't need board context to decide which tool to call.

### 3.21 Compound tool batch inserts — eliminate sequential awaits (shipped)

- **Problem:** `executeCreateQuadrant` and `executeCreateColumnLayout` called `await supabase.from(TABLE).insert(...)` once per element (outer frame + inner frames + stickies) — up to 13 sequential DB round-trips for a SWOT template. Each await added ~30–80ms.
- **Fix:** Refactored all compound tools (`createQuadrant`, `createColumnLayout`, `createFlowchart`) to collect all row objects into a local `rows[]` array first, then execute a single `supabase.from(TABLE).insert(rows)` at the end. The `placementAdds` array accumulates bounding boxes for the placement engine so relative positioning inside the compound layout remains correct.
- **Result:** SWOT template: 13 DB writes → 1 batch insert. Column layout with 3 columns + 9 stickies: 13 DB writes → 1 batch insert. Reduces per-template server time by ~400–800ms.

### 3.22 Creation grid path — new policy tier (shipped)

- **Problem:** "Create a 2×3 grid of sticky notes for pros and cons" had no matching tier. It contains `CREATION_RE` + `\bgrid\b`, so it fell into the generic complex path (Sonnet, 8 turns, `getBoardState` allowed) — overkill for a structured creation request that doesn't need to inspect existing objects.
- **Fix:** New `isCreationGrid` tier: `CREATION_RE.test(msg) && /\bgrid\b/i.test(msg)`. Returns Sonnet, **2 turns**, no `getBoardState`, `returnAfterToolExecution: true`. Two turns (rather than 1) lets Claude optionally call a creation tool and then a placement tool if needed, without the overhead of 8 turns.
- **Distinction from "arrange in a grid":** "Arrange the objects in a grid" contains `\bgrid\b` but not `CREATION_RE`, so it falls through to `looksComplex` (which tests `ARRANGE_RE`) and gets the full ops/complex path with `getBoardState`.
- **Tests added:** 3 new test cases in both `aiCommandPolicy.test.ts` and `aiEdgePolicy.test.ts` asserting the correct tier for creation-grid commands and confirming the non-creation "arrange" variant is not misclassified.

### 3.23 Ops path `returnAfterToolExecution: true` (shipped)

- **Previous behavior:** Ops path (`move`, `resize`, `change color`, etc.) had `returnAfterToolExecution: false` — after Claude executed the mutation tool, a final Claude turn was triggered to narrate the result (e.g. "I've moved the sticky note to (200, 300)."). This added a full Anthropic API round-trip (~1–2s) just for narration text the user doesn't need.
- **Fix:** Changed ops policy to `returnAfterToolExecution: true`. The edge function now returns immediately after the mutation tools execute, using `getFriendlySummary` to produce clean text (e.g. "Moved"). The narration turn is eliminated.
- **Edge case handled:** The `returnAfterToolExecution` early-exit guard already checks `executedOnlyLookups` — if Claude calls `getBoardState` first, the loop continues (doesn't exit early on a lookup-only turn). This means the flow is: `getBoardState` → continue → mutation tool → exit with friendly summary.
- **Result:** Ops commands (e.g. "Move the sticky note right") drop from ~4–5s to ~3–4s by eliminating the narration turn.

### 3.24 `CLEAR_RE` narrowing — prevent false positives (shipped)

- **Problem:** The previous `CLEAR_RE` included `\breset\b` as a bare word. This matched "reset my password", "reset the selection", or any other "reset X" phrase, incorrectly routing those commands to `clearBoard` (which deletes all board objects).
- **Fix:** Removed bare `\breset\b`. Replaced with `\breset\s+(?:the\s+)?(?:board|canvas)\b` — requires "reset" to be immediately followed by "board" or "canvas" (with optional "the"). "Clear the board", "wipe the board", "start fresh", "delete all", "erase all" patterns are unaffected.
- **Both files updated in sync:** `policy.ts` (edge) and `aiCommandPolicy.ts` (client mirror) — the fix was applied identically to both.

---

## 4. Current behavior summary

| Command type | Model | Turns | getBoardState | Return after tools | Typical latency |
|--------------|-------|--------|----------------|--------------------|-----------------|
| Simple (add 1 sticky, shape, frame, text) | Haiku | 1 | No | Yes | ~1.5–2s |
| **Bulk (create N objects of same type, N ≥ 3)** | **Haiku** | **1** | **No** | **Yes** | **~1.3–2.5s** |
| Compound (SWOT, retro, journey map, kanban, flowchart, clear board) | Sonnet | 1 | No | Yes | ~2–3s |
| **Creation grid (create a NxM grid of objects)** | **Sonnet** | **2** | **No** | **Yes** | **~2–4s** |
| Ops (move, resize, change color, delete specific, rotate) | Sonnet | 3 | Yes | **Yes** | ~3–4s |
| Query (how many, list, describe, count) | Sonnet | 8 | Yes | No | ~4–6s |
| Generic complex (arrange, connect, batch modify, multi-step) | Sonnet | 8 | Yes | No | ~5–10s |

- **Simple:** Haiku, single-turn, `boardStateForPlacementOnly` strips board state from Claude prompt (retains it for server-side placement), return immediately after tool. Target &lt;2s met. Placement engine prevents overlap with existing objects.
- **Bulk:** Haiku forced to `createBulkObjects`; all N objects computed and batch-inserted server-side in one DB call. ~2,390 input tokens regardless of N. Tested to 500 objects in 1.50s.
- **Compound:** Sonnet forced to one compound tool (`createQuadrant`, `createColumnLayout`, `createFlowchart`, `clearBoard`). All rows batch-inserted in a single Supabase call. `resolveBulkPlacement` places template in visible viewport without overlap. ~2–3s regardless of template complexity.
- **Creation grid:** Sonnet, 2 turns, no board state. "Create a 2×3 grid of sticky notes" gets a faster path than generic complex.
- **Ops:** Sonnet with board state access; 3-turn cap; `returnAfterToolExecution: true` — narration turn eliminated, saving ~1–2s. Inline board state sent for small boards (≤25 objects) to skip `getBoardState` round-trip.
- **Query:** Sonnet with board state; `BOARD_STATE_OBJECT_CAP` truncates to frames-only summary for large boards.
- **Generic complex:** Full multi-turn for arrange/connect/multi-step; `batchModify` available for bulk mutations; correctness over speed.

---

## 5. Tools & workflow

| Tool | How it was used |
|------|----------------|
| **Cursor (+ Claude Sonnet)** | Primary IDE throughout. Used for all code generation, refactoring, and debugging. Agent mode used for multi-file changes (e.g. policy + index + tests in one session). Plan mode used before large changes (compound tool architecture, ops path reclassification) to reason through implications before touching code. |
| **Claude (Sonnet via Cursor)** | Generated edge function logic, policy classification, system prompt iterations, compound tool layout math, and all test files. Served as both implementation agent and architecture consultant for the compound tool approach. |
| **Supabase Edge Functions (Deno)** | AI proxy backend: validated JWT, called Anthropic API, executed all tool handlers (Supabase inserts/updates/deletes). Deployed via `supabase functions deploy`. |
| **Vitest + Testing Library** | TDD workflow: tests written first for policy classification (`aiEdgePolicy.test.ts`, `aiCommandPolicy.test.ts`), then implementation. Tests added for `claudeAgent.ts` routing logic (`claudeAgent.test.ts` — 34 cases for `isBulkCreation`, `isQueryCommand`, ops inline threshold) and all new policy tiers (flowchart, creation grid, bulk). Run before every deploy. |
| **Supabase Realtime** | All board object changes (AI-generated or user-made) sync instantly to all connected clients via Postgres row subscriptions — no extra broadcasting code needed. |

**Workflow pattern:** Every significant change followed: plan → write failing tests → implement → green tests → deploy edge function → live test in browser.

---

## 6. MCP Usage

| MCP | What it enabled |
|-----|----------------|
| **Supabase MCP** | Direct DB introspection from Cursor — used to verify `board_objects` schema columns (`parent_id`, `font_color`, `from_id`, `to_id`) without leaving the IDE. Confirmed table structure before writing compound tool insert statements. |
| **Playwright / webapp-testing skill** | Browser automation for verifying AI command output visually (checking that SWOT template rendered correctly, that clear-board deleted all objects, that column layout heights were correct). Ran alongside manual testing. |

No other MCPs were required. Supabase's native Realtime and Edge Function primitives handled sync and server-side logic without additional MCP tooling.

---

## 7. Effective prompts

These are prompts used **during development** (in Cursor) that produced the most useful output:

**1. Compound tool architecture design**
> "The SWOT template takes 13–29s because Claude makes 7+ sequential tool calls. Propose a solution where Claude makes one call and the server does all the element creation internally. Consider our stack: Supabase Edge Function (Deno), Postgres board_objects table with x/y/width/height/parent_id columns, react-konva canvas. Don't implement yet, just explain the approach and trade-offs."

*Why it worked:* Separated thinking from implementation. Got a clean compound tool proposal before writing any code.

**2. Layout math for nested frames**
> "In our canvas (BoardObjects.tsx), frames render children using `child.x - parent.x` for relative positioning. Grandchildren use `grandchild.x - child.x`. Given outer frame at (startX, startY) with a 40px title bar, give me the exact world coordinates for 4 inner frames covering each quadrant of an 800×680 outer frame, and for stickies positioned below each inner frame's 40px title bar."

*Why it worked:* Giving the renderer's exact coordinate math as context produced correct positioning on the first attempt.

**3. Policy classification design**
> "Design a 3-tier policy classifier for AI whiteboard commands. Tier 1: pure creation with explicit type named → Haiku, 1 turn, forced tool. Tier 2: compound templates (SWOT, retro, kanban, journey map) → Sonnet, 1 turn, compound tool forced, no getBoardState. Tier 3: ops (move/resize/delete/change color) and generic complex → Sonnet, 3–8 turns, getBoardState allowed. Write the TypeScript regex-based classifier and matching tests."

*Why it worked:* Specifying all three tiers and their exact parameters upfront meant no back-and-forth iteration on the classification logic.

**4. System prompt for agentic behavior**
> "Claude is behaving like a chatbot — for 'resize the rectangle' it asks the user for the rectangle's ID and new dimensions instead of calling getBoardState and acting. Write a CRITICAL RULES section for the system prompt that forces agent behavior: never ask the user for values, always use tools to discover object IDs, make reasonable assumptions for unspecified sizes."

*Why it worked:* Framing the problem precisely ("chatbot vs agent") gave Claude the right mental model to write an effective prompt rather than generic advice.

**5. TDD for edge policy**
> "Write Vitest tests for the new 3-tier policy in policy.ts. Cover: sticky creation → simple tier, SWOT → createQuadrant forced, retro → createColumnLayout forced, clear board → clearBoard forced, move/resize/change color → complex with getBoardState, arrange → complex multi-turn. Assert modelTier, maxTurns, forcedToolName, allowGetBoardState, returnAfterToolExecution for each case."

*Why it worked:* Listing every case and every field to assert meant tests were complete on the first attempt — no missing coverage.

---

## 8. Code analysis

| Category | Estimated % | Notes |
|----------|------------|-------|
| AI-generated (Cursor + Claude) | ~85% | Edge function logic, policy classifiers, compound tool handlers, all test files, system prompt iterations, layout math |
| Hand-reviewed / hand-edited | ~10% | Regex tuning for edge cases, layout constant adjustments after visual testing, debugging specific rendering/positioning bugs |
| Hand-written from scratch | ~5% | High-level architecture decisions (3-tier policy concept, compound tool pattern), initial problem diagnosis from Supabase logs |

**Token-intensive areas:** The compound tool layout helpers (`executeCreateQuadrant`, `executeCreateColumnLayout`) and their corresponding tests were almost entirely AI-generated. The most hand-edited file was `claudeAgent.ts` (regex fixes discovered only through live testing, not caught by unit tests).

---

## 9. Strengths & limitations of AI-assisted development

### Where AI excelled
- **Boilerplate speed:** Generating the full `TOOLS` array schema, all tool handler cases in `executeTool()`, and matching test suites in seconds rather than hours.
- **Layout math:** Computing exact world coordinates for nested frame positioning (accounting for title bar offsets, relative-to-parent rendering) correctly on the first attempt when given precise context.
- **Architecture reasoning:** The compound tool strategy (move layout server-side, single LLM call) was proposed and fully reasoned through by Claude before any code was written.
- **Test completeness:** AI-generated tests covered all policy branches, edge cases, and field assertions comprehensively — better coverage than typical hand-written tests.
- **Iteration speed:** Policy changes that would take 30+ minutes manually (update classifier, update tests, verify parity) took ~5 minutes with Cursor agent mode.

### Where AI struggled
- **Live testing gaps:** Claude could not observe actual rendering output. Bugs like "the frame is too thin when no items are specified" or "axis lines look worse than nested frames" were only discoverable by running the app — tests couldn't catch visual regressions.
- **Client-edge parity drift:** Claude generated the edge policy and client policy separately; the client regex (`isComplexCommand`) drifted from the edge regex, causing the "space evenly / board appears empty" bug. Required human cross-checking to catch.
- **Default chatbot behavior:** Without explicit system prompt instructions, Claude's default is to ask clarifying questions rather than act autonomously. The "CRITICAL RULES" block had to be written explicitly — Claude did not naturally produce agentic behavior.
- **Rendering system knowledge:** Claude had no prior knowledge of how `BoardObjects.tsx` handles z-ordering and parent-relative positioning. Required reading the renderer code and providing it as context before layout math was correct.
- **Knowing when to stop:** Claude occasionally over-engineered solutions (e.g. suggesting spatial bounding-box queries for collision avoidance before the simpler 200-object cap approach was tried). Required human judgment to choose the right level of complexity.

---

## 10. Key learnings

- **Simple vs complex path:** Separating "one tool call" vs "template/multi-step" and using a faster model + single turn + return-after-tools was necessary to hit &lt;2s for simple commands.
- **Compound tools solve the N-round-trip problem:** Moving layout logic server-side into compound tools (one LLM call → many Supabase inserts) is the correct fix for template latency. Attempting to optimize Claude's multi-step orchestration (Options 1–3) degraded correctness without reliably improving latency.
- **Ops path must be complex, not simple:** Manipulation commands that reference existing objects (move, resize, change color) require `getBoardState` to resolve object IDs. Placing them on the simple/Haiku path causes Claude to fail silently or ask the user for information it should find itself.
- **Nested frames for visual quality:** Using `frame` type objects as quadrant/column containers (with `parent_id`) leverages the canvas renderer's built-in colored-header behavior, producing visually correct templates without extra rendering code.
- **System prompt agent rules are essential:** Claude defaults to chatbot behavior (asking clarifying questions) without explicit instructions to always act directly with tools. The "CRITICAL RULES" block in the system prompt is what changes it from a conversational assistant to an autonomous agent.
- **Client-edge regex parity:** The client's `claudeAgent.ts` regex for deciding which board objects to send must stay in sync with the edge policy classification. A mismatch (missing "space" from `isComplexCommand`) caused board state to be sent as `[]`, making Claude think the board was empty.
- **Context is everything:** AI output quality is directly proportional to how precisely the relevant constraints (renderer coordinate system, DB schema, existing architecture) are included in the prompt. Generic prompts produced generic code; precise context produced correct code on the first attempt.
- **TDD as a forcing function:** Writing tests before implementation forced explicit reasoning about every policy case and field value. Tests also caught regressions when policy tiers were reorganized — without them, the ops reclassification would have silently broken existing behavior.
- **Rate limits are throughput caps, not spend caps:** The 30k input-token-per-minute limit is hit not by one expensive call but by many cheap retries. The root fix is ensuring the correct number of objects is created on the first call — eliminating retries eliminates the token pileup.
- **Batch insert is mandatory for bulk operations:** Sequential `await insert()` in a loop would have timed out the Edge Function at ~100+ objects (10s limit). A single `insert([...rows])` handles 500 objects in the same time as 1 insert, making the operation latency-independent of object count.
- **Scope board state stripping precisely:** Stripping `currentObjects` for all creation commands would break "create a sticky next to the blue frame" (needs board state). The `isBulkCreation` and `isSimpleCreation` flags gate the strip (`boardStateForPlacementOnly`) to only the paths that don't need board context in the Claude prompt — every contextual creation path is untouched.
- **Deploy is a hidden step:** Client-side changes (TypeScript, policy mirrors) are immediately live in the browser. Edge Function changes require an explicit `supabase functions deploy` — forgetting this causes confusion where old server behavior persists despite correct-looking local code.
- **Regex plural handling matters:** `\brectangle\b` does not match "rectangles" — the word boundary fails because `s` follows. Using `rectangles?` (or explicit plural variants) is required for object-type regexes to work on natural language input.
- **Placement must be server-side:** Client cannot compute non-overlapping positions because it only knows the current snapshot; the edge function owns all ongoing inserts. `placement.ts` on the server resolves all positions after collecting `currentObjects` and updating `placementObjects` in-memory across tool calls in the same request.
- **Viewport bounds unlock placement quality:** Passing `viewport.bounds` from the client lets the placement engine try to land new content in the visible area first — without it, all placement falls back to "outside existing cluster" which may be off-screen. The viewport argument is optional; placement degrades gracefully without it.
- **`returnAfterToolExecution` on ops saves a full LLM turn:** The narration turn ("I've moved the sticky note to...") adds ~1–2s with no user value. Switching ops to `returnAfterToolExecution: true` + `getFriendlySummary` gives clean text in the same time as tool execution.
- **Batch inserts in compound tools are essential for correctness, not just performance:** Sequential `await insert()` calls for a SWOT template (13 inserts) can race against Supabase Realtime — clients may receive partial state mid-insert. A single batch insert is atomic from Realtime's perspective: all elements appear simultaneously.
- **Narrowing keyword regexes prevents accidental destructive actions:** Bare `\breset\b` in `CLEAR_RE` matched "reset my password" and wiped the board. Always scope destructive-action keywords to board-specific context (e.g. `reset\s+(?:the\s+)?(?:board|canvas)`).

---

## 11. References

- G4 AI command and latency targets (from project brief).
- `docs/AI_EDGE_FUNCTION.md` — Edge function setup, secrets, auth.
- `docs/CollabBoard-48hr-Final-PRD.md` — Tool schema, system prompt, templates, dev log template.
- `docs/presearch.md` — Stack choices, Claude, &lt;2s target.
