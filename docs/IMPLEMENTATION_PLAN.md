# CollabBoard – Implementation Plan (work done + what’s next)

This document reflects a scan of the project folder. It summarizes what is already done and what to do next to reach full submission (Core whiteboard + AI agent + deliverables).

---

## 1. Work already done

### MVP (all items satisfied)

| Item | Implementation |
|------|----------------|
| Infinite board with pan/zoom | [src/canvas/Canvas.tsx](src/canvas/Canvas.tsx): Konva Stage, wheel zoom (0.2x–3x), pan via drag when Pan tool active. |
| Sticky notes with editable text | [src/canvas/BoardObjects.tsx](src/canvas/BoardObjects.tsx): sticky render; [src/board/BoardPage.tsx](src/board/BoardPage.tsx): double-click opens modal, Save calls `updateObject`. |
| At least one shape type | Rectangle: `type: 'sticky' \| 'rect'` in [src/types/board.ts](src/types/board.ts); Rect tool and render in Toolbar + BoardObjects. |
| Create, move, edit objects | Create: click on canvas with Sticky/Rect tool ([Canvas.tsx](src/canvas/Canvas.tsx)). Move: drag in BoardObjects, `onDragEnd` → `updateObject`. Edit: sticky modal; Delete key in BoardPage. |
| Real-time sync 2+ users | [src/firebase/firestore.ts](src/firebase/firestore.ts): `subscribeObjects`, `addObject`, `updateObject`, `deleteObject`. BoardPage subscribes; all clients see same state. |
| Multiplayer cursors with names | [src/firebase/rtdb.ts](src/firebase/rtdb.ts): `setMyCursor`, `subscribeCursors`, `removeMyCursor`, `setupCursorOnDisconnect`. [src/canvas/OtherCursors.tsx](src/canvas/OtherCursors.tsx): Circle + display name. |
| Presence awareness | Canvas passes cursor-derived names to BoardPage → TopBar shows “X, Y online” ([src/board/TopBar.tsx](src/board/TopBar.tsx)). |
| User authentication | [src/firebase/auth.ts](src/firebase/auth.ts) + [src/auth/LoginPage.tsx](src/auth/LoginPage.tsx): Google sign-in; App shows Login or Board by `user`. |
| Deployed and publicly accessible | Build passes; [vercel.json](vercel.json) + [docs/DEPLOY.md](docs/DEPLOY.md) in place. Add Vercel URL to README after first deploy. |

### Infrastructure and config

- **Firebase:** Optional init ([src/firebase/config.ts](src/firebase/config.ts)); Firestore + RTDB with null guards in firestore.ts and rtdb.ts. Rules: [firestore.rules](firestore.rules), [database.rules.json](database.rules.json).
- **Build:** `npm run build` succeeds; [src/vite-env.d.ts](src/vite-env.d.ts) for Vite types.
- **Docs:** [docs/requirements.md](docs/requirements.md), [docs/presearch.md](docs/presearch.md), [docs/DEPLOY.md](docs/DEPLOY.md), [docs/MVP_VERIFICATION.md](docs/MVP_VERIFICATION.md), [STATUS_AND_PLAN.md](STATUS_AND_PLAN.md).

### Not done (from codebase scan)

- **Object types:** Only `sticky` and `rect` in [src/types/board.ts](src/types/board.ts). No `circle`, `line`, `connector`, `frame`, or standalone `text`.
- **Toolbar:** Only Sticky, Rect, Pan in [src/board/Toolbar.tsx](src/board/Toolbar.tsx). No circle/line tools; no shape color picker for rect (only for sticky).
- **Transforms:** Move only. No resize or rotate in BoardObjects or Toolbar.
- **Selection:** Single-select only (selectedId in BoardPage). No shift-click or drag-to-select.
- **Operations:** Delete only. No duplicate, copy, or paste.
- **AI agent:** No Claude/OpenAI integration, no tool schema, no “Run AI command” UI in the app.
- **Routing:** No React Router; single board id `MVP_BOARD_ID` in [src/constants.ts](src/constants.ts). Multi-board / shareable URLs not started.

---

## 2. What to do next (priority order)

Follow the requirement doc build strategy: board features first, then AI commands (basic then complex), then submission polish.

### Phase A: Core whiteboard (shapes + transforms + ops)

| # | Task | Est. | Details |
|---|------|------|--------|
| A1 | Add circle and line shapes | 45 min | Extend `BoardObject.type` to `'circle' \| 'line'` in [src/types/board.ts](src/types/board.ts). Add Circle/Line tools in [src/board/Toolbar.tsx](src/board/Toolbar.tsx). In [src/canvas/Canvas.tsx](src/canvas/Canvas.tsx) handle click-to-add for circle (e.g. radius or width/height) and line (two points or width). In [src/canvas/BoardObjects.tsx](src/canvas/BoardObjects.tsx) render Konva Circle and Line; drag to move; sync via existing `updateObject`. |
| A2 | Shape color picker for rect/circle | 20 min | In Toolbar, when selected object is rect or circle (not just sticky), show the same color swatches; on pick call `updateObject(..., { color })`. Reuse or mirror sticky color logic in BoardPage. |
| A3 | Resize objects | 50 min | Add resize handles (e.g. corner/edge) on selected object in BoardObjects, or a small “resize” panel in BoardPage that sets width/height. On change call `updateObject(..., { width, height })`. Sticky may keep fixed size or allow resize; rect/circle already have width/height (circle can use width/height as diameter). |
| A4 | Connectors (lines between objects) | 1 hr | New type `connector` with `fromId`, `toId`, optional `style`. Store in Firestore like other objects. In BoardObjects, resolve from/to positions from `objects` and draw a Konva Line/Arrow between them; support drag to move connector (e.g. update position or fromId/toId). Add Connector tool and creation flow (e.g. click two objects). |
| A5 | Multi-select (shift-click, drag-to-select) | 45 min | In BoardPage replace `selectedId: string \| null` with `selectedIds: string[]`. In Canvas/BoardObjects: shift+click toggles selection; optional drag-rectangle to select multiple. Toolbar and delete/duplicate/copy-paste operate on `selectedIds`. |
| A6 | Duplicate, copy/paste | 30 min | Duplicate: for each `selectedIds`, clone object (new id, same props), `addObject` for each. Copy/paste: store “clipboard” in state (or context) as array of BoardObject; Paste inserts copies with new ids at offset position. |

**Phase A total (approx.):** ~4 hours.

### Phase B: AI board agent

| # | Task | Est. | Details |
|---|------|------|--------|
| B1 | Tool layer (board API) | 30 min | Create a module (e.g. `src/ai/boardTools.ts`) that exposes: `getBoardState()` (return current `objects`), `createStickyNote(text, x, y, color)`, `createShape(type, x, y, width, height, color)`, `moveObject(id, x, y)`, `resizeObject(id, width, height)`, `updateText(id, text)`, `changeColor(id, color)`. Each calls existing Firestore helpers so all users see changes. |
| B2 | Claude 4.5 integration with function calling | 1 hr | Add Anthropic SDK (or fetch to API). Define tool schema (names, parameters) matching the board API. On user message, call Claude with tools; for each tool call in the response, invoke the corresponding board function. Use existing `MVP_BOARD_ID` and current user context as needed. |
| B3 | AI command UI | 30 min | Add a simple input (e.g. in TopBar or a floating panel) and “Run” or “Send”. On submit, call Claude with `getBoardState()` result in context; stream or show result and apply tool calls. Ensure 6+ command types (create, move, resize, updateText, changeColor, etc.) and document conflict approach (e.g. last-write-wins). |
| B4 | Multi-step and complex commands | 30 min | Support multi-step: e.g. “Create a SWOT template” → multiple `createStickyNote` / `createShape` calls. Claude already supports multiple tool calls per turn; ensure board tools are idempotent where possible and that all users see updates via Firestore. |

**Phase B total (approx.):** ~2.5 hours.

### Phase C: Submission and polish

| # | Task | Est. | Details |
|---|------|------|--------|
| C1 | Deploy and verify | 30 min | Follow [docs/DEPLOY.md](docs/DEPLOY.md). Add Vercel URL to README “Live app”. Run [docs/MVP_VERIFICATION.md](docs/MVP_VERIFICATION.md) with 2+ users; fix any production-only bugs. |
| C2 | README and architecture | 20 min | README: setup, how to run, link to live app, link to docs. Short “Architecture” subsection: React + Konva, Firestore (objects), RTDB (cursors), conflict strategy (last-write-wins). |
| C3 | Pre-Search / AI Log / Cost Analysis | Your time | Pre-Search doc (you have PDF). AI Development Log (1 page): tools, prompts, % AI vs hand-written, learnings. AI Cost Analysis: dev spend + table for 100/1K/10K/100K users (see [docs/presearch.md](docs/presearch.md)). |
| C4 | Demo video and social post | Your time | 3–5 min demo (collab + AI commands); social post with @GauntletAI. |

---

## 3. Suggested order and timeboxes

- **If you have ~6 hours:** Do **A1 → A2 → A3** (circle/line, shape color, resize), then **B1 → B2 → B3** (tools + Claude + UI). Skip A4–A6 and B4 for a first cut; add connectors and multi-step later.
- **If you have ~1 day:** Do all of Phase A, then Phase B, then C1–C2. Do C3–C4 in parallel or after.
- **Minimum for “full submission”:** MVP (done) + deploy (C1) + AI agent with 6+ commands (B1–B3) + submission docs (C3) + demo and post (C4). Core shapes (A1–A2) and resize (A3) strengthen the demo; connectors (A4) and multi-select/duplicate (A5–A6) are optional if time is short.

---

## 4. File-level checklist (what to touch)

- **Types:** [src/types/board.ts](src/types/board.ts) – add `circle`, `line`, `connector` (and optionally `frame`, `text`) to `type`.
- **Constants:** [src/constants.ts](src/constants.ts) – optional defaults for new shapes.
- **Toolbar:** [src/board/Toolbar.tsx](src/board/Toolbar.tsx) – Circle, Line (and Connector) tools; shape color when rect/circle selected.
- **Board page:** [src/board/BoardPage.tsx](src/board/BoardPage.tsx) – selectedIds if multi-select; resize UI or handlers; duplicate/copy/paste; pass through to Canvas/BoardObjects.
- **Canvas:** [src/canvas/Canvas.tsx](src/canvas/Canvas.tsx) – click-to-add for circle/line (and connector); possibly selection rect.
- **Board objects:** [src/canvas/BoardObjects.tsx](src/canvas/BoardObjects.tsx) – render circle, line, connector; resize handles or accept new width/height; multi-select styling.
- **Firestore:** [src/firebase/firestore.ts](src/firebase/firestore.ts) – no schema change; new object types just extra fields (e.g. `fromId`, `toId` for connector).
- **New:** `src/ai/boardTools.ts` (or similar) – getBoardState, createStickyNote, createShape, moveObject, resizeObject, updateText, changeColor.
- **New:** `src/ai/` – Claude client, tool definitions, and optional “Run AI command” UI component.

Use this plan as the single place for “how much is done and what to do next.” Update STATUS_AND_PLAN.md as you complete phases so the high-level status stays in sync.
