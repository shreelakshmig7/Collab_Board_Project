# Test results

**Generated:** 2026-02-21T02:46:33.281Z

| Summary | Count |
|---------|-------|
| Total tests | 100 |
| Passed | 100 |
| Failed | 0 |
| Overall | ✅ Passed |

---

## Test cases

| File | Test | Status | Duration (ms) |
|------|------|--------|---------------|
| src/ai/aiCommandPolicy.test.ts | treats sticky creation as simple with forced tool | ✅ passed | 6.20 |
| src/ai/aiCommandPolicy.test.ts | treats circle creation as simple with createShape forced | ✅ passed | 0.72 |
| src/ai/aiCommandPolicy.test.ts | treats frame creation as simple with createFrame forced | ✅ passed | 0.10 |
| src/ai/aiCommandPolicy.test.ts | treats text creation as simple with createText forced | ✅ passed | 0.18 |
| src/ai/aiCommandPolicy.test.ts | treats SWOT as compound with createQuadrant | ✅ passed | 0.10 |
| src/ai/aiCommandPolicy.test.ts | treats quadrant as compound | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats retro board as compound with createColumnLayout | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats kanban as compound with createColumnLayout | ✅ passed | 0.10 |
| src/ai/aiCommandPolicy.test.ts | treats journey map as compound with createColumnLayout | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats clear board as compound with clearBoard | ✅ passed | 0.21 |
| src/ai/aiCommandPolicy.test.ts | treats wipe everything as compound clearBoard | ✅ passed | 0.31 |
| src/ai/aiCommandPolicy.test.ts | treats move as complex with getBoardState (no longer simple) | ✅ passed | 0.23 |
| src/ai/aiCommandPolicy.test.ts | treats change color as complex | ✅ passed | 0.46 |
| src/ai/aiCommandPolicy.test.ts | treats delete specific as complex | ✅ passed | 0.08 |
| src/ai/aiCommandPolicy.test.ts | treats resize as complex | ✅ passed | 0.22 |
| src/ai/aiCommandPolicy.test.ts | treats multi-step prompts as complex | ✅ passed | 0.18 |
| src/ai/aiCommandPolicy.test.ts | treats arrange as complex multi-turn | ✅ passed | 0.10 |
| src/ai/aiEdgePolicy.test.ts | routes sticky creation to fast tier, 1 turn, forced tool | ✅ passed | 0.79 |
| src/ai/aiEdgePolicy.test.ts | routes shape creation to fast tier with forced tool | ✅ passed | 0.33 |
| src/ai/aiEdgePolicy.test.ts | routes frame creation to fast tier with forced tool | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes SWOT to compound: smart, 1 turn, createQuadrant forced, no getBoardState | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes quadrant diagram to createQuadrant | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes retrospective to compound: createColumnLayout | ✅ passed | 0.07 |
| src/ai/aiEdgePolicy.test.ts | routes kanban to createColumnLayout | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes journey map to createColumnLayout | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes clear board to compound: clearBoard forced, 1 turn | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes wipe to clearBoard | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes delete all to clearBoard | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes move to smart tier with getBoardState (not simple) | ✅ passed | 0.13 |
| src/ai/aiEdgePolicy.test.ts | routes change color to smart tier with getBoardState | ✅ passed | 4.67 |
| src/ai/aiEdgePolicy.test.ts | routes delete specific to smart tier with getBoardState | ✅ passed | 8.30 |
| src/ai/aiEdgePolicy.test.ts | routes resize to smart tier with getBoardState | ✅ passed | 1.01 |
| src/ai/aiEdgePolicy.test.ts | routes arrange to smart multi-turn with getBoardState | ✅ passed | 0.31 |
| src/ai/aiEdgePolicy.test.ts | routes connector commands to smart multi-turn | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes multi-step prompts to smart multi-turn | ✅ passed | 0.03 |
| src/board/BoardsListPage.test.tsx | shows loading then two sections: My Boards and Shared with you | ✅ passed | 92.46 |
| src/board/BoardsListPage.test.tsx | splits boards into My Boards (owned) and Shared with you (not owned) | ✅ passed | 3.36 |
| src/board/BoardsListPage.test.tsx | shows empty state when no my boards | ✅ passed | 1.69 |
| src/board/BoardsListPage.test.tsx | shows empty state when no shared boards | ✅ passed | 5.72 |
| src/board/BoardsListPage.test.tsx | My Boards list has checkboxes; Rename disabled until one selected, Delete disabled until one or more selected | ✅ passed | 37.50 |
| src/board/BoardsListPage.test.tsx | clicking board name navigates to board | ✅ passed | 25.36 |
| src/board/BoardsListPage.test.tsx | Delete opens confirmation dialog | ✅ passed | 52.91 |
| src/board/BoardsListPage.test.tsx | Rename opens modal when exactly one board selected | ✅ passed | 48.59 |
| src/board/ShareModal.test.tsx | renders nothing when not open | ✅ passed | 10.08 |
| src/board/ShareModal.test.tsx | shows dialog with title and People with access when open | ✅ passed | 77.93 |
| src/board/ShareModal.test.tsx | shows Add by email and Invite when owner | ✅ passed | 22.83 |
| src/board/ShareModal.test.tsx | does not show Add by email or Invite when not owner | ✅ passed | 8.70 |
| src/board/ShareModal.test.tsx | does not show Copy link or Link section | ✅ passed | 11.97 |
| src/board/Toolbar.test.tsx | renders View only when isViewOnly is true | ✅ passed | 12.12 |
| src/board/Toolbar.test.tsx | renders full toolbar when isViewOnly is false | ✅ passed | 87.51 |
| src/supabase/cursors.test.ts | returns a valid hex colour string | ✅ passed | 0.40 |
| src/supabase/cursors.test.ts | is deterministic — same uid always returns same colour | ✅ passed | 0.10 |
| src/supabase/cursors.test.ts | returns different colours for different uids | ✅ passed | 0.08 |
| src/supabase/cursors.test.ts | handles an empty string without throwing | ✅ passed | 0.33 |
| src/supabase/cursors.test.ts | handles a very long uid without throwing | ✅ passed | 0.34 |
| src/supabase/objects.test.ts | throws when caller is not the board owner | ✅ passed | 1.44 |
| src/supabase/objects.test.ts | throws when board is not found | ✅ passed | 0.17 |
| src/supabase/objects.test.ts | deletes when caller is the board owner | ✅ passed | 0.54 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 1.15 |
| src/supabase/presence.test.ts | upserts with correct user_id and display_name | ✅ passed | 0.74 |
| src/supabase/presence.test.ts | includes last_seen_at timestamp in the upsert payload | ✅ passed | 0.28 |
| src/supabase/presence.test.ts | accepts null displayName | ✅ passed | 0.23 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 0.13 |
| src/supabase/presence.test.ts | filters by the correct user_id | ✅ passed | 0.11 |
| src/utils/inputValidation.test.ts | rejects empty or whitespace | ✅ passed | 0.45 |
| src/utils/inputValidation.test.ts | rejects name shorter than min length | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | accepts name at min length | ✅ passed | 0.24 |
| src/utils/inputValidation.test.ts | accepts non-empty trimmed name | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | rejects name over max length | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | accepts name at max length | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | rejects name with only symbols or spaces | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | accepts name with at least one letter or number | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects email shorter than min length | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts valid email at or above min length | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts valid email | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects invalid format | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | trims, lowercases, truncates | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts at min length (1 character) | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | accepts non-empty | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts short text | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | truncates and trims | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | clamps to 20–800 | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | rounds and handles non-finite | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | accepts valid range | ✅ passed | 0.09 |
| src/utils/inputValidation.test.ts | rejects out of range or non-finite | ✅ passed | 0.12 |
| src/canvas/selectionRect.test.ts | returns ids of objects whose bounds intersect the selection rect | ✅ passed | 0.88 |
| src/canvas/selectionRect.test.ts | handles selection rect with negative width/height (drag left or up) | ✅ passed | 0.12 |
| src/canvas/selectionRect.test.ts | excludes objects with zero width or height (e.g. connectors) | ✅ passed | 0.11 |
| src/canvas/selectionRect.test.ts | returns empty array when no objects intersect | ✅ passed | 0.07 |
| src/canvas/selectionRect.test.ts | returns empty array for empty objects | ✅ passed | 0.09 |
| src/canvas/selectionRect.test.ts | replaces selection when not shiftKey | ✅ passed | 0.32 |
| src/canvas/selectionRect.test.ts | adds marquee ids to current selection when shiftKey | ✅ passed | 0.15 |
| src/canvas/selectionRect.test.ts | deduplicates when shiftKey and marquee overlaps current | ✅ passed | 0.18 |