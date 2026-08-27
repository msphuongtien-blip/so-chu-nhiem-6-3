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
 * - Lỗi của một module không được làm mất dữ liệu đã tải của module khác.
 *
 * Lưu ý kiến trúc:
 * app.js được tải trước file này. File này capture các function V5 đã tồn tại
 * rồi mới thay reference qua window.*. Không khai báo lại function global cùng
 * tên trong script riêng vì dễ tạo recursion/hoisting ngoài ý muốn.
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
 * Render một module độc lập và không để lỗi của module đó chặn module khác.
 */
async function safeRenderV6(name, renderer) {
    try {
        await renderer();
    } catch (error) {
        console.error('[V6 bootstrap] Module lỗi: ' + name, error);
    }
}

/**
 * Bootstrap an toàn cho dữ liệu cốt lõi.
 *
 * Đây là điểm sửa trực tiếp cho lỗi giao diện hiển thị 0 học sinh:
 * loadAll V5 dùng Promise.all nên chỉ cần một truy vấn phụ lỗi là toàn bộ
 * hàm bị reject. V6 tải students trước, sau đó render từng module độc lập.
 * Vì vậy lỗi competition_categories, competition_records hoặc một module
 * phụ không thể làm mất dữ liệu students đã tải thành công.
 */
const originalLoadAllV5 = window.loadAll;
if (typeof originalLoadAllV5 === 'function') {
    window.loadAll = async function loadAllV6() {
        await ensureCompetitionCategoriesV6();

        await safeRenderV6('class_settings', async () => {
            await window.loadSettings();
        });

        if (window.role !== 'teacher') {
            await safeRenderV6('student', async () => {
                await window.renderStudentAll();
            });
            return true;
        }

        // Students là dữ liệu nền của toàn bộ hệ thống, nên tải trước.
        await safeRenderV6('students_data', async () => {
            await window.loadStudentsFromSupabase();
        });

        // Lịch sử thi đua là nguồn dữ liệu riêng; lỗi của nó không chặn students.
        await safeRenderV6('competition_history', async () => {
            await window.loadCompetitionHistoryFromSupabase();
        });

        const modules = [
            ['students', window.renderStudents],
            ['dashboard', window.renderDashboard],
            ['attendance', window.renderAttendance],
            ['competition', window.renderCompetition],
            ['honors', window.renderHonors],
            ['discipline', window.renderDiscipline],
            ['learning', window.renderLearning],
            ['teams', window.renderTeams],
            ['alerts', window.renderAlerts],
            ['teacher_feedback', window.renderTeacherFeedback],
            ['teacher_messages', window.renderTeacherMessages],
        ];

        for (const [name, renderer] of modules) {
            if (typeof renderer === 'function') {
                await safeRenderV6(name, renderer);
            }
        }

        return true;
    };
}

/**
 * Capture renderCompetition V5 và thêm bước tải category.
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
 * Thay categoryName của V5 bằng dữ liệu database khi category đã tải được.
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
 * Thay scoreOptions của V5 bằng tập điểm chuẩn V6.
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
