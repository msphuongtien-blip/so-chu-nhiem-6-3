/*
 * FILE: test-center-competition-live-v6.js
 *
 * Mục đích:
 * Regression smoke test trên ứng dụng thật trong iframe.
 *
 * Kiểm tra chuỗi:
 * Supabase → Calculation → Lịch sử → Xếp hạng → reload.
 * Đồng thời kiểm tra các invariant UX của form Ghi nhận.
 *
 * Test này chỉ đọc dữ liệu và DOM, không INSERT/UPDATE/DELETE.
 */

async function getLiveAppFrameV6() {
    await waitForFrameReady();
    const frame = await waitForAppSession();

    if (!frame) {
        throw new Error(
            'Chưa có phiên đăng nhập trong iframe. Đăng nhập ứng dụng rồi chạy lại Test Center.',
        );
    }

    return frame;
}

addTest(
    'Thi đua live',
    'Ghi nhận mới đồng bộ Lịch sử + Xếp hạng',
    async () => {
        const frame = await getLiveAppFrameV6();
        frame.showPage('competition');
        await frame.renderCompetition();

        const week =
            frame.document.getElementById('compWeekFilter')?.value ||
            frame.getCurrentWeekStart?.();

        if (!week) {
            throw new Error('Không xác định được tuần Thi đua hiện tại.');
        }

        const records = frame.supabaseCache?.competitionRecords || [];
        const rankingRows = [
            ...frame.document.querySelectorAll('#rankBody tr'),
        ];

        if (rankingRows.length !== 44) {
            throw new Error(
                `Ranking phải luôn hiển thị đủ 44 học sinh, hiện có ${rankingRows.length}.`,
            );
        }

        if (!records.length) {
            const nonBaselineRows = rankingRows.filter((row) => {
                return Number(row.children[2]?.textContent?.trim()) !== 81;
            });

            if (nonBaselineRows.length) {
                throw new Error(
                    `Không có history nhưng ranking vẫn có ${nonBaselineRows.length} học sinh khác 81 điểm.`,
                );
            }

            const historyText =
                frame.document.getElementById('competitionRecent')?.textContent || '';

            if (historyText.trim()) {
                throw new Error(
                    'Không có history nhưng khu vực Lịch sử vẫn hiển thị dữ liệu.',
                );
            }

            return;
        }

        const weekRecords = records.filter((record) => {
            const recordWeek =
                frame.CompetitionCalculationV6?.getMonday?.(
                    record.week || record.week_start || record.date,
                );

            return recordWeek === week;
        });

        if (!weekRecords.length) {
            throw new Error(
                `Không có competition record trong tuần ${week} để kiểm tra đồng bộ live.`,
            );
        }

        const latestRecord = [...weekRecords].sort((a, b) =>
            String(b.created_at || '').localeCompare(String(a.created_at || '')),
        )[0];

        const student = (frame.students || []).find(
            (item) => String(item.id) === String(latestRecord.student_id),
        );

        if (!student) {
            throw new Error('Không tìm thấy học sinh của record mới nhất.');
        }

        const expectedWeeklyScore =
            frame.CompetitionCalculationV6.calculateWeekScore(
                records,
                student.id,
                week,
            );

        const rankingRow = rankingRows.find((row) => {
            return row.children[1]?.textContent?.trim() === student.full_name;
        });

        if (!rankingRow) {
            throw new Error(
                `Học sinh ${student.full_name} không xuất hiện trong bảng xếp hạng.`,
            );
        }

        const displayedWeeklyScore = Number(
            rankingRow.children[2]?.textContent?.trim(),
        );

        if (displayedWeeklyScore !== expectedWeeklyScore) {
            throw new Error(
                `Xếp hạng chưa đồng bộ: expected ${expectedWeeklyScore}, got ${displayedWeeklyScore}.`,
            );
        }

        const historyText =
            frame.document.getElementById('competitionRecent')?.textContent || '';

        if (!historyText.includes(student.full_name)) {
            throw new Error(
                `Lịch sử Thi đua không hiển thị record của ${student.full_name}.`,
            );
        }

        if (!historyText.includes(String(latestRecord.criteria || ''))) {
            throw new Error(
                'Lịch sử Thi đua không hiển thị đúng tiêu chí của record mới nhất.',
            );
        }
    },
);

addTest(
    'Thi đua live',
    'Không còn Điểm tháng, Nhóm hoặc Xu hướng trong ranking',
    async () => {
        const frame = await getLiveAppFrameV6();
        frame.showPage('competition');
        await frame.renderCompetition();

        const table = frame.document
            .getElementById('rankBody')
            ?.closest('table');

        if (!table) {
            throw new Error('Không tìm thấy bảng xếp hạng.');
        }

        const headerText = table
            .querySelector('thead')
            ?.textContent || '';

        for (const forbidden of ['Điểm tháng', 'Nhóm', 'Xu hướng']) {
            if (headerText.includes(forbidden)) {
                throw new Error(`Ranking vẫn hiển thị ${forbidden}.`);
            }
        }
    },
);

addTest(
    'Thi đua live',
    'Ghi nhận không cho chọn Ngày hoặc Tuần thủ công',
    async () => {
        const frame = await getLiveAppFrameV6();
        await frame.openCompetitionForm();

        const dateInput = frame.document.getElementById('fDateV6');
        const weekInput = frame.document.getElementById('fWeekV6');

        if (dateInput || weekInput) {
            frame.closeModal?.();
            throw new Error(
                'Form Ghi nhận vẫn để người dùng chọn Ngày hoặc Tuần thủ công.',
            );
        }

        frame.closeModal?.();
    },
);

addTest(
    'Thi đua live',
    'Mọi competition record đều có tuần khớp với ngày',
    async () => {
        const frame = await getLiveAppFrameV6();
        const records = frame.supabaseCache?.competitionRecords || [];
        const engine = frame.CompetitionCalculationV6;

        const mismatches = records.filter((record) => {
            if (!record.date || !record.week) {
                return true;
            }

            return engine.getMonday(record.date) !== engine.getMonday(record.week);
        });

        if (mismatches.length) {
            throw new Error(
                `Có ${mismatches.length} record có Ngày và Tuần không đồng nhất.`,
            );
        }
    },
);

addTest(
    'Thi đua live',
    'Reload vẫn giữ cùng điểm tuần và lịch sử',
    async () => {
        const frame = await getLiveAppFrameV6();
        frame.showPage('competition');
        await frame.renderCompetition();

        const before = {
            ranking: frame.document
                .getElementById('rankBody')
                ?.innerText || '',
            history: frame.document
                .getElementById('competitionRecent')
                ?.innerText || '',
        };

        await frame.loadCompetitionHistoryFromSupabase();
        await frame.loadStudentsFromSupabase();
        await frame.renderCompetition();

        const after = {
            ranking: frame.document
                .getElementById('rankBody')
                ?.innerText || '',
            history: frame.document
                .getElementById('competitionRecent')
                ?.innerText || '',
        };

        if (before.ranking !== after.ranking) {
            throw new Error('Ranking thay đổi sau khi đọc lại từ Supabase.');
        }

        if (before.history !== after.history) {
            throw new Error('Lịch sử thay đổi sau khi đọc lại từ Supabase.');
        }
    },
);
