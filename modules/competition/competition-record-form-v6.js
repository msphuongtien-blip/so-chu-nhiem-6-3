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
/**
 * Tính thứ Hai của tuần chứa ngày được chọn bằng resolver canonical của Core.
 *
 * Date-only được xử lý thống nhất qua YYYY-MM-DD, không dùng local Date,
 * để tránh lệch ngày/tuần do timezone.
 *
 * @param {string} dateValue Ngày dạng YYYY-MM-DD.
 * @returns {string} Ngày thứ Hai đầu tuần hoặc chuỗi rỗng nếu không hợp lệ.
 */
function getRecordFormWeekFromDateV6(dateValue) {
    if (
        typeof dateValue !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
        return '';
    }

    if (typeof compWeekStart !== 'function') {
        return '';
    }

    return compWeekStart(dateValue);
}

async function openCompetitionFormV6() {
    if (typeof ensureCompetitionCategoriesV6 === 'function') {
        await ensureCompetitionCategoriesV6();
    }

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

    /*
     * Ghi nhận is opened from the currently selected week. Default the date
     * to that week's Monday instead of silently switching to today's week.
     * The teacher can still choose another date inside the week.
     */
    const selectedWeek =
        typeof window.compWeekInput === 'function'
            ? window.compWeekInput()
            : getRecordFormWeekFromDateV6(localDate());
    const defaultRecordDate =
        selectedWeek || localDate();
    const selectedWeekEnd = (() => {
        const date = new Date(
            (selectedWeek || defaultRecordDate) + 'T00:00:00Z',
        );
        date.setUTCDate(date.getUTCDate() + 6);
        return date.toISOString().slice(0, 10);
    })();
    const selectedWeekLabel =
        typeof compWeekRange === 'function'
            ? compWeekRange(selectedWeek || defaultRecordDate)
            : selectedWeek || defaultRecordDate;

    openModal(
        'Ghi nhận thi đua',
        `
            <div class="field">
                <label>Học sinh</label>
                ${typeof globalThis.buildStudentPickerMarkupV6 === 'function' ? globalThis.buildStudentPickerMarkupV6() : '<div class="notice danger">Bộ chọn học sinh chưa sẵn sàng. Vui lòng thử lại.</div>'}
            </div>

            <div class="field">
                <label>Ngày ghi nhận</label>
                <div class="mini">${escapeRecordFormV6(selectedWeekLabel)}</div>
                <input
                    id="fDateV6"
                    type="date"
                    min="${escapeRecordFormV6(selectedWeek || defaultRecordDate)}"
                    max="${escapeRecordFormV6(selectedWeekEnd)}"
                    value="${escapeRecordFormV6(defaultRecordDate)}"
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

    if (typeof bindStudentPickerEventsV6 === 'function') {
        bindStudentPickerEventsV6();
    }

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
    const studentIds =
        typeof getCompetitionRecordSelectedStudentsV6 === 'function'
            ? getCompetitionRecordSelectedStudentsV6()
            : String(
                  document.getElementById('fStudentV6')?.value || '',
              )
                  .split(',')
                  .filter(Boolean);

    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note =
        document.getElementById('fNoteV6')?.value.trim() || '';
    const week = getRecordFormWeekFromDateV6(date);

    if (
        !studentIds.length ||
        !date ||
        !categoryId ||
        !criteriaId ||
        !week
    ) {
        globalThis.SNNotification?.error(
            'Vui lòng chọn ít nhất một học sinh, nhóm và tiêu chí.',
        );
        return false;
    }

    if (!RECORD_FORM_V6_SCORES.includes(points)) {
        globalThis.SNNotification?.error(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
        );
        return false;
    }

    const {
        data: selectedCriteria,
        error,
    } = await recordFormV6Supabase
        .from('competition_criteria')
        .select(
            'id, name, active, category_id, group_name',
        )
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        globalThis.SNNotification?.error(
            'Không tìm thấy tiêu chí đã chọn.',
        );
        return false;
    }

    const categoryMatches =
        String(selectedCriteria.category_id ?? '') ===
            String(categoryId) ||
        String(selectedCriteria.group_name ?? '') ===
            String(categoryId);

    if (!selectedCriteria.active || !categoryMatches) {
        globalThis.SNNotification?.error(
            'Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.',
        );
        return false;
    }

    const service = globalThis.CompetitionRecordServiceV6;

    if (typeof service?.saveCompetitionRecordsV6 !== 'function') {
        globalThis.SNNotification?.error(
            'Module lưu Ghi nhận chưa sẵn sàng. Vui lòng thử lại.',
        );
        return false;
    }

    const loading = globalThis.SNNotification?.loading(
        'Đang lưu ghi nhận cho ' +
            studentIds.length +
            ' học sinh...',
    );

    try {
        const result = await service.saveCompetitionRecordsV6({
            studentIds,
            points,
            criteria: selectedCriteria,
            note,
            categoryId: Number(categoryId),
            week,
            date,
            createdBy: globalThis.currentUser?.id,
        });

        if (!result.ok) {
            globalThis.SNNotification?.error(result.message || 'Không thể lưu ghi nhận.');
            return false;
        }

        closeModal();
        globalThis.SNNotification?.success(
            'Đã ghi nhận cho ' + studentIds.length + ' học sinh.',
        );
        return true;
    } catch (submitError) {
        console.error(
            '[Competition V6] Bulk submit failed:',
            submitError,
        );
        globalThis.SNNotification?.error(
            'Không thể lưu ghi nhận. Vui lòng thử lại.',
        );
        return false;
    } finally {
        loading?.close();
    }
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


