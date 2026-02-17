# CollabBoard – Requirements, Status & 6-Hour Plan

*Based on **G4 Week 1 - CollabBoard** requirement doc and **CollabBoard_Presearch_Document_Shreelakshmi_Gopinatharao**.*

---

## Pre-Search alignment (from your doc)

Your Pre-Search locks in this stack and is already reflected in the codebase:

| Area | Decision | In codebase |
|------|----------|-------------|
| **Hosting** | Vercel (serverless/edge) | Deploy target → use Vercel |
| **Auth** | Firebase Auth / SSO (social login) | ✅ Google sign-in |
| **Database** | Hybrid Firebase: Firestore (objects) + Realtime DB (cursors) | ✅ |
| **Frontend** | React SPA + Konva.js | ✅ react-konva |
| **AI Agent** | Claude 4.5 Sonnet (multi-step, tool-calling, &lt;2s) | 🔲 To integrate |
| **Security** | Input sanitization, DB-level rules | ✅ Firestore/RTDB rules |
| **Project** | Feature-based, ESLint, Cursor + MCPs | ✅ structure |

**Trade-offs accepted (Pre-Search):** Firebase vs custom WebSocket (latency for dev time); Konva vs PixiJS (speed for API simplicity); Claude 4.5 for better tool orchestration, same cost as 3.5.

**Cost analysis (from Pre-Search – for submission):**

| Component | 100 Users | 1K Users | 10K Users | 100K Users |
|-----------|-----------|----------|----------|------------|
| AI API (Claude) | $11/mo | $108/mo | $1,080/mo | $10,800/mo |
| Firebase (Firestore + Realtime) | $0 | $12/mo | $85/mo | $850/mo |
| Cloud Functions | $0 | $3/mo | $20/mo | $180/mo |
| Hosting + CDN | $0 | $0 | $20/mo | $200/mo |
| **TOTAL** | **$11/mo** | **$123/mo** | **$1,205/mo** | **$12,030/mo** |

Pre-Search also mentions **text + vector storage** for AI “board memory”; optional for MVP, can add later.

---

## Requirements summary (from doc)

### MVP (24 hours) – hard gate, all required
| Requirement | Status |
|-------------|--------|
| Infinite board with pan/zoom | ✅ Done |
| Sticky notes with editable text | ✅ Done |
| At least one shape type (rectangle, circle, or line) | ✅ Done (rect) |
| Create, move, and edit objects | ✅ Done |
| Real-time sync between 2+ users | ✅ Done |
| Multiplayer cursors with name labels | ✅ Done |
| Presence awareness (who's online) | ✅ Done |
| User authentication | ✅ Done |
| **Deployed and publicly accessible** | ✅ Ready (follow [docs/DEPLOY.md](docs/DEPLOY.md); add URL to README after deploy) |

### Core collaborative whiteboard (beyond MVP)
| Feature | Requirements | Status |
|---------|--------------|--------|
| Workspace | Infinite board, smooth pan/zoom | ✅ |
| Sticky notes | Create, edit text, change colors | ✅ |
| Shapes | Rectangles, **circles**, **lines** with solid colors | ⚠️ Rect only |
| Connectors | Lines/arrows connecting objects | ❌ |
| Text | Standalone text elements | ❌ |
| Frames | Group and organize content areas | ❌ |
| Transforms | Move, **resize**, **rotate** objects | ⚠️ Move only |
| Selection | Single and **multi-select** (shift-click, drag-to-select) | ⚠️ Single only |
| Operations | Delete, **duplicate**, **copy/paste** | ⚠️ Delete only |

### Real-time collaboration
| Feature | Status |
|---------|--------|
| Cursors with names, real-time movement | ✅ |
| Object sync (create/modify) for all users | ✅ |
| Presence (who's on the board) | ✅ |
| Conflict handling (last-write-wins acceptable) | ✅ (Firestore last-write) |
| Disconnect/reconnect resilience | ⚠️ (Firestore/RTDB reconnect built-in; no explicit UI) |
| Persistence (board survives users leaving) | ✅ |

### AI board agent (required for full submission)
- **6+ distinct commands** across: Creation, Manipulation, Layout, Complex.
- **Tool schema (minimum):** `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `getBoardState()`.
- **Shared AI state:** All users see AI results in real-time.
- **Targets:** Response <2s, 6+ command types, multi-step execution.

### Other submission deliverables
- Pre-Search document (Phase 1–3 checklist)
- AI Development Log (1 page)
- AI Cost Analysis (dev spend + 100/1K/10K/100K user projections)
- Demo video (3–5 min)
- Deployed app (public, 5+ users, auth)
- Social post (X or LinkedIn, tag @GauntletAI)

---

## Current status (what’s in the repo)

### Implemented
- **Auth:** Google sign-in (Firebase); app works without `.env` (shows message).
- **Board:** Single board (`mvp-board-1`), infinite canvas, pan/zoom (0.2x–3x).
- **Tools:** Sticky, Rect, Pan; sticky color picker when selected.
- **Objects:** Sticky (add, move, edit text, 4 colors, delete); Rect (add, move, delete). All synced via Firestore.
- **Real-time:** Firestore for objects; Realtime DB for cursors; presence in top bar (“X, Y online”).
- **Firebase:** Config (optional), auth, firestore, rtdb; `firestore.rules` and `database.rules.json` in repo.

### Not implemented (vs requirement doc)
- **Deployment** – deploy-ready (build passes, Vercel config and [docs/DEPLOY.md](docs/DEPLOY.md) in place; add live URL to README after first deploy).
- **Shapes:** Circle and line (doc asks for “rectangles, circles, lines”).
- **Connectors** – lines/arrows between objects.
- **Transforms** – resize, rotate.
- **Multi-select** – shift-click, drag-to-select.
- **Operations** – duplicate, copy/paste.
- **Frames,** **standalone text** – not started.
- **AI agent** – no natural-language commands or tool schema yet.
- **Pre-Search doc, AI Dev Log, AI Cost Analysis** – documentation tasks.

---

## 6-hour implementation plan

**Goal:** MVP fully satisfied (including deploy) + as much Core + AI as fits in 6 hours.

| # | Task | Time | Notes |
|---|-----|------|--------|
| **1** | **Deploy (MVP gate)** | 45 min | Deploy to **Vercel** (per Pre-Search); set `VITE_FIREBASE_*` env vars; ensure public URL. **Required for MVP.** |
| **2** | **Add circle and line shapes** | 45 min | New types `circle`, `line` in `BoardObject`; toolbar buttons; create/render in Canvas + BoardObjects. Meets “Shapes: rectangles, circles, lines”. |
| **3** | **Shape color picker + rect color** | 20 min | When a shape (rect/circle) is selected, show color picker like stickies so “solid colors” is consistent. |
| **4** | **Resize objects** | 50 min | Add transform handles on selected object (or simple width/height inputs); persist via `updateObject(..., { width, height })`. Enables “resize” in Core and AI schema. |
| **5** | **AI agent – tool layer + 6 commands** | 1.5 hr | Expose `getBoardState()`, `createStickyNote`, `createShape`, `moveObject`, `updateText`, `changeColor` (and optionally `resizeObject`) as callable tools; add a simple UI (input + “Run AI command” or natural language box). Per Pre-Search: use **Claude 4.5 Sonnet** with function calling. Call Firestore helpers from tool results so all users see changes in real time. Aim for 6+ command types, &lt;2s response. |
| **6** | **Connectors (lines between objects)** | 45 min | New object type `connector` with `fromId`, `toId`; draw line/arrow between two objects; create via tool or AI. Optional if time runs out. |
| **7** | **Smoke test + doc checklist** | 30 min | Test 2 browsers, refresh, 5+ objects; note conflict strategy (last-write-wins) in README; confirm Pre-Search/AI Log/Cost Analysis are planned (you do these separately). |

**Rough total:** ~5.5–6 hours.

**If time is short, drop in this order:** Connectors → Resize (keep “move” only) → then still ship deploy + circle/line + AI agent minimum.

---

## Build strategy (from doc) – where we are

1. ✅ Cursor sync  
2. ✅ Object sync  
3. ✅ Conflict handling (last-write-wins)  
4. ✅ State persistence  
5. 🔲 Board features – shapes (add circle/line), transforms (resize), then connectors  
6. 🔲 AI commands (basic) – single-step creation/manipulation  
7. 🔲 AI commands (complex) – multi-step templates  

---

## Next step

1. **Deploy** so “deployed and publicly accessible” is checked.
2. Then implement in order: **circle/line** → **shape color** → **resize** → **AI agent (6+ commands)** → **connectors** if time.
3. Keep **Pre-Search**, **AI Development Log**, and **AI Cost Analysis** as separate deliverables (you can do them in parallel or after the 6-hour code sprint).

**Pre-Search doc** is done (you have the PDF). Deploy target from Pre-Search: **Vercel**. For a full scan of the project and a step-by-step “what’s done, what’s next,” see **[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)**.
