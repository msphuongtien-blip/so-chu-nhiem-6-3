/* ===== competition-record-form-v6.js ===== */

/**
 * FILE: competition-record-form-v6.js
 *
 * Mục đích:
 * Thay thế UI form "Ghi nhận thi đua" của V5 bằng form V6 gọn hơn.
 *
 * Thiết kế:
 * - Không hiển thị các card criteria trùng lặp phía trên form.
 * - Nhóm tiêu chí lấy từ competition_categories.
 * - Criteria lấy từ competition_criteria và lọc theo category_id.
 * - Category 6 (Học tập) hoạt động giống 5 category còn lại.
 * - Thang điểm chỉ gồm -5…-1 và +1…+5; không có 0.
 * - Giáo viên chỉ chọn Ngày; Tuần luôn là dữ liệu dẫn xuất.
 *
 * Compatibility:
 * - Module giữ nguyên addCompetition(), renderStudents(),
 *   renderCompetition() và renderDashboard() đang có.
 * - Chỉ thay UI entry point openCompetitionForm().
 */

const RECORD_FORM_V6_CONFIG = {
    url:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    anonKey:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

const recordFormV6Supabase = window.supabase.createClient(
    RECORD_FORM_V6_CONFIG.url,
    RECORD_FORM_V6_CONFIG.anonKey,
);

const RECORD_FORM_V6_SCORES = [
    -5,
    -4,
    -3,
    -2,
    -1,
    1,
    2,
    3,
    4,
    5,
];

function escapeRecordFormV6(value) {
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

function getRecordFormCategoriesV6() {
    return window.CompetitionCategoryV6
        ?.getActiveCompetitionCategoriesV6?.() || [];
}

function buildRecordGroupOptionsV6(
    categories,
    selectedId = '',
) {
    return categories
        .slice()
        .sort(
            (a, b) =>
                Number(a.sort_order || 0) -
                    Number(b.sort_order || 0) ||
                Number(a.id) - Number(b.id),
        )
        .map((category) => {
            const selected =
                String(category.id) === String(selectedId)
                    ? ' selected'
                    : '';

            return (
                '<option value="' +
                escapeRecordFormV6(category.id) +
                '"' +
                selected +
                '>' +
                escapeRecordFormV6(category.id) +
                '. ' +
                escapeRecordFormV6(category.name) +
                '</option>'
            );
        })
        .join('');
}

function buildRecordScoreOptionsV6(selected = 1) {
    return RECORD_FORM_V6_SCORES
        .map((value) => {
            const selectedAttr =
                Number(selected) === value ? ' selected' : '';
            const label = value > 0 ? '+' + value : String(value);

            return (
                '<option value="' +
                value +
                '"' +
                selectedAttr +
                '>' +
                label +
                ' điểm</option>'
            );
        })
        .join('');
}

async function loadRecordFormCriteriaV6() {
    const { data, error } = await recordFormV6Supabase
        .from('competition_criteria')
        .select(
            'id, name, type, points, active, sort_order, category_id, group_name',
        )
        .eq('active', true)
        .order('sort_order', {
            ascending: true,
        });

    if (error) {
        throw error;
    }

    return data || [];
}

function filterRecordFormCriteriaV6(
    criteria,
    categoryId,
) {
    return criteria.filter((item) => {
        if (item.category_id !== null && item.category_id !== undefined) {
            return String(item.category_id) === String(categoryId);
        }

        return String(item.group_name || '') === String(categoryId);
    });
}

function buildRecordCriteriaOptionsV6(
    criteria,
    categoryId,
) {
    return filterRecordFormCriteriaV6(criteria, categoryId)
        .map((item) => {
            return (
                '<option value="' +
                escapeRecordFormV6(item.id) +
                '">' +
                escapeRecordFormV6(item.name) +
                '</option>'
            );
        })
        .join('');
}

function refreshRecordFormCriteriaV6(criteria) {
    const groupSelect = document.getElementById('fGroupV6');
    const criteriaSelect = document.getElementById('fCriteriaV6');

    if (!groupSelect || !criteriaSelect) {
        return;
    }

    const options = buildRecordCriteriaOptionsV6(
        criteria,
        groupSelect.value,
    );

    criteriaSelect.innerHTML = options ||
        '<option value="">Chưa có tiêu chí trong nhóm này</option>';

    criteriaSelect.disabled = !options;
}

async function waitForRecordFormCategoriesV6() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const categories = getRecordFormCategoriesV6();

        if (categories.length) {
            return categories;
        }

        await new Promise((resolve) => {
            window.setTimeout(resolve, 100);
        });
    }

    return [];
}

/**
 * Tính Monday từ Ngày đã chọn. Không phụ thuộc module khác để tránh
 * trường hợp load-order làm form không xác định được Tuần.
 */
function getRecordFormWeekFromDateV6(dateValue) {
    if (typeof dateValue !== 'string' || !dateValue) {
        return '';
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

async function openCompetitionFormV6() {
    const categories = await waitForRecordFormCategoriesV6();

    if (!categories.length) {
        openModal(
            'Ghi nhận thi đua',
            '<div class="notice danger">Không tải được nhóm tiêu chí. Vui lòng thử lại.</div>',
        );
        return;
    }

    let criteria;

    try {
        criteria = await loadRecordFormCriteriaV6();
    } catch (error) {
        console.error(
            '[Competition V6] Không tải được criteria:',
            error,
        );

        openModal(
            'Ghi nhận thi đua',
            '<div class="notice danger">Không tải được danh sách tiêu chí. Vui lòng thử lại.</div>',
        );
        return;
    }

    const firstCategoryId = String(categories[0].id);

    const groupOptions = buildRecordGroupOptionsV6(
        categories,
        firstCategoryId,
    );

    openModal(
        'Ghi nhận thi đua',
        `
            <div class="field">
                <label>Học sinh</label>
                <select id="fStudentV6">
                    ${students
                        .map(
                            (student) =>
                                '<option value="' +
                                escapeRecordFormV6(student.id) +
                                '">' +
                                escapeRecordFormV6(student.full_name) +
                                '</option>',
                        )
                        .join('')}
                </select>
            </div>

            <div class="field">
                <label>Ngày</label>
                <input
                    id="fDateV6"
                    type="date"
                    value="${escapeRecordFormV6(localDate())}"
                >
            </div>

            <div class="field">
                <label>Nhóm tiêu chí</label>
                <select id="fGroupV6">
                    ${groupOptions}
                </select>
            </div>

            <div class="field">
                <label>Tiêu chí</label>
                <select id="fCriteriaV6"></select>
            </div>

            <div class="field">
                <label>Điểm</label>
                <select id="fPointsV6">
                    ${buildRecordScoreOptionsV6(1)}
                </select>
            </div>

            <div class="field">
                <label>📝 Ghi chú</label>
                <textarea
                    id="fNoteV6"
                    rows="4"
                    placeholder="Lỗi vi phạm, hành vi tích cực, khen thưởng hoặc nhận xét..."
                ></textarea>
            </div>

            <div class="actions">
                <button
                    class="btn"
                    type="button"
                    onclick="closeModal()"
                >
                    Đóng
                </button>
                <button
                    class="btn primary"
                    type="button"
                    onclick="submitCompetitionV6()"
                >
                    Lưu
                </button>
            </div>
        `,
    );

    refreshRecordFormCriteriaV6(criteria);

    document
        .getElementById('fGroupV6')
        ?.addEventListener('change', () => {
            refreshRecordFormCriteriaV6(criteria);
        });

    document
        .getElementById('fCriteriaV6')
        ?.focus();
}

async function submitCompetitionV6() {
    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = getRecordFormWeekFromDateV6(date);

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return false;
    }

    if (!RECORD_FORM_V6_SCORES.includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const {
        data: selectedCriteria,
        error,
    } = await recordFormV6Supabase
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const ok = await addCompetition(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();

    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

window.openCompetitionForm = openCompetitionFormV6;

window.CompetitionRecordFormV6 = {
    RECORD_FORM_V6_SCORES,
    buildRecordGroupOptionsV6,
    buildRecordScoreOptionsV6,
    filterRecordFormCriteriaV6,
    buildRecordCriteriaOptionsV6,
    getRecordFormWeekFromDateV6,
};


/* ===== competition-record-form-clean-v6.js ===== */

/**
 * FILE: competition-record-form-clean-v6.js
 *
 * Boundary chuyển tiếp cho form ghi nhận thi đua V6.
 *
 * Nếu Final Boundary V6 đã được cài đặt, module này không được phép ghi đè
 * openCompetitionForm/submitCompetitionV6 nữa.
 */

function removeManualCompetitionWeekV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

async function submitCompetitionCleanV6() {
    if (globalThis.__finalCompetitionRecordFormV6Installed) {
        return globalThis.CompetitionRecordFormFinalV6?.submit?.() || false;
    }

    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Không thể xác định đầy đủ dữ liệu ghi nhận. Vui lòng thử lại.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const client = globalThis.SNCoreSupabase?.client || globalThis.sb;

    if (!client) {
        alert('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const { data: selectedCriteria, error } = await client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const writeBoundary =
        globalThis.CompetitionRecordWriteBoundaryV6
            ?.addCompetitionThroughV6Boundary;

    if (typeof writeBoundary !== 'function') {
        alert('Luồng lưu thi đua V6 chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const ok = await writeBoundary(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();
    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

function installCleanCompetitionRecordFormV6() {
    if (
        globalThis.__finalCompetitionRecordFormV6Installed ||
        typeof globalThis.openCompetitionFormV6 !== 'function'
    ) {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormCleanV6() {
        await globalThis.openCompetitionFormV6();
        removeManualCompetitionWeekV6();
    };

    globalThis.submitCompetitionV6 = submitCompetitionCleanV6;
    globalThis.__cleanCompetitionRecordFormV6Installed = true;
    return true;
}

const startedAt = Date.now();
const timer = window.setInterval(() => {
    if (installCleanCompetitionRecordFormV6()) {
        window.clearInterval(timer);
        return;
    }

    if (Date.now() - startedAt >= 15000) {
        window.clearInterval(timer);
    }
}, 100);

globalThis.CompetitionRecordFormCleanV6 = Object.freeze({
    removeWeek: removeManualCompetitionWeekV6,
    submit: submitCompetitionCleanV6,
    install: installCleanCompetitionRecordFormV6,
});


/* ===== competition-record-form-final-v6.js ===== */

/**
 * FILE: competition-record-form-final-v6.js
 *
 * Boundary cuối của form ghi nhận thi đua V6.
 *
 * Trách nhiệm:
 * - Giữ Ngày là field do GVCN chọn.
 * - Không cho GVCN chọn Tuần.
 * - Tự suy ra tuần từ Ngày.
 * - Bắt buộc chọn rõ học sinh trước khi lưu.
 * - Khóa submit handler V6 để không bị legacy ghi đè.
 */

function removeCompetitionWeekFieldFinalV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

/**
 * openModal có nút Đóng riêng ở modal head. Chỉ loại nút Đóng do form
 * chèn trong modalBody, tránh xóa nút đóng chính của modal.
 */
function removeDuplicateCompetitionFormCloseButtonV6() {
    const modalBody = document.getElementById('modalBody');

    if (!modalBody) {
        return;
    }

    const buttons = Array.from(modalBody.querySelectorAll('button'));

    buttons.forEach((button) => {
        if (button.textContent.trim() === 'Đóng') {
            button.remove();
        }
    });
}

function normalizeStudentSearchTextFinalV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Autocomplete giữ mã học sinh trong hidden input. Nếu một lớp UI legacy
 * làm mất hidden value nhưng ô hiển thị vẫn còn lựa chọn, phục hồi id từ
 * tên + Mã HS để không báo "thiếu học sinh" oan.
 */
function resolveStudentIdFromCompetitionFormV6() {
    const hiddenId = document.getElementById('fStudentV6')?.value || '';

    if (hiddenId) {
        return hiddenId;
    }

    const display =
        document.getElementById('fStudentV6DisplayV6')?.value || '';
    const normalizedDisplay = normalizeStudentSearchTextFinalV6(display);
    const sourceStudents =
        typeof students !== 'undefined' && Array.isArray(students)
            ? students
            : Array.isArray(globalThis.students)
                ? globalThis.students
                : [];

    if (!normalizedDisplay) {
        return '';
    }

    const match = sourceStudents.find((student) => {
        const name = normalizeStudentSearchTextFinalV6(student.full_name);
        const code = normalizeStudentSearchTextFinalV6(student.student_code);
        const combined = code ? `${name} · ${code}` : name;

        return (
            normalizedDisplay === combined ||
            normalizedDisplay === name ||
            normalizedDisplay === code
        );
    });

    return match?.id ? String(match.id) : '';
}

/**
 * Module-loader injects V6 scripts dynamically. Form may become clickable
 * before write boundary is available, so wait rather than failing early.
 */
async function waitForCompetitionWriteBoundaryV6(
    timeoutMs = 5000,
    intervalMs = 50,
) {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
        const writeBoundary =
            globalThis.CompetitionRecordWriteBoundaryV6
                ?.addCompetitionThroughV6Boundary;

        if (typeof writeBoundary === 'function') {
            return writeBoundary;
        }

        await new Promise((resolve) => {
            globalThis.setTimeout(resolve, intervalMs);
        });
    }

    return null;
}

async function submitCompetitionFinalV6() {
    const studentId = resolveStudentIdFromCompetitionFormV6();
    const date = document.getElementById('fDateV6')?.value || '';
    const categoryId = document.getElementById('fGroupV6')?.value || '';
    const criteriaId = document.getElementById('fCriteriaV6')?.value || '';
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const client =
        globalThis.SNCoreSupabase?.client ||
        globalThis.sb ||
        null;

    if (!client) {
        alert('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const { data: selectedCriteria, error } = await client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const writeBoundary = await waitForCompetitionWriteBoundaryV6();

    if (typeof writeBoundary !== 'function') {
        alert('Luồng lưu thi đua V6 chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const ok = await writeBoundary(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();

    /*
     * The V6 form writes through the Record Write Boundary directly, so it
     * does not pass through legacy addCompetition(). Refresh both caches
     * before rendering; otherwise history and the 44-student score list can
     * remain stale until a full page reload.
     */
    await Promise.all([
        globalThis.loadStudentsFromSupabase?.(),
        globalThis.loadCompetitionHistoryFromSupabase?.(),
    ]);

    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

function installFinalCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormFinalV6() {
        await globalThis.openCompetitionFormV6();
        removeCompetitionWeekFieldFinalV6();
        removeDuplicateCompetitionFormCloseButtonV6();
    };

    globalThis.submitCompetitionV6 = submitCompetitionFinalV6;
    globalThis.__finalCompetitionRecordFormV6Installed = true;
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installFinalCompetitionRecordFormV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionRecordFormFinalV6 = Object.freeze({
    removeWeek: removeCompetitionWeekFieldFinalV6,
    removeDuplicateCloseButton: removeDuplicateCompetitionFormCloseButtonV6,
    resolveStudentId: resolveStudentIdFromCompetitionFormV6,
    waitForWriter: waitForCompetitionWriteBoundaryV6,
    submit: submitCompetitionFinalV6,
    install: installFinalCompetitionRecordFormV6,
});
