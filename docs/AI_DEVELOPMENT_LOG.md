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
| **Client policy (mirror)** | `src/ai/aiCommandPolicy.ts`: `getAiCommandPolicy(message)` — same regex heuristics as edge for tests and consistency; mode `simple` vs `complex`, `allowGetBoardState`, `forcedToolName`. |
| **Edge Function** | `supabase/functions/ai-command/index.ts`: Validates JWT, reads `userMessage`, `currentObjects`, `boardId`; calls `getPolicyForMessage(userMessage)` from `policy.ts`; builds tool list (with or without `getBoardState`); single model per request (Haiku or Sonnet); runs Claude loop with sequential tool execution; returns `{ text }` or error. |
| **Edge policy** | `supabase/functions/ai-command/policy.ts`: `getPolicyForMessage(userMessage)` → `AiPolicy`: `modelTier` ('fast'|'smart'), `maxTurns`, `maxTokens`, `allowGetBoardState`, `forcedToolName`, `returnAfterToolExecution`. Simple creation/ops → fast, 1 turn, no getBoardState, return after tools; complex/template → smart, 8 turns, getBoardState allowed. |

**Tools (edge):** `getBoardState`, `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `createText`, `moveObject`, `resizeObject`, `rotateObject`, `updateText`, `changeColor`, `deleteObject`, `arrangeInGrid`.

**Models:** Simple path → `claude-haiku-4-5-20251001` (env `ANTHROPIC_MODEL_SIMPLE`); complex path → `claude-sonnet-4-20250514` (env `ANTHROPIC_MODEL_COMPLEX`).

---

## 3. Implementations tried

### 3.1 Initial setup

- Single model (Sonnet), full tool set, system prompt: “Call getBoardState first, then execute changes.”
- Client sent full board state in request body; edge inlined it in the first user message.
- **Result:** Simple commands (e.g. “Add a blue sticky”) took ~6–10s+; complex (SWOT, journey map) ~14–29s. Target &lt;2s for simple commands was missed.

### 3.2 Latency diagnosis

- Supabase logs showed delay was **server-side** (e.g. `execution_time_ms` ~10.8s), not only cold start.
- Cause: multiple Claude round-trips — model often called `getBoardState` first, then tools, then an extra “narration” turn after tool execution.

### 3.3 Simple-command optimization (shipped)

- **Policy:** Classify by message (creation/ops vs template/complex). Simple commands use:
  - `maxTurns: 1`
  - No `getBoardState` in tool list (`allowGetBoardState: false`)
  - `returnAfterToolExecution: true` — edge returns immediately after running tools (no extra Claude turn).
- **Model routing:** Simple → Haiku, complex → Sonnet (Sonnet model ID updated after retirement of earlier Haiku).
- **System prompt:** “If the request is simple, make the change in a single tool call. Only call getBoardState if the board state is missing or you need to disambiguate.”
- **Result:** Simple commands (e.g. “Add a blue sticky-note”) ~1.7–2s (e.g. `execution_time_ms` ~1720), meeting G4 &lt;2s.

### 3.4 Complex-command optimization — Option 2 (tried and reverted)

- **Idea:** When client sends non-empty `currentObjects`, omit `getBoardState` from the tool list to avoid a redundant round-trip.
- **Implementation:** In edge, `toolsForRequest = (policy.allowGetBoardState && (currentObjects ?? []).length === 0) ? TOOLS : TOOLS.filter(t => t.name !== 'getBoardState')`.
- **Result:** Latency improved but **template output regressed**: e.g. “Create a SWOT analysis template” produced four separate sticky-style cards instead of the expected single grouped template (header + 2×2 quadrants with labels and content areas). Without `getBoardState`, the model did not produce the correct layout.
- **Decision:** Reverted Option 2. For template-style commands, calling `getBoardState` is required for correct structure; we accept the extra round-trip for correctness.

### 3.5 Other complex-command ideas (not shipped)

- **Option 1:** Prompt line asking Claude to output all template tool calls in a single response.
- **Option 3:** Run independent create tools in parallel with an ordering barrier.
- These were tried in combination with Option 2; latency and/or correctness regressed, so all were reverted in favor of the current sequential execution and original prompt behavior for complex commands.

### 3.6 Client payload behavior

- Client already sends full or minimal `currentObjects` by command type (creation/complex/object-ref). Edge always inlines whatever is sent in the first user message; policy only controls whether `getBoardState` is *available* as a tool, not whether state is in the message.

---

## 4. Current behavior summary

| Command type | Model | Turns | getBoardState | Return after tools | Typical latency |
|--------------|-------|--------|----------------|--------------------|------------------|
| Simple (add sticky, add shape, move, change color, etc.) | Haiku | 1 | No | Yes | ~1.7–2s |
| Complex (SWOT, journey map, arrange grid, multi-step) | Sonnet | 8 | Yes | No | ~13–29s |

- **Simple:** Single-turn, no getBoardState, return immediately after tool run; target &lt;2s met.
- **Complex:** Multi-turn, getBoardState allowed, sequential tools; correctness preferred over further latency hacks.

---

## 5. Tools and workflow

- **Cursor:** Primary IDE with Claude integration for implementation and refactors.
- **Claude (Sonnet):** Code generation, edge function logic, policy design, system prompt tuning.
- **Supabase:** Edge Functions (Deno), JWT validation, DB for tool execution (`board_objects`).
- **Vitest + Testing Library:** Client policy tests (`aiCommandPolicy.test.ts`), edge policy tests (`aiEdgePolicy.test.ts`).

---

## 6. Learnings

- **Simple vs complex path:** Separating “one tool call” vs “template/multi-step” and using a faster model + single turn + return-after-tools was necessary to hit &lt;2s for simple commands.
- **getBoardState for templates:** For SWOT/journey-style outputs, having the model call `getBoardState` is important for correct layout and structure; removing it for non-empty client state hurt quality and was reverted.
- **Policy parity:** Keeping client-side policy logic in sync with the edge (and tested) avoids drift and makes behavior predictable.

---

## 7. References

- `docs/requirements.md` — G4 AI command and latency targets.
- `docs/AI_EDGE_FUNCTION.md` — Edge function setup, secrets, auth.
- `docs/CollabBoard-48hr-Final-PRD.md` — Tool schema, system prompt, templates, dev log template.
- `docs/presearch.md` — Stack choices, Claude, &lt;2s target.
