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
