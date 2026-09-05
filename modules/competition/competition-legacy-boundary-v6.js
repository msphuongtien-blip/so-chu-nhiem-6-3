/**
 * FILE: competition-legacy-boundary-v6.js
 *
 * Mục đích:
 * Chặn các entry point Thi đua legacy còn được app.js khai báo và route
 * chúng sang các module V6 đã được kiểm thử.
 *
 * Trách nhiệm:
 * - Giữ compatibility với inline onclick hiện tại.
 * - Route form/submit/ghi nhận sang V6.
 * - Không chứa business calculation, Supabase CRUD hoặc rendering rules.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm tuần.
 * - Tạo/sửa/xóa competition_records.
 * - Quản lý criteria.
 */

/**
 * Cài boundary sau khi app.js và toàn bộ module V6 đã được load.
 *
 * @returns {boolean} true khi các entry point bắt buộc đã được route.
 */
function installCompetitionLegacyBoundaryV6() {
    const recordForm = globalThis.openCompetitionFormV6;
    const writeBoundary = globalThis.addCompetitionThroughV6Boundary;
    const submitV6 = globalThis.submitCompetitionV6;

    if (typeof recordForm !== 'function') {
        return false;
    }

    if (typeof writeBoundary !== 'function') {
        return false;
    }

    if (typeof submitV6 !== 'function') {
        return false;
    }

    // Inline HTML vẫn gọi tên legacy nhưng không còn chạy implementation cũ.
    globalThis.openCompetitionForm = recordForm;
    globalThis.addCompetition = writeBoundary;
    globalThis.submitCompetition = submitV6;

    globalThis.__competitionLegacyBoundaryV6Installed = true;

    return true;
}

/**
 * Chờ các module V6 vì module-loader dùng classic scripts có defer.
 */
function bootstrapCompetitionLegacyBoundaryV6() {
    if (installCompetitionLegacyBoundaryV6()) {
        return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionLegacyBoundaryV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Legacy boundary bootstrap timed out.',
            );
        }
    }, 100);
}

/**
 * Public API cho Test Center.
 */
globalThis.CompetitionLegacyBoundaryV6 = Object.freeze({
    install: installCompetitionLegacyBoundaryV6,
});

bootstrapCompetitionLegacyBoundaryV6();
