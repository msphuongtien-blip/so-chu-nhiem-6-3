/**
 * FILE: student-actions-v6.js
 *
 * Mục đích:
 * C1.5 cung cấp thao tác xóa một hoặc nhiều học sinh với xác thực lại
 * mật khẩu tài khoản GVCN.
 *
 * Kiến trúc:
 * - Dùng `sb` và state hiện tại từ Core/legacy bootstrap.
 * - Không dùng service-role key ở trình duyệt.
 * - Xóa thực tế gọi RPC PostgreSQL `delete_students_secure(uuid[])`.
 * - RLS và kiểm tra `is_teacher()` vẫn là lớp bảo vệ database.
 *
 * UX/security:
 * - Xóa bulk: chọn học sinh → xem lại danh sách → password → XOA <số lượng>.
 * - Xóa từ modal Sửa: password → XOA 1.
 * - Lỗi nhập liệu hiển thị trực tiếp trong modal.
 */

(() => {
    'use strict';

    /**
     * Escape text trước khi đưa dữ liệu học sinh vào HTML.
     * Fallback giúp module không phụ thuộc tuyệt đối vào helper legacy `esc`.
     *
     * @param {unknown} value Giá trị cần escape.
     * @returns {string} Chuỗi an toàn để chèn vào HTML text context.
     */
    function escapeText(value) {
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
    }

    /**
     * Lấy học sinh theo danh sách ID và loại ID trùng.
     *
     * @param {string[]} studentIds UUID của học sinh.
     * @returns {Array<object>} Danh sách học sinh tương ứng.
     */
    function getSelectedStudents(studentIds) {
        const uniqueIds = [...new Set(studentIds.map(String))];

        return (students || []).filter((student) =>
            uniqueIds.includes(String(student.id)),
        );
    }

    /**
     * Hiển thị lỗi nhập liệu trong modal xác thực.
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
        errorBox.setAttribute('aria-live', 'polite');
    }

    /**
     * Xóa lỗi validation hiện tại.
     *
     * @param {HTMLElement} errorBox Vùng hiển thị lỗi.
     */
    function clearValidationError(errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
    }

    /**
     * Xác thực lại mật khẩu tài khoản GVCN hiện tại.
     *
     * Supabase Auth kiểm tra credential trực tiếp; password không được lưu
     * vào database hay localStorage.
     *
     * @param {string} password Mật khẩu GVCN.
     * @returns {Promise<boolean>} true khi xác thực thành công.
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
     * Gọi RPC database để xóa danh sách học sinh.
     *
     * RPC kiểm tra quyền GVCN và thực hiện thao tác theo transaction.
     * Nếu RPC báo lỗi, database rollback toàn bộ thao tác.
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
     * Tạo modal chọn một hoặc nhiều học sinh để xóa.
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

        const getCheckedIds = () => [
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
     * Mở modal xác thực hai bước cho thao tác xóa.
     *
     * @param {string[]} studentIds UUID học sinh cần xóa.
     */
    function openSecureDeleteDialog(studentIds) {
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
        const confirmationText = `XOA ${count}`;
        const listHtml = selected
            .map((student, index) => `
                <li>
                    ${index + 1}.
                    <b>${escapeText(student.full_name)}</b>
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
                        <b>Cảnh báo:</b>
                        dữ liệu liên quan có thể bị xóa theo quan hệ database
                        hiện tại. Thao tác này không thể hoàn tác từ giao diện.
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

        const submit = async () => {
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
        };

        submitButton.addEventListener('click', submit);

        passwordInput.addEventListener(
            'input',
            () => clearValidationError(errorBox),
        );

        confirmationInput.addEventListener(
            'input',
            () => clearValidationError(errorBox),
        );

        passwordInput.focus();
    }

    /**
     * Lấy ID học sinh đang được chỉnh sửa từ inline handler của nút Lưu.
     *
     * Modal legacy hiện dùng `#modalBody` và button `saveStudent('id')`.
     * Không sửa lại form legacy; chỉ đọc ID đã có.
     *
     * @param {HTMLElement} modal Modal dùng chung của ứng dụng.
     * @returns {string|null} UUID học sinh đang sửa.
     */
    function getEditingStudentId(modal) {
        const saveButton = modal.querySelector(
            '#modalBody button[onclick^="saveStudent("]',
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
     * Gắn nút Xóa vào đúng modal `#modal` khi GVCN đang sửa một học sinh.
     *
     * @param {HTMLElement} modal Modal dùng chung của ứng dụng.
     */
    function mountDeleteButtonInEditModal(modal) {
        const title = modal.querySelector('#modalTitle');
        const body = modal.querySelector('#modalBody');

        if (!title || !body) {
            return;
        }

        const isEditStudentModal = title.textContent.trim() ===
            'Chỉnh sửa học sinh';

        if (!isEditStudentModal) {
            return;
        }

        if (body.querySelector('#editStudentDeleteButton')) {
            return;
        }

        const studentId = getEditingStudentId(modal);

        if (!studentId) {
            return;
        }

        const saveButton = body.querySelector(
            'button[onclick^="saveStudent("]',
        );

        if (!saveButton) {
            return;
        }

        const deleteButton = document.createElement('button');
        deleteButton.id = 'editStudentDeleteButton';
        deleteButton.type = 'button';
        deleteButton.className = 'btn danger';
        deleteButton.textContent = 'Xóa học sinh';
        deleteButton.title =
            'Xóa học sinh sau khi xác thực mật khẩu và XOA 1';

        deleteButton.addEventListener('click', () => {
            openSecureDeleteDialog([studentId]);
        });

        saveButton.parentElement?.insertBefore(
            deleteButton,
            saveButton,
        );
    }

    /**
     * Theo dõi modal legacy dùng chung.
     *
     * `openModal()` thay đổi `#modalTitle` và `#modalBody` bằng innerHTML,
     * nên MutationObserver là cách ít xâm lấn nhất trong giai đoạn bridge.
     */
    function initEditModalDeleteObserver() {
        const modal = document.getElementById('modal');

        if (!modal) {
            return;
        }

        const observer = new MutationObserver(() => {
            mountDeleteButtonInEditModal(modal);
        });

        observer.observe(modal, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        // Kiểm tra ngay nếu modal đã được render trước khi observer khởi tạo.
        mountDeleteButtonInEditModal(modal);
    }

    /**
     * Public API tạm thời cho legacy HTML và các module V6 khác.
     */
    window.deleteStudentV6 = (studentId) =>
        openSecureDeleteDialog([studentId]);

    window.deleteStudentsBulkV6 = (studentIds) =>
        openSecureDeleteDialog(studentIds);

    /**
     * Gắn nút xóa bulk vào toolbar Học sinh.
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
        button.title = 'Chọn một hoặc nhiều học sinh để xóa';
        button.addEventListener(
            'click',
            openStudentSelectionDialog,
        );

        actions.appendChild(button);
    }

    /**
     * Khởi tạo các integration point của module.
     */
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
