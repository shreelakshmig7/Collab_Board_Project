# MVP verification checklist

Use this after the app is deployed to confirm all MVP requirements pass.

## Two-user test

1. Open the **deployed URL** in two different browsers (or one normal + one incognito).
2. Sign in with **two different Google accounts** (one per window).

### Cursors and presence

- [ ] In each window, move the mouse on the canvas. The other window shows a cursor (circle) with the other user’s display name.
- [ ] Top bar shows presence text (e.g. “Alice, Bob online” or “You, Bob online”).

### Objects – create, move, edit, delete

- [ ] **Sticky:** In window A, select Sticky tool, click on canvas. A sticky appears. In window B, the same sticky appears without refresh.
- [ ] **Rect:** In window B, select Rect tool, click on canvas. A rectangle appears. In window A, the rect appears.
- [ ] **Move:** Drag a sticky or rect in one window. Position updates in the other window.
- [ ] **Edit sticky:** In one window, double-click a sticky. Edit text in the modal, Save. The other window shows the new text.
- [ ] **Sticky color:** Select a sticky, choose a different color from the toolbar. The other window shows the new color.
- [ ] **Delete:** Select an object, press Delete or Backspace. The object disappears in both windows.

### Pan and zoom

- [ ] Use mouse wheel to zoom in/out; drag with Pan tool (or when Pan is selected) to pan. Both work; canvas is shared.

### Persistence

- [ ] In one window, create a few stickies/rects. Refresh that window (F5). After reload and sign-in, the same objects are still on the board.

### Auth

- [ ] Sign out in one window. That window returns to the login screen. The other window can continue editing; presence updates when the first user leaves.

## MVP requirements (implementation status)

All of the following are **implemented** in the codebase. Use the two-user test above to verify behavior after deploy.

- [x] **Infinite board with pan/zoom** – Pan tool + drag to pan; mouse wheel to zoom (cursor-centered). Canvas supports pan/zoom; objects persist in world space.
- [x] **Sticky notes with editable text** – Sticky tool + click to create; double-click a sticky to open edit modal; Save updates text in Supabase.
- [x] **At least one shape type (rectangle, circle, or line)** – Rect, Circle, and Line tools; click to create; select to move, resize (toolbar), change color.
- [x] **Create, move, and edit objects** – Create: Sticky/Rect/Circle/Line + click. Move: drag. Edit: double-click sticky; toolbar for color/size. Delete: select + Delete/Backspace.
- [x] **Real-time sync between 2+ users** – board_objects + Supabase Realtime; subscribeObjects pushes updates to all clients.
- [x] **Multiplayer cursors with name labels** – cursors table; OtherCursors; setMyCursor on mouse move; cleanup on disconnect.
- [x] **Presence awareness (who's online)** – Top bar shows who is online from cursor subscription; presenceNames in TopBar.
- [x] **User authentication** – Supabase Auth + Google sign-in; LoginPage; onAuthStateChanged; sign out in TopBar.
- [ ] **Deployed and publicly accessible** – Deploy to Vercel and add production URL to README when done.

Once all are verified, mark “Deployed and publicly accessible” as done in `docs/requirements.md` and add the live URL to the README.
