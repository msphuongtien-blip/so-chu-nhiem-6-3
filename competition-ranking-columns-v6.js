/**
 * FILE: competition-ranking-columns-v6.js
 *
 * Chuẩn hóa bảng xếp hạng Thi đua V6 về đúng 4 cột:
 * - Hạng
 * - Học sinh
 * - Điểm tuần
 * - Huy hiệu
 *
 * Hạng là THỨ HẠNG. Học sinh cùng điểm phải đồng hạng.
 * Không hiển thị Điểm tháng, Xu hướng hoặc Nhóm legacy.
 */

const RANKING_ALLOWED_HEADERS_V6 = Object.freeze([
    'Hạng',
    'Học sinh',
    'Điểm tuần',
    'Huy hiệu',
]);

function normalizeRankingHeaderV6(header) {
    const label = header.textContent.trim();

    if (label === 'STT') {
        header.textContent = 'Hạng';
    } else if (label === 'Nhóm') {
        header.textContent = 'Huy hiệu';
    }

    return header.textContent.trim();
}

/**
 * Competition ranking chuẩn: 1, 2, 2, 4.
 * Không dùng thứ tự dòng làm hạng khi có cùng điểm.
 */
function calculateCompetitionRanksV6(scores) {
    let previousScore = null;
    let previousRank = 0;

    return scores.map((score, index) => {
        const numericScore = Number(score);

        if (index === 0 || numericScore !== previousScore) {
            previousRank = index + 1;
            previousScore = numericScore;
        }

        return previousRank;
    });
}

function applyCompetitionRankingRanksV6(table) {
    if (!table) {
        return;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const scores = rows.map((row) => Number(row.children[2]?.textContent));
    const ranks = calculateCompetitionRanksV6(scores);

    rows.forEach((row, index) => {
        const rankCell = row.children[0];

        if (rankCell) {
            rankCell.textContent = String(ranks[index]);
        }
    });
}

function normalizeCompetitionRankingBodyRowsV6(table) {
    if (!table) {
        return;
    }

    const rows = Array.from(table.querySelectorAll('tbody tr'));

    rows.forEach((row) => {
        if (row.children.length >= 6) {
            row.children[5]?.remove();
            row.children[3]?.remove();
        }

        while (row.children.length > 4) {
            row.lastElementChild?.remove();
        }
    });

    applyCompetitionRankingRanksV6(table);
}

function enforceCompetitionRankingColumnsV6(table) {
    if (!table) {
        return;
    }

    const headers = Array.from(table.querySelectorAll('thead th'));
    headers.forEach(normalizeRankingHeaderV6);

    const keepIndexes = new Set(
        headers
            .map((header, index) => ({
                index,
                label: header.textContent.trim(),
            }))
            .filter(({ label }) => RANKING_ALLOWED_HEADERS_V6.includes(label))
            .map(({ index }) => index),
    );

    const removeIndexes = headers
        .map((_, index) => index)
        .filter((index) => !keepIndexes.has(index))
        .sort((a, b) => b - a);

    removeIndexes.forEach((index) => {
        headers[index]?.remove();
        table.querySelectorAll('tbody tr').forEach((row) => {
            row.children[index]?.remove();
        });
    });

    normalizeCompetitionRankingBodyRowsV6(table);
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
    calculateRanks: calculateCompetitionRanksV6,
    hide: hideLegacyRankingColumnsV6,
    enforce: enforceCompetitionRankingColumnsV6,
    normalizeBodyRows: normalizeCompetitionRankingBodyRowsV6,
});
