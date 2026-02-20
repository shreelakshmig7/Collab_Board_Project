# Test results

**Generated:** 2026-02-20T21:55:17.492Z

| Summary | Count |
|---------|-------|
| Total tests | 71 |
| Passed | 71 |
| Failed | 0 |
| Overall | ✅ Passed |

---

## Test cases

| File | Test | Status | Duration (ms) |
|------|------|--------|---------------|
| src/ai/aiCommandPolicy.test.ts | treats simple sticky creation as simple + forced tool | ✅ passed | 1.20 |
| src/ai/aiCommandPolicy.test.ts | treats template commands as complex | ✅ passed | 0.27 |
| src/ai/aiCommandPolicy.test.ts | treats multi-step prompts as complex | ✅ passed | 0.08 |
| src/ai/aiCommandPolicy.test.ts | keeps basic ops single-turn | ✅ passed | 0.17 |
| src/ai/aiEdgePolicy.test.ts | routes simple creation to fast tier + single turn | ✅ passed | 0.63 |
| src/ai/aiEdgePolicy.test.ts | routes templates to smart tier + multi turn | ✅ passed | 0.15 |
| src/board/BoardsListPage.test.tsx | shows loading then two sections: My Boards and Shared with you | ✅ passed | 123.22 |
| src/board/BoardsListPage.test.tsx | splits boards into My Boards (owned) and Shared with you (not owned) | ✅ passed | 2.77 |
| src/board/BoardsListPage.test.tsx | shows empty state when no my boards | ✅ passed | 6.70 |
| src/board/BoardsListPage.test.tsx | shows empty state when no shared boards | ✅ passed | 2.96 |
| src/board/BoardsListPage.test.tsx | My Boards list has checkboxes; Rename disabled until one selected, Delete disabled until one or more selected | ✅ passed | 45.94 |
| src/board/BoardsListPage.test.tsx | clicking board name navigates to board | ✅ passed | 35.96 |
| src/board/BoardsListPage.test.tsx | Delete opens confirmation dialog | ✅ passed | 60.21 |
| src/board/BoardsListPage.test.tsx | Rename opens modal when exactly one board selected | ✅ passed | 51.67 |
| src/board/ShareModal.test.tsx | renders nothing when not open | ✅ passed | 12.94 |
| src/board/ShareModal.test.tsx | shows dialog with title and People with access when open | ✅ passed | 171.87 |
| src/board/ShareModal.test.tsx | shows Add by email and Invite when owner | ✅ passed | 24.52 |
| src/board/ShareModal.test.tsx | does not show Add by email or Invite when not owner | ✅ passed | 12.54 |
| src/board/ShareModal.test.tsx | does not show Copy link or Link section | ✅ passed | 19.75 |
| src/board/Toolbar.test.tsx | renders View only when isViewOnly is true | ✅ passed | 15.61 |
| src/board/Toolbar.test.tsx | renders full toolbar when isViewOnly is false | ✅ passed | 196.35 |
| src/canvas/selectionRect.test.ts | returns ids of objects whose bounds intersect the selection rect | ✅ passed | 1.43 |
| src/canvas/selectionRect.test.ts | handles selection rect with negative width/height (drag left or up) | ✅ passed | 0.14 |
| src/canvas/selectionRect.test.ts | excludes objects with zero width or height (e.g. connectors) | ✅ passed | 0.12 |
| src/canvas/selectionRect.test.ts | returns empty array when no objects intersect | ✅ passed | 0.07 |
| src/canvas/selectionRect.test.ts | returns empty array for empty objects | ✅ passed | 0.12 |
| src/canvas/selectionRect.test.ts | replaces selection when not shiftKey | ✅ passed | 0.43 |
| src/canvas/selectionRect.test.ts | adds marquee ids to current selection when shiftKey | ✅ passed | 0.28 |
| src/canvas/selectionRect.test.ts | deduplicates when shiftKey and marquee overlaps current | ✅ passed | 0.19 |
| src/supabase/cursors.test.ts | returns a valid hex colour string | ✅ passed | 0.42 |
| src/supabase/cursors.test.ts | is deterministic — same uid always returns same colour | ✅ passed | 0.10 |
| src/supabase/cursors.test.ts | returns different colours for different uids | ✅ passed | 0.08 |
| src/supabase/cursors.test.ts | handles an empty string without throwing | ✅ passed | 0.37 |
| src/supabase/cursors.test.ts | handles a very long uid without throwing | ✅ passed | 0.51 |
| src/supabase/objects.test.ts | throws when caller is not the board owner | ✅ passed | 3.23 |
| src/supabase/objects.test.ts | throws when board is not found | ✅ passed | 0.26 |
| src/supabase/objects.test.ts | deletes when caller is the board owner | ✅ passed | 0.95 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 2.51 |
| src/supabase/presence.test.ts | upserts with correct user_id and display_name | ✅ passed | 1.85 |
| src/supabase/presence.test.ts | includes last_seen_at timestamp in the upsert payload | ✅ passed | 0.88 |
| src/supabase/presence.test.ts | accepts null displayName | ✅ passed | 0.94 |
| src/supabase/presence.test.ts | calls from() with the presence table | ✅ passed | 0.95 |
| src/supabase/presence.test.ts | filters by the correct user_id | ✅ passed | 0.11 |
| src/utils/inputValidation.test.ts | rejects empty or whitespace | ✅ passed | 0.68 |
| src/utils/inputValidation.test.ts | rejects name shorter than min length | ✅ passed | 0.08 |
| src/utils/inputValidation.test.ts | accepts name at min length | ✅ passed | 0.47 |
| src/utils/inputValidation.test.ts | accepts non-empty trimmed name | ✅ passed | 0.16 |
| src/utils/inputValidation.test.ts | rejects name over max length | ✅ passed | 0.13 |
| src/utils/inputValidation.test.ts | accepts name at max length | ✅ passed | 0.09 |
| src/utils/inputValidation.test.ts | rejects name with only symbols or spaces | ✅ passed | 0.13 |
| src/utils/inputValidation.test.ts | accepts name with at least one letter or number | ✅ passed | 0.15 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.15 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.40 |
| src/utils/inputValidation.test.ts | rejects email shorter than min length | ✅ passed | 0.54 |
| src/utils/inputValidation.test.ts | accepts valid email at or above min length | ✅ passed | 0.08 |
| src/utils/inputValidation.test.ts | accepts valid email | ✅ passed | 0.08 |
| src/utils/inputValidation.test.ts | rejects invalid format | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.03 |
| src/utils/inputValidation.test.ts | trims, lowercases, truncates | ✅ passed | 0.21 |
| src/utils/inputValidation.test.ts | rejects empty | ✅ passed | 0.51 |
| src/utils/inputValidation.test.ts | accepts at min length (1 character) | ✅ passed | 0.79 |
| src/utils/inputValidation.test.ts | accepts non-empty | ✅ passed | 0.20 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.12 |
| src/utils/inputValidation.test.ts | trims and truncates | ✅ passed | 0.15 |
| src/utils/inputValidation.test.ts | accepts short text | ✅ passed | 0.07 |
| src/utils/inputValidation.test.ts | rejects over max length | ✅ passed | 0.04 |
| src/utils/inputValidation.test.ts | truncates and trims | ✅ passed | 0.19 |
| src/utils/inputValidation.test.ts | clamps to 20–800 | ✅ passed | 0.29 |
| src/utils/inputValidation.test.ts | rounds and handles non-finite | ✅ passed | 0.05 |
| src/utils/inputValidation.test.ts | accepts valid range | ✅ passed | 0.27 |
| src/utils/inputValidation.test.ts | rejects out of range or non-finite | ✅ passed | 0.18 |