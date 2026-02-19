# CollabBoard 48-Hour Completion PRD
## From Current MVP to Full Production

---

## 📊 CURRENT STATE (MVP - 24hrs COMPLETED)

### ✅ What's Working:
1. **Authentication & User Management**
   - Login page with authentication
   - User session management
   - Sign-out functionality

2. **Board Management Screen**
   - Create new boards
   - Rename boards
   - Delete boards
   - ⚠️ Currently: Boards are private to creator only (no sharing; userA's boards not visible to userB)

3. **Canvas Features**
   - Create sticky notes
   - Create shapes: rectangle, circle, arrow
   - Connectors: *not yet implemented* (G4 requirement—in 48hr scope)
   - Resize objects
   - Change colors
   - Add text to objects
   - Pan canvas
   - Zoom in/out

4. **UI/UX**
   - Top toolbar: "Collab Board" heading
   - Online users indicator: Shows `<no_of_users>` inline
   - Hover shows user list
   - Sign-out button
   - AI button (bottom-right corner) - currently shows "coming soon"

5. **Real-Time Collaboration**
   - Multi-user sync working
   - Cursor tracking
   - Presence awareness

---

## 🎯 48-HOUR SPRINT OBJECTIVES

**Goal:** Add missing features + AI agent + polish for final submission

**Timeline:** 48 hours (2 days)
**Deadline:** Complete & submit ready application

---

## 📋 PR & MERGE REQUIREMENTS

All PRs must satisfy these before merge.

### Test-Driven Development (TDD)

- Write a failing test **before** any new production code.
- Follow Red → Green → Refactor cycle.
- PRs that add features **must** include the test written first.
- `npm test` must pass before merge.
- Colocate tests: `Bar.tsx` → `Bar.test.tsx`.
- See `.cursor/rules/tdd-workflow.mdc` for full TDD rules.

### Error Handling

- **Do not swallow errors.** Every `.catch()` must log or handle explicitly.
- Use `console.error('context message', err)` in catch blocks; never `.catch(() => {})`.
- For async effects, use `cancelled` / `abort` flags to avoid state updates after unmount.
- New async code must include error handling in its implementation.
- See `.cursor/rules/coding-standards.mdc` for error handling examples.

---

## 📅 48-HOUR BREAKDOWN

---

## **HOUR 0-12: Canvas Features & Transforms**

**Order:** Do Tasks 2 → 3 → 3b → 3c → 3d first. Task 1 (board sharing) last—only if time allows.

### **Task 1: Board Sharing (Shareable Links + Permissions)** (5 hours) — *STRETCH: skip if time-poor*

**Model:** Shareable links only. No email invites. Permission levels: view-only, edit, admin.

**Database Schema Updates:**
```sql
-- Add to boards table
ALTER TABLE boards ADD COLUMN share_slug VARCHAR(32) UNIQUE; -- For shareable URL, e.g. /board/abc123xyz

-- New table: board_permissions (user_id, board_id, role)
CREATE TABLE board_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(10) CHECK (role IN ('viewer', 'editor', 'admin')),
  UNIQUE(board_id, user_id)
);

-- RLS: Owner + users in board_permissions can access
-- Enforce role on UPDATE/DELETE: only editor+ can modify objects
```

**Implementation:**

1. **Shareable URLs** (1.5 hours)
   - Generate unique `share_slug` per board (nanoid or uuid short)
   - Route: `/board/:boardId` (existing) + `/b/:shareSlug` (share link redirects to board)
   - Copy shareable link button → `https://app.com/b/{shareSlug}`

2. **Permission Levels** (2 hours)
   - Store `user_id` + `board_id` + `role` in `board_permissions`
   - Roles: `viewer` (read-only), `editor` (create/edit/delete objects), `admin` (share, delete board)
   - When user opens share link: prompt auth if needed, add to `board_permissions` with default role (editor)
   - Share modal: Copy shareable link; optional "Manage access" to change roles for users who have opened the link

3. **Enforce Permissions** (1.5 hours)
   - RLS policies: `viewer` can SELECT only; `editor`/`admin` can INSERT/UPDATE/DELETE on `board_objects`
   - API/Realtime: Reject writes from view-only users
   - UI: Hide toolbar/creation controls for viewers

4. **Board List** (included in above)
   - Show user's own boards (owner)
   - Show boards user has access to via `board_permissions` (badge: "Shared with you" + role)

**Deliverable:** Users can share boards via link; view-only, edit, admin enforced. No email service.

---

### **Task 2: Shape Rotation Feature** (3 hours)

**Implementation:**

1. **Rotation Handle UI** (1.5 hours)
   - Add rotation handle above selected object
   - Visual indicator (circular arrow icon)
   - Show current rotation angle

2. **Rotation Logic** (1.5 hours)
   - Calculate angle from mouse position
   - Update Konva transform
   - Sync rotation to Supabase
   - Real-time rotation sync to other users

**Code Snippet:**
```typescript
// Konva rotation transformer
const transformer = new Konva.Transformer({
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  rotateEnabled: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315] // Optional: snap to angles
});

// Sync rotation
shape.on('transformend', () => {
  const rotation = shape.rotation();
  updateObjectInSupabase(shape.id(), { rotation });
});
```

**Deliverable:** All shapes (rectangle, circle, arrow, sticky notes) can be rotated

---

### **Task 3: Additional Canvas Operations** (3 hours)

**Features to Add:**

1. **Multi-Select** (1.5 hours)
   - Shift+click to add to selection
   - Drag-to-select rectangle
   - Visual selection indicators
   - Bulk operations (move, delete, color change)

2. **Duplicate, Delete & Copy/Paste** (1.5 hours)
   - Delete: toolbar or keyboard (Delete/Backspace)
   - Duplicate: toolbar or Cmd/Ctrl+D
   - Copy: Cmd/Ctrl+C; Paste: Cmd/Ctrl+V (offset position to avoid overlap)
   - Delete/duplicate/copy-paste selected objects
   - Sync operations in real-time

3. **Text Editing Enhancement** (0.5 hours)
   - Double-click to edit text inline
   - Auto-focus text input
   - Save on Enter or click outside

**Deliverable:** Professional canvas manipulation features

---

### **Task 3b: Connectors (Lines/Arrows)** (2 hours)

**G4 Requirement:** "Connectors: Lines/arrows connecting objects" — `createConnector(fromId, toId, style)`

**Implementation:**

1. **Connector Canvas Feature** (1 hour)
   - New object type: `connector` with `fromId`, `toId`, `style` (line, arrow)
   - Render line/arrow between two objects; update on object move
   - Store in Supabase; sync in real-time
   - Optional: Manual connector tool (click source object → click target object)

2. **Connector Data Model** (0.5 hours)
   - Add to `board_objects` or equivalent: `type: 'connector'`, `from_id`, `to_id`, `style`
   - Handle edge case: delete source/target → delete or orphan connector

3. **AI Integration Prep** (0.5 hours)
   - Ensure `createConnector` can be invoked by AI (object IDs from `getBoardState`)

**Deliverable:** Lines/arrows connecting objects; ready for AI `createConnector` tool

---

### **Task 3c: Frames (Hierarchical Containers)** (2 hours)

**G4 + PRD:** Frames group objects; children move/resize with frame.

**Implementation:**

1. **Frame Canvas Feature** (1.25 hours)
   - New object type: `frame` with title; `parent_id` on objects for containment
   - Create frame via toolbar; drag objects into frame (or set parent_id)
   - On frame move/resize: apply delta to all children
   - Render frames behind contained objects

2. **Data Model** (0.5 hours)
   - `board_objects`: add `parent_id` (nullable, references frame id)
   - Frame delete: orphan or delete children (decide; document)

3. **AI Integration** (0.25 hours)
   - `createFrame` tool writes to same schema; AI can create frames for templates

**Deliverable:** Frames work; objects inside move with frame. AI createFrame ready.

---

### **Task 3d: Standalone Text** (1 hour)

**G4:** "Text: Standalone text elements" — separate from sticky notes. Simpler: text without sticky box.

**Implementation:**

1. **Text Element** (0.75 hours)
   - New object type: `text` (no background box)
   - Controls: font size, font color (no color picker like stickies)
   - Editable via double-click (same pattern as sticky text)
   - Toolbar: add "Text" tool alongside sticky/shape tools

2. **Data Model** (0.25 hours)
   - `board_objects`: type `'text'`, fields: `text`, `fontSize`, `fontColor`, `x`, `y`

**Deliverable:** Standalone text elements. AI `createText` ready.

---

## **HOUR 12-24: AI Agent Implementation**

### **Task 4: AI Infrastructure Setup** (4 hours)

**Supabase Edge Function for AI Proxy:**

1. **Create Edge Function** (2 hours)
   ```bash
   # Create function
   supabase functions new ai-command
   ```

   ```typescript
   // supabase/functions/ai-command/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
   import Anthropic from 'npm:@anthropic-ai/sdk'

   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   }

   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders })
     }

     try {
       // 1. Validate JWT (Authorization: Bearer <token>)
       const authHeader = req.headers.get('Authorization')
       if (!authHeader?.startsWith('Bearer ')) {
         return new Response(JSON.stringify({ error: 'Unauthorized: missing token' }), { status: 401 })
       }
       const token = authHeader.slice(7)
       const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } })
       const { data: { user }, error: authError } = await supabase.auth.getUser(token)
       if (authError || !user) {
         return new Response(JSON.stringify({ error: 'Unauthorized: invalid token' }), { status: 401 })
       }

       const { command, boardState, boardId } = await req.json()

       // 2. Check edit permission (view-only cannot issue AI commands; only editor/admin/owner)
       const [{ data: board }, { data: perm }] = await Promise.all([
         supabase.from('boards').select('owner_id').eq('id', boardId).single(),
         supabase.from('board_permissions').select('role').eq('board_id', boardId).eq('user_id', user.id).single()
       ])
       const isOwner = board?.owner_id === user.id
       const canEdit = isOwner || ['editor', 'admin'].includes(perm?.role ?? '')
       if (!canEdit) {
         return new Response(JSON.stringify({ error: 'Forbidden: view-only or no access' }), { status: 403 })
       }
       
       const anthropic = new Anthropic({
         apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
       })

       const response = await anthropic.messages.create({
         model: 'claude-sonnet-4-20250514',
         max_tokens: 2000,
         tools: TOOL_DEFINITIONS, // Define below
         messages: [{
           role: 'user',
           content: `Current board state: ${JSON.stringify(boardState)}\n\nUser command: ${command}`
         }]
       })

       return new Response(
         JSON.stringify({ result: response }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       )
     } catch (error) {
       return new Response(
         JSON.stringify({ error: error.message }),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
       )
     }
   })
   ```

2. **Tool Definitions** (2 hours)
   - Define 13 tool functions (see schema below)—includes `createConnector`, `createText` per G4
   - Parameter validation
   - Error handling

**Frontend AI Integration:**

1. **AI Button UI** (1 hour)
   - Click opens AI command modal
   - Text input for command
   - Loading state during execution
   - Success/error feedback
   - Command history (last 5 commands)

2. **Execute AI Commands** (1 hour)
   - Send command + board state to Edge Function with `Authorization: Bearer ${session.access_token}`
   - Parse Claude's tool calls
   - Execute each tool sequentially
   - Update board in real-time
   - Sync to all users
   - Handle 401/403 (prompt re-login or show "View-only: AI not available")

**Deliverable:** AI infrastructure ready to execute commands (auth-protected)

---

### **Task 5: AI Tool Functions Implementation** (8 hours)

**Core Tool Functions (6 hours):**

1. **createStickyNote** (0.5 hours)
   ```typescript
   function createStickyNote(text: string, x: number, y: number, color: string) {
     const noteId = generateId()
     const note = {
       id: noteId,
       type: 'sticky_note',
       text,
       x, y,
       width: 200,
       height: 150,
       color: color || 'yellow',
       rotation: 0,
       boardId: currentBoardId
     }
     insertObjectToSupabase(note)
     renderStickyNote(note)
   }
   ```

2. **createText** (0.5 hours) — *G4 required; separate from stickies*
   - Standalone text: no sticky box. Font/size/color only (simpler than stickies)
   ```typescript
   function createText(text: string, x: number, y: number, fontSize?: number, color?: string) {
     const textId = generateId()
     const textObj = {
       id: textId,
       type: 'text',
       text,
       x, y,
       fontSize: fontSize || 16,
       fontColor: color || '#000',
       rotation: 0,
       boardId: currentBoardId
     }
     insertObjectToSupabase(textObj)
     renderText(textObj)
   }
   ```

3. **createShape** (0.5 hours)
   - Basic drawing primitives: rectangle, circle, arrow
   - Independent objects (not containers)

4. **createFrame** (1 hour)
   - Hierarchical container: objects inside move/resize with the frame
   - Has title; renders behind contained objects
   - Resize to fit contents (optional auto-fit)
   - *Implementation:* Objects need `parent_id` (frame id); on frame transform, apply delta to all children

5. **createConnector** (0.5 hours) — *G4 required*
   ```typescript
   function createConnector(fromId: string, toId: string, style: 'line' | 'arrow') {
     const connectorId = generateId()
     const connector = {
       id: connectorId,
       type: 'connector',
       from_id: fromId,
       to_id: toId,
       style: style || 'arrow',
       boardId: currentBoardId
     }
     insertObjectToSupabase(connector)
     renderConnector(connector)  // Line/arrow between from and to objects
   }
   ```

6. **moveObject** (0.5 hours)
   ```typescript
   function moveObject(objectId: string, x: number, y: number) {
     updateObjectInSupabase(objectId, { x, y })
     const shape = findShapeById(objectId)
     shape.position({ x, y })
     layer.batchDraw()
   }
   ```

7. **resizeObject** (0.5 hours)
8. **changeColor** (0.5 hours)
9. **updateText** (0.5 hours) — works on both sticky notes and standalone text
10. **deleteObject** (0.5 hours)

11. **arrangeInGrid** (2 hours)
   ```typescript
   function arrangeInGrid(objectIds: string[], columns: number, spacing: number = 50) {
     const objects = objectIds.map(id => findObjectById(id))
     
     let row = 0, col = 0
     const startX = 100, startY = 100
     
     objects.forEach((obj, index) => {
       const x = startX + (col * (obj.width + spacing))
       const y = startY + (row * (obj.height + spacing))
       
       moveObject(obj.id, x, y)
       
       col++
       if (col >= columns) {
         col = 0
         row++
       }
     })
   }
   ```

**Template Commands (2 hours):**

12. **SWOT Analysis Template**
    ```typescript
    function createSWOTTemplate(x: number = 200, y: number = 200) {
      const frameSize = { width: 400, height: 300 }
      const spacing = 50
      
      createFrame('Strengths', x, y, frameSize.width, frameSize.height)
      createFrame('Weaknesses', x + frameSize.width + spacing, y, frameSize.width, frameSize.height)
      createFrame('Opportunities', x, y + frameSize.height + spacing, frameSize.width, frameSize.height)
      createFrame('Threats', x + frameSize.width + spacing, y + frameSize.height + spacing, frameSize.width, frameSize.height)
    }
    ```

13. **User Journey Map** (5 stages) — Frames with contextual labels (Awareness, Consideration, Decision, Use, Advocacy); not "Stage 1..5"
14. **Retrospective Board** (3 columns)

**Deliverable:** AI agent can execute 12+ commands including complex templates + connectors

---

## **HOUR 24-36: Testing & Performance**

### **Task 6: Multi-User Testing** (4 hours)

**Test Scenarios:**

1. **Simultaneous Editing** (1 hour)
   - Open 3 browser windows (different users)
   - Create/move objects simultaneously
   - Verify no conflicts
   - Check sync latency (<100ms)

2. **AI Command Multi-User Test** (1 hour)
   - User A executes "Create SWOT analysis"
   - User B simultaneously creates sticky notes
   - Verify both see all changes (last-write-wins; no crashes)
   - Document conflict approach in submission

3. **Board Sharing Test** (1 hour)
   - Create board, verify others can't access without share link
   - Share link with User B, verify they can open and edit
   - Change User B to view-only, verify they can't edit
   - Revoke access, verify User B can't open board

4. **Stress Test** (1 hour)
   - Create 100+ objects
   - Measure FPS (target: 60 FPS)
   - Test with 5+ concurrent users
   - Network throttling test

**Deliverable:** All test scenarios documented and passing

---

### **Task 7: Performance Optimization** (4 hours)

1. **Canvas Performance** (2 hours)
   - Viewport culling (only render visible objects)
   - Layer caching for static objects
   - Debounce sync updates (max 60fps)
   - Optimize re-render triggers

2. **Realtime Optimization** (2 hours)
   - Use Supabase Broadcast for cursors (6ms latency)
   - Batch object updates
   - Differential updates (only changed properties)
   - Connection pool management

**Deliverable:** Smooth 60 FPS performance with 500+ objects

---

### **Task 8: Bug Fixes & Edge Cases** (4 hours)

- Handle disconnection/reconnection gracefully
- Object z-index management (bring to front/back)
- Prevent negative coordinates
- Handle very large/small objects
- AI command error handling
- Empty board state handling
- Concurrent AI commands: last-write-wins (no queue; G4 acceptable)

**Deliverable:** Production-ready stability

---

## **HOUR 36-48: Documentation & Submission**

### **Task 9: Documentation Package** (6 hours)

**1. GitHub Repository README** (2 hours)
```markdown
# CollabBoard - Real-Time Collaborative Whiteboard with AI

## Features
- Real-time multiplayer collaboration (Supabase Broadcast - 6ms latency)
- Infinite canvas with pan/zoom
- Shapes, sticky notes, standalone text, frames, connectors (lines/arrows between objects)
- AI agent with natural language commands
- Shareable links with permission levels (view/edit/admin)

## Tech Stack
- Frontend: React 18 + TypeScript + Konva.js
- Backend: Supabase (PostgreSQL + Realtime)
- AI: Claude Sonnet 4.5 (Function Calling)
- Deployment: Vercel

## Setup Instructions
[Detailed steps...]

## Architecture
[Include diagram...]

## Conflict Handling
- Object sync: last-write-wins
- AI commands: concurrent execution, last-write-wins (per G4)

## Live Demo
https://collabboard-demo.vercel.app
```

**2. AI Development Log** (1.5 hours)
```markdown
# AI Development Log

## Tools Used
- Cursor: Primary development environment with Claude integration
- Claude 4.5 Sonnet: Code generation, debugging, architecture decisions
- Supabase MCP: Database schema design

## AI-First Workflow
1. Architecture planning: Claude suggested Supabase over Firebase
2. Konva implementation: 70% AI-generated, 30% manual refinement
3. AI agent tools: 90% AI-generated with manual validation

## Effective Prompts
1. "Create a Konva transformer with rotation snapping every 45 degrees"
2. "Generate Supabase RLS policy for board_permissions (viewer/editor/admin roles)"
3. "Implement grid layout algorithm for arranging objects with configurable spacing"

## Code Analysis
- AI-generated: ~65%
- Hand-written: ~35%
- AI-assisted refactoring: ~80% of codebase

## Strengths
- Rapid prototyping of canvas features
- Complex RLS policy generation
- AI tool function schema generation

## Limitations
- Real-time sync debugging required manual intervention
- Edge case handling needed human review
- Performance optimization required profiling tools

## Key Learnings
- AI excels at boilerplate and standard patterns
- Human judgment critical for architecture decisions
- Cursor's multi-file context essential for refactoring
```

**3. AI Cost Analysis** (1.5 hours)

| Phase | Claude API Calls | Tokens (Input/Output) | Cost |
|-------|------------------|----------------------|------|
| Development | ~150 | 250K / 80K | ~$2.95 |
| Testing | ~50 | 60K / 20K | ~$0.48 |
| **Total Dev** | **200** | **310K / 100K** | **~$3.43** |

**Production Projections:**

| Users | Sessions/mo | AI Commands/Session | Cost/mo |
|-------|-------------|---------------------|---------|
| 100 | 300 | 8 | $11 |
| 1,000 | 3,000 | 8 | $108 |
| 10,000 | 30,000 | 8 | $1,080 |
| 100,000 | 300,000 | 8 | $10,800 |

**Assumptions:**
- 3 sessions per user per month
- 8 AI commands per session
- 1,500 tokens per command average
- Prompt caching enabled (90% savings on system prompt)

**4. Architecture Documentation** (1 hour)

Create diagrams showing:
- System architecture
- Real-time data flow
- AI agent architecture
- Authentication flow

---

### **Task 10: Demo Video Creation** (4 hours)

**Script & Recording:**

**0:00-0:30 - Introduction**
> "CollabBoard is a real-time collaborative whiteboard with AI capabilities. Built with React, Supabase, and Claude AI in 48 hours for Gauntlet AI Week 1."

**0:30-1:30 - Real-Time Collaboration Demo**
- Open 2 browser windows side-by-side
- Show User A creating sticky notes
- Show User B simultaneously adding shapes
- Demonstrate cursor tracking
- Show presence awareness (online users)
- Refresh one browser - show persistence

**1:30-3:00 - AI Agent Demo**
- Execute: "Create a SWOT analysis"
  - Show 4 frames appearing
- Execute: "Arrange all sticky notes in a 3 column grid"
  - Show automatic grid layout
- Execute: "Create a user journey map with 5 stages"
  - Show 5 frames with labels (e.g. Awareness, Consideration, Decision, Use, Advocacy)
- Show AI command executing in real-time for both users

**3:00-4:00 - Board Sharing Demo**
- Create board - show it's private until shared
- Copy share link, open in second browser (different user)
- Show both users editing in real time
- Change one user to view-only - show edit controls disabled

**4:00-4:30 - Technical Architecture**
- Show tech stack slide
- Highlight: Supabase 6ms realtime latency
- Mention: Claude 4.5 Sonnet for AI
- Show: Performance metrics (60 FPS, <100ms sync)

**4:30-5:00 - Closing**
> "Built with AI-first methodology using Cursor and Claude. Full source code on GitHub. Live demo at [URL]. Thanks to Gauntlet AI!"

**Editing:** Add captions, annotations, smooth transitions

**Deliverable:** 5-minute professional demo video

---

### **Task 11: Final Polish & Submission** (2 hours)

**UI Polish:**
- Consistent color scheme
- Loading indicators
- Error messages
- Smooth animations
- Responsive design checks

**Final Checks:**
- [ ] All features working in production
- [ ] 5+ users tested successfully
- [ ] Performance targets met (60 FPS, <100ms sync, <2s AI)
- [ ] All 5 test scenarios pass
- [ ] GitHub repo complete with README
- [ ] Demo video uploaded (YouTube/Loom)
- [ ] AI Development Log complete
- [ ] AI Cost Analysis complete
- [ ] Deployed URL accessible

**Social Post:**
```
🚀 Just shipped CollabBoard - a real-time collaborative whiteboard with AI!

✨ Features:
- 6ms realtime latency (Supabase Broadcast)
- Natural language AI commands powered by Claude
- Shareable links with permission levels (view/edit/admin)
- Infinite canvas with multiplayer cursors

🛠️ Built in 48 hours with:
- React + TypeScript + Konva.js
- Supabase (PostgreSQL + Realtime)
- Claude Sonnet 4.5

🎥 Demo: [video link]
🔗 Live: [deployed URL]
💻 Code: [github link]

#AIFirst #CollaborativeTech #GauntletAI @GauntletAI
```

**Submit Package:**
- GitHub repository URL
- Demo video link
- Pre-Search document
- AI Development Log
- AI Cost Analysis
- Deployed application URL
- Social post link/screenshot

---

## 🛠️ TECHNICAL REFERENCE

### **AI Edge Function Auth Flow**

| Step | Action |
|------|--------|
| 1 | User logs in → gets Supabase JWT |
| 2 | User opens board → has access (owner or in board_permissions) |
| 3 | User issues AI command → frontend sends `Authorization: Bearer <token>` |
| 4 | Edge Function: validate JWT → check edit permission (viewer = 403) → execute if editor/admin/owner |

**Checks per request:** (1) Valid token, (2) edit permission on board. View-only users cannot issue AI commands.

*If board sharing is skipped:* Check `boards.owner_id === user.id` only (boards stay private to creator).

---

### **Simultaneous AI Commands & Conflict Handling**

**G4 stance:** Last-write-wins acceptable; document your approach. Test simultaneous AI commands from multiple users.

**Approach:** Concurrent execution with last-write-wins (no queuing).

| Scenario | Behavior |
|----------|----------|
| User A: "Add yellow sticky" / User B: "Add blue sticky" (same time) | Both execute; both appear on board |
| Both modify the same object | Whichever write finishes last wins |
| Creation commands | Independent; no conflict |
| Layout commands (arrange in grid) | May interleave; last-write-wins on positions |

**Why no queue:**
- Simpler to implement
- G4 explicitly accepts last-write-wins
- Matches object sync behavior (already last-write-wins)
- Faster response (no queue wait)

**Reliability:** Each command executes atomically; Supabase handles concurrent writes. Document approach in submission.

---

### **Board Sharing Model**

| Aspect | Implementation |
|--------|----------------|
| **Method** | Shareable links only (no email invites) |
| **Permissions** | viewer (read-only), editor (create/edit/delete), admin (share, delete board) |
| **Storage** | `board_permissions`: user_id + board_id + role |
| **URLs** | Unique `share_slug` per board → `/b/{slug}` |
| **Flow** | User opens link → auth if needed → add to `board_permissions` (default: editor) → redirect to board |
| **Enforcement** | RLS + API: viewers cannot write; editors/admins can |

---

### **Object Types & Behavioral Definitions**

| Type | Definition | Behavior |
|------|------------|----------|
| **Frames** | Hierarchical containers that group objects | Objects inside a frame move/resize with it. Have titles. Can be resized to fit their contents. Structural containers. |
| **Shapes** | Basic drawing primitives (rectangles, circles, lines) | Independent objects, not containers. |
| **Connectors** | Lines/arrows connecting objects | Link two objects by ID; update when source/target moves. |
| **Standalone text** | Text blocks without sticky background (G4) | Separate from stickies. No sticky box; font/size/color only. Simpler than stickies. |
| **Sticky notes** | Text + colored background box | Create, edit text, change colors. Full controls. |

*Key difference: Sticky notes = text + container; standalone text = text only (no box). G4 lists both; implement as separate types.*

**User Journey Map labels:** AI generates domain-appropriate stage names (e.g. "Awareness, Consideration, Decision, Use, Advocacy"), not generic "Stage 1, 2, 3...". Same logic as SWOT: G4 expects labeled quadrants, not "Quadrant 1–4."

---

### **Complete AI Tool Schema**

```typescript
const TOOL_DEFINITIONS = [
  {
    name: "createStickyNote",
    description: "Create a sticky note on the board",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        color: { type: "string", enum: ["yellow", "pink", "blue", "green", "purple"] }
      },
      required: ["text", "x", "y"]
    }
  },
  {
    name: "createText",
    description: "Create standalone text (no sticky box). Simpler than sticky notes: font/size/color only.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        fontSize: { type: "number" },
        color: { type: "string" }
      },
      required: ["text", "x", "y"]
    }
  },
  {
    name: "createShape",
    description: "Create a basic drawing primitive (rectangle, circle, arrow). Independent object, not a container.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["rectangle", "circle", "arrow"] },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        color: { type: "string" }
      },
      required: ["type", "x", "y", "width", "height"]
    }
  },
  {
    name: "createFrame",
    description: "Create a hierarchical frame container. Objects placed inside move/resize with the frame. Has a title. Can be resized to fit contents.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["title", "x", "y", "width", "height"]
    }
  },
  {
    name: "createConnector",
    description: "Create a line or arrow connecting two objects. Use getBoardState to get object IDs.",
    input_schema: {
      type: "object",
      properties: {
        fromId: { type: "string", description: "ID of source object" },
        toId: { type: "string", description: "ID of target object" },
        style: { type: "string", enum: ["line", "arrow"], description: "Line or arrow style" }
      },
      required: ["fromId", "toId"]
    }
  },
  {
    name: "moveObject",
    description: "Move an object to new position",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["objectId", "x", "y"]
    }
  },
  {
    name: "resizeObject",
    description: "Resize an object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["objectId", "width", "height"]
    }
  },
  {
    name: "rotateObject",
    description: "Rotate an object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        rotation: { type: "number", description: "Rotation in degrees (0-360)" }
      },
      required: ["objectId", "rotation"]
    }
  },
  {
    name: "changeColor",
    description: "Change object color",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        color: { type: "string" }
      },
      required: ["objectId", "color"]
    }
  },
  {
    name: "updateText",
    description: "Update text content",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" },
        text: { type: "string" }
      },
      required: ["objectId", "text"]
    }
  },
  {
    name: "deleteObject",
    description: "Delete an object",
    input_schema: {
      type: "object",
      properties: {
        objectId: { type: "string" }
      },
      required: ["objectId"]
    }
  },
  {
    name: "arrangeInGrid",
    description: "Arrange objects in grid layout",
    input_schema: {
      type: "object",
      properties: {
        objectIds: { type: "array", items: { type: "string" } },
        columns: { type: "number" },
        spacing: { type: "number" }
      },
      required: ["objectIds", "columns"]
    }
  },
  {
    name: "getBoardState",
    description: "Get current board state for context",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];
```

### **Claude System Prompt**

```
You are an AI assistant for CollabBoard, a collaborative whiteboard tool.

Users can ask you to manipulate the board using natural language.
The board contains: sticky notes (text + colored box), standalone text (text only, no box), shapes (rectangles, circles, arrows), frames (hierarchical containers—objects inside move with the frame), and connectors (lines/arrows between objects).

Available tools:
- createStickyNote, createText, createShape, createFrame, createConnector
- moveObject, resizeObject, rotateObject
- changeColor, updateText, deleteObject
- arrangeInGrid
- getBoardState (use this first for complex commands)

Template commands you should recognize:
1. "Create SWOT analysis" → 2x2 grid of frames labeled Strengths, Weaknesses, Opportunities, Threats
2. "Create user journey map with N stages" → Horizontal row of N frames with contextual labels (e.g. Awareness, Consideration, Decision, Use, Advocacy)—not generic "Stage 1..N"
3. "Create retrospective board" → 3 frames: What Went Well, What Didn't, Action Items

Guidelines:
- Use domain-appropriate labels, not generic: SWOT = Strengths/Weaknesses/etc.; Journey = Awareness/Consideration/Decision/Use/Advocacy (or similar); Retro = What Went Well/What Didn't/Action Items
- Use realistic positions (x: 100-1500, y: 100-1000)
- Default sizes: sticky notes 200x150, frames 400x300, standalone text auto-width
- Leave spacing between objects (50-100px)
- For complex operations, call getBoardState first
- Execute tool calls sequentially

Always confirm actions: "I've created a SWOT analysis with 4 frames."
```

---

## 📊 SUCCESS CHECKLIST

### **Must Have (P0):**
- [x] MVP features (done)
- [ ] Rotation + transforms (critical for usability)
- [ ] Multi-select (essential for batch operations)
- [ ] Delete, duplicate, copy/paste (core operations)
- [ ] Frames (grouping/organization; hierarchical containers)
- [ ] Connectors (lines/arrows) — *G4 required*
- [ ] Standalone text (text-only elements; no sticky box) — *G4 required; separate from stickies*
- [ ] AI agent with 13 tools (includes createConnector, createText)
- [ ] 3 template commands (SWOT, Journey, Retro)
- [ ] All 5 test scenarios passing
- [ ] 60 FPS performance
- [ ] Demo video
- [ ] All documentation

### **Nice to Have (P1) / Stretch:**
- [ ] Board sharing (shareable links + viewer/editor/admin) — *add if time allows*
- [ ] Keyboard shortcuts (Cmd+D, Delete, etc.)
- [ ] Undo/redo
- [ ] Export board as image
- [ ] Board templates library

### **Skip if Needed (P2):**
- Grid snapping
- Ruler/guides
- Object alignment helpers
- Advanced AI commands

---

## ⚠️ RISK MANAGEMENT

| Risk | Mitigation |
|------|------------|
| AI integration takes too long | Start with 3 basic commands, expand later |
| Running out of time | **Cut board sharing first** (stretch goal). Prioritize: rotation, multi-select, delete/duplicate, frames, connectors, AI. |
| Connectors complexity | Basic line/arrow only; no bezier curves in MVP |
| Performance issues | Implement viewport culling in Hour 24 |
| Board sharing bugs | Test after implementation; defer if needed |

---

## 🎯 DAILY CHECKPOINT (End of Day 1 - Hour 24)

**Must be complete:**
- ✅ Rotation + transforms implemented
- ✅ Multi-select, duplicate, delete working
- ✅ Frames (hierarchical containers) implemented
- ✅ Connectors (lines/arrows) implemented
- ✅ AI infrastructure setup (Edge Function deployed)
- ✅ At least 7 AI tools working (including createConnector, createText)

**Stretch:** Board sharing. If not complete, cut board sharing; prioritize canvas + AI.

---

## 🚀 FINAL NOTE

**Remember:** You already have 70% done (MVP). This 48 hours is about:
1. **Hours 0-12:** Canvas features (rotation, multi-select, delete/duplicate/copy-paste, connectors, frames). Board sharing = stretch.
2. **Hours 12-24:** AI agent implementation
3. **Hours 24-36:** Testing + performance
4. **Hours 36-48:** Documentation + video + submit

**Priority:** Canvas + AI first. Board sharing only if time allows.

**You've got this! 🎯**

Project completion = Austin admission. Ship it!
