/**
 * FILE: competition-ranking-columns-v6.js
 *
 * Mục đích:
 * Loại các trường presentation legacy không còn dùng khỏi bảng xếp hạng.
 *
 * Không hiển thị:
 * - Điểm tháng.
 * - Xu hướng.
 *
 * Vẫn hiển thị:
 * - Hạng.
 * - Học sinh.
 * - Điểm tuần.
 * - Huy hiệu theo điểm tuần: Kim cương, Vàng, Bạc, Đồng, Sắt.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Xóa dữ liệu Tổ học sinh.
 * - Thay đổi competition_records.
 */

const RANKING_HIDDEN_HEADERS_V6 = Object.freeze([
    'Điểm tháng',
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
