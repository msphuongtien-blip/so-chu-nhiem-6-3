/**
 * FILE: competition-recalculation-v6.js
 *
 * Mục đích:
 * Tái tính chuỗi điểm thi đua từ tuần được sửa đến tuần cuối có dữ liệu.
 *
 * Nguồn sự thật vẫn là competition_records. Không ghi tổng điểm tuần vào
 * students hoặc snapshot; calculation engine tự suy ra rollover khi render.
 */

function getCompetitionRecalculationEngineV6() {
    return globalThis.CompetitionCalculationV6 || null;
}

function normalizeCompetitionRecalculationWeekV6(value) {
    const engine = getCompetitionRecalculationEngineV6();

    if (!engine?.getMonday) {
        throw new Error('Calculation engine V6 chưa sẵn sàng.');
    }

    const week = engine.getMonday(value);

    if (!week) {
        throw new Error('Tuần cần tính lại không hợp lệ.');
    }

    return week;
}

function getCompetitionRecalculationWeeksV6(
    records,
    studentsList,
    startWeek,
) {
    const engine = getCompetitionRecalculationEngineV6();
    const normalizedStartWeek = normalizeCompetitionRecalculationWeekV6(
        startWeek,
    );
    const weeks = new Set();

    (records || []).forEach((record) => {
        const week = engine.getMonday(
            record.week || record.week_start || record.date,
        );

        if (week && week >= normalizedStartWeek) {
            weeks.add(week);
        }
    });

    const sortedWeeks = [...weeks].sort();

    if (!sortedWeeks.length) {
        return [normalizedStartWeek];
    }

    return sortedWeeks;
}

function calculateCompetitionRecalculationV6(
    records,
    studentsList,
    startWeek,
) {
    const engine = getCompetitionRecalculationEngineV6();
    const weeks = getCompetitionRecalculationWeeksV6(
        records,
        studentsList,
        startWeek,
    );
    const students = Array.isArray(studentsList) ? studentsList : [];
    const calculations = [];

    weeks.forEach((week) => {
        students.forEach((student) => {
            calculations.push({
                week,
                studentId: student.id,
                weeklyScore: engine.calculateWeekScore(
                    records,
                    student.id,
                    week,
                ),
            });
        });
    });

    return {
        startWeek: normalizeCompetitionRecalculationWeekV6(startWeek),
        weeks,
        calculations,
    };
}

async function recalculateCompetitionFromWeekV6(startWeek) {
    const normalizedStartWeek = normalizeCompetitionRecalculationWeekV6(
        startWeek,
    );
    let records = globalThis.supabaseCache?.competitionRecords || [];
    let studentsList =
        Array.isArray(globalThis.students) ? globalThis.students : [];

    if (typeof window.loadCompetitionHistoryFromSupabase === 'function') {
        records = await window.loadCompetitionHistoryFromSupabase();
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        studentsList = await window.loadStudentsFromSupabase();
    }

    const result = calculateCompetitionRecalculationV6(
        records || [],
        studentsList || [],
        normalizedStartWeek,
    );

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    return {
        ok: true,
        ...result,
    };
}

function getEditedCompetitionWeekBeforeSaveV6() {
    const dateInput = document.getElementById('eDate');

    if (!dateInput?.value) {
        return '';
    }

    const editDateApi = globalThis.CompetitionRecordEditDateV6;

    if (editDateApi?.getWeekFromDate) {
        return editDateApi.getWeekFromDate(dateInput.value);
    }

    return normalizeCompetitionRecalculationWeekV6(dateInput.value);
}

function installCompetitionEditRecalculationV6() {
    const originalSave = globalThis.saveEditedCompetition;

    if (
        globalThis.__competitionEditRecalculationV6Installed ||
        typeof originalSave !== 'function'
    ) {
        return false;
    }

    globalThis.saveEditedCompetition = async function saveEditedCompetitionWithRecalculationV6(...args) {
        const startWeek = getEditedCompetitionWeekBeforeSaveV6();
        const result = await originalSave(...args);

        if (result === false || !startWeek) {
            return result;
        }

        try {
            await recalculateCompetitionFromWeekV6(startWeek);
        } catch (error) {
            console.error(
                '[Competition V6] Historical recalculation failed:',
                error,
            );
            alert(
                'Bản ghi đã được lưu nhưng hệ thống chưa tái tính được toàn bộ chuỗi tuần. Vui lòng cập nhật lại trang.',
            );
        }

        return result;
    };

    globalThis.__competitionEditRecalculationV6Installed = true;
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionEditRecalculationV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionRecalculationV6 = Object.freeze({
    normalizeWeek: normalizeCompetitionRecalculationWeekV6,
    getWeeks: getCompetitionRecalculationWeeksV6,
    calculate: calculateCompetitionRecalculationV6,
    recalculateFromWeek: recalculateCompetitionFromWeekV6,
    getEditedWeekBeforeSave: getEditedCompetitionWeekBeforeSaveV6,
    installEditHook: installCompetitionEditRecalculationV6,
});
