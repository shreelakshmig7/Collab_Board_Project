# CollabBoard

Real-time collaborative whiteboard with sticky notes, shapes, multiplayer cursors, and presence. Built with React, Konva.js, and Supabase (Auth, Postgres, Realtime).

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [Supabase](https://supabase.com/dashboard).
   - In **Authentication → Providers**, enable **Google** and add your OAuth client ID/secret (from Google Cloud Console).
   - In **Project Settings → API**, copy the **Project URL** and **anon public** key.
   - In **SQL Editor**, run the schema in [supabase/schema.sql](supabase/schema.sql) to create `board_objects` and `cursors` tables and RLS.
   - In **Database → Replication**, add `board_objects` and `cursors` to the `supabase_realtime` publication so live updates work.
   - In **Authentication → URL Configuration**, add your app URL (e.g. `http://localhost:5173`) to **Redirect URLs**.

3. **Environment**

   Copy `.env.example` to `.env` and set:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open the app, sign in with Google, then open a second browser/incognito window to test multiplayer cursors and object sync.

## Live app

- **Deployed URL:** Add your Vercel URL here after first deploy (e.g. `https://collab-board-xxx.vercel.app`).

## Deploy (Vercel)

1. Push the repo to GitHub and import into [Vercel](https://vercel.com).
2. In Vercel project settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_ANTHROPIC_API_KEY` for AI).
3. Deploy. Build command: `npm run build`; output: `dist`. The repo includes `vercel.json` for SPA routing.
4. **Production:** In Supabase → Authentication → URL Configuration, add your Vercel URL (e.g. `https://your-app.vercel.app`) to **Redirect URLs**.

Full steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Features

- **Auth:** Google sign-in only.
- **Board:** Infinite canvas with pan (Pan tool or drag) and zoom (mouse wheel).
- **Objects:** Sticky notes (editable text, 4 colors) and rectangles. Create with Sticky/Rect tool + click; drag to move; select and press Delete to remove.
- **Real-time:** Objects sync via Supabase Postgres + Realtime; cursors and presence via Supabase. Two or more users see each other’s cursors and names.
- **Persistence:** Board state survives refresh and reconnects.

## Documentation

- **Project requirements (MVP, Core, AI agent):** [docs/requirements.md](docs/requirements.md)
- **Pre-Search (stack, Vercel, Claude 4.5, cost):** [docs/presearch.md](docs/presearch.md)
- **Status and implementation plan:** [STATUS_AND_PLAN.md](STATUS_AND_PLAN.md)
- **Deploy steps (Vercel + Supabase):** [docs/DEPLOY.md](docs/DEPLOY.md)
- **MVP verification checklist:** [docs/MVP_VERIFICATION.md](docs/MVP_VERIFICATION.md)
- **Implementation plan (done + next):** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run preview` – preview production build
