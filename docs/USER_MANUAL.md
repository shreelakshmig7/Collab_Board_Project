# CollabBoard — User Manual

**Version 2.1 | February 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
   - 2.1 [Signing In](#21-signing-in)
   - 2.2 [System Requirements](#22-system-requirements)
3. [Board Management](#3-board-management)
   - 3.1 [The Dashboard](#31-the-dashboard)
   - 3.2 [Creating a Board](#32-creating-a-board)
   - 3.3 [Searching Boards](#33-searching-boards)
   - 3.4 [Renaming a Board](#34-renaming-a-board)
   - 3.5 [Deleting a Board](#35-deleting-a-board)
   - 3.6 [Sharing a Board](#36-sharing-a-board)
   - 3.7 [Board Roles](#37-board-roles)
4. [Navigating the Canvas](#4-navigating-the-canvas)
   - 4.1 [Pan (Scroll Around)](#41-pan-scroll-around)
   - 4.2 [Zoom](#42-zoom)
5. [The Toolbar](#5-the-toolbar)
   - 5.1 [Undo and Redo](#51-undo-and-redo)
   - 5.2 [Select Tool](#52-select-tool)
   - 5.3 [Sticky Note Tool](#53-sticky-note-tool)
   - 5.4 [Rectangle Tool](#54-rectangle-tool)
   - 5.5 [Circle Tool](#55-circle-tool)
   - 5.6 [Frame Tool](#56-frame-tool)
   - 5.7 [Text Tool](#57-text-tool)
   - 5.8 [Connector Tool](#58-connector-tool)
   - 5.9 [Color Picker](#59-color-picker)
   - 5.10 [Size Controls](#510-size-controls)
   - 5.11 [Connector Style](#511-connector-style)
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
   - 6.11 [Right-Click Context Menu](#611-right-click-context-menu)
   - 6.12 [Layer Order — Bring to Front / Send to Back](#612-layer-order--bring-to-front--send-to-back)
7. [Frames and Grouping](#7-frames-and-grouping)
8. [Connectors](#8-connectors)
9. [Real-Time Collaboration](#9-real-time-collaboration)
   - 9.1 [Multiplayer Cursors](#91-multiplayer-cursors)
   - 9.2 [Presence Indicator](#92-presence-indicator)
   - 9.3 [Object Sync](#93-object-sync)
   - 9.4 [Conflict Handling](#94-conflict-handling)
   - 9.5 [Disconnect / Reconnect](#95-disconnect--reconnect)
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
- **Undo / Redo** — full per-user history for every action taken on the canvas.
- **Layer management** — bring objects to the front or send them to the back with one click.

---

## 2. Getting Started

### 2.1 Signing In

CollabBoard requires a user account to access any board. Authentication is handled securely via Supabase Auth.

The login screen features a dark, frosted-glass card with the CollabBoard logo on a rich gradient background.

**Sign in with Google (recommended):**

1. Navigate to the CollabBoard URL (e.g., `https://your-app.vercel.app`).
2. Click the **Continue with Google** pill button.
3. Choose your Google account and grant permissions.
4. You are redirected to the Boards dashboard.

**Sign in with Email / Password:**

1. On the login page, click **Sign in with email**.
2. Enter your **email address** and **password**.
3. Click **Sign In**.

**Create a new account with Email:**

1. On the login page, click **Create account**.
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

After signing in you land on the **Boards Dashboard** — a frosted-glass card-grid view showing all boards you own or have been invited to.

### 3.1 The Dashboard

The dashboard is divided into two sections:

- **My Boards** — boards you created. Each board is shown as a card with its name, a color preview, and a three-dot actions menu.
- **Shared with you** — boards others have invited you to. These cards display a **Shared** badge and open in the role you were assigned (Editor or Viewer).

If you have no boards yet, an **empty state illustration** and a prominent **"+ Create your first board"** button are shown to help you get started.

---

### 3.2 Creating a Board

1. Click **+ New Board** (top right of the dashboard) or the **"+ Create your first board"** button when no boards exist.
2. A modal pop-up appears. Enter a board name (2–100 characters).
3. Click **Create**.
4. The new board opens immediately and is ready to use.

---

### 3.3 Searching Boards

A **search bar** at the top of the dashboard filters both "My Boards" and "Shared with you" in real time as you type.

- Type any part of the board name — matches are shown instantly.
- If no boards match your search, an "No boards match" message is shown for that section.
- Clear the search bar to return to the full list.

---

### 3.4 Renaming a Board

1. On the Boards dashboard, locate the board you want to rename.
2. Click the **⋮ (more options)** menu on that board card.
3. Select **Rename**.
4. A modal pop-up appears with the current name pre-filled. Edit it and press **Rename**.

---

### 3.5 Deleting a Board

> Only the board **owner** can delete a board.

1. On the Boards dashboard, open the **⋮** menu on the board card.
2. Select **Delete**.
3. Confirm the deletion when prompted.

> **Warning:** Deletion is permanent. All objects on the board are removed.

---

### 3.6 Sharing a Board

1. Open the board you wish to share.
2. Click the **Share** button in the top bar.
3. In the Share modal, enter the **email address** of the person you want to invite.
4. Select their **role**: Editor or Viewer.
5. Click **Send Invite**.

The invited user will see the board appear in their Boards dashboard within 15 seconds (auto-refreshed) or immediately upon their next login.

---

### 3.7 Board Roles

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
| **Scroll** | Use your trackpad two-finger scroll or scroll wheel |

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

The toolbar sits at the top of the board inside a frosted-glass bar. The active tool is highlighted with a **blue background and border** so you always know which tool is active.

When one or more objects are selected, additional action buttons (Copy, Delete, Front, Back) appear in the right portion of the toolbar.

---

### 5.1 Undo and Redo

Two arrow buttons sit at the **far left of the toolbar**, before any drawing tool:

| Button | Shortcut | Action |
|---|---|---|
| **↩ Undo** | `Ctrl+Z` / `Cmd+Z` | Reverts the last action |
| **↪ Redo** | `Ctrl+Y` / `Cmd+Y` / `Cmd+Shift+Z` | Re-applies the last undone action |

Buttons are **greyed out** when there is nothing to undo or redo.

**What can be undone / redone:**

| Action | Undoable |
|---|---|
| Create object (sticky, shape, frame, text, connector) | ✅ |
| Delete object(s) | ✅ |
| Move object(s) | ✅ |
| Resize object | ✅ |
| Edit text | ✅ |
| Change color | ✅ |
| Duplicate object(s) | ✅ |
| Bring to Front / Send to Back | ✅ |
| AI-generated changes | ❌ (AI actions affect the shared board directly) |

> **Note:** Undo history is **per-user and per-session** — it is stored locally and is not shared with collaborators. Closing the browser tab clears the undo history. The stack holds the last 50 actions.

> **Tip:** Undo/Redo keyboard shortcuts do not fire while you are typing inside a text edit field.

---

### 5.2 Select Tool

Use the Select tool to interact with existing objects.

- **Single click** — Selects one object. A selection highlight appears.
- **Shift + click** — Adds or removes an object from the current selection (multi-select).
- **Click and drag on empty canvas** — Draws a marquee rectangle; all objects fully inside are selected when you release.
- **Click and drag on the selection box** — Moves all selected objects together.
- **Click empty canvas** — Clears the selection.

---

### 5.3 Sticky Note Tool

Click the **Sticky** button, then **click anywhere on the canvas** to place a sticky note.

- Default color: yellow (`#FEF08A`).
- Default size: 180 × 120 px.
- Text placeholder ("double click to edit") is shown until you add content.

---

### 5.4 Rectangle Tool

Click the **Rect** button, then **click anywhere on the canvas** to create a rectangle.

- Default color: blue (`#93C5FD`).

---

### 5.5 Circle Tool

Click the **Circle** button, then **click anywhere on the canvas** to create a circle.

- Default color: blue (`#93C5FD`).
- Default diameter: 80 px.

---

### 5.6 Frame Tool

Click the **Frame** button, then **click anywhere on the canvas** to create a frame (container).

- Default color: indigo (`#6366f1`).
- Default size: 400 × 300 px.
- Frames have a header with a title and a body area for content.
- Objects placed inside a frame become children of that frame (see [Section 7](#7-frames-and-grouping)).

---

### 5.7 Text Tool

Click the **Text** button, then **click anywhere on the canvas** to add a standalone text element.

- Default font size: 18 px.
- Default color: dark gray (`#1a1a1a`).
- Double-click to edit the text after placing.

---

### 5.8 Connector Tool

Click the **Connector** button to enter connector mode. In connector mode:

1. **Click the source object** — it highlights with a "Select source node" tooltip.
2. **Click the target object** — the connector is drawn between the two objects.

Connectors automatically reposition their endpoints when connected objects are moved.

---

### 5.9 Color Picker

The color picker appears in the toolbar when an object is selected, showing **8 preset colors**:

| Color | Hex |
|---|---|
| Yellow | `#FEF08A` |
| Red | `#FECACA` |
| Green | `#BBF7D0` |
| Blue | `#BFDBFE` |
| Purple | `#E9D5FF` |
| Orange | `#FED7AA` |
| White | `#FFFFFF` |
| Dark Gray | `#1e293b` |

Click a color swatch to change the color of the selected object(s) instantly.

---

### 5.10 Size Controls

Two numeric input fields — **Width** and **Height** — let you specify the dimensions of a selected object.

- Range: 20–800 px for each dimension.
- For **circles**, editing Width automatically matches Height (uniform radius).
- To resize with the mouse, drag the transform handles on the selected object.

---

### 5.11 Connector Style

When the Connector tool is active or a connector is selected, choose from four line styles:

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

> **Tip:** Objects are placed with their top-left corner at the click position. The canvas position is calculated from your current pan/zoom level, so what you click is where the object appears on the board.

---

### 6.2 Selecting Objects

| Action | Result |
|---|---|
| Click an object (Select tool) | Selects that object |
| Shift + click another object | Adds to selection |
| Shift + click selected object | Removes from selection |
| Drag on empty canvas (Select tool) | Marquee (rectangle) selection |
| Click empty canvas | Deselects all |

Selected objects display a **blue highlight border**. When a single object is selected, resize and rotate handles appear around it.

---

### 6.3 Moving Objects

1. Switch to the **Select tool**.
2. **Click and drag** any selected object to move it.
3. If multiple objects are selected, **drag any one** — all selected objects move together.

Moved positions are synced in real time.

---

### 6.4 Resizing Objects

1. Select an object using the Select tool.
2. **Drag the corner or edge handles** that appear around the selection.
3. Release when the desired size is reached.

You can also type exact pixel values in the **Width** and **Height** inputs in the toolbar.

Minimum size: 8 × 8 px.

---

### 6.5 Rotating Objects

1. Select an object.
2. Hover over the **rotation handle** (the circular arrow above the selection box).
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

The color changes instantly and syncs to all users. This action is undoable.

---

### 6.8 Deleting Objects

| Method | Action |
|---|---|
| **Delete** or **Backspace** key | Deletes all selected objects |
| **Delete button** in the toolbar | Deletes all selected objects |
| Right-click context menu → **Delete** | Deletes the right-clicked object |

> **Note:** Deleting a frame also deletes all objects nested inside it (children). This is undoable — Ctrl+Z restores the frame and all its children.

---

### 6.9 Duplicating Objects

1. Select one or more objects.
2. Press **Ctrl+D** (Windows/Linux) or **Cmd+D** (Mac), or click the **Copy** button in the toolbar.

Duplicated objects appear offset from the originals and are immediately selected so you can move them.

---

### 6.10 Copy and Paste

| Action | Shortcut |
|---|---|
| Copy selected objects | `Ctrl+C` / `Cmd+C` |
| Paste objects | `Ctrl+V` / `Cmd+V` |

Pasted objects appear with a small offset from the original positions.

---

### 6.11 Right-Click Context Menu

**Right-clicking on the canvas** (or on an object) opens a context menu with quick actions.

**Right-clicking an object:**

| Menu Item | Action |
|---|---|
| **Duplicate** | Creates a copy of the selected object |
| **Delete** | Removes the selected object |

**Right-clicking on empty canvas:**

| Menu Item | Action |
|---|---|
| Tool shortcuts | Quick access to common creation tools |

The context menu closes automatically when you click elsewhere or press **Escape**.

---

### 6.12 Layer Order — Bring to Front / Send to Back

On a canvas with many overlapping objects, you control which object appears **on top** using the layer buttons in the toolbar. These buttons appear whenever one or more objects are selected.

| Button | Action |
|---|---|
| **↑ Front** | Moves the selected object(s) above all other objects |
| **↓ Back** | Moves the selected object(s) below all other objects |

**Why this matters for Frames:**

Frames have a solid background. If you create an object and it appears hidden behind a frame, select the object and click **Front** to bring it above the frame. Conversely, if you want a frame to act as a true background container, select it and click **Back** to push it behind other content.

**Multi-select behaviour:**

When multiple objects are selected and you click **Front** or **Back**, all selected objects move together as a group, preserving their relative order among themselves.

**Frame + children:**

When you select a **Frame** and click **Front**, its child objects are automatically included so they stay above the frame and do not get buried.

**Undo support:**

Layer order changes are fully undoable. Press **Ctrl+Z** / **Cmd+Z** to restore the previous layer order.

**Sync to collaborators:**

Layer order is stored in the database and synced to all users on the board in real time.

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

### Frame Layering Tips

If objects inside your frame appear hidden behind the frame's background, select the frame and click **Back** in the toolbar to push the frame below its contents. Or select the hidden objects and click **Front** to bring them above.

### Nesting

Frames support nested objects. You can place any object type (sticky, shape, text, connector, even another frame) inside a frame.

---

## 8. Connectors

Connectors are lines or arrows that link two board objects to show relationships.

### Creating a Connector

1. Select the **Connector tool**.
2. Choose a line **style** from the toolbar (Arrow, Line, Dashed, Dotted).
3. **Click the source object** — it highlights with a tooltip to confirm selection.
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

---

### 9.2 Presence Indicator

The **top bar** shows **user avatars** for all users currently on this board. Each avatar displays the user's initials (or a color-coded circle) with their display name. Presence is refreshed every 25 seconds. A user is considered offline if no heartbeat is received for 75 seconds.

> Previously this showed plain text "Online (n)". It now displays a face-pile of avatar icons — one per active user.

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
| Bring to Front / Send to Back | ✅ Near-instant (≤ 4 s debounce) |
| AI-generated objects | ✅ Instant |

**Object sync latency target:** < 100 ms.

---

### 9.4 Conflict Handling

CollabBoard uses a **last-write-wins** strategy for simultaneous edits to the same object. If two users move the same sticky note at the same time, the final position reflects whichever update arrived at the server last.

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

1. Click the **AI ✦** button in the board interface (top right area).
2. A frosted-glass side panel slides open with a chat interface.
3. Type your command in the text field (1–4,000 characters).
4. Press **Enter** or click **Run**.

The AI processes your command (< 2 seconds for simple commands) and executes the required board operations automatically.

---

### 10.2 Creation Commands

| Example Prompt | What Happens |
|---|---|
| `Add a yellow sticky note that says "User Research"` | Creates a yellow sticky note with that text |
| `Create a blue rectangle` | Places a blue rectangle on the board |
| `Add a frame called "Sprint Planning"` | Creates a labeled frame container |
| `Create a green circle` | Places a green circle on the board |
| `Add a text label that says "Done"` | Creates a standalone text element |
| `Create 20 gray sticky notes` | Batch-creates 20 gray stickies in a grid layout in one operation |
| `Add 10 blue rectangles` | Batch-creates 10 rectangles in a grid layout |

> **Bulk creation:** When you ask for 3 or more objects of the same type, the AI batch-creates them all in one fast operation (typically < 2 seconds regardless of count).

---

### 10.3 Manipulation Commands

The AI reads the current board state to identify the target objects, then applies changes in a single batch operation.

| Example Prompt | What Happens |
|---|---|
| `Move all the pink sticky notes to the left side` | Reads board, finds all pink stickies, moves them in one batch |
| `Change all blue rectangles to green` | Recolors all matching rectangles at once |
| `Delete all sticky notes` | Removes all stickies in one operation |
| `Resize the frame to 600 by 400` | Resizes the specified frame |
| `Update the text of the sticky labeled "Draft" to "Done"` | Changes the text content of the matching object |
| `Rotate the rectangle 45 degrees` | Rotates the specified object |
| `Move all green stickies to the right` | Batch-moves all matching objects |

> **Batch operations:** Commands targeting "all" or "several" objects matching a description (color, type, label) are executed in a single database write — no per-object round trips.

---

### 10.4 Layout Commands

| Example Prompt | What Happens |
|---|---|
| `Arrange these sticky notes in a grid` | Aligns selected stickies in a regular grid layout |
| `Create a 2x3 grid of sticky notes for pros and cons` | Generates 6 stickies — pros in green, cons in red |
| `Space these elements evenly` | Distributes selected objects with equal spacing |

---

### 10.5 Complex / Template Commands

The AI builds complete structured layouts in **a single operation** — one LLM call, one database write. All objects (frames, cards, arrows) appear together.

| Example Prompt | What the AI Creates |
|---|---|
| `Create a SWOT analysis` | 2×2 quadrant: Strengths (green), Weaknesses (red), Opportunities (blue), Threats (orange) — each quadrant pre-filled with 2–3 relevant items |
| `Build a user journey map with 5 stages` | 5 color-coded columns (Awareness → Advocacy) with sticky note items in each |
| `Set up a retrospective board` | 3 columns: "What Went Well", "What Didn't", "Action Items" — each with sticky note starters |
| `Create a Kanban board` | 3 columns: To Do, In Progress, Done |
| `Create a flowchart for user onboarding` | Outer frame containing color-coded step nodes connected by arrows (start → process → decision → end) |
| `Make a flow diagram for the password reset process` | Same flowchart layout with domain-relevant steps |
| `Create a process flow for incident response` | Flowchart with steps specific to the scenario |
| `Create 20 gray sticky notes` | 20 stickies in a clean grid, placed without overlapping existing content |
| `Clear the board` / `Wipe everything` | Removes every object from the board in one operation |

#### Flowchart node color coding

| Node type | Color | When used |
|---|---|---|
| **Start** | Green | First step |
| **Process** | Blue | Regular steps |
| **Decision** | Yellow | Branching / conditional steps |
| **End** | Red | Final step |

#### Semantic color assignment

The AI automatically applies meaningful colors when creating objects with positive/negative semantics:

| Context | Color |
|---|---|
| Pros, strengths, positives, "do" items | Green (`#86efac`) |
| Cons, weaknesses, negatives, "don't" items | Red/pink (`#fca5a5`) |
| Grid of distinct categories | Different color per category |

---

### 10.6 AI Tips & Best Practices

- **Be specific:** "Add a red sticky note saying 'Blocker'" gives better results than "add a note".
- **Use template names:** Say "SWOT", "kanban", "retro", "user journey map", "flowchart", "flow diagram", or "process flow" and the AI picks the correct template automatically.
- **Batch operations work:** "Move all pink sticky notes to the left" or "delete all blue rectangles" — the AI handles any number of matching objects in one step.
- **Bulk creation is fast:** "Create 50 sticky notes" completes in under 2 seconds — the AI batches all inserts.
- **Domain-aware content:** Template commands produce relevant content — a "SWOT for a SaaS product" generates appropriate Strengths, Weaknesses, Opportunities, and Threats for that domain.
- **Board clearing:** "Clear the board", "wipe everything", or "start fresh" removes all objects instantly. **This cannot be undone** — use with care.
- **All users see changes:** AI-generated objects are written to the shared board and appear for everyone in real time.
- **Commands are auth-protected:** Only signed-in users can send AI commands.

#### Expected response times

| Command type | Examples | Target time |
|---|---|---|
| Simple creation | Create sticky note, add rectangle | < 2 seconds |
| Bulk creation | Create 20 stickies, add 50 rectangles | < 2 seconds |
| Templates | SWOT, kanban, retro, flowchart | 2–4 seconds |
| Batch manipulation | Move all pink stickies, delete all blue rects | 3–6 seconds |
| Board clear | Clear the board | < 2 seconds |

---

## 11. Keyboard Shortcuts Reference

| Action | Windows / Linux | Mac |
|---|---|---|
| **Undo** | `Ctrl+Z` | `Cmd+Z` |
| **Redo** | `Ctrl+Y` or `Ctrl+Shift+Z` | `Cmd+Y` or `Cmd+Shift+Z` |
| Delete selected objects | `Delete` or `Backspace` | `Delete` or `Backspace` |
| Duplicate selected objects | `Ctrl+D` | `Cmd+D` |
| Copy selected objects | `Ctrl+C` | `Cmd+C` |
| Paste objects | `Ctrl+V` | `Cmd+V` |
| Cancel text edit | `Escape` | `Escape` |
| Save text edit (single-line) | `Enter` | `Enter` |
| New line in text | `Shift+Enter` | `Shift+Enter` |
| Close context menu | `Escape` | `Escape` |

> **Undo / Redo shortcuts are disabled** while you are typing inside a text editing field, so normal typing is never interrupted.

---

## 12. Performance & Limits

| Metric | Target / Limit |
|---|---|
| Canvas frame rate | 60 FPS during pan and object manipulation |
| Object sync latency | < 100 ms |
| Cursor sync latency | < 50 ms |
| Layer order sync | ≤ 4 s (debounced Realtime refetch) |
| Object capacity | 500+ objects without performance degradation |
| Concurrent users | 5+ without degradation |
| AI — simple creation (sticky, shape, text) | < 2 seconds |
| AI — bulk creation (any count, same type) | < 2 seconds |
| AI — templates (SWOT, kanban, retro, flowchart) | 2–4 seconds |
| AI — batch manipulation (move/delete/recolor all) | 3–6 seconds |
| AI — board clear | < 2 seconds |
| AI command length | 1–4,000 characters |
| Board name length | 2–100 characters |
| Object text length | 0–10,000 characters |
| Object size range | 8–800 px (width and height) |
| Zoom range | 20%–300% |
| Undo history | Last 50 actions (per user, per session) |
| Board state sent to AI | Capped at 200 objects to protect context window |
| Flowchart steps | Up to ~15 steps (limited by canvas height) |

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

### Layer order (Front/Back) is not updating for other users

- Layer order is synced with a short debounce (up to 4 seconds). Wait a moment.
- If it still does not update, refresh the page. The stored `z_index` values will be loaded from the database on reconnect.
- Ensure the `z_index` migration SQL has been run: `ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;`

### Objects disappear after refreshing

- Board persistence requires `board_objects` to be properly set up in the Supabase schema. Run the SQL schema in `supabase/schema.sql` if you are self-hosting.
- Check that Row Level Security (RLS) policies allow reads for your user role.

### Undo does not work

- Undo history is **per-session** — it is cleared when you close or refresh the browser tab.
- Undo does not fire while a text field is focused (to avoid interfering with typing). Click on the canvas first, then press `Ctrl+Z`.
- Undo is not available for AI-generated changes (those are shared board operations, not per-user actions).
- Viewers cannot undo — the undo/redo buttons are hidden in view-only mode.

### Template objects (SWOT, flowchart, retro) are not appearing after the AI creates them

- Wait 1–2 seconds and check again — batch-inserted objects arrive via real-time subscription and render as they arrive.
- If the frame is visible but appears empty, try scrolling or panning slightly to trigger a re-render.
- Do **not** click the frame to "reveal" objects — if they are not visible after 3 seconds, refresh the page to re-sync from the database.

### The AI cleared the board when I asked it to create something

- Avoid using the word "reset" alone in commands that describe a domain (e.g., "password reset"). Use explicit language: "create a flowchart for the password reset process".
- Words that trigger a board clear: "clear the board", "wipe everything", "start fresh", "delete all objects", "reset the board".

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
