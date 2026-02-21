# CollabBoard — User Manual

**Version 1.0 | February 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
   - 2.1 [Signing In](#21-signing-in)
   - 2.2 [System Requirements](#22-system-requirements)
3. [Board Management](#3-board-management)
   - 3.1 [Creating a Board](#31-creating-a-board)
   - 3.2 [Renaming a Board](#32-renaming-a-board)
   - 3.3 [Deleting a Board](#33-deleting-a-board)
   - 3.4 [Sharing a Board](#34-sharing-a-board)
   - 3.5 [Board Roles](#35-board-roles)
4. [Navigating the Canvas](#4-navigating-the-canvas)
   - 4.1 [Pan (Scroll Around)](#41-pan-scroll-around)
   - 4.2 [Zoom](#42-zoom)
5. [The Toolbar](#5-the-toolbar)
   - 5.1 [Select Tool](#51-select-tool)
   - 5.2 [Sticky Note Tool](#52-sticky-note-tool)
   - 5.3 [Rectangle Tool](#53-rectangle-tool)
   - 5.4 [Circle Tool](#54-circle-tool)
   - 5.5 [Frame Tool](#55-frame-tool)
   - 5.6 [Text Tool](#56-text-tool)
   - 5.7 [Connector Tool](#57-connector-tool)
   - 5.8 [Color Picker](#58-color-picker)
   - 5.9 [Size Controls](#59-size-controls)
   - 5.10 [Connector Style](#510-connector-style)
6. [Working with Objects](#6-working-with-objects)
   - 6.1 [Creating Objects](#61-creating-objects)
   - 6.2 [Selecting Objects](#62-selecting-objects)
   - 6.3 [Moving Objects](#63-moving-objects)
   - 6.4 [Resizing Objects](#64-resizing-objects)
   - 6.5 [Rotating Objects](#65-rotating-objects)
   - 6.6 [Editing Text](#66-editing-text)
   - 6.7 [Changing Color](#67-changing-color)
   - 6.8 [Deleting Objects](#68-deleting-objects)
   - 6.9 [Duplicating Objects](#69-duplicating-objects)
   - 6.10 [Copy and Paste](#610-copy-and-paste)
7. [Frames and Grouping](#7-frames-and-grouping)
8. [Connectors](#8-connectors)
9. [Real-Time Collaboration](#9-real-time-collaboration)
   - 9.1 [Multiplayer Cursors](#91-multiplayer-cursors)
   - 9.2 [Presence Indicator](#92-presence-indicator)
   - 9.3 [Object Sync](#93-object-sync)
   - 9.4 [Conflict Handling](#94-conflict-handling)
10. [AI Board Agent](#10-ai-board-agent)
    - 10.1 [Opening the AI Panel](#101-opening-the-ai-panel)
    - 10.2 [Creation Commands](#102-creation-commands)
    - 10.3 [Manipulation Commands](#103-manipulation-commands)
    - 10.4 [Layout Commands](#104-layout-commands)
    - 10.5 [Complex / Template Commands](#105-complex--template-commands)
    - 10.6 [AI Tips & Best Practices](#106-ai-tips--best-practices)
11. [Keyboard Shortcuts Reference](#11-keyboard-shortcuts-reference)
12. [Performance & Limits](#12-performance--limits)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Introduction

**CollabBoard** is a real-time collaborative whiteboard that lets multiple users brainstorm, plan, and design together — simultaneously and with zero merge conflicts. It combines:

- An **infinite canvas** for sticky notes, shapes, frames, connectors, and text.
- **Live multiplayer cursors** and presence so you always know who is online.
- A built-in **AI Board Agent** powered by Claude that understands natural language commands and can create layouts, templates, and multi-step workflows on your behalf.
- **Persistent state** — your board is saved automatically and survives browser refreshes, network drops, and user reconnections.

---

## 2. Getting Started

### 2.1 Signing In

CollabBoard requires a user account to access any board. Authentication is handled securely via Supabase Auth.

**Sign in with Google (recommended):**

1. Navigate to the CollabBoard URL (e.g., `https://your-app.vercel.app`).
2. Click **Sign in with Google**.
3. Choose your Google account and grant permissions.
4. You are redirected to the Boards dashboard.

**Sign in with Email/Password:**

1. On the login page, enter your **email address** and **password**.
2. Click **Sign In**.

**Create a new account with Email:**

1. On the login page, switch to the **Sign Up** tab.
2. Enter your email and a password.
3. Check your inbox for a confirmation email and click the link to activate your account.
4. Return to the app and sign in.

> **Note:** Your profile (display name, avatar) is created automatically on first sign-in.

---

### 2.2 System Requirements

| Requirement | Minimum |
|---|---|
| Browser | Chrome 110+, Firefox 110+, Safari 16+, Edge 110+ |
| Internet | Stable connection required for real-time sync |
| Screen | 1024 × 768 or larger recommended |
| JavaScript | Must be enabled |

---

## 3. Board Management

After signing in you land on the **Boards List** — your personal dashboard where you can see all boards you own or have been invited to.

### 3.1 Creating a Board

1. Click the **+ New Board** button (top right of the dashboard).
2. Enter a board name (2–100 characters).
3. Click **Create**.
4. The new board opens immediately and is ready to use.

---

### 3.2 Renaming a Board

1. On the Boards dashboard, locate the board you want to rename.
2. Click the **⋮ (more options)** menu on that board card.
3. Select **Rename**.
4. Type the new name and confirm.

---

### 3.3 Deleting a Board

> Only the board **owner** can delete a board.

1. On the Boards dashboard, open the **⋮** menu on the board card.
2. Select **Delete**.
3. Confirm the deletion when prompted.

> **Warning:** Deletion is permanent. All objects on the board are removed.

---

### 3.4 Sharing a Board

1. Open the board you wish to share.
2. Click the **Share** button in the top bar.
3. In the Share modal, enter the **email address** of the person you want to invite.
4. Select their **role**: Editor or Viewer.
5. Click **Send Invite**.

The invited user will see the board appear in their Boards dashboard within 15 seconds (auto-refreshed) or immediately upon their next login.

---

### 3.5 Board Roles

| Role | Can View | Can Edit | Can Share | Can Delete Board |
|---|---|---|---|---|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ |

---

## 4. Navigating the Canvas

The CollabBoard canvas is infinite — you can scroll, zoom, and position content anywhere.

### 4.1 Pan (Scroll Around)

| Method | Action |
|---|---|
| **Drag on empty canvas** | Click and drag any empty area of the canvas to pan |
| **Pan Tool** | Select the Pan tool from the toolbar, then drag anywhere |
| **Scroll** | Use your trackpad two-finger scroll or scroll wheel (may zoom depending on OS settings) |

---

### 4.2 Zoom

| Method | Action |
|---|---|
| **Mouse wheel** | Scroll up to zoom in, scroll down to zoom out |
| **Pinch gesture** (trackpad) | Pinch to zoom in or out |

**Zoom range:** 20% (0.2×) to 300% (3×).

Zooming is centered on the cursor position, so you can zoom into any specific area of the board.

---

## 5. The Toolbar

The toolbar sits on the left side of the board. It contains all drawing tools, the color picker, size controls, and action buttons.

### 5.1 Select Tool

**Shortcut:** Click the arrow/cursor icon.

Use the Select tool to interact with existing objects.

- **Single click** — Selects one object. A selection highlight appears.
- **Shift + click** — Adds or removes an object from the current selection (multi-select).
- **Click and drag on empty canvas** — Draws a marquee rectangle; all objects fully inside are selected when you release.
- **Click and drag on the selection box** — Moves all selected objects together.
- **Click empty canvas** — Clears the selection.

---

### 5.2 Sticky Note Tool

Click the sticky note icon, then **click anywhere on the canvas** to place a sticky note at that position.

- Default color: yellow (`#FEF08A`).
- Default size: 180 × 120 px.
- Text placeholder ("double click to edit") is shown until you add content.

---

### 5.3 Rectangle Tool

Click the rectangle icon, then **click anywhere on the canvas** to create a rectangle.

- Default color: blue (`#93C5FD`).
- Size is set via the **Width/Height** inputs in the toolbar before placing.

---

### 5.4 Circle Tool

Click the circle icon, then **click anywhere on the canvas** to create a circle.

- Default color: blue (`#93C5FD`).
- Default diameter: 80 px.

---

### 5.5 Frame Tool

Click the frame icon, then **click anywhere on the canvas** to create a frame (container).

- Default color: indigo (`#6366f1`).
- Default size: 400 × 300 px.
- Frames have a header with a title and a body area for content.
- Objects placed inside a frame become children of that frame (see [Section 7](#7-frames-and-grouping)).

---

### 5.6 Text Tool

Click the text icon, then **click anywhere on the canvas** to add a standalone text element.

- Default font size: 18 px.
- Default color: dark gray (`#1a1a1a`).
- Double-click to edit the text after placing.

---

### 5.7 Connector Tool

Click the connector icon to enter connector mode. In connector mode:

1. **Click the source object** — the first object the connector starts from.
2. **Click the target object** — the connector is drawn between the two objects.

Connectors automatically reposition their endpoints when connected objects are moved. Select a connector style (arrow, line, dashed, dotted) from the toolbar before drawing.

---

### 5.8 Color Picker

The color picker appears in the toolbar and shows **8 preset colors**:

| Color | Hex |
|---|---|
| Yellow | `#FEF08A` |
| Red | `#FCA5A5` |
| Green | `#86EFAC` |
| Blue | `#93C5FD` |
| Purple | `#C4B5FD` |
| Orange | `#FD BA74` |
| White | `#FFFFFF` |
| Dark Gray | `#374151` |

- Click a color swatch to set the active color **before** placing an object, or change the color of a **selected** object.

---

### 5.9 Size Controls

Two numeric input fields — **Width** and **Height** — let you specify the dimensions of objects before you place them.

- Range: 20–800 px for each dimension.
- These controls affect the next object you create (sticky, rect, circle, frame, text).
- To resize an already-placed object, select it and drag the transform handles (see [Section 6.4](#64-resizing-objects)).

---

### 5.10 Connector Style

When the Connector tool is active, choose from four line styles:

| Style | Description |
|---|---|
| **Arrow** | Solid line with arrowhead at target end |
| **Line** | Solid line, no arrowhead |
| **Dashed** | Dashed line |
| **Dotted** | Dotted line |

---

## 6. Working with Objects

### 6.1 Creating Objects

1. Select the desired tool from the toolbar (Sticky, Rect, Circle, Frame, Text).
2. Optionally choose a color and/or size.
3. **Click on the canvas** at the position where you want to place the object.

The object appears immediately and is synced to all other users on the board in real time.

> **Tip:** Objects are placed with their top-left corner at the click position (viewport-aware — the canvas position is calculated from your current pan/zoom level).

---

### 6.2 Selecting Objects

| Action | Result |
|---|---|
| Click an object (Select tool) | Selects that object |
| Shift + click another object | Adds to selection |
| Shift + click selected object | Removes from selection |
| Drag on empty canvas (Select tool) | Marquee (rectangle) selection |
| Click empty canvas | Deselects all |

Selected objects display a highlight border. When a single object is selected, resize/rotate handles appear.

---

### 6.3 Moving Objects

1. Switch to the **Select tool**.
2. **Click and drag** any selected object to move it.
3. If multiple objects are selected, **drag any one** of them — all selected objects move together.

Moved positions are synced in real time.

---

### 6.4 Resizing Objects

1. Select an object using the Select tool.
2. **Drag the corner or edge handles** that appear around the selection.
3. Release when the desired size is reached.

Minimum size: 8 × 8 px (objects cannot be resized smaller than this).

---

### 6.5 Rotating Objects

1. Select an object.
2. Hover over the **rotation handle** (circular arrow above the selection box).
3. **Click and drag** to rotate the object freely.

---

### 6.6 Editing Text

All text-bearing objects (sticky notes, frames, text elements, rectangles, circles) support inline text editing.

1. **Double-click** the object to enter edit mode.
2. A text input overlay appears. Type your content.
3. Press **Enter** to save (for single-line inputs) or click outside the object.
4. Press **Shift + Enter** to insert a new line inside multi-line text areas.
5. Press **Escape** to cancel and discard changes.

Empty objects display a "double click to edit" watermark placeholder — this is not stored as real content.

---

### 6.7 Changing Color

1. Select the object(s) you want to recolor.
2. Click a color swatch in the **Color Picker** in the toolbar.

The color changes instantly and syncs to all users.

---

### 6.8 Deleting Objects

| Method | Action |
|---|---|
| **Delete** or **Backspace** key | Deletes all selected objects |
| **Delete button** in the toolbar | Deletes all selected objects |

> **Note:** Deleting a frame also deletes all objects nested inside it (children).

---

### 6.9 Duplicating Objects

1. Select one or more objects.
2. Press **Ctrl+D** (Windows/Linux) or **Cmd+D** (Mac), or click the **Copy** button in the toolbar.

Duplicated objects appear offset from the originals and are immediately selected so you can move them.

---

### 6.10 Copy and Paste

| Action | Shortcut |
|---|---|
| Copy selected objects | **Ctrl+C** / **Cmd+C** |
| Paste objects | **Ctrl+V** / **Cmd+V** |

Pasted objects appear with a small offset from the original positions. You can paste multiple times; each paste adds another copy.

---

## 7. Frames and Grouping

**Frames** are special container objects that group and organize related content.

### Creating a Frame

1. Select the **Frame tool** from the toolbar.
2. Click on the canvas to place the frame.
3. Double-click the frame header to rename it.

### Adding Objects to a Frame

Objects are **automatically parented** to a frame when:

- They are **created with a click** inside a frame's boundaries.
- They are **dragged and dropped** onto a frame.

When an object belongs to a frame:

- Moving the **frame** moves all its children with it.
- Deleting the **frame** deletes all its children.

### Removing Objects from a Frame

Drag the object outside the frame's boundary area to detach it.

### Nesting

Frames support nested objects. You can place any object type (sticky, shape, text, connector, even another frame) inside a frame.

---

## 8. Connectors

Connectors are lines or arrows that link two board objects to show relationships.

### Creating a Connector

1. Select the **Connector tool**.
2. Choose a line **style** from the toolbar (Arrow, Line, Dashed, Dotted).
3. **Click the source object** — it highlights to confirm selection.
4. **Click the target object** — the connector is drawn between them.

### Connector Behavior

- Connectors **track object movement**: if you move a connected object, the connector endpoint follows automatically.
- Select a connector by clicking on its line and delete it with the **Delete** key.

### Supported Styles

| Style | Appearance |
|---|---|
| Arrow | → solid line with directional arrowhead |
| Line | — plain solid line |
| Dashed | - - - dashed line |
| Dotted | · · · dotted line |

---

## 9. Real-Time Collaboration

CollabBoard is designed for simultaneous multi-user editing. All changes appear for every connected user with minimal latency.

### 9.1 Multiplayer Cursors

Every connected user's **cursor is visible** on your canvas with a **name label**. Cursors update in near real time (≤ 50 ms target). This lets you see exactly where your teammates are working at any moment.

You can see other cursors even when they are outside your current viewport — the cursor indicators will appear at the edge of the screen pointing toward the remote cursor's actual position.

---

### 9.2 Presence Indicator

The **top bar** shows a list of all users currently online on this board (their name and avatar or initials). Presence is refreshed every 25 seconds. A user is considered offline if no heartbeat has been received for 75 seconds.

---

### 9.3 Object Sync

All object operations are synced in real time via Supabase Realtime:

| Operation | Synced to others |
|---|---|
| Create object | ✅ Instant |
| Move object | ✅ Instant |
| Resize / rotate | ✅ Instant |
| Edit text | ✅ On save (exit edit) |
| Change color | ✅ Instant |
| Delete object | ✅ Instant |
| AI-generated objects | ✅ Instant |

**Object sync latency target:** < 100 ms.

---

### 9.4 Conflict Handling

CollabBoard uses a **last-write-wins** strategy for simultaneous edits to the same object. If two users move the same sticky note at the same time, the final position reflects whichever update arrived at the server last.

This approach is simple and transparent: no merge conflicts, no dialogs, no blocking. For creative collaboration workflows, last-write-wins is generally acceptable.

> **Tip:** To avoid conflicts when multiple people are editing, consider using Frames to divide the board into ownership zones.

---

### 9.5 Disconnect / Reconnect

If your network connection drops:

- Your local board state is preserved in memory.
- When the connection is restored, Supabase Realtime automatically reconnects and re-syncs the latest board state from the server.
- No manual action is required — the board updates itself.

---

## 10. AI Board Agent

The AI Board Agent lets you control the board using natural language. It is powered by Anthropic Claude and runs as a secure serverless function. All AI-generated changes appear on the board for all users in real time.

### 10.1 Opening the AI Panel

1. Look for the **AI** button or panel in the board interface (usually in the top bar or a side panel).
2. Click it to open the AI command input.
3. Type your command in the text field (1–4,000 characters).
4. Press **Enter** or click **Run**.

The AI processes your command (< 2 seconds for simple commands) and executes the required board operations automatically.

---

### 10.2 Creation Commands

| Example Prompt | What Happens |
|---|---|
| `Add a yellow sticky note that says "User Research"` | Creates a yellow sticky note with that text |
| `Create a blue rectangle at position 100, 200` | Places a blue rectangle at the specified coordinates |
| `Add a frame called "Sprint Planning"` | Creates a labeled frame container |
| `Create a green circle` | Places a green circle on the board |
| `Add a text label that says "Done"` | Creates a standalone text element |

---

### 10.3 Manipulation Commands

| Example Prompt | What Happens |
|---|---|
| `Move all the pink sticky notes to the right side` | Reads board state, identifies pink stickies, moves them |
| `Change the sticky note color to green` | Updates color of selected/specified sticky |
| `Resize the frame to 600 by 400` | Resizes the specified frame |
| `Update the text of the first sticky to "In Progress"` | Changes the text content |
| `Delete all rectangles` | Removes all rectangle objects from the board |

---

### 10.4 Layout Commands

| Example Prompt | What Happens |
|---|---|
| `Arrange these sticky notes in a grid` | Aligns selected stickies in a regular grid layout |
| `Create a 2x3 grid of sticky notes for pros and cons` | Generates 6 sticky notes in 2 columns × 3 rows |
| `Space these elements evenly` | Distributes selected objects with equal spacing |

---

### 10.5 Complex / Template Commands

The AI can plan and execute **multi-step workflows** that create structured templates in one command.

| Example Prompt | What the AI Creates |
|---|---|
| `Create a SWOT analysis` | A 2×2 quadrant layout with labeled quadrants: Strengths, Weaknesses, Opportunities, Threats |
| `Build a user journey map with 5 stages` | 5 labeled columns (stages) with sticky note placeholders in each |
| `Set up a retrospective board` | Three columns: "What Went Well", "What Didn't", "Action Items" — each with a header frame |
| `Create a Kanban board` | Three columns: To Do, In Progress, Done — with frames and sticky placeholders |
| `Build a 2x3 pros and cons grid` | Six sticky notes arranged in 2 columns (Pros / Cons) × 3 rows |

---

### 10.6 AI Tips & Best Practices

- **Be specific:** "Add a red sticky note in the top-left area saying 'Blocker'" gives better results than "add a note".
- **Reference existing objects:** "Move all blue rectangles below the frame labeled Sprint Planning" — the AI reads the current board state to locate objects.
- **Use templates for common patterns:** The AI knows SWOT, Kanban, retrospective, user journey map, and 2×N grid layouts out of the box.
- **Multi-step commands work:** You can ask for complex workflows in one sentence — the AI breaks them into steps and executes them in sequence.
- **All users see changes:** AI-generated objects are written to the shared board and appear for everyone instantly.
- **Commands are auth-protected:** Only signed-in users can send AI commands.

---

## 11. Keyboard Shortcuts Reference

| Action | Windows / Linux | Mac |
|---|---|---|
| Delete selected objects | `Delete` or `Backspace` | `Delete` or `Backspace` |
| Duplicate selected objects | `Ctrl+D` | `Cmd+D` |
| Copy selected objects | `Ctrl+C` | `Cmd+C` |
| Paste objects | `Ctrl+V` | `Cmd+V` |
| Cancel text edit | `Escape` | `Escape` |
| Save text edit (single-line) | `Enter` | `Enter` |
| New line in text | `Shift+Enter` | `Shift+Enter` |

---

## 12. Performance & Limits

| Metric | Target / Limit |
|---|---|
| Canvas frame rate | 60 FPS during pan, zoom, and object manipulation |
| Object sync latency | < 100 ms |
| Cursor sync latency | < 50 ms |
| Object capacity | 500+ objects without performance degradation |
| Concurrent users | 5+ without degradation |
| AI response time | < 2 seconds for single-step commands |
| AI command length | 1–4,000 characters |
| Board name length | 2–100 characters |
| Object text length | 0–10,000 characters |
| Object size range | 8–800 px (width and height) |
| Zoom range | 20%–300% |
| Board state sent to AI | Capped at 200 objects to protect context window |

---

## 13. Troubleshooting

### I can't see other users' cursors

- Ensure both users are on the **same board** (same board URL/ID).
- Check that Supabase Realtime is enabled for the `cursors` table in your project settings.
- Cursor presence refreshes every 1.5 seconds — wait a moment after the other user connects.

### My changes are not appearing for other users

- Verify your internet connection is stable.
- Check that `board_objects` is added to the `supabase_realtime` publication in Supabase → Database → Replication.
- Try refreshing the page — the board will re-sync from the server.

### Objects disappear after refreshing

- Board persistence requires `board_objects` to be properly set up in the Supabase schema. Run the SQL schema in `supabase/schema.sql` if you are self-hosting.
- Check that Row Level Security (RLS) policies allow reads for your user role.

### The AI command returns an error

- Ensure you are signed in (AI commands require a valid session token).
- Confirm the `ANTHROPIC_API_KEY` environment variable is set in your deployment (Vercel project settings).
- Try a shorter, more specific command.
- AI commands are limited to 4,000 characters.

### Login with Google does not redirect back

- In Supabase → Authentication → URL Configuration, ensure your app URL (local or deployed) is listed under **Redirect URLs**.
- For local development: `http://localhost:5173` must be in the list.
- For production: your full Vercel URL (e.g., `https://your-app.vercel.app`) must be in the list.

### I see "Sign in required" even after signing in

- Clear browser cookies and cache for the site and sign in again.
- Ensure pop-ups are not blocked for Google OAuth.

---

*For setup instructions, deployment guide, and architecture documentation, see the [README](../README.md) and [docs/DEPLOY.md](DEPLOY.md).*
