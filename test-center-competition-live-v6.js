/*
 * FILE: test-center-competition-live-v6.js
 *
 * Mục đích:
 * Regression smoke test trên ứng dụng thật trong iframe.
 *
 * Kiểm tra lỗi GVCN vừa phát hiện:
 * - Record đã tồn tại trong Supabase.
 * - Điểm ở trang Học sinh/Hồ sơ có thể đã cập nhật.
 * - Nhưng Lịch sử Thi đua và Xếp hạng không được phép vẫn hiển thị dữ liệu cũ.
 *
 * Test này chỉ đọc dữ liệu và DOM, không INSERT/UPDATE/DELETE.
 */

addTest(
    'Thi đua live',
    'Ghi nhận mới phải đồng bộ Lịch sử + Xếp hạng',
    async () => {
        await waitForFrameReady();

        const frame = await waitForAppSession();

        if (!frame) {
            throw new Error(
                'Chưa có phiên đăng nhập trong iframe. Đăng nhập ứng dụng rồi chạy lại Test Center.',
            );
        }

        if (
            typeof frame.renderCompetition !== 'function' ||
            !frame.supabaseCache?.competitionRecords
        ) {
            throw new Error(
                'Thi đua chưa sẵn sàng: thiếu renderer hoặc competition cache.',
            );
        }

        frame.showPage('competition');
        await frame.renderCompetition();

        const week =
            frame.document.getElementById('compWeekFilter')?.value ||
            frame.getCurrentWeekStart?.();

        if (!week) {
            throw new Error('Không xác định được tuần Thi đua hiện tại.');
        }

        const records = frame.supabaseCache.competitionRecords || [];
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

        const rankingRows = [
            ...frame.document.querySelectorAll('#rankBody tr'),
        ];
        const rankingRow = rankingRows.find((row) => {
            const cells = [...row.children];
            return cells[1]?.textContent?.trim() === student.full_name;
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

        const scoreLabel =
            Number(latestRecord.score) > 0
                ? `+${Number(latestRecord.score)}`
                : String(Number(latestRecord.score));

        if (!historyText.includes(scoreLabel)) {
            throw new Error(
                `Lịch sử Thi đua không hiển thị đúng điểm ${scoreLabel}.`,
            );
        }
    },
);
