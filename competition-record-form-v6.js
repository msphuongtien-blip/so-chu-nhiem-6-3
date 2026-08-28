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

/**
 * Escape HTML trước khi đưa dữ liệu database vào chuỗi HTML.
 */
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

/**
 * Lấy categories từ Category V6 dùng chung.
 */
function getRecordFormCategoriesV6() {
    return window.CompetitionCategoryV6
        ?.getActiveCompetitionCategoriesV6?.() || [];
}

/**
 * Sinh option cho select Nhóm tiêu chí.
 */
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

/**
 * Sinh option cho select Điểm.
 */
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

/**
 * Tải criteria đang active từ database.
 */
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

/**
 * Lọc criteria theo category đã chọn.
 *
 * `category_id` là khóa liên kết chính. `group_name` chỉ là compatibility
 * với dữ liệu legacy chưa được chuẩn hóa hoàn toàn.
 */
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

/**
 * Sinh option criteria cho một category.
 */
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

/**
 * Cập nhật danh sách criteria theo Nhóm tiêu chí.
 */
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

/**
 * Chờ Category V6 tải xong nếu module form được nạp sớm hơn network response.
 */
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
 * Form ghi nhận V6.
 *
 * Không còn block criteria cards duplicate của V5.
 */
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
                <label>Tuần</label>
                <input
                    id="fWeekV6"
                    type="date"
                    value="${escapeRecordFormV6(getCurrentWeekStart())}"
                >
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

/**
 * Lưu record sau khi form V6 đã xác thực category + criteria.
 */
async function submitCompetitionV6() {
    const studentId = document.getElementById('fStudentV6')?.value;
    const week = document.getElementById('fWeekV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';

    if (!studentId || !week || !date || !categoryId || !criteriaId) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return;
    }

    if (!RECORD_FORM_V6_SCORES.includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return;
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
        return;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return;
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
        return;
    }

    closeModal();

    await renderStudents();
    await renderCompetition();
    await renderDashboard();
}

/**
 * Replace the legacy form entry point after app.js has loaded.
 */
window.openCompetitionForm = openCompetitionFormV6;

window.CompetitionRecordFormV6 = {
    RECORD_FORM_V6_SCORES,
    buildRecordGroupOptionsV6,
    buildRecordScoreOptionsV6,
    filterRecordFormCriteriaV6,
    buildRecordCriteriaOptionsV6,
};
