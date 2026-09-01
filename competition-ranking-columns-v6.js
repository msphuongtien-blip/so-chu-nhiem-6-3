/**
 * FILE: competition-ranking-columns-v6.js
 *
 * Mục đích:
 * Chuẩn hóa bảng xếp hạng Thi đua V6 về đúng 3 cột nghiệp vụ mà GVCN
 * cần nhìn trong một lần quét:
 * - Học sinh
 * - Điểm tuần
 * - Huy hiệu
 *
 * Không hiển thị:
 * - Hạng
 * - Điểm tháng
 * - Xu hướng
 * - Nhóm legacy
 *
 * Badge vẫn được lấy từ điểm tuần và giữ đủ 5 cấp.
 */

const RANKING_ALLOWED_HEADERS_V6 = Object.freeze([
    'Học sinh',
    'Điểm tuần',
    'Huy hiệu',
]);

function normalizeRankingHeaderV6(header) {
    const label = header.textContent.trim();

    if (label === 'Nhóm') {
        header.textContent = 'Huy hiệu';
    }

    return header.textContent.trim();
}

/**
 * Giữ đúng các cột nghiệp vụ cần thiết và xóa toàn bộ cột presentation
 * legacy khỏi cả header lẫn body để không còn tình trạng lệch cột.
 */
function enforceCompetitionRankingColumnsV6(table) {
    if (!table) {
        return;
    }

    const headers = Array.from(
        table.querySelectorAll('thead th'),
    );

    headers.forEach(normalizeRankingHeaderV6);

    const keepIndexes = new Set(
        headers
            .map((header, index) => ({
                index,
                label: header.textContent.trim(),
            }))
            .filter(({ label }) =>
                RANKING_ALLOWED_HEADERS_V6.includes(label),
            )
            .map(({ index }) => index),
    );

    const removeIndexes = headers
        .map((_, index) => index)
        .filter((index) => !keepIndexes.has(index))
        .sort((a, b) => b - a);

    removeIndexes.forEach((index) => {
        headers[index]?.remove();

        table
            .querySelectorAll('#rankBody tr')
            .forEach((row) => {
                row.children[index]?.remove();
            });
    });
}

function hideLegacyRankingColumnsV6() {
    const rankBody = document.getElementById('rankBody');
    const table = rankBody?.closest('table');

    if (!table) {
        return;
    }

    enforceCompetitionRankingColumnsV6(table);
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
    allowedHeaders: RANKING_ALLOWED_HEADERS_V6,
    hide: hideLegacyRankingColumnsV6,
    enforce: enforceCompetitionRankingColumnsV6,
});
