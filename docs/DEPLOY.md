# CollabBoard – Deploy to Vercel (MVP)

## 1. Build and push

```bash
npm run build
git add . && git commit -m "Prepare for deploy" && git push origin main
```

(Use your branch name if not `main`.)

## 2. Vercel project

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub).
2. **Add New** → **Project** → Import your CollabBoard repo.
3. **Framework Preset:** Vite (auto-detected). **Root Directory:** leave default. **Build Command:** `npm run build`. **Output Directory:** `dist`.
4. **Environment Variables:** Add from `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - (Optional) `VITE_ANTHROPIC_API_KEY` for AI commands.

5. Click **Deploy**. Wait for the build to finish.

## 3. Supabase – redirect URL

1. Copy your Vercel URL (e.g. `https://collab-board-xxx.vercel.app`).
2. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
3. Add the Vercel URL to **Redirect URLs** (e.g. `https://collab-board-xxx.vercel.app/**`).

Without this, Google sign-in redirect after login may fail on the deployed app.

## 4. Database and Realtime (required for 2-user sync)

**Schema:** Run [supabase/schema.sql](../supabase/schema.sql) in Supabase **SQL Editor** to create `boards`, `board_objects`, and `cursors` and RLS. If you already had the `boards` table and only your own boards were visible, add this policy so everyone sees all boards:  
`CREATE POLICY "Allow authenticated read all boards" ON boards FOR SELECT TO authenticated USING (true);`

**Realtime (required for other user’s cursor + object moves to show):**

1. In Supabase Dashboard go to **Database** → **Replication** (or **Publications**).
2. Open the **supabase_realtime** publication.
3. Add **board_objects**, **cursors**, and **presence** (toggle or “Add table” for each).
4. Save.

Without this, the other user’s cursor won’t appear and their object moves won’t sync.

### If other users’ changes or cursors don’t show until you refresh

1. **Realtime publication**  
   In Supabase: **Database** → **Replication** → **supabase_realtime**. Ensure **board_objects**, **cursors**, and **presence** are in the publication (toggled on). Save.

2. **Browser console**  
   Open DevTools → Console. On load you may see `[Realtime] … subscription status:` if the Realtime channel failed (e.g. `CHANNEL_ERROR`). Fix any errors shown (often missing tables in publication or RLS blocking).

3. **Both users signed in**  
   Realtime uses the same RLS as the REST API. Both users must be **signed in** (e.g. Google) so they have the `authenticated` role; otherwise they won’t receive postgres_changes.

4. **No ad-blockers / extensions**  
   Some extensions block WebSockets. Try in an incognito window or another browser.

## 5. Live URL

After deploy, your app is at the Vercel URL. Add it to the README **Live app** section and to `docs/requirements.md` once the MVP checklist is verified.
