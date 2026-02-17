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

## 4. Database and Realtime

- Ensure you ran [supabase/schema.sql](../supabase/schema.sql) in SQL Editor to create `board_objects` and `cursors` and RLS.
- In **Database → Replication**, add `board_objects` and `cursors` to the `supabase_realtime` publication so live sync works.

## 5. Live URL

After deploy, your app is at the Vercel URL. Add it to the README **Live app** section and to `docs/requirements.md` once the MVP checklist is verified.
