# Add the presence table and Realtime (Online dropdown)

Use these steps if you already have the project set up but don't have the **presence** table yet (needed for the "Online" dropdown to show all logged-in users).

---

## Step 1 – Create the presence table and RLS

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** and select your project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Paste this SQL:

```sql
-- Global presence: who is logged in (one row per user).
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

5. Click **Run** (or press Cmd/Ctrl + Enter).
6. You should see **Success. No rows returned.**

---

## Step 2 – Add presence to the Realtime publication

1. In the left sidebar, go to **Database** → **Replication** (or **Publications**).
2. Open the **supabase_realtime** publication.
3. Find **presence** in the list of tables.
4. Turn **presence** on (toggle or "Add table" so it's included in the publication).
5. Click **Save**.

---

After this, the "Online" dropdown will show all logged-in users and update in real time.
