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
    // Rendering is owned by the consolidated Competition pipeline.
    // Keep this function as a compatibility API; no renderer wrapping.
    return typeof globalThis.renderCompetition === 'function';
}

globalThis.CompetitionRankingUIV6 = Object.freeze({
    MONTHLY_SCORE_LABEL: COMPETITION_RANKING_UI_V6.MONTHLY_SCORE_LABEL,
    removeMonthlyScoreColumn: removeMonthlyScoreColumnV6,
    removeMonthlyScoreColumnFromDom: removeMonthlyScoreColumnFromDomV6,
    install: installCompetitionRankingUIV6,
});


/**
 * Multi-student filter cho trang Thi đua.
 *
 * Tái sử dụng cùng contract tìm kiếm của StudentAutocompleteV6:
 * họ tên hoặc Mã HS, không phân biệt hoa/thường và dấu.
 */
let competitionStudentFilterStateV6 = new Set();
let competitionStudentFilterMountedV6 = false;

function getCompetitionStudentFilterSourceV6() {
    if (Array.isArray(globalThis.students)) {
        return globalThis.students;
    }

    return [];
}

function getSelectedCompetitionStudentIdsV6() {
    return [...competitionStudentFilterStateV6];
}

function renderCompetitionStudentFilterSelectedV6() {
    const root = document.getElementById('competitionStudentFilterV6');

    if (!root) {
        return;
    }

    const selected = getCompetitionStudentFilterSourceV6().filter(
        (student) =>
            competitionStudentFilterStateV6.has(String(student.id)),
    );
    const summary = root.querySelector(
        '.competition-student-filter-summary-v6',
    );
    const list = root.querySelector(
        '.competition-student-filter-selected-v6',
    );

    if (summary) {
        summary.textContent = selected.length
            ? `Đã chọn: ${selected.length} học sinh`
            : 'Tất cả học sinh';
    }

    if (list) {
        list.innerHTML = selected.length
            ? selected
                .map(
                    (student) => `
                        <span class="competition-student-chip-v6">
                            ${escapeStudentPickerHtmlV6(student.full_name)}
                            <button
                                type="button"
                                data-remove-student-id="${escapeStudentPickerHtmlV6(student.id)}"
                                aria-label="Bỏ chọn ${escapeStudentPickerHtmlV6(student.full_name)}"
                            >×</button>
                        </span>
                    `,
                )
                .join('')
            : '';
    }
}

function renderCompetitionStudentFilterResultsV6(keyword) {
    const root = document.getElementById('competitionStudentFilterV6');
    const results = root?.querySelector(
        '.competition-student-filter-results-v6',
    );
    const searchInput = root?.querySelector(
        '.competition-student-filter-search-v6',
    );

    if (!root || !results || !searchInput) {
        return;
    }

    const filterFn =
        globalThis.StudentAutocompleteV6?.filterStudents;

    const matches = filterFn
        ? filterFn(getCompetitionStudentFilterSourceV6(), keyword)
        : [];

    if (!keyword.trim()) {
        results.innerHTML =
            '<div class="student-autocomplete-empty-v6">Gõ tên hoặc Mã HS để tìm.</div>';
        results.classList.remove('hidden');
        return;
    }

    if (!matches.length) {
        results.innerHTML =
            '<div class="student-autocomplete-empty-v6">Không tìm thấy học sinh phù hợp.</div>';
        results.classList.remove('hidden');
        return;
    }

    results.innerHTML = matches
        .map((student) => {
            const id = String(student.id);
            const checked =
                competitionStudentFilterStateV6.has(id);

            return `
                <label class="competition-student-filter-option-v6">
                    <input
                        type="checkbox"
                        value="${escapeStudentPickerHtmlV6(id)}"
                        ${checked ? 'checked' : ''}
                    >
                    <span class="competition-student-filter-name-v6">
                        <strong>${escapeStudentPickerHtmlV6(student.full_name)}</strong>
                        <small>${escapeStudentPickerHtmlV6(student.student_code || 'Chưa có Mã HS')}</small>
                    </span>
                </label>
            `;
        })
        .join('');

    results.classList.remove('hidden');
}

function mountCompetitionStudentFilterV6() {
    if (competitionStudentFilterMountedV6) {
        return true;
    }

    const select = document.getElementById('compStudentFilter');

    if (!select) {
        return false;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'competitionStudentFilterV6';
    wrapper.className = 'competition-student-filter-v6';
    wrapper.innerHTML = `
        <button
            type="button"
            class="competition-student-filter-trigger-v6"
            aria-expanded="false"
        >
            <span class="competition-student-filter-summary-v6">Tất cả học sinh</span>
            <span aria-hidden="true">▾</span>
        </button>
        <div class="competition-student-filter-panel-v6 hidden">
            <div class="student-autocomplete-input-wrap-v6">
                <input
                    type="text"
                    class="competition-student-filter-search-v6"
                    autocomplete="off"
                    placeholder="Gõ tên hoặc Mã HS..."
                    aria-label="Tìm học sinh theo họ tên hoặc Mã HS"
                >
            </div>
            <div class="competition-student-filter-selected-v6"></div>
            <div class="competition-student-filter-results-v6 hidden"></div>
            <div class="competition-student-filter-actions-v6">
                <button type="button" class="btn small" data-select-all-students-v6>Chọn tất cả</button>
                <button type="button" class="btn small" data-clear-students-v6>Bỏ chọn</button>
            </div>
        </div>
    `;

    select.replaceWith(wrapper);

    const trigger = wrapper.querySelector(
        '.competition-student-filter-trigger-v6',
    );
    const panel = wrapper.querySelector(
        '.competition-student-filter-panel-v6',
    );
    const search = wrapper.querySelector(
        '.competition-student-filter-search-v6',
    );

    trigger.addEventListener('click', () => {
        const opening = panel.classList.toggle('hidden') === false;
        trigger.setAttribute('aria-expanded', String(opening));

        if (opening) {
            search.focus();
            renderCompetitionStudentFilterResultsV6(search.value);
        }
    });

    search.addEventListener('input', () => {
        renderCompetitionStudentFilterResultsV6(search.value);
    });

    panel.addEventListener('change', (event) => {
        const checkbox = event.target.closest(
            'input[type="checkbox"]',
        );

        if (!checkbox) {
            return;
        }

        const id = String(checkbox.value);

        if (checkbox.checked) {
            competitionStudentFilterStateV6.add(id);
        } else {
            competitionStudentFilterStateV6.delete(id);
        }

        renderCompetitionStudentFilterSelectedV6();
        renderCompetitionStudentFilterResultsV6(search.value);

        if (typeof globalThis.renderCompetition === 'function') {
            globalThis.renderCompetition();
        }
    });

    panel.addEventListener('click', (event) => {
        const removeButton = event.target.closest(
            '[data-remove-student-id]',
        );

        if (removeButton) {
            competitionStudentFilterStateV6.delete(
                String(removeButton.dataset.removeStudentId),
            );
            renderCompetitionStudentFilterSelectedV6();
            renderCompetitionStudentFilterResultsV6(search.value);

            if (typeof globalThis.renderCompetition === 'function') {
                globalThis.renderCompetition();
            }
            return;
        }

        if (event.target.closest('[data-select-all-students-v6]')) {
            getCompetitionStudentFilterSourceV6().forEach((student) => {
                competitionStudentFilterStateV6.add(String(student.id));
            });
            renderCompetitionStudentFilterSelectedV6();
            renderCompetitionStudentFilterResultsV6(search.value);

            if (typeof globalThis.renderCompetition === 'function') {
                globalThis.renderCompetition();
            }
        }

        if (event.target.closest('[data-clear-students-v6]')) {
            competitionStudentFilterStateV6.clear();
            renderCompetitionStudentFilterSelectedV6();
            renderCompetitionStudentFilterResultsV6(search.value);

            if (typeof globalThis.renderCompetition === 'function') {
                globalThis.renderCompetition();
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            panel.classList.add('hidden');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    competitionStudentFilterMountedV6 = true;
    renderCompetitionStudentFilterSelectedV6();
    return true;
}

globalThis.CompetitionRankingUIV6 = Object.freeze({
    MONTHLY_SCORE_LABEL: COMPETITION_RANKING_UI_V6.MONTHLY_SCORE_LABEL,
    removeMonthlyScoreColumn: removeMonthlyScoreColumnV6,
    removeMonthlyScoreColumnFromDom: removeMonthlyScoreColumnFromDomV6,
    install: installCompetitionRankingUIV6,
    mountStudentFilter: mountCompetitionStudentFilterV6,
    getSelectedStudentIds: getSelectedCompetitionStudentIdsV6,
});
