/**
 * FILE: competition-criteria-settings-v6.js
 *
 * Mục đích:
 * Quản lý giao diện và thao tác CRUD cho các criteria nhỏ thuộc
 * 6 category của module Thi đua.
 *
 * Nguyên tắc:
 * - Category luôn lấy từ competition_categories.
 * - Criteria thuộc một category thông qua category_id.
 * - Criteria đã từng được dùng trong competition_records chỉ được soft delete.
 * - Criteria chưa từng có dữ liệu có thể bị xóa vật lý.
 * - Category 6 không có đường xóa category trong module này.
 * - Không thay thế source-of-truth competition_records.
 *
 * Compatibility:
 * - app.js vẫn chứa form legacy.
 * - Module này chỉ cung cấp settings UI và bridge vào form legacy.
 */

const CRITERIA_V6_SUPABASE_CONFIG = {
    url: 'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    anonKey:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

const criteriaV6Supabase = window.supabase.createClient(
    CRITERIA_V6_SUPABASE_CONFIG.url,
    CRITERIA_V6_SUPABASE_CONFIG.anonKey,
);

let criteriaSettingsCategoryIdV6 = 1;
let criteriaSettingsRowsV6 = [];
let criteriaSettingsInitializedV6 = false;

/**
 * Lấy category từ module Category V6.
 *
 * Nếu module Category chưa sẵn sàng, trả về mảng rỗng để UI không lỗi.
 */
function getCriteriaSettingsCategoriesV6() {
    if (
        window.CompetitionCategoryV6 &&
        typeof window.CompetitionCategoryV6
            .getActiveCompetitionCategoriesV6 === 'function'
    ) {
        return window.CompetitionCategoryV6
            .getActiveCompetitionCategoriesV6();
    }

    return [];
}

/**
 * Escape HTML để dữ liệu từ database không được chèn trực tiếp vào DOM.
 */
function escapeCriteriaSettingsHtmlV6(value) {
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
 * Lấy danh sách category và bảo đảm category đang chọn vẫn hợp lệ.
 */
function normalizeCriteriaSettingsCategoryV6() {
    const categories = getCriteriaSettingsCategoriesV6();

    if (!categories.length) {
        criteriaSettingsCategoryIdV6 = 1;
        return categories;
    }

    const exists = categories.some(
        (category) =>
            Number(category.id) ===
            Number(criteriaSettingsCategoryIdV6),
    );

    if (!exists) {
        criteriaSettingsCategoryIdV6 = Number(
            categories[0].id,
        );
    }

    return categories;
}

/**
 * Tải criteria của một category.
 *
 * Criteria inactive vẫn được tải để GVCN có thể bật lại hoặc xem trạng thái.
 */
async function loadCriteriaSettingsRowsV6() {
    const categoryId = Number(criteriaSettingsCategoryIdV6);

    const { data, error } = await criteriaV6Supabase
        .from('competition_criteria')
        .select(
            'id, name, points, type, active, sort_order, category_id, group_name, default_score',
        )
        .eq('category_id', categoryId)
        .order('sort_order', {
            ascending: true,
        })
        .order('created_at', {
            ascending: true,
        });

    if (error) {
        throw error;
    }

    criteriaSettingsRowsV6 = data || [];

    return criteriaSettingsRowsV6;
}

/**
 * Tạo nút chuyển category bằng chính dữ liệu database.
 */
function renderCriteriaSettingsTabsV6() {
    const tabs = document.getElementById(
        'criteriaSettingsTabsV6',
    );

    if (!tabs) {
        return;
    }

    const categories = normalizeCriteriaSettingsCategoryV6();

    tabs.innerHTML = categories
        .map((category) => {
            const active =
                Number(category.id) ===
                Number(criteriaSettingsCategoryIdV6);

            return `
                <button
                    class="btn small ${active ? 'primary' : ''}"
                    type="button"
                    data-criteria-category="${escapeCriteriaSettingsHtmlV6(category.id)}"
                >
                    ${escapeCriteriaSettingsHtmlV6(category.id)}.
                    ${escapeCriteriaSettingsHtmlV6(category.name)}
                </button>
            `;
        })
        .join('');
}

/**
 * Định dạng điểm mặc định theo quy tắc V6.
 */
function formatCriteriaDefaultScoreV6(row) {
    if (row.default_score !== null && row.default_score !== undefined) {
        const score = Number(row.default_score);
        return score > 0 ? `+${score}` : String(score);
    }

    const score = Number(row.points || 0);
    const signed = row.type === 'minus' ? -Math.abs(score) : Math.abs(score);

    return signed > 0 ? `+${signed}` : String(signed);
}

/**
 * Render danh sách criteria đang chọn.
 */
function renderCriteriaSettingsListV6() {
    const list = document.getElementById(
        'criteriaSettingsListV6',
    );

    if (!list) {
        return;
    }

    const categories = getCriteriaSettingsCategoriesV6();
    const category = categories.find(
        (item) =>
            Number(item.id) ===
            Number(criteriaSettingsCategoryIdV6),
    );

    const title = document.getElementById(
        'criteriaSettingsSelectedTitleV6',
    );

    if (title) {
        title.textContent = category
            ? `Nhóm ${category.id}: ${category.name}`
            : 'Cài đặt tiêu chí';
    }

    if (!criteriaSettingsRowsV6.length) {
        list.innerHTML = `
            <div class="notice">
                <b>Chưa có tiêu chí.</b>
                <div class="mini">
                    Hãy thêm tiêu chí đầu tiên cho nhóm này.
                </div>
            </div>
        `;
        return;
    }

    list.innerHTML = criteriaSettingsRowsV6
        .map((row) => {
            const status = row.active ? 'Đang dùng' : 'Đã tắt';
            const statusClass = row.active ? 'pill' : 'pill';
            const toggleLabel = row.active ? 'Tắt' : 'Bật';

            return `
                <div class="notice criteria-settings-row-v6">
                    <div class="section-title">
                        <div>
                            <b>${escapeCriteriaSettingsHtmlV6(row.name)}</b>
                            <div class="mini">
                                Điểm mặc định:
                                <b>${escapeCriteriaSettingsHtmlV6(formatCriteriaDefaultScoreV6(row))}</b>
                            </div>
                        </div>
                        <span class="${statusClass}">
                            ${escapeCriteriaSettingsHtmlV6(status)}
                        </span>
                    </div>
                    <div class="actions">
                        <button
                            class="btn small"
                            type="button"
                            data-criteria-edit="${escapeCriteriaSettingsHtmlV6(row.id)}"
                        >
                            Sửa
                        </button>
                        <button
                            class="btn small"
                            type="button"
                            data-criteria-toggle="${escapeCriteriaSettingsHtmlV6(row.id)}"
                        >
                            ${toggleLabel}
                        </button>
                        <button
                            class="btn small danger"
                            type="button"
                            data-criteria-delete="${escapeCriteriaSettingsHtmlV6(row.id)}"
                        >
                            Xóa
                        </button>
                    </div>
                </div>
            `;
        })
        .join('');
}

/**
 * Render toàn bộ khu vực Cài đặt tiêu chí.
 */
async function renderCriteriaSettingsV6() {
    const box = document.getElementById('criteriaSettings');

    if (!box) {
        return;
    }

    normalizeCriteriaSettingsCategoryV6();

    box.innerHTML = `
        <div class="criteria-settings-v6">
            <div id="criteriaSettingsTabsV6" class="actions"></div>
            <div class="notice">
                <div class="section-title">
                    <h3 id="criteriaSettingsSelectedTitleV6">
                        Cài đặt tiêu chí
                    </h3>
                    <button
                        id="criteriaSettingsAddButtonV6"
                        class="btn primary"
                        type="button"
                    >
                        + Thêm tiêu chí
                    </button>
                </div>
                <div id="criteriaSettingsListV6"></div>
            </div>
        </div>
    `;

    renderCriteriaSettingsTabsV6();

    try {
        await loadCriteriaSettingsRowsV6();
        renderCriteriaSettingsListV6();
    } catch (error) {
        console.error(
            '[Competition V6] Không thể tải criteria settings:',
            error,
        );

        const list = document.getElementById(
            'criteriaSettingsListV6',
        );

        if (list) {
            list.innerHTML = `
                <div class="notice danger">
                    Không tải được danh sách tiêu chí.
                    Vui lòng thử lại.
                </div>
            `;
        }
    }

    bindCriteriaSettingsEventsV6();
}

/**
 * Chuyển category và tải lại criteria tương ứng.
 */
async function selectCriteriaSettingsCategoryV6(categoryId) {
    criteriaSettingsCategoryIdV6 = Number(categoryId);

    renderCriteriaSettingsTabsV6();

    try {
        await loadCriteriaSettingsRowsV6();
        renderCriteriaSettingsListV6();
    } catch (error) {
        console.error(
            '[Competition V6] Không thể tải criteria:',
            error,
        );
    }
}

/**
 * Đọc một criteria cụ thể.
 */
async function getCriteriaSettingsRowV6(id) {
    const { data, error } = await criteriaV6Supabase
        .from('competition_criteria')
        .select(
            'id, name, points, type, active, sort_order, category_id, group_name, default_score',
        )
        .eq('id', id)
        .single();

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Hiển thị form Add/Edit dùng chung.
 */
function openCriteriaSettingsEditorV6(row = null) {
    const categoryId = Number(
        row?.category_id || criteriaSettingsCategoryIdV6,
    );

    const currentScore = row
        ? Number(
              row.default_score ??
                  (row.type === 'minus'
                      ? -Math.abs(Number(row.points))
                      : Math.abs(Number(row.points))),
          )
        : 1;

    const scoreOptions = [
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
    ]
        .map((score) => {
            const selected =
                Number(currentScore) === score
                    ? ' selected'
                    : '';
            const label = score > 0 ? `+${score}` : String(score);

            return `<option value="${score}"${selected}>${label} điểm</option>`;
        })
        .join('');

    const title = row
        ? 'Sửa tiêu chí'
        : 'Thêm tiêu chí';
    const buttonLabel = row ? 'Lưu thay đổi' : 'Thêm tiêu chí';

    openModal(
        title,
        `
            <div class="field">
                <label for="criteriaV6Name">Tên tiêu chí</label>
                <input
                    id="criteriaV6Name"
                    value="${escapeCriteriaSettingsHtmlV6(row?.name || '')}"
                    placeholder="Ví dụ: Hoàn thành bài tập"
                >
            </div>
            <div class="field">
                <label for="criteriaV6Category">Nhóm tiêu chí</label>
                <select id="criteriaV6Category">
                    ${getCriteriaSettingsCategoriesV6()
                        .map((category) => {
                            const selected =
                                Number(category.id) === categoryId
                                    ? ' selected'
                                    : '';

                            return `
                                <option
                                    value="${escapeCriteriaSettingsHtmlV6(category.id)}"
                                    ${selected}
                                >
                                    ${escapeCriteriaSettingsHtmlV6(category.id)}.
                                    ${escapeCriteriaSettingsHtmlV6(category.name)}
                                </option>
                            `;
                        })
                        .join('')}
                </select>
            </div>
            <div class="field">
                <label for="criteriaV6Score">
                    Mức điểm mặc định
                </label>
                <select id="criteriaV6Score">
                    ${scoreOptions}
                </select>
            </div>
            <div class="actions">
                <button
                    class="btn"
                    type="button"
                    onclick="closeModal()"
                >
                    Hủy
                </button>
                <button
                    class="btn primary"
                    type="button"
                    id="criteriaV6SaveButton"
                >
                    ${buttonLabel}
                </button>
            </div>
        `,
    );

    const saveButton = document.getElementById(
        'criteriaV6SaveButton',
    );

    if (!saveButton) {
        return;
    }

    saveButton.addEventListener('click', async () => {
        await saveCriteriaSettingsV6(row?.id || null);
    });
}

/**
 * Lưu criteria mới hoặc cập nhật criteria hiện có.
 */
async function saveCriteriaSettingsV6(existingId = null) {
    const name = document
        .getElementById('criteriaV6Name')
        ?.value.trim();
    const categoryId = Number(
        document.getElementById('criteriaV6Category')?.value,
    );
    const score = Number(
        document.getElementById('criteriaV6Score')?.value,
    );

    const validScores = [
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

    if (!name) {
        alert('Vui lòng nhập tên tiêu chí.');
        return;
    }

    if (
        !Number.isInteger(categoryId) ||
        categoryId < 1 ||
        categoryId > 6
    ) {
        alert('Nhóm tiêu chí không hợp lệ.');
        return;
    }

    if (!validScores.includes(score)) {
        alert('Điểm phải là -5…-1 hoặc +1…+5.');
        return;
    }

    const basePayload = {
        name,
        category_id: categoryId,
        group_name: String(categoryId),
        points: Math.abs(score),
        type: score < 0 ? 'minus' : 'plus',
        default_score: score,
        updated_at: new Date().toISOString(),
    };

    let error = null;

    if (existingId) {
        ({ error } = await criteriaV6Supabase
            .from('competition_criteria')
            .update(basePayload)
            .eq('id', existingId));
    } else {
        const maxSort = Math.max(
            0,
            ...criteriaSettingsRowsV6.map(
                (row) => Number(row.sort_order || 0),
            ),
        );

        ({ error } = await criteriaV6Supabase
            .from('competition_criteria')
            .insert({
                ...basePayload,
                active: true,
                sort_order: maxSort + 1,
            }));
    }

    if (error) {
        console.error(
            '[Competition V6] Không thể lưu criteria:',
            error,
        );
        alert(
            'Không thể lưu tiêu chí. ' +
                (error.message || 'Vui lòng thử lại.'),
        );
        return;
    }

    closeModal();
    await loadCriteriaSettingsRowsV6();
    renderCriteriaSettingsListV6();
}

/**
 * Kiểm tra criteria đã từng được dùng trong lịch sử hay chưa.
 */
async function criteriaHasHistoryV6(criteriaId) {
    const { count, error } = await criteriaV6Supabase
        .from('competition_records')
        .select('id', {
            count: 'exact',
            head: true,
        })
        .eq('criteria_id', criteriaId);

    if (error) {
        throw error;
    }

    return Number(count || 0) > 0;
}

/**
 * Bật/tắt criteria mà không xóa lịch sử.
 */
async function toggleCriteriaSettingsV6(id) {
    let row;

    try {
        row = await getCriteriaSettingsRowV6(id);
    } catch (error) {
        alert('Không tìm thấy tiêu chí.');
        return;
    }

    const { error } = await criteriaV6Supabase
        .from('competition_criteria')
        .update({
            active: !row.active,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        alert(
            'Không thể cập nhật trạng thái. ' +
                (error.message || ''),
        );
        return;
    }

    await loadCriteriaSettingsRowsV6();
    renderCriteriaSettingsListV6();
}

/**
 * Xóa criteria theo quy tắc soft delete / hard delete đã chốt.
 */
async function deleteCriteriaSettingsV6(id) {
    let row;

    try {
        row = await getCriteriaSettingsRowV6(id);
    } catch (error) {
        alert('Không tìm thấy tiêu chí.');
        return;
    }

    const hasHistory = await criteriaHasHistoryV6(id);

    if (hasHistory) {
        const confirmed = confirm(
            `Tiêu chí "${row.name}" đã có dữ liệu lịch sử.\n\n` +
                'Hệ thống sẽ TẮT tiêu chí thay vì xóa khỏi database.\n\n' +
                'Tiếp tục?',
        );

        if (!confirmed) {
            return;
        }

        const { error } = await criteriaV6Supabase
            .from('competition_criteria')
            .update({
                active: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (error) {
            alert(
                'Không thể tắt tiêu chí. ' +
                    (error.message || ''),
            );
            return;
        }
    } else {
        const confirmed = confirm(
            `Xóa tiêu chí "${row.name}" khỏi database?\n\n` +
                'Tiêu chí này chưa từng có dữ liệu lịch sử.',
        );

        if (!confirmed) {
            return;
        }

        const { error } = await criteriaV6Supabase
            .from('competition_criteria')
            .delete()
            .eq('id', id);

        if (error) {
            alert(
                'Không thể xóa tiêu chí. ' +
                    (error.message || ''),
            );
            return;
        }
    }

    await loadCriteriaSettingsRowsV6();
    renderCriteriaSettingsListV6();
}

/**
 * Gắn event cho toàn bộ khu vực settings.
 */
function bindCriteriaSettingsEventsV6() {
    if (criteriaSettingsInitializedV6) {
        return;
    }

    const box = document.getElementById('criteriaSettings');

    if (!box) {
        return;
    }

    criteriaSettingsInitializedV6 = true;

    box.addEventListener('click', async (event) => {
        const categoryButton = event.target.closest(
            '[data-criteria-category]',
        );
        const editButton = event.target.closest(
            '[data-criteria-edit]',
        );
        const toggleButton = event.target.closest(
            '[data-criteria-toggle]',
        );
        const deleteButton = event.target.closest(
            '[data-criteria-delete]',
        );
        const addButton = event.target.closest(
            '#criteriaSettingsAddButtonV6',
        );

        if (categoryButton) {
            await selectCriteriaSettingsCategoryV6(
                categoryButton.dataset.criteriaCategory,
            );
            return;
        }

        if (addButton) {
            openCriteriaSettingsEditorV6();
            return;
        }

        if (editButton) {
            try {
                const row = await getCriteriaSettingsRowV6(
                    editButton.dataset.criteriaEdit,
                );
                openCriteriaSettingsEditorV6(row);
            } catch (error) {
                alert('Không thể tải tiêu chí.');
            }
            return;
        }

        if (toggleButton) {
            await toggleCriteriaSettingsV6(
                toggleButton.dataset.criteriaToggle,
            );
            return;
        }

        if (deleteButton) {
            await deleteCriteriaSettingsV6(
                deleteButton.dataset.criteriaDelete,
            );
        }
    });
}

/**
 * Xóa các card criteria dư trong modal Ghi nhận.
 *
 * UI chính thức chỉ dùng Nhóm tiêu chí + Tiêu chí dropdown.
 */
function removeLegacyCompetitionCriteriaCardsV6() {
    const body = document.getElementById('modalBody');

    if (!body) {
        return;
    }

    body.querySelectorAll('.criteria-group').forEach((node) => {
        node.remove();
    });
}

/**
 * Sau khi mở form Ghi nhận, bỏ UI criteria card legacy dư thừa.
 */
function installCompetitionFormCleanupV6() {
    const original = window.openCompetitionForm;

    if (typeof original !== 'function') {
        return;
    }

    window.openCompetitionForm = function openCompetitionFormV6Clean() {
        const result = original();

        window.setTimeout(() => {
            removeLegacyCompetitionCriteriaCardsV6();
        }, 0);

        return result;
    };
}

/**
 * Khởi tạo module settings khi DOM sẵn sàng.
 */
function initCompetitionCriteriaSettingsV6() {
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            () => {
                renderCriteriaSettingsV6();
                installCompetitionFormCleanupV6();
            },
            {
                once: true,
            },
        );
        return;
    }

    renderCriteriaSettingsV6();
    installCompetitionFormCleanupV6();
}

initCompetitionCriteriaSettingsV6();

window.CompetitionCriteriaSettingsV6 = {
    render: renderCriteriaSettingsV6,
    selectCategory: selectCriteriaSettingsCategoryV6,
    add: () => openCriteriaSettingsEditorV6(),
    edit: (id) =>
        getCriteriaSettingsRowV6(id).then(
            (row) => openCriteriaSettingsEditorV6(row),
        ),
    toggle: toggleCriteriaSettingsV6,
    remove: deleteCriteriaSettingsV6,
};
