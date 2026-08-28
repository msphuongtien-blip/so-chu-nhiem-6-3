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
 * - Calculation engine V6 là nguồn quy tắc; adapter chỉ chuẩn hóa input.
 *
 * Không chịu trách nhiệm:
 * - Ghi database.
 * - Tạo record.
 * - Quản lý category/criteria.
 */

const COMPETITION_CALC_RUNTIME_V6_WAIT_MS = 15000;
const COMPETITION_CALC_RUNTIME_V6_POLL_MS = 100;

let competitionCalculationRuntimeInstalledV6 = false;
let competitionOriginalRenderV6 = null;

/**
 * Lọc dữ liệu để renderer legacy chỉ thấy dữ liệu phù hợp với giai đoạn
 * tính điểm mà người dùng đang xem.
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

    const officialFirstWeek = engine.CONFIG.OFFICIAL_FIRST_WEEK;
    const records = Array.isArray(supabaseCache?.competitionRecords)
        ? supabaseCache.competitionRecords
        : [];

    return records.filter((record) => {
        const week = engine.getMonday(
            record.week || record.week_start || record.date,
        );

        return week >= officialFirstWeek;
    });
}

/**
 * Thiết lập adapter một lần.
 *
 * Renderer V5 vẫn chịu trách nhiệm dựng HTML; adapter chỉ thay tập records
 * đầu vào khi người dùng đang xem giai đoạn chính thức.
 */
function installCompetitionCalculationRuntimeV6() {
    if (
        competitionCalculationRuntimeInstalledV6 ||
        typeof window.renderCompetition !== 'function' ||
        !globalThis.CompetitionCalculationV6
    ) {
        return false;
    }

    competitionOriginalRenderV6 = window.renderCompetition;

    async function renderCompetitionWithCalculationV6(...args) {
        const filter = document.getElementById('compWeekFilter');
        const selectedWeek =
            filter?.value ||
            (typeof window.getCurrentWeekStart === 'function'
                ? window.getCurrentWeekStart()
                : '');

        const originalRecords =
            supabaseCache.competitionRecords;
        const calculationRecords =
            getCalculationRecordsForWeekV6(selectedWeek);

        if (calculationRecords) {
            supabaseCache.competitionRecords =
                calculationRecords;
        }

        try {
            return await competitionOriginalRenderV6(...args);
        } finally {
            supabaseCache.competitionRecords = originalRecords;
        }
    }

    renderCompetitionWithCalculationV6.__calculationWrappedV6 = true;
    window.renderCompetition = renderCompetitionWithCalculationV6;
    competitionCalculationRuntimeInstalledV6 = true;

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
