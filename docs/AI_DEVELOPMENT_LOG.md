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

**Tools (edge):** `getBoardState`, `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `createText`, `moveObject`, `resizeObject`, `rotateObject`, `updateText`, `changeColor`, `deleteObject`, `arrangeInGrid`, **`createQuadrant`**, **`createColumnLayout`**, **`clearBoard`**.

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

### 3.11 Client payload regex fixes (shipped)

- **Problem:** Commands like "space elements evenly" weren't sending `currentObjects` to the edge function because "space" wasn't in the client's `isComplexCommand` regex. Claude received `"Current board state: []"` and concluded the board was empty.
- **Fix:** Added `space|align|distribute|kanban` to `isComplexCommand`; broadened `isObjectRefCommand` to capture `resize|rotate|rename|change|update|color`. Both ensure the full board state is included in the request for any command that needs to operate on existing objects.

---

## 4. Current behavior summary

| Command type | Model | Turns | getBoardState | Return after tools | Typical latency |
|--------------|-------|--------|----------------|--------------------|-----------------|
| Simple (add sticky, add shape, add frame, add text) | Haiku | 1 | No | Yes | ~1.7–2s |
| Compound (SWOT, retro, journey map, kanban, clear board) | Sonnet | 1 | No | Yes | ~2–3s |
| Ops (move, resize, change color, delete specific, rotate) | Sonnet | 3 | Yes | No | ~3–5s |
| Generic complex (arrange, connect, multi-step) | Sonnet | 8 | Yes | No | ~5–10s |

- **Simple:** Haiku, single-turn, no board state, return immediately after tool. Target &lt;2s met.
- **Compound:** Sonnet forced to one compound tool; all DB operations done server-side. ~2–3s regardless of template complexity.
- **Ops:** Sonnet with board state access; 3-turn cap prevents over-running on simple mutations.
- **Generic complex:** Full multi-turn for arrange/connect/multi-step; correctness over speed.

---

## 5. Tools & workflow

| Tool | How it was used |
|------|----------------|
| **Cursor (+ Claude Sonnet)** | Primary IDE throughout. Used for all code generation, refactoring, and debugging. Agent mode used for multi-file changes (e.g. policy + index + tests in one session). Plan mode used before large changes (compound tool architecture, ops path reclassification) to reason through implications before touching code. |
| **Claude (Sonnet via Cursor)** | Generated edge function logic, policy classification, system prompt iterations, compound tool layout math, and all test files. Served as both implementation agent and architecture consultant for the compound tool approach. |
| **Supabase Edge Functions (Deno)** | AI proxy backend: validated JWT, called Anthropic API, executed all tool handlers (Supabase inserts/updates/deletes). Deployed via `supabase functions deploy`. |
| **Vitest + Testing Library** | TDD workflow: tests written first for policy classification (`aiEdgePolicy.test.ts`, `aiCommandPolicy.test.ts`), then implementation. 100 tests across 10 files; run before every deploy. |
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

---

## 11. References

- `docs/requirements.md` — G4 AI command and latency targets.
- `docs/AI_EDGE_FUNCTION.md` — Edge function setup, secrets, auth.
- `docs/CollabBoard-48hr-Final-PRD.md` — Tool schema, system prompt, templates, dev log template.
- `docs/presearch.md` — Stack choices, Claude, &lt;2s target.
