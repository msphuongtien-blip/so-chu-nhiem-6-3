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
            'id, name, type, points, active, sort_order, category_id, group_name, default_score',
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

function getRecordFormCriteriaDefaultScoreV6(criteria) {
    const value = Number(
        criteria?.default_score ??
            (criteria?.type === 'minus'
                ? -Math.abs(Number(criteria?.points))
                : Math.abs(Number(criteria?.points))),
    );

    return RECORD_FORM_V6_SCORES.includes(value) ? value : 1;
}

function refreshRecordFormCriteriaV6(criteria) {
    const groupSelect = document.getElementById('fGroupV6');
    const criteriaSelect = document.getElementById('fCriteriaV6');
    const pointsSelect = document.getElementById('fPointsV6');

    if (!groupSelect || !criteriaSelect) {
        return;
    }

    const matchingCriteria = filterRecordFormCriteriaV6(
        criteria,
        groupSelect.value,
    );

    criteriaSelect.innerHTML =
        buildRecordCriteriaOptionsV6(criteria, groupSelect.value) ||
        '<option value="">Chưa có tiêu chí trong nhóm này</option>';

    criteriaSelect.disabled = matchingCriteria.length === 0;

    if (pointsSelect) {
        pointsSelect.innerHTML = buildRecordScoreOptionsV6(
            getRecordFormCriteriaDefaultScoreV6(matchingCriteria[0]),
        );
        pointsSelect.disabled = matchingCriteria.length === 0;
    }
}

function refreshRecordFormSelectedCriteriaScoreV6(criteria) {
    const criteriaId =
        document.getElementById('fCriteriaV6')?.value || '';
    const selectedCriteria = criteria.find(
        item => String(item.id) === String(criteriaId),
    );
    const pointsSelect = document.getElementById('fPointsV6');

    if (pointsSelect && selectedCriteria) {
        pointsSelect.innerHTML = buildRecordScoreOptionsV6(
            getRecordFormCriteriaDefaultScoreV6(selectedCriteria),
        );
    }
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
        ?.addEventListener('change', () => {
            refreshRecordFormSelectedCriteriaScoreV6(criteria);
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
    getRecordFormCriteriaDefaultScoreV6,
    refreshRecordFormCriteriaV6,
    refreshRecordFormSelectedCriteriaScoreV6,
};


