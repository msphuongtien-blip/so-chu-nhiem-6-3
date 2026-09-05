/* ===== competition-render-helpers-v6.js ===== */

/**
 * FILE: competition-render-helpers-v6.js
 *
 * Mục đích:
 * Cung cấp các helper hiển thị cho module Thi đua V6 mà runtime legacy
 * `app.js` vẫn đang gọi.
 *
 * Trách nhiệm:
 * - Khôi phục helper `trendText()` bị thiếu sau quá trình tách module.
 * - Không thực hiện query Supabase.
 * - Không thay đổi cách tính điểm.
 *
 * Thiết kế:
 * - Helper nhận dữ liệu đã có sẵn trên object học sinh.
 * - Hàm luôn trả về chuỗi an toàn để renderer không làm hỏng toàn bộ UI.
 */

/**
 * Xác định xu hướng điểm thi đua từ lịch sử điểm của một HS.
 *
 * Quy ước:
 * - Không đủ dữ liệu để so sánh: "—".
 * - Điểm gần nhất tăng: "↗ Tăng".
 * - Điểm gần nhất giảm: "↘ Giảm".
 * - Điểm không đổi: "→ Ổn định".
 *
 * @param {Array<number|string>} scoreHistory Lịch sử điểm theo tuần.
 * @returns {string} Chuỗi hiển thị xu hướng.
 */
function trendText(scoreHistory) {
    if (!Array.isArray(scoreHistory) || scoreHistory.length < 2) {
        return '—';
    }

    const previous = Number(
        scoreHistory[scoreHistory.length - 2],
    );
    const latest = Number(
        scoreHistory[scoreHistory.length - 1],
    );

    if (!Number.isFinite(previous) || !Number.isFinite(latest)) {
        return '—';
    }

    if (latest > previous) {
        return '↗ Tăng';
    }

    if (latest < previous) {
        return '↘ Giảm';
    }

    return '→ Ổn định';
}

/**
 * Public API dành cho runtime legacy và các module V6.
 */
globalThis.CompetitionRenderHelpersV6 = Object.freeze({
    trendText,
});

/*
 * `renderCompetition()` của app.js gọi trực tiếp `trendText()` theo kiểu
 * global function. Giữ alias này trong thời gian migration để không phải
 * viết lại toàn bộ renderer legacy ngay trong C2.3.
 */
globalThis.trendText = trendText;


/* ===== competition-render-pipeline-v6.js ===== */

/**
 * FILE: modules/competition/competition-render-pipeline-v6.js
 *
 * Mục đích:
 * Orchestrator duy nhất của renderer Thi đua V6.
 *
 * Pipeline:
 * 1. Đọc category/config cần cho UI.
 * 2. Gọi renderer dữ liệu gốc của app.js đúng một lần.
 * 3. Chuẩn hóa ranking về 4 cột và thứ hạng đồng hạng.
 * 4. Refresh issue/snapshot notification sau khi UI chính đã ổn định.
 *
 * Không chịu trách nhiệm:
 * - Ghi competition_records.
 * - Tự định nghĩa công thức điểm.
 * - Thay đổi dữ liệu Supabase.
 *
 * Quy tắc:
 * - Chỉ module này được phép bọc window.renderCompetition.
 * - Các compatibility module khác chỉ expose helper/service, không bọc renderer.
 */

let competitionLegacyRenderV6 = null;
let competitionRenderPipelineInstalledV6 = false;

async function renderCompetitionPipelineV6(...args) {
    if (typeof competitionLegacyRenderV6 !== 'function') {
        throw new Error('Competition legacy renderer chưa sẵn sàng.');
    }

    if (typeof globalThis.ensureCompetitionCategoriesV6 === 'function') {
        await globalThis.ensureCompetitionCategoriesV6();
    }

    if (typeof globalThis.renderCompetitionCategoryFilterV6 === 'function') {
        globalThis.renderCompetitionCategoryFilterV6();
    }

    const result = await competitionLegacyRenderV6(...args);

    if (typeof globalThis.refreshCompetitionCategoryControlsV6 === 'function') {
        globalThis.refreshCompetitionCategoryControlsV6();
    }

    if (typeof globalThis.hideLegacyRankingColumnsV6 === 'function') {
        globalThis.hideLegacyRankingColumnsV6();
    }

    if (typeof globalThis.removeMonthlyScoreColumnFromDomV6 === 'function') {
        globalThis.removeMonthlyScoreColumnFromDomV6();
    }

    if (typeof globalThis.refreshCompetitionIssuesNotificationV6 === 'function') {
        await globalThis.refreshCompetitionIssuesNotificationV6();
    }

    if (typeof globalThis.refreshCompetitionSnapshotNotificationV6 === 'function') {
        await globalThis.refreshCompetitionSnapshotNotificationV6();
    }

    if (typeof globalThis.bindCompetitionRankingCollapseV6 === 'function') {
        globalThis.bindCompetitionRankingCollapseV6();
    }

    return result;
}

function installCompetitionRenderPipelineV6() {
    if (competitionRenderPipelineInstalledV6) {
        return true;
    }

    const legacyRenderer = globalThis.renderCompetition;

    if (typeof legacyRenderer !== 'function') {
        return false;
    }

    competitionLegacyRenderV6 = legacyRenderer;
    globalThis.renderCompetition = renderCompetitionPipelineV6;
    globalThis.__competitionSingleRendererV6 = true;
    competitionRenderPipelineInstalledV6 = true;

    return true;
}

globalThis.CompetitionRenderPipelineV6 = Object.freeze({
    install: installCompetitionRenderPipelineV6,
    render: renderCompetitionPipelineV6,
});

installCompetitionRenderPipelineV6();
