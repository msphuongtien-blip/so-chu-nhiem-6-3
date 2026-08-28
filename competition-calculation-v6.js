/**
 * FILE: competition-calculation-v6.js
 *
 * Mục đích:
 * Cung cấp calculation engine thuần cho module Thi đua – Xếp hạng.
 *
 * Quy tắc chính thức:
 * - Điểm nền của Week 1 là 81.
 * - Week 1 chính thức của năm học 2026-2027 bắt đầu ngày 07/09/2026.
 * - Record trước 07/09/2026 là test data và không tham gia phép tính
 *   chính thức sau mốc này.
 * - Rollover chỉ bắt đầu từ tuần sau Week 1.
 * - Điểm mỗi record chỉ được là -5…-1 hoặc +1…+5.
 * - Điểm tuần bị giới hạn trong khoảng 0…100.
 *
 * Thiết kế:
 * - Các hàm tính toán là pure function để dễ kiểm thử.
 * - Không đọc DOM.
 * - Không gọi Supabase.
 * - Không tự ghi điểm tổng vào database.
 */

const COMPETITION_CALCULATION_V6 = Object.freeze({
    OFFICIAL_FIRST_WEEK: '2026-09-07',
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
 * Chuẩn hóa ngày theo dạng YYYY-MM-DD.
 *
 * @param {string|Date} value Ngày đầu vào.
 * @returns {string} Ngày chuẩn hóa.
 */
function normalizeCompetitionCalculationDateV6(value) {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return String(value || '').slice(0, 10);
}

/**
 * Kiểm tra một ngày có nằm trong giai đoạn chính thức hay chưa.
 */
function isOfficialCompetitionWeekV6(week) {
    return (
        normalizeCompetitionCalculationDateV6(week) >=
        COMPETITION_CALCULATION_V6.OFFICIAL_FIRST_WEEK
    );
}

/**
 * Chuẩn hóa về đầu tuần theo quy ước Monday của hệ thống.
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
 * Tính điểm bắt đầu của tuần kế tiếp từ điểm kết thúc tuần hiện tại.
 *
 * Các ngưỡng này được giữ đúng theo rule rollover hiện tại của hệ thống.
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
 * Giới hạn điểm trong khoảng 0…100.
 */
function clampCompetitionScoreV6(score) {
    return Math.max(
        COMPETITION_CALCULATION_V6.MIN_SCORE,
        Math.min(
            COMPETITION_CALCULATION_V6.MAX_SCORE,
            Number(score) || 0,
        ),
    );
}

/**
 * Tính tổng điểm thay đổi của một HS trong một tuần.
 *
 * Chỉ lấy record đúng student_id và week.
 */
function sumCompetitionWeekChangeV6(records, studentId, week) {
    return records
        .filter((record) => {
            return (
                String(record.student_id) === String(studentId) &&
                String(record.week || record.week_start || '') ===
                    String(week)
            );
        })
        .reduce((sum, record) => {
            return sum + Number(record.score ?? record.points ?? 0);
        }, 0);
}

/**
 * Lấy các tuần chính thức có dữ liệu của một HS.
 *
 * Record test trước 07/09/2026 được loại khỏi chuỗi chính thức.
 */
function getOfficialCompetitionWeeksV6(records, studentId) {
    return [
        ...new Set(
            records
                .filter((record) => {
                    const week = getMondayForCompetitionWeekV6(
                        record.week || record.week_start || record.date,
                    );

                    return (
                        String(record.student_id) === String(studentId) &&
                        week >=
                            COMPETITION_CALCULATION_V6.OFFICIAL_FIRST_WEEK
                    );
                })
                .map((record) =>
                    getMondayForCompetitionWeekV6(
                        record.week || record.week_start || record.date,
                    ),
                ),
        ),
    ].sort();
}

/**
 * Tính điểm tuần chính thức cho một HS.
 *
 * Trước 07/09/2026:
 * - Dùng BASE_SCORE + thay đổi của chính tuần test.
 * - Không áp dụng rollover giữa các tuần test.
 *
 * Từ 07/09/2026:
 * - Week 1 bắt đầu từ 81.
 * - Mỗi tuần sau nhận start score từ rollover của tuần trước.
 */
function calculateCompetitionWeekScoreV6(
    records,
    studentId,
    targetWeek,
) {
    const normalizedTargetWeek =
        getMondayForCompetitionWeekV6(targetWeek);

    if (!normalizedTargetWeek) {
        return COMPETITION_CALCULATION_V6.BASE_SCORE;
    }

    if (!isOfficialCompetitionWeekV6(normalizedTargetWeek)) {
        return clampCompetitionScoreV6(
            COMPETITION_CALCULATION_V6.BASE_SCORE +
                sumCompetitionWeekChangeV6(
                    records,
                    studentId,
                    normalizedTargetWeek,
                ),
        );
    }

    let startScore = COMPETITION_CALCULATION_V6.BASE_SCORE;
    let currentWeek =
        COMPETITION_CALCULATION_V6.OFFICIAL_FIRST_WEEK;

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
 * Cộng 7 ngày mà không phụ thuộc timezone của trình duyệt.
 */
function addSevenDaysCompetitionV6(value) {
    const date = new Date(`${value}T00:00:00`);

    date.setUTCDate(date.getUTCDate() + 7);

    return date.toISOString().slice(0, 10);
}

/**
 * Tính tổng cộng/trừ của một HS trong một tuần.
 */
function summarizeCompetitionWeekV6(
    records,
    studentId,
    week,
) {
    const weekStart = getMondayForCompetitionWeekV6(week);
    const rows = records.filter((record) => {
        return (
            String(record.student_id) === String(studentId) &&
            String(record.week || record.week_start || '') ===
                weekStart
        );
    });

    const totalPlus = rows
        .filter((record) => Number(record.score ?? record.points) > 0)
        .reduce(
            (sum, record) =>
                sum + Number(record.score ?? record.points ?? 0),
            0,
        );

    const totalMinus = rows
        .filter((record) => Number(record.score ?? record.points) < 0)
        .reduce(
            (sum, record) =>
                sum + Number(record.score ?? record.points ?? 0),
            0,
        );

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
 * Public API dùng chung cho module khác và regression test.
 */
globalThis.CompetitionCalculationV6 = Object.freeze({
    CONFIG: COMPETITION_CALCULATION_V6,
    normalizeDate: normalizeCompetitionCalculationDateV6,
    getMonday: getMondayForCompetitionWeekV6,
    isOfficialWeek: isOfficialCompetitionWeekV6,
    clampScore: clampCompetitionScoreV6,
    rolloverStart: getCompetitionRolloverStartV6,
    sumWeekChange: sumCompetitionWeekChangeV6,
    getOfficialWeeks: getOfficialCompetitionWeeksV6,
    calculateWeekScore: calculateCompetitionWeekScoreV6,
    summarizeWeek: summarizeCompetitionWeekV6,
});
