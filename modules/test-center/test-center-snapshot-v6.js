/*
 * FILE: test-center-snapshot-v6.js
 *
 * Test Center tests for the snapshot -> review -> edit -> recalculation flow.
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

    addTest('Snapshot & sửa điểm', 'Snapshot chỉ hiển thị record cộng/trừ thực tế và chỉ có nút Sửa', async () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();

        try {
            window.students = [{ id: 's1', full_name: 'HS Test' }];
            const rows = [
                {
                    id: 'r1', student_id: 's1', date: '2026-08-25', week: '2026-08-24',
                    criteria: 'QA cộng', points: 5, note: 'fixture', group_name: 'Học tập',
                },
                {
                    id: 'r2', student_id: 's1', date: '2026-08-26', week: '2026-08-24',
                    criteria: 'QA trừ', points: -2, note: 'fixture', group_name: 'Nề nếp',
                },
            ];

            if (!await api.show(rows, '2026-08-24')) {
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
            if (!body.textContent.includes('Sửa')) {
                throw new Error('Snapshot phải có nút Sửa.');
            }
            if (body.textContent.includes('Tạo task')) {
                throw new Error('Snapshot không còn nút tạo task sửa điểm.');
            }
        } finally {
            fixture.remove();
            delete window.students;
        }
    });

    addTest('Snapshot & sửa điểm', 'Snapshot viewer không tự ghi competition_records', async () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();

        try {
            await api.show([
                {
                    id: 'r1', student_id: 's1', date: '2026-08-25', week: '2026-08-24',
                    criteria: 'QA', points: 1,
                },
            ], '2026-08-24');

            if (typeof window.saveEditedCompetition === 'function') {
                throw new Error('Test Center không được yêu cầu gọi saveEditedCompetition từ snapshot.');
            }
        } finally {
            fixture.remove();
        }
    });

    addTest('Snapshot & sửa điểm', 'Correction task service không còn là dependency của Snapshot', () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        if (typeof api.createIssue === 'function' || typeof window.createCompetitionIssueFromSnapshotV6 === 'function') {
            throw new Error('Snapshot không được phụ thuộc vào correction task.');
        }
        if (typeof api.show !== 'function') {
            throw new Error('Snapshot API không còn show().');
        }
    });

    addTest('Snapshot & sửa điểm', 'Xem sau đóng modal nhưng không đánh dấu đã đối chiếu', async () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();
        const week = '2026-08-24';
        const key = `competition-snapshot-viewed:${week}`;
        localStorage.removeItem(key);

        try {
            await api.show([
                { id: 'r1', student_id: 's1', date: week, week, criteria: 'QA', points: 1 },
            ], week);

            if (typeof window.deferCompetitionSnapshotV6 !== 'function') {
                throw new Error('Thiếu hành động Xem sau.');
            }
            window.deferCompetitionSnapshotV6();

            if (!fixture.querySelector('#modal').classList.contains('hidden')) {
                throw new Error('Xem sau phải đóng snapshot.');
            }
            if (localStorage.getItem(key) === '1') {
                throw new Error('Xem sau không được đánh dấu đã đối chiếu.');
            }
        } finally {
            fixture.remove();
            localStorage.removeItem(key);
        }
    });

    addTest('Snapshot & sửa điểm', 'Đã đối chiếu đóng modal và không prompt lại cùng tuần', async () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const fixture = makeModalFixture();
        const week = '2026-08-24';
        const key = `competition-snapshot-viewed:${week}`;
        localStorage.removeItem(key);

        try {
            await api.show([
                { id: 'r1', student_id: 's1', date: week, week, criteria: 'QA', points: 1 },
            ], week);

            if (typeof window.confirmCompetitionSnapshotV6 !== 'function') {
                throw new Error('Thiếu hành động Đã đối chiếu – Đóng.');
            }
            window.confirmCompetitionSnapshotV6(week);

            if (!fixture.querySelector('#modal').classList.contains('hidden')) {
                throw new Error('Đã đối chiếu phải đóng snapshot.');
            }
            if (localStorage.getItem(key) !== '1') {
                throw new Error('Đã đối chiếu phải ghi nhận tuần đã xem.');
            }
        } finally {
            fixture.remove();
            localStorage.removeItem(key);
        }
    });

    addTest('Snapshot & sửa điểm', 'Snapshot phản ánh bản ghi đã sửa hoặc đã xóa', async () => {
        const api = requireApi('CompetitionSnapshotNotificationV6');
        const originalClient = window.SNCoreSupabase?.client;
        const fixture = makeModalFixture();

        try {
            const currentRecords = [
                {
                    id: 'r1', student_id: 's1', date: '2026-08-25', criteria: 'Đã sửa',
                    points: -1, note: 'sau sửa', category_id: 6,
                },
            ];
            window.SNCoreSupabase = {
                ...(window.SNCoreSupabase || {}),
                client: {
                    from(table) {
                        if (table !== 'competition_records') {
                            throw new Error(`Unexpected table: ${table}`);
                        }
                        return {
                            select() {
                                return {
                                    in() {
                                        return Promise.resolve({ data: currentRecords, error: null });
                                    },
                                };
                            },
                        };
                    },
                },
            };

            const rows = [
                {
                    id: 'r1', student_id: 's1', date: '2026-08-25', week: '2026-08-24',
                    criteria: 'Cũ', points: 1, note: 'trước sửa', category_id: 1,
                },
                {
                    id: 'r2', student_id: 's1', date: '2026-08-26', week: '2026-08-24',
                    criteria: 'Bản ghi bị xóa', points: -1, note: '', category_id: 1,
                },
            ];

            if (typeof api.showWithCurrentStatus !== 'function') {
                throw new Error('Thiếu API reflect trạng thái sau sửa/xóa.');
            }
            await api.showWithCurrentStatus(rows, '2026-08-24');

            const body = fixture.querySelector('#modalBody');
            if (!body.textContent.includes('Đã cập nhật')) {
                throw new Error('Bản ghi đã sửa phải hiện trạng thái Đã cập nhật.');
            }
            if (!body.textContent.includes('Đã xóa')) {
                throw new Error('Bản ghi đã xóa phải hiện trạng thái Đã xóa.');
            }
        } finally {
            fixture.remove();
            window.SNCoreSupabase = { ...(window.SNCoreSupabase || {}), client: originalClient };
        }
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
})();
