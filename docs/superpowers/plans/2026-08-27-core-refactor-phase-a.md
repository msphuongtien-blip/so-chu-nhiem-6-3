# Core Refactor Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách lớp Core của website hiện tại thành các trách nhiệm rõ ràng mà không thay đổi behavior, dữ liệu, authentication, RLS hoặc giao diện đang hoạt động.

**Architecture:** Đợt A tạo `config.js`, `supabase.js`, `state.js`, `utils.js` dưới `core/`; `app.js` tiếp tục giữ nghiệp vụ legacy và bootstrap trong giai đoạn chuyển tiếp. Existing inline handlers được giữ nguyên qua compatibility approach; chưa chuyển nghiệp vụ sang các module chức năng trong đợt A.

**Tech Stack:** Vanilla JavaScript, Supabase JS v2, HTML/CSS hiện tại, Vercel deployment.

**Spec:** Thiết kế Core Refactor đã được chị phê duyệt trong cuộc trao đổi hiện tại.

## Global Constraints

- Không tạo database mới.
- Không thay đổi hoặc xóa RLS/Auth hiện tại.
- Giữ nguyên 44 học sinh hiện có.
- Không tạo học sinh giả.
- Không thay đổi UI/UX trong đợt A.
- Không thay đổi logic nghiệp vụ Thi đua/Điểm danh/Gọi tên ngoài những thay đổi bắt buộc để tách Core.
- Mọi file mới phải có comment đầu file và function mới có JSDoc khi logic không hiển nhiên.
- Không viết câu lệnh hoặc function dài thành một dòng nếu có thể format rõ ràng.
- Mỗi thay đổi phải có test trước implementation, sau đó kiểm tra lại toàn bộ app.
- Mỗi commit phải atomic, có message rõ ràng và có thể rollback.

---

### Task 1: Create the core test harness

**Files:**
- Create: `tests/core/core-contract.test.js`

**Interfaces:**
- Consumes: Browser-safe pure helper contracts and shared state contracts.
- Produces: A repeatable Node test entry point that verifies the Core contracts without touching production data.

- [ ] **Step 1: Write failing tests**

Test these behaviors:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    escapeHtml,
    getCurrentWeekStart,
    createInitialState,
} from '../../core/utils.js';

test('escapeHtml escapes HTML-sensitive characters', () => {
    assert.equal(
        escapeHtml('<script>"x"</script>'),
        '&lt;script&gt;&quot;x&quot;&lt;/script&gt;',
    );
});

test('getCurrentWeekStart returns Monday for a known Wednesday', () => {
    assert.equal(
        getCurrentWeekStart(new Date('2026-08-26T00:00:00Z')),
        '2026-08-24',
    );
});

test('createInitialState contains the shared application state shape', () => {
    const state = createInitialState();

    assert.equal(state.currentUser, null);
    assert.equal(state.currentProfile, null);
    assert.equal(state.role, 'teacher');
    assert.deepEqual(state.students, []);
    assert.deepEqual(state.supabaseCache.students, []);
    assert.deepEqual(state.supabaseCache.competitionRecords, []);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/core/core-contract.test.js
```

Expected: FAIL because `core/utils.js` and the Core exports do not yet exist.

- [ ] **Step 3: Do not add production code beyond what these contracts require**

Create only the minimal Core functions required by the tests in later tasks.

- [ ] **Step 4: Commit the test harness**

```bash
git add tests/core/core-contract.test.js
git commit -m "test(core): define phase A core contracts"
```

---

### Task 2: Extract configuration and Supabase client

**Files:**
- Create: `core/config.js`
- Create: `core/supabase.js`

**Interfaces:**
- Consumes: Existing Supabase URL and publishable key currently in `app.js`.
- Produces: `APP_CONFIG`, `createSupabaseClient()` and a singleton `supabaseClient` for later modules.

- [ ] **Step 1: Extend failing tests**

Add:

```javascript
import {
    APP_CONFIG,
} from '../../core/config.js';
import {
    createSupabaseClient,
} from '../../core/supabase.js';

test('APP_CONFIG points to the existing Supabase project', () => {
    assert.equal(
        APP_CONFIG.SUPABASE_URL,
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    );
});

test('createSupabaseClient requires the existing Supabase JS global', () => {
    const previousSupabase = globalThis.supabase;

    globalThis.supabase = {
        createClient: (url, key) => ({
            url,
            key,
        }),
    };

    const client = createSupabaseClient();

    assert.equal(client.url, APP_CONFIG.SUPABASE_URL);
    assert.equal(client.key, APP_CONFIG.SUPABASE_PUBLISHABLE_KEY);

    globalThis.supabase = previousSupabase;
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
node --test tests/core/core-contract.test.js
```

Expected: FAIL because `core/config.js` and `core/supabase.js` are not implemented.

- [ ] **Step 3: Implement minimal Core configuration/client**

`core/config.js` must contain only configuration constants and a file-level comment. It must not contain DOM or business logic.

`core/supabase.js` must expose the client factory and singleton; it must not duplicate client creation elsewhere.

- [ ] **Step 4: Run test and verify GREEN**

```bash
node --test tests/core/core-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/config.js core/supabase.js tests/core/core-contract.test.js
git commit -m "refactor(core): extract Supabase configuration and client"
```

---

### Task 3: Extract shared state

**Files:**
- Create: `core/state.js`

**Interfaces:**
- Consumes: Current global state shape in `app.js`.
- Produces: `createInitialState()` and one shared mutable state object for later migration.

- [ ] **Step 1: Extend failing tests**

Add:

```javascript
test('state preserves the current application defaults', () => {
    const state = createInitialState();

    assert.deepEqual(state.classSettings, {
        class_name: '6/3',
        school_year: '2026-2027',
        teacher_name: 'Phượng Tiên',
    });

    assert.equal(state.trendChart, null);
    assert.equal(state.studentChart, null);
    assert.deepEqual(state.randomHistory, []);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/core/core-contract.test.js
```

Expected: FAIL until `core/state.js` exists.

- [ ] **Step 3: Implement shared state**

The state shape must preserve current defaults and must not add new business fields in Phase A.

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/core/core-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/state.js tests/core/core-contract.test.js
git commit -m "refactor(core): extract shared application state"
```

---

### Task 4: Extract pure shared utilities

**Files:**
- Create: `core/utils.js`

**Interfaces:**
- Consumes: `localDate`, `compWeekStart`, `getCurrentWeekStart`, `$`, `esc` and other pure helpers currently embedded in `app.js`.
- Produces: browser-safe pure utilities that can be imported without application bootstrap.

- [ ] **Step 1: Extend failing tests**

Add tests for:

```javascript
test('getCurrentWeekStart handles Sunday by returning previous Monday', () => {
    assert.equal(
        getCurrentWeekStart(new Date('2026-08-30T00:00:00Z')),
        '2026-08-24',
    );
});

test('localDate formats a Date in YYYY-MM-DD without milliseconds', () => {
    assert.match(
        localDate(new Date('2026-08-27T12:00:00Z')),
        /^2026-08-2[67]$/,
    );
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/core/core-contract.test.js
```

Expected: FAIL until utilities are implemented.

- [ ] **Step 3: Implement utilities**

Use explicit multi-line functions for any non-trivial logic. `escapeHtml` must preserve the current escaping semantics. Date functions must return the same values as the legacy implementation for the same input.

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/core/core-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add core/utils.js tests/core/core-contract.test.js
git commit -m "refactor(core): extract shared utility functions"
```

---

### Task 5: Integrate Core into the existing page without changing behavior

**Files:**
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Consumes: `core/config.js`, `core/supabase.js`, `core/state.js`, `core/utils.js`.
- Produces: Existing global function names and page behavior remain available to inline handlers.

- [ ] **Step 1: Add a failing smoke test**

Create `tests/core/bootstrap-contract.test.js` that verifies the expected script dependency order as plain text:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');

for (const file of [
    'core/config.js',
    'core/supabase.js',
    'core/state.js',
    'core/utils.js',
    'app.js',
]) {
    assert.ok(
        html.includes(`src="${file}"`),
        `index.html must load ${file}`,
    );
}
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/core/bootstrap-contract.test.js
```

Expected: FAIL because the new scripts are not referenced yet.

- [ ] **Step 3: Integrate scripts in dependency order**

The order must be:

```text
Supabase CDN
Chart.js CDN
core/config.js
core/supabase.js
core/state.js
core/utils.js
app.js
compatibility/V6 files
```

Do not delete existing scripts in Phase A.

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/core/core-contract.test.js tests/core/bootstrap-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Perform manual regression checks before commit**

Verify on the Vercel deployment:

```text
Login GVCN
→ Dashboard
→ 44 học sinh
→ Điểm danh
→ Thi đua
→ Gọi tên
→ Bảng danh dự
→ Nề nếp
→ Học tập
→ Báo cáo
→ Cài đặt
```

Open DevTools Console and verify there is no new `ReferenceError`, `SyntaxError`, failed script request, or Supabase initialization error.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js core/ tests/core/
git commit -m "refactor(core): integrate core layer with legacy bootstrap"
```

---

### Task 6: Phase A code-quality and verification gate

**Files:**
- Modify: Any Phase A file only when a discovered issue is verified by a failing check.

**Interfaces:**
- Consumes: Complete Phase A Core layer and legacy application.
- Produces: Verified branch state ready for the teacher's independent regression test.

- [ ] **Step 1: Run all Core tests**

```bash
node --test tests/core/*.test.js
```

Expected: PASS.

- [ ] **Step 2: Syntax-check every JavaScript file in Phase A**

```bash
find core -name '*.js' -print0 | xargs -0 -n1 node --check
node --check app.js
```

Expected: every command returns exit code 0.

- [ ] **Step 3: Check for unintended hard-coded Core duplicates**

Search `app.js` for duplicated configuration/state definitions and record findings. No Core extraction is considered complete until the duplicated definitions are either intentionally kept for compatibility with an explicit comment or replaced safely.

- [ ] **Step 4: Verify Git diff**

Confirm only Phase A files changed. No student data, seed files, RLS policy files, or unrelated UI files should change.

- [ ] **Step 5: Verify Vercel status**

The commit must report Vercel success before the branch is handed to the teacher.

- [ ] **Step 6: Create final Phase A commit**

```bash
git add core app.js index.html tests/core
git commit -m "chore(core): complete phase A verification gate"
```

At this checkpoint, do not merge to `main`. Wait for teacher acceptance testing.
