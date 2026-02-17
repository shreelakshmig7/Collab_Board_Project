# CollabBoard – Project Requirements (G4 Week 1)

Source: **G4 Week 1 - CollabBoard** requirement doc.

## MVP (24 hours) – hard gate, all required

- [x] Infinite board with pan/zoom
- [x] Sticky notes with editable text
- [x] At least one shape type (rectangle, circle, or line)
- [x] Create, move, and edit objects
- [x] Real-time sync between 2+ users
- [x] Multiplayer cursors with name labels
- [x] Presence awareness (who's online)
- [x] User authentication
- [x] **Deployed and publicly accessible** (add live URL to README after first deploy; see [DEPLOY.md](DEPLOY.md) and [MVP_VERIFICATION.md](MVP_VERIFICATION.md))

## Core collaborative whiteboard

| Feature | Requirements |
|--------|--------------|
| Workspace | Infinite board, smooth pan/zoom |
| Sticky notes | Create, edit text, change colors |
| Shapes | Rectangles, circles, lines with solid colors |
| Connectors | Lines/arrows connecting objects |
| Text | Standalone text elements |
| Frames | Group and organize content areas |
| Transforms | Move, resize, rotate objects |
| Selection | Single and multi-select (shift-click, drag-to-select) |
| Operations | Delete, duplicate, copy/paste |

## Real-time collaboration

- Cursors with names, real-time movement
- Object sync (create/modify) for all users
- Presence (who's on the board)
- Conflict handling: last-write-wins acceptable (document approach)
- Disconnect/reconnect resilience
- Persistence: board state survives users leaving and returning

## AI board agent (required for full submission)

- **6+ distinct commands** across: Creation, Manipulation, Layout, Complex.
- **Tool schema (minimum):** `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `getBoardState()`.
- **Shared AI state:** All users see AI results in real time.
- **Targets:** Response <2s, 6+ command types, multi-step execution.

### Example commands

- Creation: "Add a yellow sticky note that says 'User Research'", "Create a blue rectangle at 100, 200"
- Manipulation: "Move all pink stickies to the right", "Change the sticky color to green"
- Layout: "Arrange these stickies in a grid", "Space these elements evenly"
- Complex: "Create a SWOT analysis template", "Build a user journey map with 5 stages"

## Submission deliverables

- GitHub repo (setup guide, architecture overview, deployed link)
- Demo video (3–5 min)
- Pre-Search document (Phase 1–3 checklist)
- AI Development Log (1 page)
- AI Cost Analysis (dev spend + 100/1K/10K/100K user projections)
- Deployed application (public, 5+ users, auth)
- Social post (X or LinkedIn, tag @GauntletAI)

## Build strategy (priority order)

1. Cursor sync → 2. Object sync → 3. Conflict handling → 4. State persistence → 5. Board features (shapes, frames, connectors, transforms) → 6. AI commands (basic) → 7. AI commands (complex)
