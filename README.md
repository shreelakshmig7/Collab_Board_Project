# CollabBoard

Real-time collaborative whiteboard with AI-powered commands, multiplayer cursors, and presence. Built with React, Konva.js, and Supabase (Auth, Postgres, Realtime).

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [Supabase](https://supabase.com/dashboard).
   - In **Authentication → Providers**, enable **Google** and add your OAuth client ID/secret (from Google Cloud Console).
   - In **Project Settings → API**, copy the **Project URL** and **anon public** key.
   - In **SQL Editor**, run the schema in [supabase/schema.sql](supabase/schema.sql) to create all tables and RLS policies.
   - In **Database → Replication**, add `board_objects` and `cursors` to the `supabase_realtime` publication so live updates work.
   - In **Authentication → URL Configuration**, add your app URL (e.g. `http://localhost:5173`) to **Redirect URLs**.

3. **Environment**

   Copy `.env.example` to `.env` and set:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   For AI commands, the API key is set in the Supabase Edge Function (see [docs/DEPLOY.md](docs/DEPLOY.md)), not in `.env` — the client never sees it.

4. **Run**

   ```bash
   npm run dev
   ```

   Open the app, sign in with Google, then open a second browser/incognito window to test multiplayer cursors and object sync.

## Live app

- **Deployed URL:** https://collabboard-snowy.vercel.app/

## Deploy (Vercel)

1. Push the repo to GitHub and import into [Vercel](https://vercel.com).
2. In Vercel project settings, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Build command: `npm run build`; output: `dist`. The repo includes `vercel.json` for SPA routing.
4. **AI agent:** Deploy the Supabase Edge Function (`supabase/functions/ai-command`) and set `ANTHROPIC_API_KEY` as a Supabase secret — it is never exposed to the client.
5. **Production:** In Supabase → Authentication → URL Configuration, add your Vercel URL to **Redirect URLs**.

Full steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Features

- **Auth:** Google sign-in and email/password via Supabase Auth.
- **Boards:** Create, rename, and delete multiple boards. Share boards with other users (view or edit access).
- **Infinite canvas:** Pan (Pan tool or drag) and zoom (mouse wheel, 0.2×–3×).
- **Objects:** Sticky notes (editable text, colors), rectangles, circles, lines, frames (labeled containers), standalone text, and connectors (arrows/lines between objects).
- **Transforms:** Move, resize, rotate any object. Drag-to-select marquee, shift-click for multi-select.
- **Operations:** Delete (Backspace/Delete), duplicate (Ctrl+D), copy/paste (Ctrl+C / Ctrl+V).
- **Real-time collaboration:** All object changes sync instantly via Supabase Postgres + Realtime. Multiplayer cursors with name labels. Presence indicator (who's online).
- **AI Board Agent:** Natural language commands powered by Claude — create sticky notes, shapes, frames, connectors; move, resize, recolor, delete objects; arrange in grids; generate SWOT analyses, retrospective boards, user journey maps, and kanban boards in one command.
- **Persistence:** Board state survives refresh and reconnects.

## Architecture

React (SPA) + Konva.js for the canvas. Supabase for auth, Postgres (board objects), and Realtime (object sync via `postgres_changes`, drag sync via Broadcast). Supabase Edge Function as AI proxy — validates JWT, calls Claude, executes tool calls server-side. Conflict strategy: last-write-wins (Postgres `updated_at`). **Full overview:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (system diagram, stack, flows, code layout, decisions).

## Documentation

- **Setup guide (run locally, deploy, AI):** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)
- **Architecture overview (diagram, stack, flows, code layout):** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Pre-Search (stack decisions, cost analysis):** [docs/presearch.md](docs/presearch.md)
- **AI Development Log:** [docs/AI_DEVELOPMENT_LOG.md](docs/AI_DEVELOPMENT_LOG.md)
- **AI Cost Analysis:** [docs/AI_COST_ANALYSIS.md](docs/AI_COST_ANALYSIS.md)
- **Deploy steps (Vercel + Supabase):** [docs/DEPLOY.md](docs/DEPLOY.md)
- **MVP verification checklist:** [docs/MVP_VERIFICATION.md](docs/MVP_VERIFICATION.md)
- **User Manual:** [docs/USER_MANUAL.md](docs/USER_MANUAL.md)

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run preview` – preview production build
- `npm test` – run all tests (Vitest)
