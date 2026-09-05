/**
 * FILE: competition-ranking-ui-v6.js
 *
 * Mục đích:
 * Boundary UI cho bảng xếp hạng Thi đua V6 trong giai đoạn app.js legacy
 * vẫn còn tồn tại.
 *
 * Trách nhiệm:
 * - Bọc renderer Thi đua hiện tại.
 * - Loại bỏ cột Điểm tháng khỏi DOM sau khi renderer chạy.
 * - Giữ nguyên Điểm tuần, Nhóm và Xu hướng.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Đọc/ghi Supabase.
 * - Thay đổi dữ liệu lịch sử.
 */

const COMPETITION_RANKING_UI_V6 = Object.freeze({
    MONTHLY_SCORE_LABEL: 'Điểm tháng',
});

/**
 * Loại bỏ cột Điểm tháng khỏi một đoạn HTML ranking.
 *
 * Helper này phục vụ Test Center và không phụ thuộc DOM thật.
 *
 * @param {string} html HTML của header hoặc row.
 * @returns {string} HTML sau khi bỏ monthly score cell.
 */
function removeMonthlyScoreColumnV6(html) {
    let cleaned = String(html || '');

    cleaned = cleaned.replace(
        /<th[^>]*>\s*Điểm tháng\s*<\/th>/i,
        '',
    );

    // Renderer legacy đặt monthly score ngay sau weekly score.
    cleaned = cleaned.replace(
        /(<td>\s*<b>[^<]+<\/b>\s*<\/td>)\s*<td>[^<]*<\/td>(\s*<td>.*?<\/td>\s*<td>.*?<\/td>)/i,
        '$1$2',
    );

    return cleaned;
}

/**
 * Xóa cột monthly score trực tiếp trên bảng ranking hiện tại.
 */
function removeMonthlyScoreColumnFromDomV6() {
    const rankBody = document.getElementById('rankBody');

    if (!rankBody) {
        return;
    }

    const table = rankBody.closest('table');

    if (!table) {
        return;
    }

    const headers = Array.from(table.querySelectorAll('thead th'));
    const monthlyIndex = headers.findIndex((header) => {
        return header.textContent.trim() === COMPETITION_RANKING_UI_V6.MONTHLY_SCORE_LABEL;
    });

    if (monthlyIndex < 0) {
        return;
    }

    headers[monthlyIndex].remove();

    Array.from(rankBody.querySelectorAll('tr')).forEach((row) => {
        const cells = Array.from(row.children);
        cells[monthlyIndex]?.remove();
    });
}

/**
 * Bọc renderer legacy để cột monthly không quay lại sau mỗi lần render.
 */
function installCompetitionRankingUIV6() {
    const legacyRenderCompetition = globalThis.renderCompetition;

    if (typeof legacyRenderCompetition !== 'function') {
        return false;
    }

    if (globalThis.__competitionRankingUIV6Installed) {
        return true;
    }

    globalThis.renderCompetition = async function competitionRankingRenderV6(...args) {
        const result = await legacyRenderCompetition(...args);
        removeMonthlyScoreColumnFromDomV6();
        return result;
    };

    globalThis.__competitionRankingUIV6Installed = true;

    return true;
}

globalThis.CompetitionRankingUIV6 = Object.freeze({
    MONTHLY_SCORE_LABEL: COMPETITION_RANKING_UI_V6.MONTHLY_SCORE_LABEL,
    removeMonthlyScoreColumn: removeMonthlyScoreColumnV6,
    removeMonthlyScoreColumnFromDom: removeMonthlyScoreColumnFromDomV6,
    install: installCompetitionRankingUIV6,
});

installCompetitionRankingUIV6();
