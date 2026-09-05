/**
 * FILE: student-actions-v6-final.js
 *
 * Mục đích:
 * Bổ sung thao tác Xóa học sinh an toàn trong giai đoạn refactor từng phần.
 * C1 chỉ thêm khả năng xóa học sinh test chưa có dữ liệu nghiệp vụ; CRUD cũ
 * vẫn nằm trong app.js cho đến đợt tách Students chính thức.
 *
 * Trách nhiệm:
 * - Kiểm tra các bảng phụ thuộc students.id trước khi DELETE.
 * - Chặn xóa nếu học sinh đã có dữ liệu nghiệp vụ.
 * - Cho phép xóa thật học sinh test chưa phát sinh dữ liệu.
 * - Đọc lại dữ liệu sau DELETE để đồng bộ UI.
 *
 * Không chịu trách nhiệm:
 * - Xóa lịch sử nghiệp vụ.
 * - Xóa tài khoản Supabase Auth.
 * - Bypass RLS.
 */

const STUDENT_DEPENDENCY_TABLES = Object.freeze([
    'attendance',
    'competition_records',
    'competition_data_issues',
    'competition_weekly_snapshots',
    'honors',
]);

/**
 * Đếm dữ liệu liên quan của một học sinh trên toàn bộ bảng phụ thuộc.
 *
 * `Promise.all()` chạy các query độc lập song song. `head: true` giúp chỉ
 * nhận metadata số dòng, không tải nội dung nghiệp vụ về browser.
 *
 * @param {string} studentId UUID của học sinh.
 * @param {object} client Supabase client dùng chung.
 * @returns {Promise<object>} Map tên bảng → số bản ghi.
 * @throws {Error} Khi bất kỳ query nào thất bại.
 */
async function getStudentDependencyCounts(studentId, client) {
    const results = await Promise.all(
        STUDENT_DEPENDENCY_TABLES.map(async (tableName) => {
            const { count, error } = await client
                .from(tableName)
                .select('student_id', {
                    count: 'exact',
                    head: true,
                })
                .eq('student_id', studentId);

            if (error) {
                throw error;
            }

            return [tableName, count || 0];
        }),
    );

    return Object.fromEntries(results);
}

/**
 * Xóa học sinh nếu chưa có dữ liệu nghiệp vụ liên quan.
 *
 * Đây là hard delete có chủ đích cho học sinh test/chưa phát sinh lịch sử.
 * Nếu đã có dữ liệu, function dừng trước DELETE để bảo toàn lịch sử.
 * RLS của Supabase vẫn là lớp bảo vệ quyền cuối cùng.
 *
 * @param {string} studentId UUID của học sinh.
 * @returns {Promise<boolean>} true khi DELETE thành công.
 */
async function deleteStudent(studentId) {
    if (!studentId) {
        alert('Không xác định được học sinh cần xóa.');
        return false;
    }

    const client = globalThis.SNCoreSupabase?.client;

    if (!client) {
        alert('Supabase client chưa sẵn sàng.');
        return false;
    }

    try {
        const counts = await getStudentDependencyCounts(
            studentId,
            client,
        );

        const dependencies = Object.entries(counts)
            .filter(([, count]) => count > 0)
            .map(([tableName, count]) => `${tableName}: ${count}`);

        if (dependencies.length) {
            alert(
                'Không thể xóa học sinh vì đã có dữ liệu liên quan:\n\n' +
                dependencies.join('\n') +
                '\n\nDữ liệu lịch sử được bảo vệ và không bị cascade-xóa.',
            );
            return false;
        }

        const { error } = await client
            .from('students')
            .delete()
            .eq('id', studentId);

        if (error) {
            alert(`Không thể xóa học sinh: ${error.message}`);
            return false;
        }

        // Đọc lại từ database thay vì tự giảm biến đếm ở frontend.
        if (typeof globalThis.loadAll === 'function') {
            await globalThis.loadAll();
        }

        return true;
    } catch (error) {
        console.error('[Student Actions] Delete failed:', error);
        alert(
            `Không thể kiểm tra/xóa học sinh: ${
                error.message || error
            }`,
        );
        return false;
    }
}

/**
 * Gắn nút Xóa vào bảng học sinh hiện tại mà chưa phải sửa renderer legacy.
 *
 * MutationObserver theo dõi tbody vì app.js render lại bảng sau tìm kiếm,
 * refresh hoặc CRUD. Mỗi dòng chỉ được thêm một nút Xóa.
 */
function decorateStudentRowsWithDeleteAction() {
    const body = document.getElementById('studentBody');

    if (!body) {
        return;
    }

    body.querySelectorAll('tr').forEach((row) => {
        const editButton = row.querySelector(
            'button[onclick^="editStudent("]',
        );
        const actionCell = editButton?.parentElement;

        if (
            !actionCell ||
            actionCell.querySelector('[data-delete-student]')
        ) {
            return;
        }

        const onclick = editButton.getAttribute('onclick') || '';
        const match = onclick.match(
            /editStudent\(["']([^"']+)["']\)/,
        );
        const studentId = match?.[1];

        if (!studentId) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn small danger';
        button.dataset.deleteStudent = studentId;
        button.textContent = 'Xóa';

        button.addEventListener('click', () => {
            const confirmed = window.confirm(
                'Xóa học sinh này? Chỉ học sinh chưa có dữ liệu nghiệp vụ mới được xóa.',
            );

            if (!confirmed) {
                return;
            }

            void deleteStudent(studentId);
        });

        actionCell.appendChild(button);
    });
}

/**
 * Khởi động observer cho bảng học sinh.
 */
function initStudentDeleteAction() {
    const body = document.getElementById('studentBody');

    if (!body || body.dataset.deleteObserverReady === 'true') {
        return;
    }

    const observer = new MutationObserver(
        decorateStudentRowsWithDeleteAction,
    );

    observer.observe(body, {
        childList: true,
        subtree: true,
    });

    body.dataset.deleteObserverReady = 'true';
    decorateStudentRowsWithDeleteAction();
}

globalThis.StudentActionsV6 = Object.freeze({
    deleteStudent,
    getStudentDependencyCounts,
    initStudentDeleteAction,
});

globalThis.deleteStudent = deleteStudent;

if (document.readyState === 'loading') {
    document.addEventListener(
        'DOMContentLoaded',
        initStudentDeleteAction,
        { once: true },
    );
} else {
    initStudentDeleteAction();
}
