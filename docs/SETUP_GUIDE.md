# CollabBoard — Setup Guide

This guide walks you through running CollabBoard locally and optionally deploying it. For **G4 Week 1 submission**: use this to run the project; **architecture overview** and **deployed link** are in the [README](../README.md).

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Supabase account** — [supabase.com](https://supabase.com/dashboard)
- **(Optional, for AI commands)** Anthropic API key — [console.anthropic.com](https://console.anthropic.com)  
- **(Optional, for deploy)** GitHub account and [Vercel](https://vercel.com) account

---

## 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/CollabBoard.git
cd CollabBoard
npm install
```

Use your actual repo URL if different.

---

## 2. Supabase project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project (or use an existing one).
2. Wait for the project to finish provisioning.
3. In **Project Settings** → **API**, copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

You will need these for the environment file in step 6.

---

## 3. Database schema

1. In Supabase, open **SQL Editor**.
2. Open [supabase/schema.sql](../supabase/schema.sql) from this repo and copy its full contents.
3. Paste into the SQL Editor and **Run**.

This creates:

- **Tables:** `boards`, `board_objects`, `cursors`, `presence`, `board_members` (for sharing)
- **RLS policies** so users only access their own or shared boards
- **Indexes** for Realtime and queries

If you already had an older schema, you may need to drop obsolete policies (see [docs/DEPLOY.md](DEPLOY.md) for the "Allow authenticated read all boards" note).

---

## 4. Realtime publication

Required for multiplayer cursors, object sync, and presence.

1. In Supabase: **Database** → **Replication** (or **Publications**).
2. Open the **supabase_realtime** publication.
3. Ensure these tables are **enabled** (toggled on):
   - **board_objects**
   - **cursors**
   - **presence**
4. Save.

Without this, other users’ cursors and object changes will not appear until refresh.

---

**If you already had an older schema without the presence table** (e.g. the "Online" dropdown is missing), run this in SQL Editor, then add **presence** to the Realtime publication (step 3 above):

```sql
CREATE TABLE IF NOT EXISTS presence (
  user_id UUID NOT NULL PRIMARY KEY,
  display_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read all presence"
  ON presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own presence"
  ON presence FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 5. Authentication

1. In Supabase: **Authentication** → **Providers**.
2. Enable **Google** (and optionally **Email**).
3. For Google: create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com) (OAuth 2.0 Client ID for a web application), then paste **Client ID** and **Client Secret** into Supabase.
4. Go to **Authentication** → **URL Configuration**.
5. Add your app URLs to **Redirect URLs**, for example:
   - `http://localhost:5173/**` (local dev)
   - `https://your-app.vercel.app/**` (after deploy)

---

## 6. Environment variables

1. In the project root, copy the example env file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set (required for the app to run):

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   Use the values from step 2. The client never receives your Supabase service role key; only the anon key is used.

3. **Optional — AI commands:**  
   If you will use the **deployed** AI Edge Function (recommended), you do **not** set any Anthropic key in `.env`; the key is stored as a Supabase secret (see step 8).  
   If you are not using the AI agent, you can leave `VITE_ANTHROPIC_API_KEY` unset or omit it.

---

## 7. Run locally

```bash
npm run dev
```

1. Open the URL shown (e.g. `http://localhost:5173`).
2. Sign in with Google (or email if enabled).
3. Create a board and add sticky notes or shapes.
4. To test multiplayer: open a second browser (or incognito), sign in as another user (or same user), open the same board — you should see cursors and object changes in real time.

---

## 8. AI agent (optional)

The AI board agent runs in a **Supabase Edge Function**. The API key stays on the server and is never sent to the browser.

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase login`.
2. Link your project (if not already):

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

   Find the project ref in Supabase Dashboard → Project Settings → General.

3. Deploy the Edge Function:

   ```bash
   supabase functions deploy ai-command
   ```

4. Set your Anthropic API key as a secret:

   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

   Get the key from [console.anthropic.com](https://console.anthropic.com) → API Keys.

5. No need to set `VITE_ANTHROPIC_API_KEY` in `.env`; the client uses the deployed function URL (derived from `VITE_SUPABASE_URL`) and sends the Supabase JWT. The Edge Function validates the JWT and uses the server-side API key.

For local testing of the Edge Function (e.g. `supabase functions serve ai-command`), see [docs/AI_EDGE_FUNCTION.md](AI_EDGE_FUNCTION.md).

---

## 9. Deploy to production (optional)

1. Push the repo to GitHub and import it as a project in [Vercel](https://vercel.com).
2. In the Vercel project, add **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy (Vercel will use `npm run build` and output `dist`).
4. In Supabase → **Authentication** → **URL Configuration**, add your Vercel URL to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`).
5. If you use the AI agent, ensure the Edge Function is deployed and `ANTHROPIC_API_KEY` is set in Supabase secrets (step 8).

Full deployment details (including schema and Realtime checks): [docs/DEPLOY.md](DEPLOY.md).

---

## Where to find more

| Document | Description |
|----------|-------------|
| [README](../README.md) | **Deployed link**, features, scripts |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | **Architecture overview** — system diagram, stack, sync/AI flows, code layout, decisions |
| [docs/DEPLOY.md](DEPLOY.md) | Full deploy steps, Realtime troubleshooting, board sharing |
| [docs/AI_EDGE_FUNCTION.md](AI_EDGE_FUNCTION.md) | AI Edge Function setup and auth flow |
| [docs/presearch.md](presearch.md) | Pre-Search (stack decisions, tradeoffs) |
| [docs/AI_DEVELOPMENT_LOG.md](AI_DEVELOPMENT_LOG.md) | AI development log (tools, prompts, learnings) |
| [docs/AI_COST_ANALYSIS.md](AI_COST_ANALYSIS.md) | Dev spend and production cost projections |
| [docs/MVP_VERIFICATION.md](MVP_VERIFICATION.md) | MVP verification checklist |
| [docs/USER_MANUAL.md](USER_MANUAL.md) | User manual for the app |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (output: `dist`) |
| `npm run preview` | Preview production build locally |
| `npm test` | Run tests (Vitest) |
