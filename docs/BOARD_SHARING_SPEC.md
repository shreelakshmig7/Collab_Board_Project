# Board Sharing – Private vs Shared Modes (Spec)

**Status:** Implemented. Run the board-sharing migration block in `supabase/schema.sql` (from "Board sharing" through the RLS section) in the Supabase SQL Editor before using share links.

This doc captures the agreed behavior, data model, and UI for the Board Sharing PR.

---

## 1. Data model (Option B)

- **`board_members`** table: single source of truth for who has access and their role.
  - Columns: `board_id`, `user_id`, `role` (`'owner'` | `'editor'`).
  - **Owner is stored here** (one row per board with role `'owner'`). Additional editors added when they use the share link.
  - RLS: allow access only if `auth.uid()` is in `board_members` for that board (no special-case for owner elsewhere).
- **`boards`** table additions:
  - **`public_access_level`**: `'private'` | `'can_edit'`.
    - `'private'`: only members in `board_members` can access (RLS).
    - `'can_edit'`: board is “shared”; link is live; users who open the link are added as editors and then access via `board_members`.
  - **`share_slug`**: unique slug for the share URL. Generated **once** when owner first enables sharing; reused thereafter (no “regenerate link” in MVP).

**Decided (Option B):** Owner lives in `board_members` with role `'owner'`. Keep `boards.user_id` for backward compatibility and display (e.g. “Created by”); new boards get an owner row in `board_members` on create. **Migration:** backfill existing boards with `INSERT INTO board_members (board_id, user_id, role) SELECT id, user_id, 'owner' FROM boards` so every board has exactly one owner in `board_members`.

---

## 2. RLS (conceptual)

- **Private:** Access allowed only if `auth.uid()` exists in `board_members` for that board with role `owner` or `editor`.
- **Shared:** The board has `public_access_level = 'can_edit'`. In practice, when a user opens the share link we add them to `board_members` as `editor`, so RLS continues to be “allow if in `board_members` (owner/editor).” The `public_access_level` column marks the board as “shared” and drives the badge; the slug controls who can be added as editor.

(If we later support “allow read/write when `public_access_level = 'can_edit'` even without a row in `board_members`,” that would require an extra mechanism, e.g. signed token or server-side validation of the slug; not in MVP.)

---

## 3. Share toggle and badge

- **Toggle:** There is no separate header switch. The effective “toggle” is **“Enable sharing” inside the Share modal.** When the user enables sharing there, we set `public_access_level = 'can_edit'`, generate and store `share_slug` (if not already set), and the badge updates.
- **Badge (status pill):**
  - **Placement:** Top-left, **next to the board title** (same row as “← Boards” and the title). When the user is on the board screen, the board title is shown (from `boardName`); the pill sits beside it.
  - **Private:** Light gray pill: **🔒 Private**.
  - **Shared:** Soft green pill: **🌐 Shared**.
- **When to show “Shared”:** If the board has been put in shared mode (link enabled), show **Shared** for both the creator and any user who has opened the link. If no one has been given the link / sharing has never been enabled, show **Private** for everyone (including the creator).

---

## 4. Board title and header context

- **After login:** User sees the app (e.g. “Collab Board” or board list).
- **Inside a board:** The **board title** appears in the header (already the case via `boardTitle` / `boardName` in `TopBar`). The status pill (🔒 Private / 🌐 Shared) appears next to this title.

---

## 5. Share slug and link

- Generate **one** `share_slug` per board when the owner first enables sharing (e.g. in the Share modal). Reuse that slug; no “regenerate link” in MVP.
- Share URL format: `https://<app>/b/<share_slug>` (or equivalent). Opening this link resolves the board, adds the user to `board_members` as `editor` (if not already), and redirects to the board view so both creator and that user see the board as **Shared**.

---

## 6. Share button and Share modal

- **Share button:** In the header (e.g. outlined, “closed” look when private). Clicking it opens the **Share modal**.
- **Share modal:**
  - When sharing is **off:** Contains an action to **“Enable sharing”** (the toggle). After enabling, we generate and store `share_slug`, set `public_access_level = 'can_edit'`, and the badge switches to **🌐 Shared**.
  - When sharing is **on:** Modal shows the board as **“Live”** and a **“Copy Link”** field (share URL) highlighted (e.g. blue). User can copy the link to invite others.

---

## 7. Presence bar and cursors

- **Private:** Only the current user’s avatar in the presence bar; no other cursors on the canvas.
- **Shared:** As others join (via the link), their avatars appear in the presence bar and their **live cursors** (e.g. “Collaborator A”) appear on the canvas. No change to how human cursors are implemented; we just ensure that when the board is shared and others are in `board_members`, they can connect and appear as today.

---

## 8. AI: processing state and presence

- **When the AI is running:** Show a **processing state** or an **“AI is typing…”** indicator (not a permanent avatar).
- **Presence bar:** The AI is **not** a permanent resident. It appears **only when active**, with a distinct indicator (e.g. sparkling icon or “Bot” label) so it’s clear it’s not a human collaborator.

---

## 9. Demo phrases (for MVP video)

- *“Currently, this board is in Private Mode. Thanks to Supabase RLS, this data is strictly isolated to my UID.”*
- *“I’ll now transition this to a Shared Workspace. Notice the status badge update from ‘Private’ to ‘Shared’ in the header.”*
- *“This flip of a boolean [enabling sharing / public_access_level] in our PostgreSQL database instantly opens a WebSocket connection via Supabase Realtime, allowing collaborators to see my work and the AI Agents to broadcast updates to everyone on the board.”*

---

## 10. Implementation checklist (when approved)

- [ ] Schema: add `board_members`, `boards.public_access_level`, `boards.share_slug`. Owner in `board_members` (role `'owner'`); backfill existing boards from `boards.user_id`; new board creation inserts owner into `board_members`.
- [ ] RLS: boards and board_objects allow access only when `auth.uid()` is in `board_members` with role owner or editor; board list filtered the same way.
- [ ] Route: `/b/:shareSlug` → resolve board by slug → add current user to `board_members` as editor if not present → redirect to `/board/:boardId`.
- [ ] Share modal: “Enable sharing” (sets `public_access_level`, generates `share_slug`), “Copy Link” field when shared, “Live” state.
- [ ] TopBar: status pill (🔒 Private / 🌐 Shared) next to board title; Share button opens modal.
- [ ] Badge and Share button only shown on board view (when `boardTitle` is present).
- [ ] AI: “AI is typing…” / processing indicator when a command is running; optional temporary “Bot” entry in presence bar when AI is active (sparkle or Bot label).
- [ ] TDD: tests for slug generation, RLS behavior, add-member-on-link-open, and modal/toggle behavior as needed.

---

## 11. Out of scope for this PR

- Viewer-only role (read-only).
- “Manage access” UI (list of users, change roles).
- Regenerate share link.
- Email invites.
