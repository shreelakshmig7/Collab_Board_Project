-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create tables and RLS.

-- Boards: one row per whiteboard, owned by a user.
CREATE TABLE IF NOT EXISTS boards (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled board',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Users can only see boards they created (own boards).
CREATE POLICY "Users can read own boards"
  ON boards FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can only insert their own boards; can update/delete own or when no one is viewing the board.
CREATE POLICY "Users can manage own boards"
  ON boards FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Any authenticated user can update a board when no one has it open (no cursor rows).
CREATE POLICY "Allow update board when no viewers"
  ON boards FOR UPDATE TO authenticated
  USING ((SELECT count(*)::int FROM cursors WHERE cursors.board_id = boards.id::text) = 0);

-- Any authenticated user can delete a board when no one has it open.
CREATE POLICY "Allow delete board when no viewers"
  ON boards FOR DELETE TO authenticated
  USING ((SELECT count(*)::int FROM cursors WHERE cursors.board_id = boards.id::text) = 0);

-- Board objects (stickies, shapes). One row per object per board.
CREATE TABLE IF NOT EXISTS board_objects (
  board_id TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL,
  height DOUBLE PRECISION NOT NULL,
  text TEXT,
  color TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, id)
);

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

-- Cursors for multiplayer presence. One row per user per board.
CREATE TABLE IF NOT EXISTS cursors (
  board_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  display_name TEXT,
  color TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

-- Enable Realtime: In Supabase Dashboard go to Database → Replication,
-- find supabase_realtime and add board_objects, cursors, and presence to the publication.

-- RLS: allow all authenticated users to read/write (collaborative board).
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write board_objects"
  ON board_objects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write cursors"
  ON cursors FOR ALL TO authenticated USING (true) WITH CHECK (true);
