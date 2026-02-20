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

-- ─────────────────────────────────────────────────────────────────────────────
-- Stale-presence cleanup
-- Deletes any presence row whose last_seen_at is older than 2 minutes.
-- The client heartbeat fires every 25 s, so 2 min is a generous safety margin.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_stale_presence()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM presence WHERE last_seen_at < NOW() - INTERVAL '2 minutes';
  DELETE FROM cursors   WHERE updated_at   < NOW() - INTERVAL '2 minutes';
$$;

-- Schedule the cleanup every minute via pg_cron (enable the pg_cron extension in
-- Supabase Dashboard → Database → Extensions first, then run):
--
--   SELECT cron.schedule('prune-stale-presence', '* * * * *', 'SELECT prune_stale_presence()');
--
-- Without pg_cron the client-side updated_at / last_seen_at filters in
-- subscribeCursors() and subscribePresence() are the primary guard;
-- this job only keeps the tables tidy.

-- Enable Realtime: In Supabase Dashboard go to Database → Replication,
-- find supabase_realtime and add board_objects, cursors, and presence to the publication.
-- Cursor presence works with Realtime (instant) or via app polling (~1.5s) if cursors is not in the publication.

-- RLS: allow all authenticated users to read/write (collaborative board).
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write board_objects"
  ON board_objects FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write cursors"
  ON cursors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Schema migrations: new columns for extended object types
-- Run these in Supabase SQL Editor if upgrading from the original schema.
-- ─────────────────────────────────────────────────────────────────────────────

-- Rotation in degrees (for all object types)
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS rotation DOUBLE PRECISION DEFAULT 0;

-- Parent frame id (for objects contained inside a frame)
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS parent_id TEXT;

-- Connector endpoints
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS from_id TEXT;
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS to_id TEXT;

-- Connector/line style: 'line' | 'arrow'
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS style TEXT;

-- Standalone text element properties
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS font_size DOUBLE PRECISION;
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS font_color TEXT;

-- Frame body text (separate from header/title)
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS body_text TEXT;

-- Connector endpoint overrides (when user drags tail/head to resize)
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS from_x DOUBLE PRECISION;
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS from_y DOUBLE PRECISION;
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS to_x DOUBLE PRECISION;
ALTER TABLE board_objects ADD COLUMN IF NOT EXISTS to_y DOUBLE PRECISION;

-- ─────────────────────────────────────────────────────────────────────────────
-- Board sharing: board_members (owner/editor), public_access_level, share_slug
-- Run in Supabase SQL Editor. Option B: owner lives in board_members.
-- ─────────────────────────────────────────────────────────────────────────────

-- New table: who can access each board and their role
CREATE TABLE IF NOT EXISTS board_members (
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (board_id, user_id)
);
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Profiles: email/display_name for invite-by-email lookup. App upserts on login.
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles read all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles insert own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profiles update own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Pending invites (email not yet a user). Owner adds/revokes; on signup we migrate to board_members.
CREATE TABLE IF NOT EXISTS board_invites (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(board_id, email)
);
ALTER TABLE board_invites ENABLE ROW LEVEL SECURITY;

-- Boards: shared vs private; share link slug (generated once when sharing enabled)
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_access_level TEXT NOT NULL DEFAULT 'private' CHECK (public_access_level IN ('private', 'can_edit'));
ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_slug TEXT UNIQUE;

-- Backfill: ensure every existing board has an owner in board_members (idempotent)
INSERT INTO board_members (board_id, user_id, role)
SELECT b.id, b.user_id, 'owner' FROM boards b
WHERE NOT EXISTS (SELECT 1 FROM board_members m WHERE m.board_id = b.id AND m.role = 'owner');

-- Trigger: new boards get owner row in board_members automatically
CREATE OR REPLACE FUNCTION add_owner_to_board_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_board_members_owner ON boards;
CREATE TRIGGER tr_board_members_owner
  AFTER INSERT ON boards
  FOR EACH ROW EXECUTE PROCEDURE add_owner_to_board_members();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS for board sharing: access via board_members only
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: check membership without RLS recursion (used by policies)
CREATE OR REPLACE FUNCTION public.is_board_member(bid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = bid AND user_id = uid);
$$;

CREATE OR REPLACE FUNCTION public.is_board_owner(bid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = bid AND user_id = uid AND role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.is_board_editor_or_owner(bid uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM board_members WHERE board_id = bid AND user_id = uid AND role IN ('owner', 'editor'));
$$;

-- board_members: read for members; only owner can insert/update/delete (invite flow)
DROP POLICY IF EXISTS "Members can read board_members" ON board_members;
CREATE POLICY "Members can read board_members"
  ON board_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_board_member(board_id, auth.uid()));
DROP POLICY IF EXISTS "User can join as editor when board is shared" ON board_members;
CREATE POLICY "Owner can add board members"
  ON board_members FOR INSERT TO authenticated
  WITH CHECK (is_board_owner(board_id, auth.uid()));
CREATE POLICY "Owner can update board members"
  ON board_members FOR UPDATE TO authenticated
  USING (is_board_owner(board_id, auth.uid()))
  WITH CHECK (is_board_owner(board_id, auth.uid()));
CREATE POLICY "Owner can remove board members"
  ON board_members FOR DELETE TO authenticated
  USING (is_board_owner(board_id, auth.uid()));

-- board_invites: only owner can see/add/revoke
CREATE POLICY "Owner can read board_invites"
  ON board_invites FOR SELECT TO authenticated
  USING (is_board_owner(board_id, auth.uid()));
CREATE POLICY "Owner can add board_invites"
  ON board_invites FOR INSERT TO authenticated
  WITH CHECK (is_board_owner(board_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "Owner can delete board_invites"
  ON board_invites FOR DELETE TO authenticated
  USING (is_board_owner(board_id, auth.uid()));

-- boards: drop old policies, add member-based access
DROP POLICY IF EXISTS "Users can read own boards" ON boards;
DROP POLICY IF EXISTS "Users can manage own boards" ON boards;
DROP POLICY IF EXISTS "Allow update board when no viewers" ON boards;
DROP POLICY IF EXISTS "Allow delete board when no viewers" ON boards;

CREATE POLICY "Members can read board"
  ON boards FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM board_members WHERE board_id = boards.id));

-- Allow reading board by owner (user_id). Fixes 403 on create: INSERT with .select() needs SELECT to return the row.
CREATE POLICY "Owner can read own board"
  ON boards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Resolve share slug to board id only (so listBoards doesn't expose shared boards to non-members).
-- Option A: when opening /b/:slug, client resolves id then checks membership (getBoard); redirect only if already a member.
CREATE OR REPLACE FUNCTION public.get_board_id_by_share_slug(slug text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM boards WHERE share_slug = slug LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_board_id_by_share_slug(text) TO authenticated;

DROP POLICY IF EXISTS "Anyone can read shared board (for slug lookup)" ON boards;

CREATE POLICY "User can create own board"
  ON boards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can update board when no viewers" ON boards;
-- Allow members to update board (e.g. enable sharing, rename) even when board is open
CREATE POLICY "Editors can update board"
  ON boards FOR UPDATE TO authenticated
  USING (is_board_editor_or_owner(boards.id, auth.uid()))
  WITH CHECK (is_board_editor_or_owner(boards.id, auth.uid()));

CREATE POLICY "Members can delete board when no viewers"
  ON boards FOR DELETE TO authenticated
  USING (
    is_board_editor_or_owner(boards.id, auth.uid())
    AND (SELECT count(*)::int FROM cursors WHERE cursors.board_id = boards.id::text) = 0
  );

-- board_objects: members can read; only editor/owner can write
DROP POLICY IF EXISTS "Allow authenticated read/write board_objects" ON board_objects;
DROP POLICY IF EXISTS "Members can read/write board_objects" ON board_objects;
CREATE POLICY "Members can read board_objects"
  ON board_objects FOR SELECT TO authenticated
  USING (is_board_member(board_objects.board_id::uuid, auth.uid()));
CREATE POLICY "Editors can write board_objects"
  ON board_objects FOR ALL TO authenticated
  USING (is_board_editor_or_owner(board_objects.board_id::uuid, auth.uid()))
  WITH CHECK (is_board_editor_or_owner(board_objects.board_id::uuid, auth.uid()));

-- cursors: members can read; any member can write own cursor (viewer can show presence)
DROP POLICY IF EXISTS "Allow authenticated read/write cursors" ON cursors;
DROP POLICY IF EXISTS "Members can read/write cursors" ON cursors;
CREATE POLICY "Members can read cursors"
  ON cursors FOR SELECT TO authenticated
  USING (is_board_member(cursors.board_id::uuid, auth.uid()));
CREATE POLICY "Members can write own cursor"
  ON cursors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_board_member(cursors.board_id::uuid, auth.uid()));
CREATE POLICY "Members can update own cursor"
  ON cursors FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can delete own cursor"
  ON cursors FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Migration: allow viewer role in board_members (run if table already had only owner/editor)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'board_members_role_check' AND conrelid = 'board_members'::regclass) THEN
    ALTER TABLE board_members DROP CONSTRAINT board_members_role_check;
  END IF;
  ALTER TABLE board_members ADD CONSTRAINT board_members_role_check CHECK (role IN ('owner', 'editor', 'viewer'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
