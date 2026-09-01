/*
 * FILE: test-center-snapshot-v6.js
 *
 * Test Center tests for the newly added snapshot -> correction -> recalculation flow.
 * All tests here are fixture-only and never write production data.
 */

(function registerSnapshotCorrectionTestsV6() {
    function requireApi(name) {
        const api = window[name];
        if (!api) {
            throw new Error(`${name} chưa được load.`);
        }
        return api;
    }

    function makeModalFixture() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div id="modal" class="hidden">
                <h2 id="modalTitle"></h2>
                <div id="modalBody"></div>
            </div>
        `;
        document.body.appendChild(wrapper);
        return wrapper;
    }

    addTest('Snapshot & sửa điểm', 'Snapshot API được load', () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        if (typeof api.load !== 'function' || typeof api.show !== 'function') {
            throw new Error('Snapshot API thiếu load/show.');
        }
    });

    addTest('Snapshot & sửa điểm', 'Snapshot chỉ hiển thị record cộng/trừ thực tế', () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();

        try {
            window.students = [{ id: 's1', full_name: 'HS Test' }];
            const rows = [
                {
                    id: 'r1',
                    student_id: 's1',
                    date: '2026-08-25',
                    week: '2026-08-24',
                    criteria: 'QA cộng',
                    points: 5,
                    note: 'fixture',
                    group_name: 'Học tập',
                },
                {
                    id: 'r2',
                    student_id: 's1',
                    date: '2026-08-26',
                    week: '2026-08-24',
                    criteria: 'QA trừ',
                    points: -2,
                    note: 'fixture',
                    group_name: 'Nề nếp',
                },
            ];

            if (!api.show(rows, '2026-08-24')) {
                throw new Error('Không render được snapshot fixture.');
            }

            const body = fixture.querySelector('#modalBody');
            const renderedRows = body.querySelectorAll('tbody tr');

            if (renderedRows.length !== 2) {
                throw new Error(`Expected 2 record rows, got ${renderedRows.length}.`);
            }
            if (!body.textContent.includes('+5') || !body.textContent.includes('-2')) {
                throw new Error('Snapshot không hiển thị đúng điểm +/- của fixture.');
            }
            if (body.textContent.includes('Điểm tuần') || body.textContent.includes('Hạng')) {
                throw new Error('Snapshot không được biến thành bảng ranking.');
            }
            if (!body.textContent.includes('Tạo task sửa điểm')) {
                throw new Error('Snapshot thiếu nút tạo task sửa điểm.');
            }
        } finally {
            fixture.remove();
            delete window.students;
        }
    });

    addTest('Snapshot & sửa điểm', 'Snapshot viewer không tự ghi competition_records', () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();

        try {
            api.show([
                {
                    id: 'r1',
                    student_id: 's1',
                    date: '2026-08-25',
                    week: '2026-08-24',
                    criteria: 'QA',
                    points: 1,
                },
            ], '2026-08-24');

            if (typeof window.saveEditedCompetition === 'function') {
                throw new Error('Test Center không được yêu cầu gọi saveEditedCompetition từ snapshot.');
            }
        } finally {
            fixture.remove();
        }
    });

    addTest('Snapshot & sửa điểm', 'Correction task service có đủ create/list/resolve', () => {
        const service = requireApi('CompetitionIssuesServiceV6');
        ['createIssue', 'listOpenIssues', 'resolveIssue'].forEach((method) => {
            if (typeof service[method] !== 'function') {
                throw new Error(`Thiếu ${method}().`);
            }
        });
    });

    addTest('Snapshot & sửa điểm', 'Historical correction recalculates toàn bộ chuỗi tuần sau', () => {
        const recalculation = requireApi('CompetitionRecalculationV6');
        const student = { id: 's1' };
        const before = [
            { student_id: 's1', week: '2030-01-07', score: 5 },
            { student_id: 's1', week: '2030-01-14', score: 5 },
            { student_id: 's1', week: '2030-01-21', score: -5 },
        ];
        const after = [
            { student_id: 's1', week: '2030-01-07', score: -5 },
            { student_id: 's1', week: '2030-01-14', score: 5 },
            { student_id: 's1', week: '2030-01-21', score: -5 },
        ];

        const beforeResult = recalculation.calculate(before, [student], '2030-01-07');
        const afterResult = recalculation.calculate(after, [student], '2030-01-07');
        const beforeScores = Array.from(beforeResult.calculations, (item) => item.weeklyScore);
        const afterScores = Array.from(afterResult.calculations, (item) => item.weeklyScore);

        if (JSON.stringify(beforeScores) !== JSON.stringify([86, 86, 76])) {
            throw new Error(`Chuỗi trước sửa sai: ${JSON.stringify(beforeScores)}.`);
        }
        if (JSON.stringify(afterScores) !== JSON.stringify([76, 76, 66])) {
            throw new Error(`Chuỗi sau sửa sai: ${JSON.stringify(afterScores)}.`);
        }
    });

    addTest('Snapshot & sửa điểm', 'Xem sau không đánh dấu snapshot đã xem', () => {
        const source = window.CompetitionSnapshotNotificationV6;
        const week = source.previousWeek();
        const key = `competition-snapshot-viewed:${week}`;
        localStorage.removeItem(key);

        if (typeof window.hideCompetitionSnapshotNoticeV6 !== 'undefined') {
            throw new Error('hide handler không nên là API công khai cần gọi từ Test Center.');
        }

        if (localStorage.getItem(key) === '1') {
            throw new Error('Snapshot đã bị đánh dấu viewed trước khi mở.');
        }
    });
})();
