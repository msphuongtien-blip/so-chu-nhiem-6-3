# Competition V6 — Remaining Implementation Plan

> Master plan for the remaining work after the completed V6/core/Test Center checkpoints. This file intentionally excludes tasks already verified as completed.

## Scope and source plans

This remaining plan consolidates the unfinished work from:
- Thi đua V5 Phase 3 Implementation Plan (2026-08-27).
- Core Refactor Phase A Implementation Plan (2026-08-27).
- Competition Calculation and QA Center Implementation Plan (2026-09-01).
- Subsequent Test Center decisions recorded in the working chat.

The repository branch is the implementation source of truth. Older plan file paths are adapted to the actual V6 root-level modules already present in the repository.

## Global contracts

- `competition_records` remains the Source of Truth.
- Do not write a manually accumulated total score to compensate for history.
- First calculable cycle starts at 81; do not hard-code a calendar date as Week 1.
- `date` is the user-entered record date; `week` is derived by the system.
- Valid record changes are `-5..-1` and `+1..+5`; `0` is invalid.
- Weekly score is clamped to `0..100`.
- Rollover is exactly:
  - 91–100 → 91
  - 81–90 → 81
  - 66–80 → 71
  - 50–65 → 61
  - 0–49 → 51
- If a later week has no record, its score remains the rollover value from the preceding week.
- Editing/deleting a historical record must recalculate the affected week and every later affected rollover week.
- No separate monthly competition-score column/display. Monthly reporting may summarize the four weekly scores separately.
- All 6 competition groups remain supported. Criteria with history use soft delete (`active=false`).
- Preserve current 44 students and historical records. Do not create fake production students.
- Preserve Auth/RLS unless a failing security test proves a required policy change.
- No Service Role Key in browser code.
- Every code file has a file-level responsibility comment. Non-trivial functions have JSDoc/comments. Do not compress functions into one line.
- Mutation tests must use isolated `AUTOTEST_` data and cleanup. Pure calculation tests must never mutate production data.

## Completed checkpoints — intentionally not repeated as tasks

The following are considered completed and are not implementation targets in this plan:
- Core config/Supabase/state/utils extraction and HTML bootstrap integration.
- Six-category V6 adapter/runtime and category settings UI.
- Competition form, student picker, record submit/date/edit synchronization modules.
- V6 calculation engine integration with the current ranking runtime.
- 44-student ranking and equal-rank behavior already wired into the current UI.
- Current Test Center shell/group runner and readability pass.
- Core/bootstrap contract tests and existing calculation/category/form regression coverage.

These items remain subject to final regression verification but are not to be rebuilt.

---

## Task R1 — Make weekly calculation fully dynamic and contract-driven

**Depends on:** existing `competition-calculation-v6.js`.
**Can run in parallel with:** Task R3, Task R7, Task R8.

**Files:**
- Modify `competition-calculation-v6.js`.
- Modify `competition-calculation-runtime-v6.js` only if the runtime API needs alignment.
- Modify `test-center-v6.js` / `test-center-groups-v6.js`.
- Create/modify calculation regression tests as needed.

### Work
1. Remove the fixed official Week 1 calendar date from the calculation algorithm.
2. Determine the first calculable week from supplied history; if there is no earlier history, use base 81.
3. Calculate later weeks sequentially from the preceding week's final score through the exact rollover contract above.
4. Preserve empty-week rollover with no record.
5. Ensure the calculation engine never reads `students.competition_score` for historical weekly results.
6. Add boundary tests for `91→91`, `90→81`, `80→71`, `65→61`, `49→51`, and multiple empty weeks.
7. Add multi-week edit tests proving a change to an earlier week propagates forward.

### Verification
- Pure tests pass.
- Existing V6 ranking still receives the calculated score.
- No production data mutation occurs.

### Commit
`fix(competition): make weekly calculation history-driven`

---

## Task R2 — Remove obsolete monthly score from ranking UI

**Depends on:** Task R1.
**Can run in parallel with:** Task R3, Task R7, Task R8.

**Files:**
- Modify `index.html`.
- Modify the V6 competition rendering/runtime module supplying `rankBody`.
- Modify relevant Test Center assertions.

### Work
1. Remove `Điểm tháng` from the ranking table.
2. For an empty selected later week, display the calculation engine's rollover result rather than `students.competition_score`.
3. Keep four-week/month summary outside the weekly ranking table.
4. Preserve existing weekly ranking, 44-student display, and equal-rank behavior.

### Verification
- Search confirms no ranking header/row still exposes `Điểm tháng`.
- Empty later week shows rollover.
- Existing ranking smoke tests remain green.

### Commit
`fix(competition): remove obsolete monthly score from ranking`

---

## Task R3 — Finish legacy Thi đua boundary and app.js readability

**Depends on:** existing V6 adapters; does not change business rules.
**Can run in parallel with:** Task R1, Task R4, Task R7, Task R8.

**Files:**
- `app.js`.
- Existing V6 competition modules already loaded by `index.html`.
- Add focused regression test only where a boundary is changed.

### Work
1. Identify remaining legacy competition entry points, especially `renderCompetition()`, `addCompetition()`, `openCompetitionForm()`, `submitCompetition()` and related direct Supabase calls.
2. Route them through the existing V6 modules instead of duplicating business logic.
3. Remove duplicated calculation/criteria/form behavior only after confirming the V6 replacement is equivalent.
4. Keep compatibility with existing inline handlers where required.
5. Reformat remaining non-trivial one-line functions into readable multi-line code.
6. Add file/function comments where responsibility is not obvious.
7. Do not refactor unrelated attendance/random/honors/discipline behavior in this task.

### Verification
- `app.js` no longer contains the legacy competition business path that duplicates V6 behavior.
- No new `ReferenceError`, `SyntaxError`, missing-module, or duplicate-Supabase-client issue.
- Existing competition flows still work.

### Commit
`refactor(competition): remove legacy competition boundary from app`

---

## Task R4 — Weekly snapshot persistence and correction chain

**Depends on:** Task R1.
**Blocks:** Task R5 and Task R6.
**Can run in parallel with:** Task R3, Task R7, Task R8.

**Files:**
- Create/modify `supabase/migrations/<timestamp>_weekly_snapshot.sql` only if schema is not already present.
- Create `competition-weekly-snapshot-v6.js` or the repository's existing V6 service location.
- Create `tests/competition/snapshot-v6.test.js`.

### Work
1. Store one weekly snapshot per `(student_id, week)`.
2. Snapshot must contain at least `student_id`, `week`, `start_score`, `total_plus`, `total_minus`, `total_change`, `final_score`, `group`, `rank`.
3. Build snapshots from `competition_records` + calculation engine, never by trusting a manually edited final score.
4. Upsert safely on `(student_id, week)`.
5. Refresh the snapshot after an affected record edit/delete.
6. Recalculate later snapshots when rollover changes.
7. Do not rewrite historical `competition_records` merely to create a snapshot.

### Verification
- Create/update/delete record changes the affected snapshot.
- A historical edit propagates to later snapshot start scores.
- Duplicate snapshot creation is idempotent.

### Commit
`feat(competition): add weekly snapshot persistence`

---

## Task R5 — Server-side Sunday snapshot automation

**Depends on:** Task R4.
**Can run in parallel with:** Task R7, Task R8 after its own prerequisites.

**Files:**
- Create `supabase/functions/create-weekly-snapshots/index.ts`.
- Create/modify scheduler SQL/configuration only when supported by the current Supabase project.
- Create `tests/competition/scheduler-verification.md`.

### Work
1. Add a server-side Edge Function for weekly snapshots.
2. Service Role access, if required, stays server-side only.
3. Make manual invocation safe and idempotent.
4. Verify all 44 students are handled for the target week.
5. Configure Sunday execution in the project's supported timezone mechanism; if scheduler configuration cannot be applied programmatically, document the exact manual configuration instead of guessing.

### Verification
- Manual invocation succeeds.
- Re-running does not create duplicates.
- Snapshot data matches the calculation engine.
- No secret is sent from the browser.

### Commit
`feat(competition): automate weekly snapshot creation`

---

## Task R6 — Start-of-week snapshot notification and viewer

**Depends on:** Task R4 and Task R5.
**Can run in parallel with:** Task R7, Task R8.

**Files:**
- Create/modify `snapshot-notification-v6.js`.
- Modify `index.html` only for required markup.
- Create `tests/competition/snapshot-notification-v6.test.js`.

### Work
1. Detect when a previous weekly snapshot exists for the current week transition.
2. Show a concise notification with `Xem snapshot` and `Xem sau`.
3. `Xem snapshot` opens the saved weekly result for all 44 students.
4. Track viewed/dismissed state without changing snapshot data.
5. Avoid repeated notifications after the teacher has dismissed/viewed the snapshot.

### Commit
`feat(competition): add weekly snapshot notification`

---

## Task R7 — Data issue reporting and resolution

**Can run in parallel with:** Task R1, Task R3, Task R4, Task R8.

**Files:**
- Create `competition-issues-v6.js` or equivalent service module.
- Create renderer module if required.
- Create `tests/competition/issues-v6.test.js`.

### Work
1. Implement `createIssue(payload)`.
2. Implement `listOpenIssues()`.
3. Implement `resolveIssue(issueId, resolutionNote)`.
4. Support `OPEN/RESOLVED` status.
5. Show a startup warning when unresolved data issues exist.
6. Link an issue to the relevant student/week/record where applicable.
7. Resolving an issue must remove the warning without deleting the audit/history trail.

### Commit
`feat(competition): add data issue reporting`

---

## Task R8 — Student login by student code

**Can run in parallel with:** Task R1, Task R3, Task R4, Task R7.

**Files:**
- Create `supabase/functions/student-login/index.ts` only if required by the chosen Supabase-supported flow.
- Create/modify `student-auth-v6.js`.
- Modify `index.html` login markup.
- Create `tests/auth/student-login-v6.test.js`.

### Work
1. Authenticate using `student_code + password`, not an email displayed in the student profile.
2. Resolve `student_code` to the authenticated user/session server-side where required.
3. Establish a normal Supabase-supported session.
4. Enforce read-only student scope through RLS.
5. Prevent a student logged in as `6301` from reading `6302`'s private data.
6. If the Supabase Auth model cannot safely support the required session flow, stop this task and report the concrete blocker before changing architecture.

### Commit
`feat(auth): add student-code login flow`

---

## Task R9 — Teacher/Admin student password reset

**Depends on:** Task R8 and audit contract from Task R11.

**Files:**
- Create `supabase/functions/admin-reset-student-password/index.ts`.
- Create `student-password-reset-v6.js`.
- Create `tests/auth/reset-password-v6.test.js`.

### Work
1. Require teacher/admin authorization.
2. Require re-authentication.
3. Reset password server-side.
4. Never expose Service Role Key to the browser.
5. Write an audit entry without storing the password.

### Commit
`feat(auth): add audited student password reset`

---

## Task R10 — Safe Excel import and TEST/REAL bulk delete

**Can run in parallel with:** Task R7, Task R8.
**Depends on:** audit contract from Task R11 before finalizing mutation paths.

**Files:**
- Create `student-data-management-v6.js`.
- Create `student-excel-import-v6.js`.
- Create `supabase/functions/admin-bulk-data-operation/index.ts`.
- Create `tests/admin/data-management-v6.test.js`.

### Work
1. Preview Excel before insertion.
2. Validate required fields and duplicate/conflicting student codes.
3. Generate class/STT code consistently with the current class convention.
4. Require explicit confirmation before inserting.
5. Support TEST and REAL delete scopes.
6. Require re-authentication, scope confirmation, and confirmation phrase for destructive actions.
7. Prevent accidental deletion of unrelated classes/data.
8. Audit destructive operations.

### Commit
`feat(admin): add safe student data management`

---

## Task R11 — Audit log and security hardening

**Depends on:** Task R7 and any mutation paths introduced before final security verification.
**Can run in parallel with:** Task R8 and non-security UI work.

**Files:**
- Create/modify `supabase/migrations/<timestamp>_audit_log.sql` only if needed.
- Create `audit-log-v6.js` only if a teacher viewer is required.
- Create `tests/security/audit-log-v6.test.js`.

### Work
1. Log sensitive actions server-side.
2. At minimum cover: update score, delete competition record, delete student, bulk delete, reset password, resolve issue.
3. Do not log passwords or other secrets.
4. Provide a safe teacher viewer only if needed; do not expose sensitive payloads unnecessarily.

### Commit
`feat(security): add audit logging for sensitive actions`

---

## Task R12 — RLS verification and minimal policy corrections

**Depends on:** Task R8, Task R9, Task R10, Task R11.

**Files:**
- Create `tests/security/phase3-rls-v6.sql`.
- Modify RLS policies only when a failing test proves the correction is required.

### Work
1. Verify teacher SELECT/INSERT/UPDATE/DELETE access.
2. Verify student read-only permitted scope.
3. Verify student cannot read another student's private data.
4. Verify student cannot insert/update/delete competition records.
5. Keep RLS enabled throughout.

### Commit
`test(security): verify competition RLS matrix`

---

## Task R13 — Full preflight, regression, deployment verification, and final Test Center

**Depends on:** all preceding implementation tasks.

**Files:**
- Create/modify `test-center-v6.js` and grouped runner only for missing coverage.
- Create `tests/phase3-regression-checklist.md`.
- Modify `README.md`.

### Verification gate

1. Run all pure/unit tests.
2. Run syntax checks for every JavaScript file touched in the phase.
3. Verify module/dependency order in `index.html`.
4. Verify no duplicate Supabase initialization or stale legacy competition path remains.
5. Verify 44 students.
6. Verify all 6 criteria groups.
7. Verify valid score set and rejection of zero.
8. Verify initial 81 and history-driven week calculation.
9. Verify all five rollover boundaries and empty-week carry-forward.
10. Verify historical edit/delete propagation.
11. Verify ranking and equal ranks.
12. Verify no monthly score column.
13. Verify snapshot persistence and idempotence.
14. Verify notification and issue resolution.
15. Verify student login and student isolation.
16. Verify password reset and audit behavior.
17. Verify import preview and destructive-operation safeguards.
18. Verify RLS matrix.
19. Run the existing random-picker smoke test.
20. Run all Test Center groups independently, then Run All.
21. Verify Vercel deployment for the final commit.
22. Fix every failure and rerun the affected test plus the full regression set.
23. Update README and mark the plan checkpoints with commit SHAs.

### Final handoff rule

Only after the verification gate is green should the teacher receive one final Vercel/Test Center link for manual acceptance testing. Do not ask the teacher to retest failures that can be detected and fixed in code.

### Commit
`chore(qa): complete competition V6 verification gate`

---

## Execution policy

For each implementation task:

`RED → implement → GREEN → refactor → targeted verification → full affected regression → fix failures → rerun → atomic commit`.

Independent tasks may be executed in parallel. Dependent tasks wait for their prerequisite contract. Never claim a task is complete without verification evidence.

### Mandatory stop conditions

Stop and ask the teacher if:
- Current schema contradicts the approved contract.
- Existing data could be lost or rewritten.
- RLS behavior is ambiguous and cannot be safely verified.
- Supabase Auth cannot support the required student session model.
- Scheduler support cannot be established without guessing.
- A legacy function writes a total score outside the Source of Truth model.
- A dependency requires deleting/renaming an existing column or changing historical semantics.
