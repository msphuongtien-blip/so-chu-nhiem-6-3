/**
 * FILE: competition-v6-category.js
 *
 * Mục đích:
 * Bổ sung nền tảng Category V6 cho module Thi đua mà không thay đổi
 * responsibility của app.js.
 *
 * Nguyên tắc:
 * - Category được đọc từ bảng competition_categories hiện có.
 * - Category 6 (Học tập) dùng cùng một đường dữ liệu với 5 category còn lại.
 * - Không hard-code danh sách category trong logic nghiệp vụ.
 * - Không tự quyết định tài khoản là Teacher hay Student.
 * - Không thay thế calculation engine của V5 ở Task 1.
 *
 * Quan trọng:
 * `sb` trong app.js là biến `let` ở global lexical scope nên không nằm
 * trên `window`. Module này dùng một Supabase client riêng trong giai đoạn
 * tương thích để không phụ thuộc vào biến global nội bộ của app.js.
 * Việc hợp nhất client dùng chung sẽ được xử lý ở bước refactor architecture.
 */

const V6_VALID_SCORES = [
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

const V6_SUPABASE_CONFIG = {
    url:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    anonKey:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

const v6Supabase = window.supabase.createClient(
    V6_SUPABASE_CONFIG.url,
    V6_SUPABASE_CONFIG.anonKey,
);

let competitionCategoriesV6 = [];

/**
 * Tải category từ database hiện tại.
 *
 * Hàm này chỉ đọc dữ liệu cấu hình. Không tạo hoặc cập nhật category.
 */
async function loadCompetitionCategoriesV6() {
    const { data, error } = await v6Supabase
        .from('competition_categories')
        .select('id, name, active, sort_order')
        .order('sort_order', {
            ascending: true,
        })
        .order('id', {
            ascending: true,
        });

    if (error) {
        throw error;
    }

    competitionCategoriesV6 = data || [];

    return competitionCategoriesV6;
}

/**
 * Tải category theo kiểu best-effort.
 *
 * Nếu truy vấn category thất bại, không được làm hỏng bootstrap của toàn app.
 */
async function ensureCompetitionCategoriesV6() {
    try {
        await loadCompetitionCategoriesV6();
        return true;
    } catch (error) {
        console.error(
            '[Competition V6] Không thể tải competition_categories:',
            error,
        );

        competitionCategoriesV6 = [];
        return false;
    }
}

/**
 * Lấy các category đang active.
 */
function getActiveCompetitionCategoriesV6() {
    return competitionCategoriesV6.filter(
        (category) => category.active !== false,
    );
}

/**
 * Lấy tên category theo ID từ dữ liệu database đã tải.
 */
function getCompetitionCategoryNameV6(id) {
    const category = competitionCategoriesV6.find(
        (item) => String(item.id) === String(id),
    );

    return category?.name || '';
}

/**
 * Tạo option HTML cho danh sách category từ một tập category cụ thể.
 *
 * Hàm này được expose cho test và các module V6 khác. Khi render runtime,
 * dữ liệu được lấy trực tiếp từ `competition_categories`.
 */
function buildCompetitionCategoryOptionsV6(
    categories,
    selectedId = '',
) {
    return (categories || [])
        .filter((category) => category.active !== false)
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
                esc(category.id) +
                '"' +
                selected +
                '>' +
                esc(category.id) +
                '. ' +
                esc(category.name) +
                '</option>'
            );
        });
}

/**
 * Tạo option HTML cho danh sách category hiện đang được tải.
 */
function competitionCategoryOptionsV6(selectedId = '') {
    return buildCompetitionCategoryOptionsV6(
        competitionCategoriesV6,
        selectedId,
    ).join('');
}

/**
 * Tạo option cho tập điểm được phép trong V6.
 *
 * Zero cố ý không xuất hiện.
 */
function scoreOptionsV6(selected = 1) {
    return V6_VALID_SCORES
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
 * Chỉ bổ sung category vào luồng bootstrap hiện tại.
 *
 * Không tự kiểm tra `window.role` vì `role` trong app.js không nằm trên
 * window. Quyết định Teacher/Student vẫn thuộc về loadAll() của app.js.
 */
const originalLoadAllV5 = window.loadAll;
if (typeof originalLoadAllV5 === 'function') {
    window.loadAll = async function loadAllV6() {
        // Category là dữ liệu bổ trợ; lỗi của nó không được chặn app.
        await ensureCompetitionCategoriesV6();

        // Gọi đúng bootstrap V5 đã tồn tại, tránh duplicate role logic.
        return originalLoadAllV5();
    };
}

/**
 * Bổ sung category database trước khi render màn hình Thi đua.
 */
const originalRenderCompetitionV5 = window.renderCompetition;
if (typeof originalRenderCompetitionV5 === 'function') {
    window.renderCompetition = async function renderCompetitionV6() {
        await ensureCompetitionCategoriesV6();
        renderCompetitionCategoryFilterV6();

        return originalRenderCompetitionV5();
    };
}

/**
 * Dùng tên category từ database thay cho mapping hard-code của V5.
 */
const originalCategoryNameV5 = window.categoryName;
if (typeof originalCategoryNameV5 === 'function') {
    window.categoryName = function categoryNameV6(id) {
        const name = getCompetitionCategoryNameV6(id);

        return name || originalCategoryNameV5(id);
    };
}

/**
 * Dùng tập score chuẩn V6 cho các form đang gọi scoreOptions().
 */
if (typeof window.scoreOptions === 'function') {
    window.scoreOptions = function scoreOptionsV6Wrapper(selected) {
        return scoreOptionsV6(selected);
    };
}

/**
 * Thay danh sách category trong một select hiện có.
 *
 * Đây là compatibility adapter cho các form V5. Không sao chép logic form;
 * chỉ thay options sau khi form đã render.
 */
function mountCategorySelectV6(
    select,
    selectedId = '',
) {
    if (!select) {
        return;
    }

    const currentValue = selectedId || select.value || '';

    select.innerHTML =
        '<option value="">-- Chọn nhóm --</option>' +
        competitionCategoryOptionsV6(currentValue);

    if (currentValue) {
        select.value = currentValue;
    }
}

/**
 * Thay các category group cards của form Ghi nhận bằng 6 category hiện tại.
 */
function mountCompetitionGroupCardsV6() {
    const body = document.getElementById('modalBody');

    if (!body) {
        return;
    }

    const groupContainer = body.querySelector('.criteria-group')?.parentElement;

    if (!groupContainer) {
        return;
    }

    const criteriaGroups = {};

    body.querySelectorAll('.criteria-group').forEach((group) => {
        const heading = group.querySelector('h4')?.textContent || '';
        const match = heading.match(/Nhóm\s+(\d+)/);

        if (match) {
            criteriaGroups[match[1]] = group;
        }
    });

    const generated = competitionCategoriesV6
        .filter((category) => category.active !== false)
        .map((category) => {
            const existing = criteriaGroups[String(category.id)];

            if (existing) {
                const heading = existing.querySelector('h4');

                if (heading) {
                    heading.textContent =
                        `Nhóm ${category.id}: ${category.name}`;
                }

                return existing.outerHTML;
            }

            return `
                <div class="criteria-group">
                    <h4>Nhóm ${category.id}: ${escapeHtmlV6(category.name)}</h4>
                    <div class="criteria-items">
                        <span class="mini">Chưa có tiêu chí.</span>
                    </div>
                </div>
            `;
        })
        .join('');

    groupContainer.innerHTML = generated;
}

/**
 * Escape HTML nội bộ để adapter không tạo HTML injection từ tên category.
 */
function escapeHtmlV6(value) {
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
 * Áp dụng 6 category cho các form V5 sau khi modal đã render.
 */
function refreshCompetitionCategoryControlsV6() {
    mountCompetitionGroupCardsV6();

    mountCategorySelectV6(
        document.getElementById('fGroup'),
    );

    mountCategorySelectV6(
        document.getElementById('eGroup'),
    );

    mountCategorySelectV6(
        document.getElementById('crGroup'),
    );
}

/**
 * Chờ một modal V5 render xong rồi áp dụng adapter.
 */
function applyCategoryAdapterAfterModalV6() {
    window.setTimeout(() => {
        refreshCompetitionCategoryControlsV6();
    }, 0);
}

/**
 * Bọc các hàm V5 có select category hard-code.
 *
 * Wrapper chỉ can thiệp vào DOM sau khi hàm cũ đã hoàn tất nhiệm vụ chính.
 */
const originalOpenCompetitionFormV5 = window.openCompetitionForm;
if (typeof originalOpenCompetitionFormV5 === 'function') {
    window.openCompetitionForm = function openCompetitionFormV6() {
        const result = originalOpenCompetitionFormV5();
        applyCategoryAdapterAfterModalV6();
        return result;
    };
}

const originalEditCompetitionRecordV5 = window.editCompetitionRecord;
if (typeof originalEditCompetitionRecordV5 === 'function') {
    window.editCompetitionRecord = async function editCompetitionRecordV6(id) {
        const result = await originalEditCompetitionRecordV5(id);
        applyCategoryAdapterAfterModalV6();
        return result;
    };
}

const originalEditCriteriaV5 = window.editCriteria;
if (typeof originalEditCriteriaV5 === 'function') {
    window.editCriteria = function editCriteriaV6(id) {
        const result = originalEditCriteriaV5(id);
        applyCategoryAdapterAfterModalV6();
        return result;
    };
}

const originalAddCriteriaV5 = window.addCriteria;
if (typeof originalAddCriteriaV5 === 'function') {
    window.addCriteria = function addCriteriaV6() {
        const result = originalAddCriteriaV5();
        applyCategoryAdapterAfterModalV6();
        return result;
    };
}

/**
 * Render bộ lọc category từ database.
 */
function renderCompetitionCategoryFilterV6() {
    const select = document.getElementById('compGroupFilter');

    if (!select || !competitionCategoriesV6.length) {
        return;
    }

    const currentValue = select.value;

    select.innerHTML =
        '<option value="">Tất cả nhóm</option>' +
        competitionCategoryOptionsV6(currentValue);

    if (currentValue) {
        select.value = currentValue;
    }
}

window.CompetitionCategoryV6 = {
    V6_VALID_SCORES,
    getActiveCompetitionCategoriesV6,
    getCompetitionCategoryNameV6,
    buildOptions: buildCompetitionCategoryOptionsV6,
    competitionCategoryOptionsV6,
    scoreOptionsV6,
    refreshCompetitionCategoryControlsV6,
};
