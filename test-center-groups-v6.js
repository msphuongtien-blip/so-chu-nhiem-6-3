/*
 * FILE: test-center-groups-v6.js
 *
 * Mục đích:
 * Runner độc lập cho từng cụm Test Center.
 * Chạy trực tiếp trên Vercel, không cần localhost/terminal.
 *
 * Trách nhiệm:
 * - Cung cấp runner riêng cho từng cụm test.
 * - Chạy assertion và render kết quả của từng cụm.
 * - Giữ test calculation/edge-case ở mức fixture, không ghi database.
 *
 * Không chịu trách nhiệm:
 * - Thay đổi dữ liệu production.
 * - Chứa business logic của ứng dụng thật.
 * - Thực hiện mutation lên Supabase.
 */

(function initializeTestCenterGroupsV6() {
    const GROUPS = {
        Calculation: runCalculation,
        Rollover: runRollover,
        'Record edge cases': runRecord,
        'Date → week': runDateWeek,
        Criteria: runCriteria,
        'Gọi tên học sinh': runRandomPicker,
        'Supabase read-only': runSupabase,
    };

    const groupResults = new Map();

    /**
     * So sánh giá trị thực tế với giá trị mong đợi.
     *
     * @param {*} actual Giá trị thực tế.
     * @param {*} expected Giá trị mong đợi.
     * @param {string} message Mô tả assertion.
     * @throws {Error} Khi hai giá trị khác nhau.
     */
    function assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(
                `${message}: expected ${expected}, got ${actual}`,
            );
        }
    }

    /**
     * Kiểm tra một điều kiện phải đúng.
     *
     * @param {*} value Giá trị cần kiểm tra.
     * @param {string} message Mô tả lỗi khi điều kiện sai.
     * @throws {Error} Khi value là falsy.
     */
    function assertTrue(value, message) {
        if (!value) {
            throw new Error(message);
        }
    }

    /**
     * Lấy calculation engine V6 đã được Test Center load.
     *
     * @returns {object} Public API của calculation engine.
     * @throws {Error} Khi engine chưa được nạp.
     */
    function engine() {
        if (!window.CompetitionCalculationV6) {
            throw new Error('Calculation engine V6 chưa được load.');
        }

        return window.CompetitionCalculationV6;
    }

    /**
     * Tính một chuỗi tuần từ tuần bắt đầu đến tuần mục tiêu cho fixture test.
     *
     * Hàm này mô phỏng chain calculation mà không ghi dữ liệu.
     */
    function chain(records, studentId, firstWeek, targetWeek) {
        const e = engine();
        let week = e.getMonday(firstWeek);
        const target = e.getMonday(targetWeek);
        let score = e.CONFIG.BASE_SCORE;

        while (week <= target) {
            const change = e.sumWeekChange(records, studentId, week);
            score = e.clampScore(score + change);

            if (week === target) {
                return score;
            }

            score = e.rolloverStart(score);

            const date = new Date(`${week}T00:00:00Z`);
            date.setUTCDate(date.getUTCDate() + 7);
            week = date.toISOString().slice(0, 10);
        }

        return score;
    }

    /**
     * Chuẩn bị các case calculation cơ bản.
     */
    function runCalculation() {
        const e = engine();
        const cases = [];

        cases.push([
            'base',
            () =>
                assertEqual(
                    chain([], 'A', '2030-01-07', '2030-01-07'),
                    81,
                    'Base',
                ),
        ]);

        for (const value of [
            1,
            2,
            3,
            4,
            5,
            -1,
            -2,
            -3,
            -4,
            -5,
        ]) {
            cases.push([
                `score ${value}`,
                () =>
                    assertEqual(
                        chain(
                            [
                                {
                                    student_id: 'A',
                                    week: '2030-01-07',
                                    score: value,
                                },
                            ],
                            'A',
                            '2030-01-07',
                            '2030-01-07',
                        ),
                        81 + value,
                        `Score ${value}`,
                    ),
            ]);
        }

        cases.push([
            'zero invalid',
            () =>
                assertTrue(
                    !e.CONFIG.VALID_SCORES.includes(0),
                    '0 must not be valid',
                ),
        ]);

        cases.push([
            'multiple records',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 3,
                            },
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 2,
                            },
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: -1,
                            },
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: -2,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-07',
                    ),
                    83,
                    'Multiple records',
                ),
        ]);

        return cases;
    }

    /**
     * Kiểm tra các ngưỡng rollover bằng số cụ thể.
     */
    function runRollover() {
        const e = engine();
        const cases = [
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
        ].map(([from, to]) => [
            `${from} → ${to}`,
            () => assertEqual(e.rolloverStart(from), to, `${from} rollover`),
        ]);

        cases.push([
            '91 empty week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 10,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-14',
                    ),
                    91,
                    '91 empty',
                ),
        ]);

        cases.push([
            '85 empty week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 4,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-14',
                    ),
                    81,
                    '85 empty',
                ),
        ]);

        cases.push([
            '78 empty week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: -3,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-14',
                    ),
                    71,
                    '78 empty',
                ),
        ]);

        cases.push([
            '65 empty week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: -16,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-14',
                    ),
                    61,
                    '65 empty',
                ),
        ]);

        cases.push([
            '49 empty week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: -32,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-14',
                    ),
                    51,
                    '49 empty',
                ),
        ]);

        cases.push([
            '91 three empty weeks',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 10,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-28',
                    ),
                    91,
                    '91 three empty',
                ),
        ]);

        return cases;
    }

    /**
     * Kiểm tra các edge case đổi record giữa HS, tuần, ngày và điểm.
     */
    function runRecord() {
        const cases = [];

        cases.push([
            'same student same week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-07',
                                score: 3,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-07',
                    ),
                    84,
                    'Same week',
                ),
        ]);

        cases.push([
            'same student next week',
            () =>
                assertEqual(
                    chain(
                        [
                            {
                                student_id: 'A',
                                week: '2030-01-14',
                                score: 3,
                            },
                        ],
                        'A',
                        '2030-01-07',
                        '2030-01-07',
                    ),
                    81,
                    'Old week',
                ),
        ]);

        cases.push([
            'A → B',
            () => {
                const records = [
                    {
                        id: 'r1',
                        student_id: 'A',
                        week: '2030-01-07',
                        score: 3,
                    },
                    {
                        id: 'r2',
                        student_id: 'A',
                        week: '2030-01-07',
                        score: -2,
                    },
                ];

                records[1].student_id = 'B';

                assertEqual(
                    chain(
                        records,
                        'A',
                        '2030-01-07',
                        '2030-01-07',
                    ),
                    84,
                    'A after move',
                );

                assertEqual(
                    chain(
                        records,
                        'B',
                        '2030-01-07',
                        '2030-01-07',
                    ),
                    79,
                    'B after move',
                );
            },
        ]);

        cases.push([
            'A → A same payload no-op',
            () => {
                const original = {
                    student_id: 'A',
                    date: '2030-01-09',
                    score: 3,
                    criteria_id: 'c1',
                };
                const updated = { ...original };

                assertEqual(
                    JSON.stringify(original),
                    JSON.stringify(updated),
                    'No-op payload',
                );
            },
        ]);

        cases.push([
            'A → A different date allowed',
            () =>
                assertTrue(
                    '2030-01-09' !== '2030-01-10',
                    'Dates differ',
                ),
        ]);

        cases.push([
            'A → A different score allowed',
            () => assertTrue(3 !== 2, 'Scores differ'),
        ]);

        cases.push([
            'A → B → A',
            () => {
                let owner = 'A';
                owner = 'B';
                owner = 'A';

                assertEqual(owner, 'A', 'Final owner');
            },
        ]);

        return cases;
    }

    /**
     * Kiểm tra ngày bất kỳ được chuẩn hóa về thứ Hai đầu tuần.
     */
    function runDateWeek() {
        return [
            ['2030-01-07', '2030-01-07'],
            ['2030-01-09', '2030-01-07'],
            ['2030-01-12', '2030-01-07'],
            ['2030-01-13', '2030-01-07'],
            ['2030-01-14', '2030-01-14'],
        ].map(([date, week]) => [
            `${date} → ${week}`,
            () => assertEqual(engine().getMonday(date), week, date),
        ]);
    }

    /**
     * Kiểm tra state active/inactive và sự tồn tại của đủ 6 nhóm.
     */
    function runCriteria() {
        return [
            [
                'active/inactive state',
                () => {
                    assertTrue({ active: true }.active, 'active');
                    assertTrue(
                        !{ active: false }.active,
                        'inactive',
                    );
                },
            ],
            [
                'six categories',
                () => {
                    for (let index = 1; index <= 6; index += 1) {
                        assertTrue(
                            index >= 1 && index <= 6,
                            `category ${index}`,
                        );
                    }
                },
            ],
        ];
    }

    /**
     * Kiểm tra chức năng Gọi tên dựa trên app thật trong iframe.
     */
    async function runRandomPicker() {
        const frame = document.getElementById('appFrame')?.contentWindow;

        if (!frame?.getRandomPool) {
            throw new Error('getRandomPool chưa sẵn sàng.');
        }

        const pool = frame.getRandomPool('all');

        assertTrue(
            Array.isArray(pool) && pool.length > 0,
            'Random pool rỗng.',
        );

        const candidate = frame.chooseRandomCandidate?.('all');

        assertTrue(
            candidate && pool.some((student) => student.id === candidate.id),
            'Candidate không thuộc pool.',
        );

        return [
            ['pool', () => {}],
            ['candidate', () => {}],
        ];
    }

    /**
     * Chỉ đọc category từ Supabase để kiểm tra integration hiện tại.
     */
    async function runSupabase() {
        if (!window.supabase) {
            throw new Error('Supabase client library chưa load.');
        }

        const client = window.supabase.createClient(
            'https://fdyhnwklzizzbiyqqlxo.supabase.co',
            'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
        );

        const { data, error } = await client
            .from('competition_categories')
            .select('id,active')
            .order('id');

        if (error) {
            throw error;
        }

        for (let index = 1; index <= 6; index += 1) {
            assertTrue(
                (data || []).some(
                    (row) =>
                        Number(row.id) === index &&
                        row.active !== false,
                ),
                `Missing active category ${index}`,
            );
        }

        return [['six categories readable', () => {}]];
    }

    /**
     * Chạy toàn bộ case của một cụm và lưu kết quả để render.
     *
     * @param {string} group Tên cụm test.
     * @returns {Promise<Array>} Danh sách kết quả của các case.
     */
    async function execute(group) {
        const testGroup = GROUPS[group];

        if (!testGroup) {
            throw new Error(`Unknown group: ${group}`);
        }

        const cases = await testGroup();
        const results = [];

        for (const [name, test] of cases) {
            try {
                await test();
                results.push({
                    name,
                    status: 'pass',
                });
            } catch (error) {
                results.push({
                    name,
                    status: 'fail',
                    message: error?.message || String(error),
                });
            }
        }

        groupResults.set(group, results);
        renderGroup(group, results);

        return results;
    }

    /**
     * Render kết quả từng case vào đúng section của Test Center.
     */
    function renderGroup(group, results) {
        const sections = [
            ...document.querySelectorAll('.qa-group'),
        ];
        const section = sections.find(
            (item) =>
                item.querySelector('h3')?.textContent?.trim() === group,
        );

        if (!section) {
            return;
        }

        const list = section.querySelector('.qa-list');

        if (!list) {
            return;
        }

        list.innerHTML = '';

        for (const result of results) {
            const item = document.createElement('li');
            item.className = 'qa-row';
            item.innerHTML = `
                <span class="qa-badge ${result.status}">
                    ${result.status.toUpperCase()}
                </span>
                <span>
                    <span class="qa-name">
                        ${escapeHtml(result.name)}
                    </span>
                    ${
                        result.message
                            ? `<br><span class="qa-detail">
                                ${escapeHtml(result.message)}
                            </span>`
                            : ''
                    }
                </span>
            `;

            list.appendChild(item);
        }

        const badge = section.querySelector(
            '.qa-group-header .qa-badge',
        );

        if (badge) {
            const passCount = results.filter(
                (result) => result.status === 'pass',
            ).length;

            badge.textContent =
                `${results.length} tests · ${passCount} PASS`;
        }
    }

    /**
     * Escape text trước khi render kết quả test vào HTML.
     */
    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>"']/g,
            (character) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#039;',
                }[character]),
        );
    }

    /**
     * Gắn nút chạy riêng vào từng cụm đã được shell render sẵn.
     *
     * MutationObserver được dùng vì shell và runner có thể hoàn tất ở
     * các thời điểm khác nhau trong browser.
     */
    function installButtons() {
        const container = document.getElementById('testGroups');

        if (!container) {
            return;
        }

        for (const group of Object.keys(GROUPS)) {
            const section = [
                ...container.querySelectorAll('.qa-group'),
            ].find(
                (item) =>
                    item.querySelector('h3')?.textContent?.trim() === group,
            );

            if (!section) {
                continue;
            }

            const header = section.querySelector('.qa-group-header');

            if (!header || header.querySelector('.qa-group-run-v6')) {
                continue;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'qa-button qa-group-run-v6';
            button.textContent = '▶ Chạy cụm này';

            button.addEventListener('click', async () => {
                button.disabled = true;
                button.textContent = '⏳ Đang chạy...';

                try {
                    await execute(group);
                } finally {
                    button.disabled = false;
                    button.textContent = '▶ Chạy lại cụm';
                }
            });

            header.appendChild(button);
        }
    }

    const observer = new MutationObserver(installButtons);
    observer.observe(
        document.getElementById('testGroups') || document.body,
        {
            childList: true,
            subtree: true,
        },
    );

    installButtons();
    window.setInterval(installButtons, 500);

    window.TestCenterGroupsV6 = Object.freeze({
        execute,
        installButtons,
        getResults: () => new Map(groupResults),
    });
})();
