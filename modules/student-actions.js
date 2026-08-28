/**
 * FILE: modules/student-actions.js
 *
 * Mục đích:
 * Bổ sung thao tác quản lý học sinh mới trong quá trình refactor từng phần.
 * C1 chỉ đưa chức năng Xóa học sinh an toàn vào một module riêng; CRUD cũ
 * vẫn nằm trong app.js cho đến đợt tách Students chính thức.
 *
 * Trách nhiệm:
 * - Kiểm tra các bảng đang phụ thuộc students.id trước khi DELETE.
 * - Chặn xóa nếu học sinh đã có dữ liệu nghiệp vụ.
 * - Cho phép xóa thật học sinh test chưa có dữ liệu liên quan.
 * - Cập nhật lại giao diện từ database sau khi xóa thành công.
 *
 * Không chịu trách nhiệm:
 * - Xóa dữ liệu lịch sử cascade.
 * - Xóa tài khoản Supabase Auth.
 * - Bypass RLS.
 */

const STUDENT_DEPENDENCY_TABLES = Object.freeze([
    'attendance',
    'competition_records',
    'competition_data_issues',
    'competition_weekly_snapshots',
    'discipline_records',
    'honors',
    'learning_records',
]);

/**
 * Đếm dữ liệu liên quan của một học sinh trên toàn bộ bảng phụ thuộc.
 *
 * Các query không phụ thuộc lẫn nhau nên được chạy song song bằng
 * Promise.all. `count: 'exact'` + `head: true` chỉ lấy metadata số dòng,
 * không tải toàn bộ dữ liệu của các bảng về browser.
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
 * Đây là hard delete có chủ đích dành cho học sinh test/chưa phát sinh
 * lịch sử. Khi đã có dữ liệu, function dừng trước DELETE để bảo toàn lịch sử.
 * Quyền cuối cùng vẫn do RLS students_teacher của Supabase quyết định.
 *
 * @param {string} studentId UUID của học sinh cần xóa.
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

        // Đọc lại từ database để mọi module dùng đúng dữ liệu mới nhất.
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
 * Gắn nút Xóa vào các dòng học sinh do app.js render.
 *
 * MutationObserver được dùng vì app.js có thể render lại tbody sau tìm kiếm,
 * refresh hoặc CRUD. Observer chỉ thêm nút khi dòng chưa có.
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
