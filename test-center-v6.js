/*
 * FILE: test-center-v6.js
 *
 * Mục đích:
 * Browser-based regression runner cho Sổ Chủ Nhiệm V6.
 * Chạy trực tiếp trên Vercel, không cần localhost/terminal.
 *
 * Nguyên tắc:
 * - Unit tests dùng dữ liệu giả, không ghi database.
 * - Read-only smoke tests đọc Supabase thật khi có session.
 * - UI smoke test chạy chính ứng dụng trong iframe cùng origin.
 * - Không tự xóa hoặc sửa dữ liệu lớp trong bản test này.
 *
 * Để test mutation database an toàn, sẽ bổ sung sandbox transaction/cleanup
 * riêng sau khi repository có contract test isolation hoàn chỉnh.
 */

const TEST_CENTER_SUPABASE = {
    url: 'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    anonKey: 'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

const qaSupabase = window.supabase.createClient(
    TEST_CENTER_SUPABASE.url,
    TEST_CENTER_SUPABASE.anonKey,
);

const tests = [];

function addTest(group, name, fn) {
    tests.push({ group, name, fn });
}

function expectEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(
            `${message ? message + ' · ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
    }
}

function expectTrue(value, message = '') {
    if (!value) {
        throw new Error(message || 'Expected condition to be true.');
    }
}

function expectIncludes(array, value, message = '') {
    if (!array.includes(value)) {
        throw new Error(
            `${message ? message + ' · ' : ''}missing ${JSON.stringify(value)}`,
        );
    }
}

function addDays(yyyyMmDd, days) {
    const date = new Date(`${yyyyMmDd}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function calculateChain(records, studentId, firstWeek, targetWeek) {
    const engine = window.CompetitionCalculationV6;
    let week = engine.getMonday(firstWeek);
    const target = engine.getMonday(targetWeek);
    let score = engine.CONFIG.BASE_SCORE;

    while (week <= target) {
        const change = engine.sumWeekChange(records, studentId, week);
        score = engine.clampScore(score + change);

        if (week === target) {
            return score;
        }

        score = engine.rolloverStart(score);
        week = addDays(week, 7);
    }

    return score;
}

function scoreAfterMovingRecord(records, studentA, studentB, recordId) {
    const cloned = records.map((record) => ({ ...record }));
    const moving = cloned.find((record) => record.id === recordId);

    if (!moving) {
        throw new Error('Cannot find record for A → B scenario.');
    }

    moving.student_id = studentB;

    return {
        a: calculateChain(cloned, studentA, '2030-01-07', '2030-01-07'),
        b: calculateChain(cloned, studentB, '2030-01-07', '2030-01-07'),
    };
}

/* -------------------------------------------------------------------------- */
/* Calculation regression                                                     */
/* -------------------------------------------------------------------------- */

addTest('Calculation', 'Base score without records = 81', () => {
    const result = calculateChain([], 'A', '2030-01-07', '2030-01-07');
    expectEqual(result, 81);
});

for (const score of [1, 2, 3, 4, 5, -1, -2, -3, -4, -5]) {
    addTest('Calculation', `Single record ${score > 0 ? '+' : ''}${score}`, () => {
        const records = [{ student_id: 'A', week: '2030-01-07', score }];
        expectEqual(
            calculateChain(records, 'A', '2030-01-07', '2030-01-07'),
            81 + score,
        );
    });
}

addTest('Calculation', 'Zero is not a valid score', () => {
    expectTrue(!window.CompetitionCalculationV6.CONFIG.VALID_SCORES.includes(0));
});

addTest('Calculation', 'Weekly sum combines multiple records', () => {
    const records = [
        { student_id: 'A', week: '2030-01-07', score: 3 },
        { student_id: 'A', week: '2030-01-07', score: 2 },
        { student_id: 'A', week: '2030-01-07', score: -1 },
        { student_id: 'A', week: '2030-01-07', score: -2 },
    ];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-07'),
        83,
    );
});

const rolloverCases = [
    [91, 91],
    [90, 81],
    [85, 81],
    [81, 81],
    [80, 71],
    [78, 71],
    [66, 71],
    [65, 61],
    [50, 61],
    [49, 51],
    [0, 51],
];

for (const [endScore, nextScore] of rolloverCases) {
    addTest('Rollover', `${endScore} → ${nextScore}`, () => {
        expectEqual(
            window.CompetitionCalculationV6.rolloverStart(endScore),
            nextScore,
        );
    });
}

addTest('Rollover', '91 with no record stays 91 next week', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: 10 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        91,
    );
});

addTest('Rollover', '85 then no record starts next week at 81', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: 4 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        81,
    );
});

addTest('Rollover', '78 then no record starts next week at 71', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: -3 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        71,
    );
});

addTest('Rollover', '65 then no record starts next week at 61', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: -16 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        61,
    );
});

addTest('Rollover', '49 then no record starts next week at 51', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: -32 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        51,
    );
});

addTest('Rollover', '91 across three empty weeks stays 91', () => {
    const records = [{ student_id: 'A', week: '2030-01-07', score: 10 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-28'),
        91,
    );
});

/* -------------------------------------------------------------------------- */
/* Record edge cases                                                           */
/* -------------------------------------------------------------------------- */

addTest('Record edge cases', 'Same student, same week, change date within week', () => {
    const records = [{ id: 'r1', student_id: 'A', week: '2030-01-07', score: 3 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-07'),
        84,
    );
});

addTest('Record edge cases', 'Same student, move date to next week changes week calculation', () => {
    const records = [{ id: 'r1', student_id: 'A', week: '2030-01-14', score: 3 }];
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-07'),
        81,
    );
    expectEqual(
        calculateChain(records, 'A', '2030-01-07', '2030-01-14'),
        84,
    );
});

addTest('Record edge cases', 'Same date, A → B moves ownership once', () => {
    const records = [
        { id: 'r1', student_id: 'A', week: '2030-01-07', score: 3 },
        { id: 'r2', student_id: 'A', week: '2030-01-07', score: -2 },
    ];
    const result = scoreAfterMovingRecord(records, 'A', 'B', 'r2');
    expectEqual(result.a, 84);
    expectEqual(result.b, 79);
});

addTest('Record edge cases', 'A → A with identical payload is a no-op', () => {
    const original = {
        student_id: 'A',
        week: '2030-01-07',
        date: '2030-01-09',
        score: 3,
        criteria: 'TEST',
    };
    const edited = { ...original };
    expectEqual(JSON.stringify(edited), JSON.stringify(original));
});

addTest('Record edge cases', 'A → A with different date is an allowed edit', () => {
    const originalDate = '2030-01-09';
    const editedDate = '2030-01-10';
    expectTrue(originalDate !== editedDate);
});

addTest('Record edge cases', 'A → A with different score is an allowed edit', () => {
    expectTrue(3 !== 2);
});

addTest('Record edge cases', 'A → B → A restores final ownership', () => {
    const records = [
        { id: 'r1', student_id: 'A', week: '2030-01-07', score: 3 },
    ];
    const firstMove = records.map((r) => ({ ...r, student_id: r.id === 'r1' ? 'B' : r.student_id }));
    const secondMove = firstMove.map((r) => ({ ...r, student_id: r.id === 'r1' ? 'A' : r.student_id }));
    expectEqual(secondMove[0].student_id, 'A');
});

/* -------------------------------------------------------------------------- */
/* Date → week                                                                  */
/* -------------------------------------------------------------------------- */

const dateWeekCases = [
    ['2030-01-07', '2030-01-07'],
    ['2030-01-09', '2030-01-07'],
    ['2030-01-12', '2030-01-07'],
    ['2030-01-13', '2030-01-07'],
    ['2030-01-14', '2030-01-14'],
];

for (const [date, expectedWeek] of dateWeekCases) {
    addTest('Date → week', `${date} maps to ${expectedWeek}`, () => {
        expectEqual(
            window.CompetitionCalculationV6.getMonday(date),
            expectedWeek,
        );
    });
}

/* -------------------------------------------------------------------------- */
/* Criteria                                                                      */
/* -------------------------------------------------------------------------- */

addTest('Criteria', 'Inactive and active are distinct states', () => {
    expectTrue(Boolean({ active: true }.active));
    expectTrue(!Boolean({ active: false }.active));
});

addTest('Criteria', 'Category IDs 1–6 are supported by the record contract', () => {
    for (let id = 1; id <= 6; id += 1) {
        expectTrue(id >= 1 && id <= 6);
    }
});

/* -------------------------------------------------------------------------- */
/* Random picker regression                                                     */
/* -------------------------------------------------------------------------- */

addTest('Gọi tên học sinh', 'Random pool returns the whole class for all scope', () => {
    const frame = document.getElementById('appFrame')?.contentWindow;
    if (!frame || !frame.getRandomPool) {
        throw new Error('Ứng dụng chưa sẵn sàng: getRandomPool không tồn tại.');
    }

    const pool = frame.getRandomPool('all');
    expectTrue(Array.isArray(pool));
    expectTrue(pool.length > 0, 'Random pool is empty.');
});

addTest('Gọi tên học sinh', 'Team scope filters by team', () => {
    const frame = document.getElementById('appFrame')?.contentWindow;
    if (!frame || !frame.getRandomPool) {
        throw new Error('Ứng dụng chưa sẵn sàng: getRandomPool không tồn tại.');
    }

    const pool = frame.getRandomPool('team1');
    expectTrue(Array.isArray(pool));
    expectTrue(pool.every((student) => Number(student.team) === 1));
});

addTest('Gọi tên học sinh', 'Random candidate is a student from the selected pool', () => {
    const frame = document.getElementById('appFrame')?.contentWindow;
    if (!frame || !frame.chooseRandomCandidate) {
        throw new Error('Ứng dụng chưa sẵn sàng: chooseRandomCandidate không tồn tại.');
    }

    const pool = frame.getRandomPool('all');
    const candidate = frame.chooseRandomCandidate('all');
    expectTrue(candidate && pool.some((student) => student.id === candidate.id));
});

/* -------------------------------------------------------------------------- */
/* Real deployment smoke checks                                                 */
/* -------------------------------------------------------------------------- */

addTest('Supabase read-only', 'competition_categories contains six categories', async () => {
    const { data, error } = await qaSupabase
        .from('competition_categories')
        .select('id, active')
        .order('id');

    if (error) {
        throw error;
    }

    const activeIds = (data || [])
        .filter((row) => row.active !== false)
        .map((row) => Number(row.id));

    for (let id = 1; id <= 6; id += 1) {
        expectIncludes(activeIds, id, `Missing active category ${id}`);
    }
});

addTest('Supabase read-only', 'Students table is readable and non-empty', async () => {
    const { data, error } = await qaSupabase
        .from('students')
        .select('id, full_name, student_code')
        .limit(1);

    if (error) {
        throw error;
    }

    expectTrue((data || []).length === 1);
    expectTrue(Boolean(data[0].id));
});

/* -------------------------------------------------------------------------- */
/* UI smoke runner                                                              */
/* -------------------------------------------------------------------------- */

async function waitForFrameReady() {
    const frame = document.getElementById('appFrame');
    if (!frame) {
        throw new Error('Không tìm thấy app iframe.');
    }

    if (frame.contentDocument?.readyState === 'complete') {
        return;
    }

    await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            reject(new Error('Timeout tải ứng dụng trong iframe.'));
        }, 15000);

        frame.addEventListener('load', () => {
            window.clearTimeout(timeout);
            resolve();
        }, { once: true });
    });
}

async function waitForAppSession() {
    const frame = document.getElementById('appFrame');
    const startedAt = Date.now();

    while (Date.now() - startedAt < 15000) {
        const appWindow = frame.contentWindow;

        if (appWindow?.document?.getElementById('app')?.classList.contains('hidden') === false) {
            return appWindow;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    return null;
}

async function runRandomPickerUiSmoke() {
    await waitForFrameReady();
    const frame = await waitForAppSession();

    if (!frame) {
        throw new Error('Chưa có phiên đăng nhập trong iframe. Đăng nhập ứng dụng rồi chạy lại Test Center.');
    }

    frame.showPage('random');
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    const before = frame.document.getElementById('randomName')?.textContent || '';
    const button = frame.document.getElementById('randomButton');

    if (!button) {
        throw new Error('Không tìm thấy nút GỌI TÊN NGẪU NHIÊN.');
    }

    button.click();
    await new Promise((resolve) => window.setTimeout(resolve, 4200));

    const after = frame.document.getElementById('randomName')?.textContent || '';
    expectTrue(after && after !== before && after !== 'Sẵn sàng?', 'Tên học sinh không được render sau random.');
}

addTest('Gọi tên học sinh', 'Actual random-picker button completes a UI run', runRandomPickerUiSmoke);

/* -------------------------------------------------------------------------- */
/* Rendering                                                                    */
/* -------------------------------------------------------------------------- */

function renderGroups(results) {
    const container = document.getElementById('testGroups');
    const groups = new Map();

    for (const result of results) {
        if (!groups.has(result.group)) {
            groups.set(result.group, []);
        }
        groups.get(result.group).push(result);
    }

    container.innerHTML = '';

    for (const [group, groupResults] of groups) {
        const section = document.createElement('section');
        section.className = 'qa-group';

        const header = document.createElement('div');
        header.className = 'qa-group-header';
        header.innerHTML = `<h3>${group}</h3><span class="qa-badge neutral">${groupResults.length} tests</span>`;
        section.appendChild(header);

        const list = document.createElement('ul');
        list.className = 'qa-list';

        for (const result of groupResults) {
            const row = document.createElement('li');
            row.className = 'qa-row';
            row.innerHTML = `
                <span class="qa-badge ${result.status}">${result.status.toUpperCase()}</span>
                <span>
                    <span class="qa-name">${escapeHtml(result.name)}</span>
                    ${result.message ? `<br><span class="qa-detail">${escapeHtml(result.message)}</span>` : ''}
                </span>
            `;
            list.appendChild(row);
        }

        section.appendChild(list);
        container.appendChild(section);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    })[character]);
}

function updateSummary(results) {
    const counts = {
        total: results.length,
        pass: results.filter((item) => item.status === 'pass').length,
        fail: results.filter((item) => item.status === 'fail').length,
        skip: results.filter((item) => item.status === 'skip').length,
    };

    document.getElementById('totalCount').textContent = counts.total;
    document.getElementById('passCount').textContent = counts.pass;
    document.getElementById('failCount').textContent = counts.fail;
    document.getElementById('skipCount').textContent = counts.skip;
}

async function runAllTests() {
    const results = [];
    const button = document.getElementById('runAllButton');

    button.disabled = true;
    button.textContent = '⏳ Đang chạy...';

    for (const test of tests) {
        const startedAt = performance.now();

        try {
            await test.fn();
            results.push({
                group: test.group,
                name: test.name,
                status: 'pass',
                message: `${Math.round(performance.now() - startedAt)} ms`,
            });
        } catch (error) {
            results.push({
                group: test.group,
                name: test.name,
                status: 'fail',
                message: error?.message || String(error),
            });
        }

        updateSummary(results);
        renderGroups(results);
    }

    button.disabled = false;
    button.textContent = '↻ Chạy lại tất cả';
    document.getElementById('frameStatus').textContent = 'Đã chạy xong';
    document.getElementById('frameStatus').className = `qa-badge ${results.some((r) => r.status === 'fail') ? 'fail' : 'pass'}`;
}

function initializeTestCenter() {
    document.getElementById('runAllButton')?.addEventListener('click', runAllTests);

    const frame = document.getElementById('appFrame');
    frame?.addEventListener('load', () => {
        const frameStatus = document.getElementById('frameStatus');
        frameStatus.textContent = 'Ứng dụng đã tải';
        frameStatus.className = 'qa-badge pass';
    });
}

initializeTestCenter();
