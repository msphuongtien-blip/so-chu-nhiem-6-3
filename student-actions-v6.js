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
 * - Lỗi nhập liệu được hiển thị trực tiếp trong modal, không dùng alert().
 *
 * Quy trình bảo mật:
 * 1. GVCN chọn chính xác học sinh.
 * 2. Hệ thống hiển thị lại danh sách và số lượng.
 * 3. GVCN nhập lại mật khẩu tài khoản hiện tại.
 * 4. GVCN nhập `XOA <số lượng>` để xác nhận.
 * 5. Database thực hiện thao tác trong transaction của RPC.
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
     * password vào database hay localStorage. Session vẫn do Supabase Auth
     * quản lý.
     *
     * @param {string} password Mật khẩu GVCN nhập lại.
     * @returns {Promise<boolean>} true khi credential hợp lệ.
     */
    async function reauthenticateTeacher(password) {
        if (!currentUser?.email) {
            throw new Error(
                'Không xác định được tài khoản GVCN hiện tại.',
            );
        }

        const { error } = await sb.auth.signInWithPassword({
            email: currentUser.email,
            password,
        });

        if (error) {
            const authError = new Error('Mật khẩu không đúng.');
            authError.code = 'INVALID_PASSWORD';
            throw authError;
        }

        return true;
    }

    /**
     * Gọi RPC PostgreSQL để xóa toàn bộ danh sách.
     *
     * RPC kiểm tra quyền GVCN và thực hiện DELETE trong cùng transaction.
     * Nếu PostgreSQL raise exception, toàn bộ thao tác được rollback.
     *
     * @param {string[]} studentIds UUID học sinh cần xóa.
     * @returns {Promise<object>} Kết quả RPC.
     */
    async function deleteStudentsSecurely(studentIds) {
        const { data, error } = await sb.rpc(
            'delete_students_secure',
            {
                p_student_ids: studentIds,
            },
        );

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Lưu vị trí cuộn hiện tại của modal nếu cần render lại nội dung.
     */
    function getModalElement() {
        return document.querySelector(
            '.modal-backdrop:last-of-type .modal',
        );
    }

    /**
     * Hiển thị lỗi validation theo một format thống nhất.
     *
     * @param {HTMLElement} errorBox Vùng hiển thị lỗi.
     * @param {string} message Nội dung lỗi.
     */
    function showValidationError(errorBox, message) {
        errorBox.hidden = false;
        errorBox.textContent = message;
        errorBox.style.color = '#b42318';
        errorBox.style.marginTop = '10px';
        errorBox.setAttribute('role', 'alert');
    }

    /**
     * Xóa thông báo validation trước khi kiểm tra lại form.
     *
     * @param {HTMLElement} errorBox Vùng hiển thị lỗi.
     */
    function clearValidationError(errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
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
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
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
                        <button
                            class="btn small"
                            type="button"
                            id="studentDeleteSelectAll"
                        >
                            Chọn tất cả
                        </button>
                        <button
                            class="btn small"
                            type="button"
                            id="studentDeleteClearAll"
                        >
                            Bỏ chọn
                        </button>
                        <span class="mini" id="studentDeleteCount">
                            Đã chọn: 0
                        </span>
                    </div>
                    <div
                        id="studentDeleteList"
                        style="max-height:360px;overflow:auto"
                    ></div>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>
                        Hủy
                    </button>
                    <button
                        class="btn danger"
                        type="button"
                        id="studentDeleteContinue"
                    >
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

        const searchInput = modal.querySelector(
            '#studentDeleteSearch',
        );
        const list = modal.querySelector('#studentDeleteList');
        const count = modal.querySelector('#studentDeleteCount');

        const getCheckedIds = () =>
            [
                ...modal.querySelectorAll(
                    '.student-delete-check:checked',
                ),
            ].map((input) => input.value);

        const updateCount = () => {
            count.textContent =
                `Đã chọn: ${getCheckedIds().length}`;
        };

        const renderList = () => {
            const query = searchInput.value
                .trim()
                .toLocaleLowerCase('vi');

            const filtered = students.filter((student) => {
                const text = [
                    student.full_name || '',
                    student.student_code || '',
                ].join(' ');

                return text
                    .toLocaleLowerCase('vi')
                    .includes(query);
            });

            list.innerHTML = filtered
                .map((student) => `
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
                `)
                .join('');

            updateCount();
        };

        searchInput.addEventListener('input', renderList);

        modal
            .querySelector('#studentDeleteSelectAll')
            .addEventListener('click', () => {
                modal
                    .querySelectorAll('.student-delete-check')
                    .forEach((input) => {
                        input.checked = true;
                    });

                updateCount();
            });

        modal
            .querySelector('#studentDeleteClearAll')
            .addEventListener('click', () => {
                modal
                    .querySelectorAll('.student-delete-check')
                    .forEach((input) => {
                        input.checked = false;
                    });

                updateCount();
            });

        list.addEventListener('change', updateCount);

        modal
            .querySelector('#studentDeleteContinue')
            .addEventListener('click', () => {
                const selectedIds = getCheckedIds();

                if (!selectedIds.length) {
                    alert('Chưa chọn học sinh cần xóa.');
                    return;
                }

                close();
                openSecureDeleteDialog(selectedIds);
            });

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
        const listHtml = selected
            .map((student, index) => `
                <li>
                    ${index + 1}.
                    <b>${escapeText(student.full_name)}</b>
                    · Mã HS: ${escapeText(student.student_code)}
                </li>
            `)
            .join('');

        const confirmationText = `XOA ${count}`;
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>Xác thực xóa ${count} học sinh</h3>
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
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
                            Nhập <b>${confirmationText}</b> để xác nhận
                        </label>
                        <input
                            id="secureDeleteConfirm"
                            type="text"
                            autocomplete="off"
                            placeholder="${confirmationText}"
                        >
                    </div>
                    <div
                        id="secureDeleteError"
                        class="mini"
                        role="alert"
                        aria-live="polite"
                        hidden
                    ></div>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>
                        Hủy
                    </button>
                    <button
                        class="btn danger"
                        type="button"
                        id="secureDeleteSubmit"
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

        const passwordInput = modal.querySelector(
            '#secureDeletePassword',
        );
        const confirmationInput = modal.querySelector(
            '#secureDeleteConfirm',
        );
        const submitButton = modal.querySelector(
            '#secureDeleteSubmit',
        );
        const errorBox = modal.querySelector('#secureDeleteError');

        submitButton.addEventListener('click', async () => {
            clearValidationError(errorBox);

            const password = passwordInput.value;
            const confirmation = confirmationInput.value.trim();

            if (!password) {
                showValidationError(
                    errorBox,
                    'Vui lòng nhập lại mật khẩu tài khoản GVCN.',
                );
                passwordInput.focus();
                return;
            }

            if (confirmation !== confirmationText) {
                showValidationError(
                    errorBox,
                    `Mã xác nhận chưa đúng. Hãy nhập chính xác: ${confirmationText}`,
                );
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
                console.error(
                    'Secure student deletion failed:',
                    error,
                );

                if (error?.code === 'INVALID_PASSWORD') {
                    showValidationError(
                        errorBox,
                        'Mật khẩu không đúng. Vui lòng kiểm tra lại.',
                    );
                    passwordInput.select();
                } else {
                    showValidationError(
                        errorBox,
                        error?.message ||
                        'Không thể xóa học sinh. Vui lòng thử lại.',
                    );
                }

                submitButton.disabled = false;
                submitButton.textContent = `Xóa ${count} học sinh`;
            }
        });

        passwordInput.addEventListener('input', () => {
            clearValidationError(errorBox);
        });

        confirmationInput.addEventListener('input', () => {
            clearValidationError(errorBox);
        });

        passwordInput.focus();
    }

    /**
     * Lấy student ID từ nút Lưu trong modal Chỉnh sửa học sinh.
     *
     * `openStudentForm()` hiện dùng inline handler `saveStudent('id')`.
     * Ta tận dụng chính ID đó để tránh duplicate form và duplicate state.
     *
     * @param {HTMLElement} modal Modal hiện tại.
     * @returns {string|null} UUID học sinh hoặc null.
     */
    function getEditingStudentId(modal) {
        const saveButton = modal.querySelector(
            'button[onclick^="saveStudent("]',
        );

        if (!saveButton) {
            return null;
        }

        const onclick = saveButton.getAttribute('onclick') || '';
        const match = onclick.match(
            /saveStudent\(["']([^"']+)["']\)/,
        );

        return match?.[1] || null;
    }

    /**
     * Gắn nút Xóa vào modal Chỉnh sửa một học sinh.
     *
     * Nút này dùng cùng secure delete flow với bulk delete, nên không có
     * đường tắt nào bỏ qua password re-authentication và mã `XOA 1`.
     *
     * @param {HTMLElement} modal Modal chỉnh sửa học sinh.
     */
    function mountDeleteButtonInEditModal(modal) {
        if (!modal || modal.dataset.deleteActionReady === 'true') {
            return;
        }

        const heading = modal.querySelector('.modal-head h3');
        const actions = modal.querySelector('.modal-foot, .actions');

        if (!heading || !actions) {
            return;
        }

        if (!heading.textContent.includes('Chỉnh sửa học sinh')) {
            return;
        }

        const studentId = getEditingStudentId(modal);

        if (!studentId) {
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn danger';
        button.textContent = 'Xóa học sinh';
        button.addEventListener('click', () => {
            openSecureDeleteDialog([studentId]);
        });

        actions.insertBefore(
            button,
            actions.querySelector('.btn.primary') || null,
        );

        modal.dataset.deleteActionReady = 'true';
    }

    /**
     * Theo dõi các modal được tạo động bởi `openModal()`.
     *
     * MutationObserver được dùng vì modal legacy được chèn trực tiếp vào
     * body sau khi người dùng bấm Sửa, nên lúc DOMContentLoaded chưa tồn tại.
     */
    function initEditModalDeleteObserver() {
        const observer = new MutationObserver(() => {
            document
                .querySelectorAll('.modal-backdrop .modal')
                .forEach(mountDeleteButtonInEditModal);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
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
        const actions = document.querySelector(
            '#students .section-title .actions',
        );

        if (!actions || actions.querySelector('#studentDeleteManager')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'studentDeleteManager';
        button.type = 'button';
        button.className = 'btn';
        button.textContent = 'Xóa học sinh';
        button.addEventListener(
            'click',
            openStudentSelectionDialog,
        );

        actions.appendChild(button);
    }

    function initStudentActions() {
        mountStudentDeleteButton();
        initEditModalDeleteObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            initStudentActions,
            { once: true },
        );
    } else {
        initStudentActions();
    }
})();
