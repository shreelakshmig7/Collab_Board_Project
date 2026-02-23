# Test results

**Generated:** 2026-02-22T21:42:51.036Z

| Summary | Count |
|---------|-------|
| Total tests | 143 |
| Passed | 143 |
| Failed | 0 |
| Overall | ✅ Passed |

---

## Test cases

| File | Test | Status | Duration (ms) |
|------|------|--------|---------------|
| src/ai/aiCommandPolicy.test.ts | treats sticky creation as simple with forced tool | ✅ passed | 0.90 |
| src/ai/aiCommandPolicy.test.ts | treats circle creation as simple with createShape forced | ✅ passed | 0.35 |
| src/ai/aiCommandPolicy.test.ts | treats frame creation as simple with createFrame forced | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats text creation as simple with createText forced | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats SWOT as compound with createQuadrant | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats quadrant as compound | ✅ passed | 0.04 |
| src/ai/aiCommandPolicy.test.ts | treats retro board as compound with createColumnLayout | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats kanban as compound with createColumnLayout | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats journey map as compound with createColumnLayout | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats clear board as compound with clearBoard | ✅ passed | 0.08 |
| src/ai/aiCommandPolicy.test.ts | treats wipe everything as compound clearBoard | ✅ passed | 0.56 |
| src/ai/aiCommandPolicy.test.ts | treats move as complex with getBoardState (no longer simple) | ✅ passed | 0.41 |
| src/ai/aiCommandPolicy.test.ts | treats change color as complex | ✅ passed | 0.28 |
| src/ai/aiCommandPolicy.test.ts | treats delete specific as complex | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats resize as complex | ✅ passed | 0.05 |
| src/ai/aiCommandPolicy.test.ts | treats multi-step prompts as complex | ✅ passed | 0.07 |
| src/ai/aiCommandPolicy.test.ts | treats arrange as complex multi-turn | ✅ passed | 0.03 |
| src/ai/aiCommandPolicy.test.ts | treats "create 50 sticky notes" as compound with createBulkObjects | ✅ passed | 0.12 |
| src/ai/aiCommandPolicy.test.ts | treats "add 20 rectangles" as compound bulk | ✅ passed | 0.19 |
| src/ai/aiCommandPolicy.test.ts | treats "create a dozen frames" as compound bulk | ✅ passed | 0.13 |
| src/ai/aiCommandPolicy.test.ts | treats "make several circles" as compound bulk | ✅ passed | 0.06 |
| src/ai/aiCommandPolicy.test.ts | treats "add 100 text labels" as compound bulk | ✅ passed | 0.08 |
| src/ai/aiCommandPolicy.test.ts | does NOT treat single-object creation as bulk | ✅ passed | 0.93 |
| src/ai/aiCommandPolicy.test.ts | does NOT treat "create 2 stickies" as bulk (below threshold) | ✅ passed | 0.27 |
| src/ai/aiCommandPolicy.test.ts | does NOT treat contextual creation as bulk — "create a sticky next to the blue frame" | ✅ passed | 0.09 |
| src/ai/aiEdgePolicy.test.ts | routes sticky creation to fast tier, 1 turn, forced tool | ✅ passed | 1.99 |
| src/ai/aiEdgePolicy.test.ts | routes shape creation to fast tier with forced tool | ✅ passed | 1.17 |
| src/ai/aiEdgePolicy.test.ts | routes frame creation to fast tier with forced tool | ✅ passed | 0.16 |
| src/ai/aiEdgePolicy.test.ts | routes SWOT to compound: smart, 1 turn, createQuadrant forced, no getBoardState | ✅ passed | 0.10 |
| src/ai/aiEdgePolicy.test.ts | routes quadrant diagram to createQuadrant | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes retrospective to compound: createColumnLayout | ✅ passed | 0.09 |
| src/ai/aiEdgePolicy.test.ts | routes kanban to createColumnLayout | ✅ passed | 0.06 |
| src/ai/aiEdgePolicy.test.ts | routes journey map to createColumnLayout | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes clear board to compound: clearBoard forced, 1 turn | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes wipe to clearBoard | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes delete all to clearBoard | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes move to smart tier with getBoardState (not simple) | ✅ passed | 0.14 |
| src/ai/aiEdgePolicy.test.ts | routes change color to smart tier with getBoardState | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes delete specific to smart tier with getBoardState | ✅ passed | 0.05 |
| src/ai/aiEdgePolicy.test.ts | routes resize to smart tier with getBoardState | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes arrange to smart multi-turn with getBoardState | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | routes connector commands to smart multi-turn | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes multi-step prompts to smart multi-turn | ✅ passed | 0.04 |
| src/ai/aiEdgePolicy.test.ts | routes "create 50 sticky notes" to bulk: fast, 1 turn, createBulkObjects, no board state | ✅ passed | 0.15 |
| src/ai/aiEdgePolicy.test.ts | routes "add 20 rectangles" to bulk | ✅ passed | 0.11 |
| src/ai/aiEdgePolicy.test.ts | routes "create a dozen frames" to bulk | ✅ passed | 0.03 |
| src/ai/aiEdgePolicy.test.ts | routes "make several circles" to bulk | ✅ passed | 0.02 |
| src/ai/aiEdgePolicy.test.ts | routes "add 100 text labels" to bulk | ✅ passed | 0.02 |
| src/ai/aiEdgePolicy.test.ts | does NOT route single-object creation to bulk | ✅ passed | 0.80 |
| src/ai/aiEdgePolicy.test.ts | does NOT route "create 2 stickies" to bulk (below threshold) | ✅ passed | 0.08 |
| src/ai/aiEdgePolicy.test.ts | does NOT route contextual creation to bulk — "create a sticky next to the blue frame" | ✅ passed | 0.26 |
| src/ai/claudeAgent.test.ts | sends board state for "how many objects are there in the board" | ✅ passed | 0.61 |
| src/ai/claudeAgent.test.ts | sends board state for "how many sticky notes are there" | ✅ passed | 0.21 |
| src/ai/claudeAgent.test.ts | sends board state for "list all objects" | ✅ passed | 0.05 |
| src/ai/claudeAgent.test.ts | sends board state for "what frames are on the board" | ✅ passed | 0.05 |
| src/ai/claudeAgent.test.ts | sends board state for "describe the canvas" | ✅ passed | 0.05 |
| src/ai/claudeAgent.test.ts | sends board state for "show me all the shapes" | ✅ passed | 0.04 |
| src/ai/claudeAgent.test.ts | sends board state for "tell me what stickies are on the board" | ✅ passed | 0.04 |
| src/ai/claudeAgent.test.ts | does NOT treat "tell me a joke" as a query command | ✅ passed | 0.04 |
| src/ai/claudeAgent.test.ts | does NOT treat "help me brainstorm ideas" as a query command | ✅ passed | 0.04 |
| src/ai/claudeAgent.test.ts | sends board state for "what should I add?" via creation path | ✅ passed | 0.12 |
| src/ai/claudeAgent.test.ts | strips board state for "create 50 sticky notes" | ✅ passed | 0.15 |
| src/ai/claudeAgent.test.ts | strips board state for "add 20 rectangles" | ✅ passed | 0.07 |
| src/ai/claudeAgent.test.ts | sends board state for single creation (unchanged) | ✅ passed | 0.02 |
| src/ai/claudeAgent.test.ts | sends board state for move command (unchanged) | ✅ passed | 0.02 |
| src/canvas/placementUtils.test.ts | returns false when no objects | ✅ passed | 0.87 |
| src/canvas/placementUtils.test.ts | returns true when candidate overlaps one object | ✅ passed | 0.11 |
| src/canvas/placementUtils.test.ts | returns false when candidate does not overlap | ✅ passed | 0.06 |
| src/canvas/placementUtils.test.ts | ignores objects with zero width or height | ✅ passed | 0.06 |
| src/canvas/placementUtils.test.ts | returns false when no objects | ✅ passed | 0.28 |
| src/canvas/placementUtils.test.ts | returns true when center is inside an object | ✅ passed | 0.06 |
| src/canvas/placementUtils.test.ts | returns false when center is outside | ✅ passed | 0.04 |
| src/canvas/placementUtils.test.ts | ignores zero-area objects | ✅ passed | 0.05 |
| src/canvas/placementUtils.test.ts | returns position when viewport is empty (viewport center first) | ✅ passed | 0.33 |
| src/canvas/placementUtils.test.ts | returns first empty cell when one object exists | ✅ passed | 0.17 |
| src/canvas/placementUtils.test.ts | returns null when viewport is full | ✅ passed | 0.62 |
| src/canvas/placementUtils.test.ts | returns position to the right of cluster | ✅ passed | 0.09 |
| src/canvas/placementUtils.test.ts | returns position when no objects | ✅ passed | 0.04 |
| src/canvas/selectionRect.test.ts | returns ids of objects whose bounds intersect the selection rect | ✅ passed | 0.92 |
| src/canvas/selectionRect.test.ts | handles selection rect with negative width/height (drag left or up) | ✅ passed | 0.13 |
| src/canvas/selectionRect.test.ts | excludes objects with zero width or height (e.g. connectors) | ✅ passed | 0.11 |
| src/canvas/selectionRect.test.ts | returns empty array when no objects intersect | ✅ passed | 0.07 |
| src/canvas/selectionRect.test.ts | returns empty array for empty objects | ✅ passed | 0.08 |
| src/canvas/selectionRect.test.ts | replaces selection when not shiftKey | ✅ passed | 0.26 |
| src/canvas/selectionRect.test.ts | adds marquee ids to current selection when shiftKey | ✅ passed | 0.11 |
| src/canvas/selectionRect.test.ts | deduplicates when shiftKey and marquee overlaps current | ✅ passed | 0.15 |
| src/supabase/cursors.test.ts | returns a valid hex colour string | ✅ passed | 0.38 |
| src/supabase/cursors.test.ts | is deterministic — same uid always returns same colour | ✅ passed | 0.10 |
| src/supabase/cursors.test.ts | returns different colours for different uids | ✅ passed | 0.08 |
| src/supabase/cursors.test.ts | handles an empty string without throwing | ✅ passed | 0.33 |
| src/supabase/cursors.test.ts | handles a very long uid without throwing | ✅ passed | 0.34 |
| src/supabase/objects.test.ts | throws when caller is not the board owner | ✅ passed | 3.06 |
| src/supabase/objects.test.ts | throws when board is not found | ✅ passed | 0.48 |
| src/supabase/objects.test.ts | deletes when caller is the board owner | ✅ passed | 1.24 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 2.66 |
| src/supabase/presence.test.ts | upserts with correct user_id and display_name | ✅ passed | 1.69 |
| src/supabase/presence.test.ts | includes last_seen_at timestamp in the upsert payload | ✅ passed | 0.66 |
| src/supabase/presence.test.ts | accepts null displayName | ✅ passed | 0.61 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 0.20 |
| src/supabase/presence.test.ts | filters by the correct user_id | ✅ passed | 0.18 |
| src/board/BoardsListPage.test.tsx | shows loading then two sections: My Boards and Shared with you | ✅ passed | 119.99 |
| src/board/BoardsListPage.test.tsx | splits boards into My Boards (owned) and Shared with you (not owned) | ✅ passed | 2.81 |
| src/board/BoardsListPage.test.tsx | shows empty state when no my boards | ✅ passed | 3.01 |
| src/board/BoardsListPage.test.tsx | shows empty state when no shared boards | ✅ passed | 7.36 |
| src/board/BoardsListPage.test.tsx | My Boards list has checkboxes; Rename disabled until one selected, Delete disabled until one or more selected | ✅ passed | 43.69 |
| src/board/BoardsListPage.test.tsx | clicking board name navigates to board | ✅ passed | 28.48 |
| src/board/BoardsListPage.test.tsx | Delete opens confirmation dialog | ✅ passed | 49.20 |
| src/board/BoardsListPage.test.tsx | Rename opens modal when exactly one board selected | ✅ passed | 46.99 |
| src/board/ShareModal.test.tsx | renders nothing when not open | ✅ passed | 14.68 |
| src/board/ShareModal.test.tsx | shows dialog with title and People with access when open | ✅ passed | 90.50 |
| src/board/ShareModal.test.tsx | shows Add by email and Invite when owner | ✅ passed | 22.81 |
| src/board/ShareModal.test.tsx | does not show Add by email or Invite when not owner | ✅ passed | 19.72 |
| src/board/ShareModal.test.tsx | does not show Copy link or Link section | ✅ passed | 17.85 |
| src/board/Toolbar.test.tsx | renders View only when isViewOnly is true | ✅ passed | 24.44 |
| src/board/Toolbar.test.tsx | renders full toolbar when isViewOnly is false | ✅ passed | 101.50 |
| src/utils/inputValidation.test.ts | rejects empty or whitespace | ✅ passed | 1.23 |
| src/utils/inputValidation.test.ts | rejects name shorter than min length | ✅ passed | 0.18 |
| src/utils/inputValidation.test.ts | accepts name at min length | ✅ passed | 0.59 |
| src/utils/inputValidation.test.ts | accepts non-empty trimmed name | ✅ passed | 0.22 |
| src/utils/inputValidation.test.ts | rejects name over max length | ✅ passed | 0.20 |
| src/utils/inputValidation.test.ts | accepts name at max length | ✅ passed | 0.15 |
| src/utils/inputValidation.test.ts | rejects name with only symbols or spaces | ✅ passed | 0.14 |
| src/utils/inputValidation.test.ts | accepts name with at least one letter or number | ✅ passed | 0.08 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.08 |
| src/utils/inputValidation.test.ts | rejects email shorter than min length | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts valid email at or above min length | ✅ passed | 0.06 |
| src/utils/inputValidation.test.ts | accepts valid email | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects invalid format | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | trims, lowercases, truncates | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | accepts at min length (1 character) | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | accepts non-empty | ✅ passed | 0.02 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | accepts short text | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | truncates and trims | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | clamps to 20–800 | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | rounds and handles non-finite | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | accepts valid range | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | rejects out of range or non-finite | ✅ passed | 0.04 |