/**
 * FILE: student-actions-v6.js
 *
 * Mục đích:
 * C1.5 cung cấp thao tác xóa một hoặc nhiều học sinh với xác thực lại
 * mật khẩu tài khoản GVCN. C1.6 (bulk import CSV) sẽ được triển khai riêng.
 *
 * Kiến trúc:
 * - Dùng `sb` từ core/supabase.js; không tạo client thứ hai.
 * - Không dùng service-role key ở trình duyệt.
 * - Xóa thực tế gọi RPC PostgreSQL `delete_students_secure(uuid[])`.
 * - RLS và kiểm tra `is_teacher()` vẫn là lớp bảo vệ database.
 *
 * Quy trình bảo mật:
 * 1. GVCN chọn chính xác học sinh.
 * 2. Hệ thống hiển thị lại danh sách và số lượng.
 * 3. GVCN nhập lại mật khẩu tài khoản hiện tại.
 * 4. GVCN nhập `XOA <số lượng>` để xác nhận.
 * 5. Database thực hiện thao tác theo transaction của RPC.
 */

(() => {
    'use strict';

    /**
     * Escape text trước khi đưa dữ liệu học sinh vào HTML.
     * Fallback giúp module có thể được chạy độc lập trong test.
     */
    const escapeText = (value) => {
        if (typeof esc === 'function') {
            return esc(value);
        }

        return String(value ?? '').replace(
            /[&<>"']/g,
            (character) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;',
            }[character]),
        );
    };

    /**
     * Lấy các học sinh được chọn từ state hiện tại và loại ID trùng.
     *
     * @param {string[]} studentIds UUID của học sinh.
     * @returns {Array<object>} Các học sinh tương ứng trong `students`.
     */
    function getSelectedStudents(studentIds) {
        const uniqueIds = [...new Set(studentIds.map(String))];

        return (students || []).filter((student) =>
            uniqueIds.includes(String(student.id)),
        );
    }

    /**
     * Xác thực lại mật khẩu tài khoản GVCN hiện tại.
     *
     * Supabase Auth `signInWithPassword()` xác thực credential mà không lưu
     * password vào database hay localStorage. Session hợp lệ vẫn do Supabase
     * Auth quản lý.
     *
     * @param {string} password Mật khẩu GVCN nhập lại.
     * @returns {Promise<boolean>} true khi credential hợp lệ.
     */
    async function reauthenticateTeacher(password) {
        if (!currentUser?.email) {
            throw new Error('Không xác định được tài khoản GVCN hiện tại.');
        }

        const { error } = await sb.auth.signInWithPassword({
            email: currentUser.email,
            password,
        });

        if (error) {
            throw new Error('Mật khẩu xác thực không đúng.');
        }

        return true;
    }

    /**
     * Gọi RPC PostgreSQL để xóa toàn bộ danh sách.
     *
     * RPC kiểm tra quyền GVCN và xóa trong một transaction. Nếu số dòng xóa
     * khác số dòng yêu cầu, RPC sẽ raise exception để PostgreSQL rollback.
     *
     * @param {string[]} studentIds UUID học sinh cần xóa.
     * @returns {Promise<object>} Kết quả RPC.
     */
    async function deleteStudentsSecurely(studentIds) {
        const { data, error } = await sb.rpc(
            'delete_students_secure',
            { p_student_ids: studentIds },
        );

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Tạo modal chọn học sinh cho thao tác bulk delete.
     * Danh sách lấy trực tiếp từ `students`, không tạo dữ liệu giả.
     */
    function openStudentSelectionDialog() {
        if (role !== 'teacher') {
            alert('Chỉ GVCN mới được phép xóa học sinh.');
            return;
        }

        if (!students?.length) {
            alert('Chưa tải được danh sách học sinh.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>Chọn học sinh cần xóa</h3>
                    <button class="btn small" type="button" data-close>Đóng</button>
                </div>
                <div class="modal-body">
                    <div class="field">
                        <input
                            id="studentDeleteSearch"
                            type="search"
                            placeholder="Tìm tên hoặc mã HS..."
                        >
                    </div>
                    <div class="actions" style="margin:8px 0">
                        <button class="btn small" type="button" id="studentDeleteSelectAll">
                            Chọn tất cả
                        </button>
                        <button class="btn small" type="button" id="studentDeleteClearAll">
                            Bỏ chọn
                        </button>
                        <span class="mini" id="studentDeleteCount">Đã chọn: 0</span>
                    </div>
                    <div
                        id="studentDeleteList"
                        style="max-height:360px;overflow:auto"
                    ></div>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>Hủy</button>
                    <button class="btn danger" type="button" id="studentDeleteContinue">
                        Tiếp tục
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', close);
        });

        const searchInput = modal.querySelector('#studentDeleteSearch');
        const list = modal.querySelector('#studentDeleteList');
        const count = modal.querySelector('#studentDeleteCount');

        const renderList = () => {
            const query = searchInput.value.trim().toLocaleLowerCase('vi');
            const filtered = students.filter((student) => {
                const text = `${student.full_name || ''} ${student.student_code || ''}`;
                return text.toLocaleLowerCase('vi').includes(query);
            });

            list.innerHTML = filtered.map((student) => `
                <label
                    class="notice"
                    style="display:flex;gap:10px;align-items:center;margin-bottom:6px"
                >
                    <input
                        type="checkbox"
                        class="student-delete-check"
                        value="${escapeText(student.id)}"
                    >
                    <span>
                        <b>${escapeText(student.full_name)}</b>
                        · Mã HS: ${escapeText(student.student_code)}
                        · Tổ ${escapeText(student.team || '—')}
                    </span>
                </label>
            `).join('');

            updateCount();
        };

        const getCheckedIds = () =>
            [...modal.querySelectorAll('.student-delete-check:checked')]
                .map((input) => input.value);

        const updateCount = () => {
            count.textContent = `Đã chọn: ${getCheckedIds().length}`;
        };

        searchInput.addEventListener('input', renderList);

        modal.querySelector('#studentDeleteSelectAll').addEventListener(
            'click',
            () => {
                modal.querySelectorAll('.student-delete-check').forEach((input) => {
                    input.checked = true;
                });
                updateCount();
            },
        );

        modal.querySelector('#studentDeleteClearAll').addEventListener(
            'click',
            () => {
                modal.querySelectorAll('.student-delete-check').forEach((input) => {
                    input.checked = false;
                });
                updateCount();
            },
        );

        list.addEventListener('change', updateCount);

        modal.querySelector('#studentDeleteContinue').addEventListener(
            'click',
            () => {
                const selectedIds = getCheckedIds();

                if (!selectedIds.length) {
                    alert('Chưa chọn học sinh cần xóa.');
                    return;
                }

                close();
                openSecureDeleteDialog(selectedIds);
            },
        );

        renderList();
        searchInput.focus();
    }

    /**
     * Hiển thị danh sách chính xác và yêu cầu password + confirmation.
     *
     * @param {string[]} studentIds UUID học sinh.
     */
    async function openSecureDeleteDialog(studentIds) {
        if (role !== 'teacher') {
            alert('Chỉ GVCN mới được phép xóa học sinh.');
            return;
        }

        const selected = getSelectedStudents(studentIds);

        if (!selected.length) {
            alert('Không tìm thấy học sinh được chọn.');
            return;
        }

        const count = selected.length;
        const listHtml = selected.map((student, index) => `
            <li>
                ${index + 1}. <b>${escapeText(student.full_name)}</b>
                · Mã HS: ${escapeText(student.student_code)}
            </li>
        `).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>Xác thực xóa ${count} học sinh</h3>
                    <button class="btn small" type="button" data-close>Đóng</button>
                </div>
                <div class="modal-body">
                    <div class="notice">
                        <b>Danh sách chính xác sẽ bị xóa:</b>
                        <ol>${listHtml}</ol>
                    </div>
                    <div class="notice" style="margin-top:12px">
                        <b>Cảnh báo:</b> dữ liệu liên quan có thể bị xóa theo
                        quan hệ database hiện tại. Thao tác này không thể hoàn tác
                        từ giao diện.
                    </div>
                    <div class="field" style="margin-top:12px">
                        <label for="secureDeletePassword">
                            Nhập lại mật khẩu tài khoản GVCN
                        </label>
                        <input
                            id="secureDeletePassword"
                            type="password"
                            autocomplete="current-password"
                            placeholder="Mật khẩu hiện tại"
                        >
                    </div>
                    <div class="field">
                        <label for="secureDeleteConfirm">
                            Nhập <b>XOA ${count}</b> để xác nhận
                        </label>
                        <input
                            id="secureDeleteConfirm"
                            type="text"
                            autocomplete="off"
                            placeholder="XOA ${count}"
                        >
                    </div>
                    <p id="secureDeleteError" class="mini" role="alert"></p>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>Hủy</button>
                    <button class="btn danger" type="button" id="secureDeleteSubmit">
                        Xóa ${count} học sinh
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', close);
        });

        const passwordInput = modal.querySelector('#secureDeletePassword');
        const confirmationInput = modal.querySelector('#secureDeleteConfirm');
        const submitButton = modal.querySelector('#secureDeleteSubmit');
        const errorBox = modal.querySelector('#secureDeleteError');

        submitButton.addEventListener('click', async () => {
            errorBox.textContent = '';

            const password = passwordInput.value;
            const confirmation = confirmationInput.value.trim();

            if (!password) {
                errorBox.textContent = 'Vui lòng nhập lại mật khẩu.';
                passwordInput.focus();
                return;
            }

            if (confirmation !== `XOA ${count}`) {
                errorBox.textContent = `Cần nhập chính xác: XOA ${count}`;
                confirmationInput.focus();
                return;
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Đang xác thực và xóa...';

            try {
                await reauthenticateTeacher(password);
                await deleteStudentsSecurely(
                    selected.map((student) => student.id),
                );

                close();

                if (typeof loadAll === 'function') {
                    await loadAll();
                }

                alert(`Đã xóa ${count} học sinh.`);
            } catch (error) {
                console.error('Secure student deletion failed:', error);
                errorBox.textContent =
                    error?.message || 'Không thể xóa học sinh.';
                submitButton.disabled = false;
                submitButton.textContent = `Xóa ${count} học sinh`;
            }
        });

        passwordInput.focus();
    }

    /**
     * Expose API cho các UI/module khác trong giai đoạn refactor.
     */
    window.deleteStudentV6 = (studentId) =>
        openSecureDeleteDialog([studentId]);

    window.deleteStudentsBulkV6 = (studentIds) =>
        openSecureDeleteDialog(studentIds);

    /**
     * Thêm nút quản lý xóa vào page Học sinh mà không sửa lại markup lớn
     * của index.html. Cách này giữ phạm vi thay đổi nhỏ trong C1.5.
     */
    function mountStudentDeleteButton() {
        const actions = document.querySelector('#students .section-title .actions');

        if (!actions || actions.querySelector('#studentDeleteManager')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'studentDeleteManager';
        button.type = 'button';
        button.className = 'btn';
        button.textContent = 'Xóa học sinh';
        button.addEventListener('click', openStudentSelectionDialog);
        actions.appendChild(button);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountStudentDeleteButton);
    } else {
        mountStudentDeleteButton();
    }
})();
