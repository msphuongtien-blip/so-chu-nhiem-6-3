/**
 * FILE: competition-v6-category.js
 *
 * Mục đích:
 * Cung cấp lớp tương thích cho Category V6 của module Thi đua.
 *
 * Nguyên tắc:
 * - Category được đọc từ bảng competition_categories của Supabase.
 * - Không hard-code danh sách category 1–6 trong logic nghiệp vụ.
 * - Category 6 (Học tập) dùng cùng một luồng như các category khác.
 * - Không để lỗi của lớp Category làm dừng bootstrap của toàn website.
 *
 * Lưu ý kiến trúc:
 * app.js được tải trước file này. Vì vậy file này chỉ capture các function
 * V5 đã tồn tại rồi mới gắn wrapper qua window.*. Không khai báo lại function
 * global bằng cùng tên trong script riêng, vì cách đó dễ tạo recursion/hoisting
 * ngoài ý muốn và làm toàn bộ dashboard không tải dữ liệu.
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

let competitionCategoriesV6 = [];

/**
 * Tải toàn bộ category hiện có từ Supabase.
 */
async function loadCompetitionCategoriesV6() {
    if (!window.sb) {
        throw new Error('Supabase client chưa được khởi tạo.');
    }

    const { data, error } = await window.sb
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
 * Lỗi category chỉ được ghi log; không được làm hỏng bootstrap của app.
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
 * Trả về category đang active để dùng cho thao tác mới.
 */
function getActiveCompetitionCategoriesV6() {
    return competitionCategoriesV6.filter(
        (category) => category.active !== false,
    );
}

/**
 * Lấy tên category từ dữ liệu đã tải từ database.
 */
function getCompetitionCategoryNameV6(id) {
    const category = competitionCategoriesV6.find(
        (item) => String(item.id) === String(id),
    );

    return category?.name || 'Không xác định';
}

/**
 * Tạo option HTML cho category mà không hard-code ID.
 */
function competitionCategoryOptionsV6(selectedId = '') {
    return getActiveCompetitionCategoriesV6()
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
        })
        .join('');
}

/**
 * Tạo option cho đúng tập điểm được phép của module Thi đua.
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
 * Gắn category layer vào app V5 sau khi app.js đã được thực thi hoàn tất.
 *
 * Đây là wrapper an toàn:
 * 1. Capture function cũ.
 * 2. Gắn function mới qua window.*.
 * 3. Function mới gọi function cũ thay vì tự gọi chính nó.
 */
const originalLoadAllV5 = window.loadAll;
if (typeof originalLoadAllV5 === 'function') {
    window.loadAll = async function loadAllV6() {
        await ensureCompetitionCategoriesV6();
        return originalLoadAllV5();
    };
}

const originalRenderCompetitionV5 = window.renderCompetition;
if (typeof originalRenderCompetitionV5 === 'function') {
    window.renderCompetition = async function renderCompetitionV6() {
        await ensureCompetitionCategoriesV6();
        renderCompetitionCategoryFilterV6();
        return originalRenderCompetitionV5();
    };
}

/**
 * Thay categoryName của app V5 bằng phiên bản đọc từ database.
 */
const originalCategoryNameV5 = window.categoryName;
if (typeof originalCategoryNameV5 === 'function') {
    window.categoryName = function categoryNameV6(id) {
        const name = getCompetitionCategoryNameV6(id);

        return name !== 'Không xác định'
            ? name
            : originalCategoryNameV5(id);
    };
}

/**
 * Thay scoreOptions của app V5 bằng tập điểm chuẩn V6.
 */
if (typeof window.scoreOptions === 'function') {
    window.scoreOptions = function scoreOptionsV6Wrapper(selected) {
        return scoreOptionsV6(selected);
    };
}

/**
 * Render bộ lọc category theo dữ liệu Supabase.
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
