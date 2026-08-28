/**
 * FILE: student-actions-v6.js
 *
 * Mục đích:
 * Cung cấp các thao tác quản trị học sinh nguy hiểm hơn CRUD thông thường.
 * C1.5 triển khai xóa một hoặc nhiều học sinh với xác thực lại mật khẩu.
 *
 * Kiến trúc:
 * - Không tạo Supabase client mới; dùng `sb` từ core/supabase.js.
 * - Không bypass RLS và không dùng service-role key ở trình duyệt.
 * - Xóa thực tế được thực hiện bởi RPC `delete_students_secure(uuid[])`.
 *
 * Quy tắc bảo mật:
 * 1. Người dùng phải đang ở vai trò GVCN.
 * 2. Hiển thị chính xác danh sách học sinh trước khi xóa.
 * 3. Người dùng phải nhập lại mật khẩu tài khoản hiện tại.
 * 4. Phải nhập đúng chuỗi xác nhận có chứa số lượng học sinh.
 *
 * C1.6 bulk import CSV được tách riêng để tránh trộn hai workflow rủi ro.
 */

(() => {
    'use strict';

    /**
     * Escape text trước khi đưa tên học sinh vào HTML.
     * Dùng helper Core nếu đã được load; fallback chỉ dành cho trường hợp
     * module được mở độc lập trong test.
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
     * Trả về danh sách học sinh đang được chọn, loại bỏ ID trùng.
     *
     * @param {string[]} studentIds Danh sách UUID học sinh.
     * @returns {Array<object>} Danh sách học sinh tương ứng trong state hiện tại.
     */
    function getSelectedStudents(studentIds) {
        const uniqueIds = [...new Set(studentIds.map(String))];

        return (students || []).filter((student) =>
            uniqueIds.includes(String(student.id)),
        );
    }

    /**
     * Xác thực lại password của tài khoản GVCN hiện tại.
     *
     * Supabase Auth `signInWithPassword()` được dùng để xác thực credential
     * hiện tại. Không lưu password và không đưa password vào database.
     *
     * @param {string} password Mật khẩu người dùng nhập lại.
     * @returns {Promise<boolean>} true khi xác thực thành công.
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
     * Gọi RPC xóa học sinh ở database.
     *
     * RPC là transaction boundary ở PostgreSQL. Nếu thao tác không xóa đủ
     * số lượng yêu cầu, function database sẽ raise exception để rollback.
     *
     * @param {string[]} studentIds UUID học sinh cần xóa.
     * @returns {Promise<object>} Kết quả từ RPC.
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
     * Hiển thị modal xác nhận xóa và thực hiện xóa sau khi đủ các lớp bảo vệ.
     *
     * @param {string[]} studentIds UUID của học sinh cần xóa.
     */
    async function openSecureDeleteDialog(studentIds) {
        if (role !== 'teacher') {
            alert('Chỉ GVCN mới được phép xóa học sinh.');
            return;
        }

        const selected = getSelectedStudents(studentIds);

        if (!selected.length) {
            alert('Chưa chọn học sinh cần xóa.');
            return;
        }

        const count = selected.length;
        const listHtml = selected
            .map((student, index) => `
                <li>
                    ${index + 1}. <b>${escapeText(student.full_name)}</b>
                    · Mã HS: ${escapeText(student.student_code)}
                </li>
            `)
            .join('');

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
                        <b>Cảnh báo:</b> dữ liệu liên quan có thể bị xóa theo quan hệ
                        database hiện tại. Đây là thao tác không thể hoàn tác từ giao diện.
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
                    <button
                        id="secureDeleteSubmit"
                        class="btn danger"
                        type="button"
                    >
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
                await deleteStudentsSecurely(selected.map((student) => student.id));

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
     * Mở workflow xóa một học sinh từ bảng danh sách.
     * Được expose global để có thể gọi từ inline handler hiện tại.
     *
     * @param {string} studentId UUID học sinh.
     */
    window.deleteStudentV6 = (studentId) =>
        openSecureDeleteDialog([studentId]);

    /**
     * Mở workflow xóa nhiều học sinh.
     * Module quản lý danh sách có thể gọi hàm này sau khi người dùng chọn checkbox.
     *
     * @param {string[]} studentIds UUID học sinh.
     */
    window.deleteStudentsBulkV6 = (studentIds) =>
        openSecureDeleteDialog(studentIds);
})();
