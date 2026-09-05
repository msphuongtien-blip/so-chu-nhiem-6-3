/**
 * FILE: competition-ui-v6.js
 *
 * Mục đích: UI boundary và compatibility layer cho Thi đua V6.
 * Tập trung các phần trình bày/bridge runtime, không chứa persistence.
 */

\n/* ===== competition-ux-v6.js ===== */\n\n/**
 * FILE: competition-ux-v6.js
 *
 * Mục đích:
 * Tập trung các cải tiến UX nhỏ của module Thi đua – Xếp hạng mà không
 * đưa thêm logic vào app.js legacy.
 *
 * Chức năng:
 * - Thu gọn / mở rộng bảng xếp hạng.
 * - Làm mới dữ liệu sau khi xóa record.
 * - Thay dropdown HS trong form Sửa record bằng autocomplete.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Thay đổi schema/RLS.
 * - Tạo Supabase client mới.
 */

const COMPETITION_UX_V6_POLL_MS = 100;
const COMPETITION_UX_V6_WAIT_MS = 15000;
const COMPETITION_UX_V6_MAX_RESULTS = 8;

let competitionRankingCollapseBoundV6 = false;
let competitionDeleteWrappedV6 = false;
let competitionEditPickerWrappedV6 = false;

/**
 * Chuẩn hóa text tìm kiếm để không phân biệt hoa/thường và dấu tiếng Việt.
 */
function normalizeCompetitionUxSearchV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Escape dữ liệu trước khi đưa vào HTML.
 */
function escapeCompetitionUxHtmlV6(value) {
    return String(value ?? '').replace(
        /[&<>\"']/g,
        (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '\"': '&quot;',
            "'": '&#039;',
        }[character]),
    );
}

/**
 * Tạo nút thu gọn/mở rộng cho bảng xếp hạng.
 */
function bindCompetitionRankingCollapseV6() {
    if (competitionRankingCollapseBoundV6) {
        return;
    }

    const section = findRankingSectionV6();

    if (!section) {
        return;
    }

    const sectionTitle = section.querySelector('.section-title');
    const tableWrap = section.querySelector('.tablewrap');

    if (!sectionTitle || !tableWrap) {
        return;
    }

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'btn small';
    toggleButton.id = 'competitionRankingToggleV6';
    toggleButton.textContent = 'Mở rộng';
    toggleButton.setAttribute('aria-expanded', 'false');

    sectionTitle.appendChild(toggleButton);

    // Mặc định thu gọn để GVCN nhanh chóng đi tới Lịch sử.
    tableWrap.classList.add('competition-ranking-collapsed-v6');

    toggleButton.addEventListener('click', () => {
        const collapsed = tableWrap.classList.toggle(
            'competition-ranking-collapsed-v6',
        );

        toggleButton.textContent = collapsed
            ? 'Mở rộng'
            : 'Thu gọn';
        toggleButton.setAttribute(
            'aria-expanded',
            String(!collapsed),
        );
    });

    competitionRankingCollapseBoundV6 = true;
}

/**
 * Tìm card chứa tiêu đề "Xếp hạng ... học sinh".
 */
function findRankingSectionV6() {
    return Array.from(
        document.querySelectorAll('.card.section'),
    ).find((card) => {
        const heading = card.querySelector('h2');
        return heading?.textContent?.startsWith('Xếp hạng');
    });
}

/**
 * Làm mới toàn bộ dữ liệu sau khi một record bị xóa.
 */
async function refreshCompetitionAfterDeleteV6() {
    if (
        typeof window.loadCompetitionHistoryFromSupabase ===
        'function'
    ) {
        await window.loadCompetitionHistoryFromSupabase();
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        await window.loadStudentsFromSupabase();
    }

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    if (typeof window.renderStudents === 'function') {
        await window.renderStudents();
    }

    if (typeof window.renderDashboard === 'function') {
        await window.renderDashboard();
    }
}

/**
 * Bọc function xóa legacy sau khi nó đã hoàn thành DELETE.
 *
 * Legacy function vẫn chịu trách nhiệm confirm và DELETE. Wrapper chỉ đảm bảo
 * cache/UI được cập nhật ngay sau thao tác đó.
 */
function installCompetitionDeleteRefreshV6() {
    if (
        competitionDeleteWrappedV6 ||
        typeof window.deleteCompetitionRecord !== 'function'
    ) {
        return false;
    }

    const originalDelete = window.deleteCompetitionRecord;

    async function deleteCompetitionRecordWithRefreshV6(...args) {
        await originalDelete(...args);

        try {
            await refreshCompetitionAfterDeleteV6();
        } catch (error) {
            console.error(
                '[Competition V6] Không thể refresh sau khi xóa record:',
                error,
            );
        }
    }

    deleteCompetitionRecordWithRefreshV6.__competitionUxWrappedV6 = true;
    window.deleteCompetitionRecord = deleteCompetitionRecordWithRefreshV6;
    competitionDeleteWrappedV6 = true;

    return true;
}

/**
 * Render autocomplete HS cho form Sửa record.
 */
function buildEditStudentPickerV6(selectedStudentId) {
    const selectedStudent = (Array.isArray(students) ? students : [])
        .find(
            (student) =>
                String(student.id) === String(selectedStudentId),
        );

    const displayValue = selectedStudent
        ? `${selectedStudent.full_name} · ${selectedStudent.student_code || ''}`.trim()
        : '';

    return `
        <div class="competition-edit-student-picker-v6">
            <input
                id="eStudent"
                type="hidden"
                value="${escapeCompetitionUxHtmlV6(selectedStudentId)}"
            >
            <div class="competition-edit-student-input-wrap-v6">
                <input
                    id="eStudentPickerInputV6"
                    type="text"
                    autocomplete="off"
                    value="${escapeCompetitionUxHtmlV6(displayValue)}"
                    placeholder="Gõ họ tên hoặc Mã HS..."
                >
                <button
                    id="eStudentPickerClearV6"
                    class="competition-edit-student-clear-v6"
                    type="button"
                    aria-label="Đổi học sinh"
                >
                    ×
                </button>
            </div>
            <div
                id="eStudentPickerResultsV6"
                class="competition-edit-student-results-v6 hidden"
            ></div>
            <div class="mini">
                Gõ tên hoặc Mã HS để tìm nhanh.
            </div>
        </div>
    `;
}

/**
 * Hiển thị kết quả tìm HS trong form Sửa.
 */
function renderEditStudentPickerResultsV6(keyword) {
    const results = document.getElementById(
        'eStudentPickerResultsV6',
    );

    if (!results) {
        return;
    }

    const normalized =
        normalizeCompetitionUxSearchV6(keyword);

    const matches = (Array.isArray(students) ? students : [])
        .filter((student) => {
            const name = normalizeCompetitionUxSearchV6(
                student.full_name,
            );
            const code = normalizeCompetitionUxSearchV6(
                student.student_code,
            );

            return (
                name.includes(normalized) ||
                code.includes(normalized)
            );
        })
        .slice(0, COMPETITION_UX_V6_MAX_RESULTS);

    if (!normalized) {
        results.classList.add('hidden');
        results.innerHTML = '';
        return;
    }

    if (!matches.length) {
        results.innerHTML =
            '<div class="competition-edit-student-empty-v6">' +
            'Không tìm thấy HS phù hợp.' +
            '</div>';
        results.classList.remove('hidden');
        return;
    }

    results.innerHTML = matches
        .map((student) => `
            <button
                class="competition-edit-student-option-v6"
                type="button"
                data-edit-student-id="${escapeCompetitionUxHtmlV6(student.id)}"
            >
                <span>
                    ${escapeCompetitionUxHtmlV6(student.full_name)}
                </span>
                <span class="mini">
                    ${escapeCompetitionUxHtmlV6(student.student_code || '')}
                    ${student.team ? ` · Tổ ${escapeCompetitionUxHtmlV6(student.team)}` : ''}
                </span>
            </button>
        `)
        .join('');

    results.classList.remove('hidden');
}

/**
 * Gắn event cho autocomplete trong form Sửa.
 */
function bindEditStudentPickerV6() {
    const input = document.getElementById(
        'eStudentPickerInputV6',
    );
    const results = document.getElementById(
        'eStudentPickerResultsV6',
    );
    const clearButton = document.getElementById(
        'eStudentPickerClearV6',
    );
    const hiddenStudent = document.getElementById('eStudent');

    if (!input || !results || !clearButton || !hiddenStudent) {
        return;
    }

    input.addEventListener('input', () => {
        hiddenStudent.value = '';
        renderEditStudentPickerResultsV6(input.value);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim()) {
            renderEditStudentPickerResultsV6(input.value);
        }
    });

    clearButton.addEventListener('click', () => {
        input.value = '';
        hiddenStudent.value = '';
        input.focus();
        renderEditStudentPickerResultsV6('');
    });

    results.addEventListener('click', (event) => {
        const option = event.target.closest(
            '[data-edit-student-id]',
        );

        if (!option) {
            return;
        }

        const studentId = option.dataset.editStudentId;
        const student = (Array.isArray(students) ? students : [])
            .find(
                (item) =>
                    String(item.id) === String(studentId),
            );

        if (!student) {
            return;
        }

        hiddenStudent.value = String(student.id);
        input.value = `${student.full_name} · ${student.student_code || ''}`.trim();
        results.classList.add('hidden');
    });

    document.addEventListener(
        'click',
        (event) => {
            if (
                !event.target.closest(
                    '.competition-edit-student-picker-v6',
                )
            ) {
                results.classList.add('hidden');
            }
        },
        { once: true },
    );
}

/**
 * Bọc form Sửa legacy: giữ toàn bộ nghiệp vụ hiện có, chỉ thay field HS.
 */
function installCompetitionEditPickerV6() {
    if (
        competitionEditPickerWrappedV6 ||
        typeof window.editCompetitionRecord !== 'function'
    ) {
        return false;
    }

    const originalEdit = window.editCompetitionRecord;

    async function editCompetitionRecordWithPickerV6(id) {
        await originalEdit(id);

        const studentSelect = document.getElementById('eStudent');

        if (!studentSelect) {
            return;
        }

        const selectedStudentId = studentSelect.value;
        const parent = studentSelect.parentElement;

        if (!parent) {
            return;
        }

        parent.innerHTML =
            '<label>Học sinh</label>' +
            buildEditStudentPickerV6(selectedStudentId);

        bindEditStudentPickerV6();
    }

    window.editCompetitionRecord =
        editCompetitionRecordWithPickerV6;
    competitionEditPickerWrappedV6 = true;

    return true;
}

/**
 * Thêm CSS riêng cho các phần UX V6 mà không đưa style vào index.html.
 */
function loadCompetitionUxStylesV6() {
    if (
        document.querySelector(
            'link[data-competition-ux-v6-style]',
        )
    ) {
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'competition-ux-v6.css';
    link.dataset.competitionUxV6Style = 'true';

    document.head.appendChild(link);
}

/**
 * Bootstrap sau khi runtime legacy đã sẵn sàng.
 */
function bootstrapCompetitionUxV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        bindCompetitionRankingCollapseV6();
        installCompetitionDeleteRefreshV6();
        installCompetitionEditPickerV6();
        loadCompetitionUxStylesV6();

        if (
            competitionRankingCollapseBoundV6 &&
            competitionDeleteWrappedV6 &&
            competitionEditPickerWrappedV6
        ) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_UX_V6_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] UX bootstrap timed out.',
            );
        }
    }, COMPETITION_UX_V6_POLL_MS);
}

bootstrapCompetitionUxV6();
\n\n/* ===== competition-legacy-boundary-v6.js ===== */\n\n/**
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
