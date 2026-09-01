/**
 * FILE: competition-ranking-columns-v6.js
 *
 * Mục đích:
 * Loại hoàn toàn các trường presentation legacy khỏi bảng xếp hạng V6.
 *
 * Không hiển thị:
 * - Điểm tháng.
 * - Nhóm điểm/tier cũ.
 * - Xu hướng.
 *
 * Chỉ giữ:
 * - Hạng.
 * - Học sinh.
 * - Điểm tuần.
 *
 * Trách nhiệm:
 * - Chỉ xử lý presentation boundary trong thời gian app.js legacy còn tồn tại.
 * - Không thay đổi competition_records hoặc dữ liệu điểm nguồn.
 */

const RANKING_HIDDEN_HEADERS_V6 = Object.freeze([
    'Điểm tháng',
    'Nhóm',
    'Xu hướng',
]);

function hideLegacyRankingColumnsV6() {
    const rankBody = document.getElementById('rankBody');
    const table = rankBody?.closest('table');

    if (!table) {
        return;
    }

    const headers = Array.from(table.querySelectorAll('thead th'));
    const indexes = headers
        .map((header, index) => ({
            index,
            label: header.textContent.trim(),
        }))
        .filter(({ label }) => RANKING_HIDDEN_HEADERS_V6.includes(label))
        .map(({ index }) => index)
        .sort((a, b) => b - a);

    indexes.forEach((index) => {
        headers[index]?.remove();

        Array.from(rankBody.querySelectorAll('tr')).forEach((row) => {
            row.children[index]?.remove();
        });
    });
}

function installRankingColumnBoundaryV6() {
    const render = globalThis.renderCompetition;

    if (
        typeof render !== 'function' ||
        globalThis.__rankingColumnBoundaryV6Installed
    ) {
        return false;
    }

    globalThis.renderCompetition = async function renderCompetitionWithColumnBoundaryV6(...args) {
        const result = await render(...args);
        hideLegacyRankingColumnsV6();
        return result;
    };

    globalThis.__rankingColumnBoundaryV6Installed = true;
    hideLegacyRankingColumnsV6();
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installRankingColumnBoundaryV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionRankingColumnsV6 = Object.freeze({
    hiddenHeaders: RANKING_HIDDEN_HEADERS_V6,
    hide: hideLegacyRankingColumnsV6,
});
