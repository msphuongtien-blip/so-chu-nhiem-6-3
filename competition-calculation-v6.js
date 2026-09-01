/**
 * FILE: competition-calculation-v6.js
 *
 * Mục đích:
 * Calculation engine thuần cho Thi đua – Xếp hạng V6.
 *
 * Trách nhiệm:
 * - Tính điểm tuần từ competition_records.
 * - Suy ra tuần đầu tiên từ history thay vì một ngày lịch cố định.
 * - Áp dụng rollover cho các tuần tiếp theo.
 *
 * Không chịu trách nhiệm:
 * - Đọc DOM.
 * - Gọi Supabase.
 * - Ghi điểm tổng vào database.
 */

const COMPETITION_CALCULATION_V6 = Object.freeze({
    BASE_SCORE: 81,
    MIN_SCORE: 0,
    MAX_SCORE: 100,
    VALID_SCORES: Object.freeze([
        -5,
        -4,
        -3,
        -2,
        -1,
        1,
        2,
        3,
        4,
        5,
    ]),
});

/**
 * Chuẩn hóa ngày về YYYY-MM-DD.
 *
 * @param {string|Date} value Ngày đầu vào.
 * @returns {string} Ngày chuẩn hóa hoặc chuỗi rỗng nếu không hợp lệ.
 */
function normalizeCompetitionCalculationDateV6(value) {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return String(value || '').slice(0, 10);
}

/**
 * Chuẩn hóa một ngày về thứ Hai đầu tuần.
 *
 * @param {string|Date} value Ngày bất kỳ trong tuần.
 * @returns {string} Ngày thứ Hai theo YYYY-MM-DD.
 */
function getMondayForCompetitionWeekV6(value) {
    const normalized = normalizeCompetitionCalculationDateV6(value);
    const date = new Date(`${normalized}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

/**
 * Tính điểm bắt đầu của tuần sau từ điểm kết thúc tuần hiện tại.
 *
 * @param {number} endScore Điểm cuối tuần.
 * @returns {number} Điểm bắt đầu tuần sau theo contract rollover.
 */
function getCompetitionRolloverStartV6(endScore) {
    const score = Number(endScore);

    if (score >= 91) {
        return 91;
    }

    if (score >= 81) {
        return 81;
    }

    if (score >= 66) {
        return 71;
    }

    if (score >= 50) {
        return 61;
    }

    return 51;
}

/**
 * Giới hạn điểm tuần trong 0–100.
 *
 * @param {number} score Điểm cần giới hạn.
 * @returns {number} Điểm hợp lệ trong khoảng 0–100.
 */
function clampCompetitionScoreV6(score) {
    const numericScore = Number(score);

    if (!Number.isFinite(numericScore)) {
        return COMPETITION_CALCULATION_V6.BASE_SCORE;
    }

    return Math.max(
        COMPETITION_CALCULATION_V6.MIN_SCORE,
        Math.min(
            COMPETITION_CALCULATION_V6.MAX_SCORE,
            numericScore,
        ),
    );
}

/**
 * Lấy tổng điểm cộng/trừ của một học sinh trong một tuần.
 *
 * @param {Array<object>} records Competition records.
 * @param {string} studentId Học sinh cần tính.
 * @param {string} weekStart Ngày thứ Hai của tuần.
 * @returns {number} Tổng thay đổi điểm trong tuần.
 */
function sumCompetitionWeekChangeV6(records, studentId, weekStart) {
    return records
        .filter((record) => {
            const recordWeek = getMondayForCompetitionWeekV6(
                record.week || record.week_start || record.date,
            );

            return (
                String(record.student_id) === String(studentId) &&
                recordWeek === weekStart
            );
        })
        .reduce((sum, record) => {
            return sum + Number(record.score ?? record.points ?? 0);
        }, 0);
}

/**
 * Lấy toàn bộ tuần có history của một học sinh.
 *
 * @param {Array<object>} records Competition records.
 * @param {string} studentId Học sinh cần tìm.
 * @returns {string[]} Danh sách tuần tăng dần.
 */
function getCompetitionHistoryWeeksV6(records, studentId) {
    return [
        ...new Set(
            records
                .filter((record) => {
                    return String(record.student_id) === String(studentId);
                })
                .map((record) => {
                    return getMondayForCompetitionWeekV6(
                        record.week || record.week_start || record.date,
                    );
                })
                .filter(Boolean),
        ),
    ].sort();
}

/**
 * Tương thích API cũ: mọi tuần hợp lệ đều thuộc calculation cycle.
 * Không còn khái niệm "official week" dựa trên một ngày cố định.
 *
 * @param {string|Date} week Tuần cần kiểm tra.
 * @returns {boolean} True khi tuần có thể chuẩn hóa.
 */
function isOfficialCompetitionWeekV6(week) {
    return Boolean(getMondayForCompetitionWeekV6(week));
}

/**
 * Tính điểm của một tuần từ toàn bộ history.
 *
 * Quy trình:
 * 1. Nếu chưa có history trước hoặc trong target week, điểm là 81.
 * 2. Tuần đầu tiên có history bắt đầu từ 81.
 * 3. Mỗi tuần sau cộng thay đổi của tuần đó rồi áp dụng rollover cho tuần kế.
 * 4. Tuần không có record vẫn được đi qua để giữ rollover.
 *
 * @param {Array<object>} records Competition records.
 * @param {string} studentId Học sinh cần tính.
 * @param {string|Date} targetWeek Tuần cần lấy điểm.
 * @returns {number} Điểm cuối của target week.
 */
function calculateCompetitionWeekScoreV6(
    records,
    studentId,
    targetWeek,
) {
    const normalizedTargetWeek = getMondayForCompetitionWeekV6(targetWeek);

    if (!normalizedTargetWeek) {
        return COMPETITION_CALCULATION_V6.BASE_SCORE;
    }

    const historyWeeks = getCompetitionHistoryWeeksV6(
        records,
        studentId,
    );

    const firstHistoryWeek = historyWeeks.find((week) => {
        return week <= normalizedTargetWeek;
    });

    // Không có history trong hoặc trước target week: vẫn dùng điểm nền.
    if (!firstHistoryWeek) {
        return COMPETITION_CALCULATION_V6.BASE_SCORE;
    }

    let startScore = COMPETITION_CALCULATION_V6.BASE_SCORE;
    let currentWeek = firstHistoryWeek;

    while (currentWeek <= normalizedTargetWeek) {
        const totalChange = sumCompetitionWeekChangeV6(
            records,
            studentId,
            currentWeek,
        );

        const endScore = clampCompetitionScoreV6(
            startScore + totalChange,
        );

        if (currentWeek === normalizedTargetWeek) {
            return endScore;
        }

        startScore = getCompetitionRolloverStartV6(endScore);
        currentWeek = addSevenDaysCompetitionV6(currentWeek);
    }

    return COMPETITION_CALCULATION_V6.BASE_SCORE;
}

/**
 * Cộng đúng 7 ngày theo UTC để tránh lệch ngày do timezone.
 *
 * @param {string} value Ngày YYYY-MM-DD.
 * @returns {string} Ngày sau 7 ngày.
 */
function addSevenDaysCompetitionV6(value) {
    const date = new Date(`${value}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + 7);

    return date.toISOString().slice(0, 10);
}

/**
 * Tóm tắt cộng/trừ và điểm cuối của một tuần.
 *
 * @param {Array<object>} records Competition records.
 * @param {string} studentId Học sinh cần tính.
 * @param {string|Date} week Tuần cần tóm tắt.
 * @returns {object} Tổng cộng, tổng trừ và điểm tuần.
 */
function summarizeCompetitionWeekV6(records, studentId, week) {
    const weekStart = getMondayForCompetitionWeekV6(week);
    const rows = records.filter((record) => {
        const recordWeek = getMondayForCompetitionWeekV6(
            record.week || record.week_start || record.date,
        );

        return (
            String(record.student_id) === String(studentId) &&
            recordWeek === weekStart
        );
    });

    const totalPlus = rows
        .filter((record) => Number(record.score ?? record.points) > 0)
        .reduce((sum, record) => {
            return sum + Number(record.score ?? record.points ?? 0);
        }, 0);

    const totalMinus = rows
        .filter((record) => Number(record.score ?? record.points) < 0)
        .reduce((sum, record) => {
            return sum + Number(record.score ?? record.points ?? 0);
        }, 0);

    const weeklyScore = calculateCompetitionWeekScoreV6(
        records,
        studentId,
        weekStart,
    );

    return {
        week: weekStart,
        totalPlus,
        totalMinus,
        totalChange: totalPlus + totalMinus,
        weeklyScore,
    };
}

/**
 * Public API dùng chung cho runtime V6 và Test Center.
 */
globalThis.CompetitionCalculationV6 = Object.freeze({
    CONFIG: COMPETITION_CALCULATION_V6,
    normalizeDate: normalizeCompetitionCalculationDateV6,
    getMonday: getMondayForCompetitionWeekV6,
    isOfficialWeek: isOfficialCompetitionWeekV6,
    clampScore: clampCompetitionScoreV6,
    rolloverStart: getCompetitionRolloverStartV6,
    sumWeekChange: sumCompetitionWeekChangeV6,
    getOfficialWeeks: getCompetitionHistoryWeeksV6,
    calculateWeekScore: calculateCompetitionWeekScoreV6,
    summarizeWeek: summarizeCompetitionWeekV6,
});
