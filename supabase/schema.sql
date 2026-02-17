-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) to create tables and RLS.

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
-- find supabase_realtime and add board_objects and cursors to the publication.

-- RLS: allow all authenticated users to read/write (collaborative board).
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write board_objects"
  ON board_objects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write cursors"
  ON cursors FOR ALL TO authenticated USING (true) WITH CHECK (true);
