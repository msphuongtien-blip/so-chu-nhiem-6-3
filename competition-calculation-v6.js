/**
 * FILE: competition-calculation-v6.js
 *
 * Mục đích: Domain module đã được hợp nhất theo chức năng để dễ bảo trì.
 */


/* ===== competition-calculation-v6.js ===== */

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


/* ===== competition-calculation-runtime-v6.js ===== */

/**
 * FILE: competition-calculation-runtime-v6.js
 *
 * Mục đích:
 * Nối calculation engine V6 vào renderer Thi đua hiện tại mà không phải
 * thay thế toàn bộ app.js trong một lần refactor lớn.
 *
 * Quy tắc:
 * - Trước 07/09/2026: giữ dữ liệu test để GVCN tiếp tục kiểm thử.
 * - Từ 07/09/2026: record trước Week 1 chính thức không tham gia rollover.
 * - Calculation engine V6 là nguồn quy tắc tính điểm tuần.
 * - Renderer chỉ chịu trách nhiệm trình bày; không tự định nghĩa lại công thức.
 *
 * Không chịu trách nhiệm:
 * - Ghi database.
 * - Tạo record.
 * - Quản lý category/criteria.
 * - Tính điểm tháng; phần này sẽ được thay bằng summary V6 ở C2.6.
 */

const COMPETITION_CALC_RUNTIME_V6_WAIT_MS = 15000;
const COMPETITION_CALC_RUNTIME_V6_POLL_MS = 100;

let competitionCalculationRuntimeInstalledV6 = false;
let competitionOriginalRenderV6 = null;
let competitionOriginalCalculateWeekV6 = null;

/**
 * Lọc dữ liệu để renderer legacy chỉ thấy dữ liệu phù hợp với giai đoạn
 * tính điểm mà người dùng đang xem.
 *
 * Việc lọc này phục vụ phần Lịch sử hiển thị. Phép tính điểm tuần đã được
 * chuyển sang calculation engine V6 nên không phụ thuộc vào helper này.
 */
function getCalculationRecordsForWeekV6(targetWeek) {
    const engine = globalThis.CompetitionCalculationV6;

    if (!engine) {
        return null;
    }

    const normalizedTargetWeek = engine.getMonday(targetWeek);

    if (!engine.isOfficialWeek(normalizedTargetWeek)) {
        return Array.isArray(supabaseCache?.competitionRecords)
            ? supabaseCache.competitionRecords
            : [];
    }

    const officialFirstWeek =
        engine.CONFIG.OFFICIAL_FIRST_WEEK;
    const records = Array.isArray(
        supabaseCache?.competitionRecords,
    )
        ? supabaseCache.competitionRecords
        : [];

    // Calculation Engine V6 hiện không khai báo OFFICIAL_FIRST_WEEK.
    // Khi cấu hình này chưa tồn tại, tuyệt đối không dùng
    // `week >= undefined` vì biểu thức đó sẽ loại toàn bộ history.
    if (!officialFirstWeek) {
        return records;
    }

    return records.filter((record) => {
        const week = engine.getMonday(
            record.week ||
                record.week_start ||
                record.date,
        );

        return week >= officialFirstWeek;
    });
}

/**
 * Thay calculation function tuần của runtime legacy bằng engine V6.
 *
 * Đây là bước chuyển tiếp: các renderer cũ vẫn gọi
 * `calculateStudentWeek(studentId, week)`, nhưng function đó sẽ chuyển tiếp
 * sang engine V6 thay vì giữ một công thức thứ hai trong app.js.
 */
function installCompetitionWeekCalculationV6() {
    if (
        typeof window.calculateStudentWeek !==
        'function'
    ) {
        return false;
    }

    if (
        window.calculateStudentWeek
            .__calculationV6Wrapped === true
    ) {
        return true;
    }

    competitionOriginalCalculateWeekV6 =
        window.calculateStudentWeek;

    window.calculateStudentWeek = function calculateStudentWeekV6(
        studentId,
        week,
    ) {
        const engine =
            globalThis.CompetitionCalculationV6;

        if (!engine) {
            return competitionOriginalCalculateWeekV6(
                studentId,
                week,
            );
        }

        const records = Array.isArray(
            supabaseCache?.competitionRecords,
        )
            ? supabaseCache.competitionRecords
            : [];

        return engine.calculateWeekScore(
            records,
            studentId,
            week,
        );
    };

    window.calculateStudentWeek
        .__calculationV6Wrapped = true;

    return true;
}

/**
 * Thiết lập adapter một lần.
 *
 * Renderer V5 vẫn chịu trách nhiệm dựng HTML; adapter chỉ thay tập records
 * đầu vào cho phần Lịch sử và route hàm tính điểm tuần sang engine V6.
 */
function installCompetitionCalculationRuntimeV6() {
    if (
        competitionCalculationRuntimeInstalledV6 ||
        typeof window.renderCompetition !==
            'function' ||
        !globalThis.CompetitionCalculationV6
    ) {
        return false;
    }

    const weekCalculationReady =
        installCompetitionWeekCalculationV6();

    if (!weekCalculationReady) {
        return false;
    }

    competitionOriginalRenderV6 =
        window.renderCompetition;

    async function renderCompetitionWithCalculationV6(
        ...args
    ) {
        const filter = document.getElementById(
            'compWeekFilter',
        );
        const selectedWeek =
            filter?.value ||
            (typeof window.getCurrentWeekStart ===
            'function'
                ? window.getCurrentWeekStart()
                : '');

        const originalRecords =
            supabaseCache.competitionRecords;
        const calculationRecords =
            getCalculationRecordsForWeekV6(
                selectedWeek,
            );

        if (calculationRecords) {
            supabaseCache.competitionRecords =
                calculationRecords;
        }

        try {
            return await competitionOriginalRenderV6(
                ...args,
            );
        } finally {
            supabaseCache.competitionRecords =
                originalRecords;
        }
    }

    renderCompetitionWithCalculationV6
        .__calculationWrappedV6 = true;
    window.renderCompetition =
        renderCompetitionWithCalculationV6;
    competitionCalculationRuntimeInstalledV6 =
        true;

    return true;
}

/**
 * Chờ calculation engine + renderer cùng sẵn sàng.
 */
function bootstrapCompetitionCalculationRuntimeV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installCompetitionCalculationRuntimeV6()) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_CALC_RUNTIME_V6_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Calculation runtime bootstrap timed out.',
            );
        }
    }, COMPETITION_CALC_RUNTIME_V6_POLL_MS);
}

bootstrapCompetitionCalculationRuntimeV6();
