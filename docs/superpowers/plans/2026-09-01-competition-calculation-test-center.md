# Competition Calculation and QA Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weekly competition scores derive from record history and rollover without hard-coding a Week 1 date, remove the obsolete monthly-score display, and provide independently runnable browser QA groups with isolated fixtures.

**Architecture:** `competition-calculation-v6.js` is the pure source of truth for weekly score and rollover. UI rendering consumes calculated weekly scores rather than `students.competition_score` for historical weeks. `test-center-v6.js` owns browser assertions and exposes each test group independently; pure fixtures remain isolated from production data.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Supabase/PostgreSQL, Vercel.

**Spec:** Current Thi đua requirements approved in chat: first week starts at 81; later weeks start from rollover; a later week with no records keeps its rollover score; no fixed calendar date for Week 1; no monthly score column; monthly reporting will show four weekly scores plus a separate four-week summary in the common/semester summary area; QA groups must be runnable independently.

## Global Constraints

- Do not hard-code a calendar date as Week 1.
- `date` is the only user-entered record date; `week` is derived by the system.
- Historical weekly score is derived from `competition_records` plus rollover, not from `students.competition_score`.
- Do not create or display a separate monthly competition score.
- Preserve existing legacy features, including random student picker.
- Keep modules separated by responsibility and documented with comments.
- Mutation QA must use isolated `AUTOTEST_` data and cleanup; pure tests must not mutate production data.

---

### Task 1: Dynamic Weekly Calculation

**Files:**
- Modify: `competition-calculation-v6.js`
- Test: `test-center-v6.js`

- [ ] Remove the fixed official Week 1 date from the calculation algorithm.
- [ ] Define the first calculable week from the supplied record history; when no earlier history exists, use base 81.
- [ ] Calculate each later week sequentially and apply the existing rollover thresholds.
- [ ] Add regression fixtures for 91→91, 90→81, 80→71, 65→61, 49→51 and empty weeks preserving the rollover value.
- [ ] Verify score calculation does not read `students.competition_score`.

### Task 2: Historical Ranking and Monthly UI Cleanup

**Files:**
- Modify: `index.html`
- Modify: the V6 competition rendering/runtime module that supplies `rankBody`

- [ ] Remove the `Điểm tháng` column from ranking.
- [ ] Ensure an empty selected week uses the calculation engine's rollover result rather than the student's current score.
- [ ] Keep the four-week summary out of the ranking table.

### Task 3: Independent Test Center Groups

**Files:**
- Modify: `test-center-v6.html`
- Modify: `test-center-v6.js`
- Modify: `test-center-v6.css`

- [ ] Add a Run button per test group plus Run All.
- [ ] Add isolated fixture/scenario panels so the teacher can see which test data each group uses.
- [ ] Keep calculation/edge-case tests data-only and non-mutating.
- [ ] Keep Supabase tests read-only unless a dedicated sandbox mutation contract exists.
- [ ] Include legacy random-picker regression in its own runnable group.
- [ ] Show group-level PASS/FAIL counts and individual failure details.

### Task 4: Verification

- [ ] Run each group independently in the Vercel Test Center.
- [ ] Run all groups.
- [ ] Verify no monthly score column remains in the ranking UI.
- [ ] Verify a later empty week preserves rollover from the previous week.
- [ ] Verify the existing random-picker smoke test remains runnable.
