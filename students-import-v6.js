/**
 * FILE: students-import-v6.js
 *
 * Mục đích:
 * C1.6 cung cấp chức năng bulk import học sinh bằng CSV.
 *
 * Phạm vi:
 * - Tải template CSV.
 * - Chọn và đọc file CSV.
 * - Parse CSV có hỗ trợ dấu phẩy, dấu ngoặc kép và BOM UTF-8.
 * - Validate dữ liệu trước khi ghi database.
 * - Phát hiện trùng mã HS trong file và với database hiện tại.
 * - Preview kết quả để GVCN kiểm tra trước khi import.
 * - Bulk insert chỉ khi toàn bộ dữ liệu hợp lệ.
 *
 * Không import các field hệ thống do database tự quản lý:
 * `id`, `user_id`, `competition_score`, `attendance_percent`,
 * `weekly_start_score`, `competition_week_start`, `created_at`, `updated_at`.
 *
 * Nguyên tắc:
 * - Không tạo dữ liệu HS giả.
 * - Không ghi database trước khi GVCN xác nhận ở màn hình preview.
 * - Không tự sửa dữ liệu lỗi âm thầm.
 * - Bulk import theo nguyên tắc all-or-nothing ở cấp request INSERT.
 */

(() => {
    'use strict';

    /**
     * Các cột hồ sơ được phép import.
     *
     * full_name và student_code là bắt buộc theo schema `students`.
     * Các trường còn lại có thể để trống.
     */
    const CSV_HEADERS = [
        'full_name',
        'student_code',
        'gender',
        'team',
        'support_level',
        'progress_note',
        'special_note',
    ];

    const REQUIRED_HEADERS = [
        'full_name',
        'student_code',
    ];

    const ALLOWED_GENDERS = new Set([
        'Nam',
        'Nữ',
        'Khác',
    ]);

    const ALLOWED_SUPPORT_LEVELS = new Set([
        'Không',
        'Cần hỗ trợ',
        'Cần can thiệp',
    ]);

    /**
     * Chuẩn hóa nội dung ô CSV.
     *
     * @param {unknown} value Giá trị thô từ CSV.
     * @returns {string} Chuỗi đã loại BOM và khoảng trắng thừa.
     */
    function normalizeCell(value) {
        return String(value ?? '')
            .replace(/^\uFEFF/, '')
            .trim();
    }

    /**
     * Parse một file CSV mà không cần thư viện ngoài.
     *
     * Bộ parser này hỗ trợ:
     * - dấu phẩy phân cách cột;
     * - giá trị đặt trong `"..."`;
     * - dấu `"` kép trong ô CSV (`""`);
     * - xuống dòng CRLF/LF;
     * - BOM UTF-8 ở đầu file.
     *
     * @param {string} csvText Nội dung CSV.
     * @returns {string[][]} Ma trận dòng/cột.
     */
    function parseCsv(csvText) {
        const text = String(csvText ?? '').replace(/^\uFEFF/, '');
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            const nextCharacter = text[index + 1];

            if (character === '"') {
                if (inQuotes && nextCharacter === '"') {
                    cell += '"';
                    index += 1;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (character === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
                continue;
            }

            if ((character === '\n' || character === '\r') && !inQuotes) {
                if (character === '\r' && nextCharacter === '\n') {
                    index += 1;
                }

                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
                continue;
            }

            cell += character;
        }

        if (inQuotes) {
            throw new Error(
                'File CSV có dấu ngoặc kép chưa được đóng đúng cách.',
            );
        }

        if (cell !== '' || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        return rows;
    }

    /**
     * Chuyển một ma trận CSV thành các object theo tên header.
     *
     * Thứ tự cột không bắt buộc; hệ thống map theo tên header.
     *
     * @param {string[][]} matrix Ma trận từ `parseCsv()`.
     * @returns {{headers: string[], rows: object[]}} Dữ liệu đã map.
     */
    function mapCsvRows(matrix) {
        if (!matrix.length) {
            throw new Error('File CSV đang trống.');
        }

        const headers = matrix[0].map(normalizeCell);
        const normalizedHeaders = headers.map((header) =>
            header.toLowerCase(),
        );

        const duplicateHeader = normalizedHeaders.find(
            (header, index) =>
                normalizedHeaders.indexOf(header) !== index,
        );

        if (duplicateHeader) {
            throw new Error(
                `Header CSV bị trùng: ${duplicateHeader}`,
            );
        }

        const missingRequiredHeaders = REQUIRED_HEADERS.filter(
            (header) => !normalizedHeaders.includes(header),
        );

        if (missingRequiredHeaders.length) {
            throw new Error(
                `Thiếu cột bắt buộc: ${missingRequiredHeaders.join(', ')}`,
            );
        }

        const unknownHeaders = normalizedHeaders.filter(
            (header) => !CSV_HEADERS.includes(header),
        );

        if (unknownHeaders.length) {
            throw new Error(
                `CSV có cột không được hỗ trợ: ${unknownHeaders.join(', ')}`,
            );
        }

        const rows = matrix
            .slice(1)
            .map((values, index) => {
                const row = {
                    __rowNumber: index + 2,
                };

                CSV_HEADERS.forEach((header) => {
                    const columnIndex = normalizedHeaders.indexOf(header);
                    row[header] = normalizeCell(
                        columnIndex >= 0 ? values[columnIndex] : '',
                    );
                });

                return row;
            })
            .filter((row) =>
                CSV_HEADERS.some((header) => row[header] !== ''),
            );

        return {
            headers,
            rows,
        };
    }

    /**
     * Kiểm tra từng dòng CSV trước khi import.
     *
     * @param {object[]} rows Các dòng đã map từ CSV.
     * @param {object[]} existingStudents HS hiện có trong state.
     * @returns {{validRows: object[], errors: object[], duplicates: object[]}}
     */
    function validateImportRows(rows, existingStudents = []) {
        const errors = [];
        const duplicateRows = [];
        const seenCodes = new Map();
        const existingCodes = new Set(
            existingStudents.map((student) =>
                normalizeCell(student.student_code),
            ),
        );
        const validRows = [];

        rows.forEach((row) => {
            const rowErrors = [];
            const code = normalizeCell(row.student_code);
            const name = normalizeCell(row.full_name);

            if (!name) {
                rowErrors.push('Thiếu họ tên.');
            }

            if (!/^\d{4,}$/.test(code)) {
                rowErrors.push('Mã HS phải gồm ít nhất 4 chữ số.');
            }

            if (code && existingCodes.has(code)) {
                rowErrors.push('Mã HS đã tồn tại trong hệ thống.');
            }

            if (code && seenCodes.has(code)) {
                rowErrors.push(
                    `Trùng mã HS với dòng ${seenCodes.get(code)} trong file.`,
                );
                duplicateRows.push(row);
            }

            if (row.gender && !ALLOWED_GENDERS.has(row.gender)) {
                rowErrors.push(
                    'Giới tính chỉ nhận: Nam, Nữ hoặc Khác.',
                );
            }

            if (row.team) {
                const team = Number(row.team);

                if (!Number.isInteger(team) || team < 1 || team > 4) {
                    rowErrors.push('Tổ phải là số nguyên từ 1 đến 4.');
                }
            }

            if (
                row.support_level &&
                !ALLOWED_SUPPORT_LEVELS.has(row.support_level)
            ) {
                rowErrors.push(
                    'Mức hỗ trợ chỉ nhận: Không, Cần hỗ trợ, Cần can thiệp.',
                );
            }

            if (code) {
                seenCodes.set(code, row.__rowNumber);
            }

            if (rowErrors.length) {
                errors.push({
                    rowNumber: row.__rowNumber,
                    fullName: name || '(trống)',
                    studentCode: code || '(trống)',
                    reasons: rowErrors,
                });
                return;
            }

            validRows.push({
                full_name: name,
                student_code: code,
                gender: row.gender || null,
                team: row.team ? Number(row.team) : null,
                support_level: row.support_level || 'Không',
                progress_note: row.progress_note || '',
                special_note: row.special_note || '',
            });
        });

        return {
            validRows,
            errors,
            duplicates: duplicateRows,
        };
    }

    /**
     * Tạo payload gửi Supabase.
     *
     * Function này cố ý chỉ trả về các field hồ sơ được phép import,
     * tránh việc CSV có thể ghi đè điểm thi đua hoặc field hệ thống.
     *
     * @param {object[]} validRows Các dòng đã validate.
     * @returns {object[]} Payload INSERT.
     */
    function buildInsertPayload(validRows) {
        return validRows.map((row) => ({
            full_name: row.full_name,
            student_code: row.student_code,
            gender: row.gender,
            team: row.team,
            support_level: row.support_level,
            progress_note: row.progress_note,
            special_note: row.special_note,
        }));
    }

    /**
     * Tạo nội dung CSV mẫu.
     *
     * Dòng dữ liệu mẫu để trống, tránh vô tình đưa dữ liệu giả vào database.
     *
     * @returns {string} Nội dung CSV UTF-8.
     */
    function createTemplateCsv() {
        return `\uFEFF${CSV_HEADERS.join(',')}\n`;
    }

    /**
     * Tải template CSV về máy GVCN.
     */
    function downloadTemplateCsv() {
        const blob = new Blob(
            [createTemplateCsv()],
            {
                type: 'text/csv;charset=utf-8',
            },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'template_hoc_sinh_6-3.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    /**
     * Hiển thị thông báo lỗi trong vùng có sẵn của modal import.
     *
     * @param {HTMLElement} box Element hiển thị lỗi.
     * @param {string} message Nội dung lỗi.
     */
    function showImportError(box, message) {
        box.hidden = false;
        box.textContent = message;
        box.style.color = '#b42318';
        box.style.marginTop = '10px';
    }

    /**
     * Xóa thông báo lỗi import.
     *
     * @param {HTMLElement} box Element hiển thị lỗi.
     */
    function clearImportError(box) {
        box.hidden = true;
        box.textContent = '';
    }

    /**
     * Mở modal preview dữ liệu CSV.
     *
     * Chưa INSERT vào database tại thời điểm mở modal.
     * Chỉ nút "Nhập vào hệ thống" mới thực hiện INSERT.
     *
     * @param {string} fileName Tên file người dùng chọn.
     * @param {string} csvText Nội dung CSV.
     */
    function openCsvPreview(fileName, csvText) {
        try {
            const matrix = parseCsv(csvText);
            const { rows } = mapCsvRows(matrix);
            const validation = validateImportRows(
                rows,
                Array.isArray(students) ? students : [],
            );

            renderImportPreview(
                fileName,
                validation.validRows,
                validation.errors,
            );
        } catch (error) {
            openImportMessageModal(
                'Không đọc được file CSV',
                error?.message || 'File CSV không hợp lệ.',
            );
        }
    }

    /**
     * Tạo modal thông báo đơn giản theo style hiện tại.
     *
     * @param {string} title Tiêu đề.
     * @param {string} message Nội dung.
     */
    function openImportMessageModal(title, message) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>${escapeHtml(title)}</h3>
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
                </div>
                <div class="modal-body">
                    <div class="notice danger">
                        ${escapeHtml(message)}
                    </div>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>
                        Đóng
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', () => modal.remove());
        });
    }

    /**
     * Escape HTML độc lập cho module import.
     * Không phụ thuộc vào helper `esc` để test dễ dàng hơn.
     *
     * @param {unknown} value Giá trị cần escape.
     * @returns {string} Chuỗi HTML-safe.
     */
    function escapeHtml(value) {
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
     * Hiển thị preview và kết quả validation trước khi import.
     *
     * @param {string} fileName Tên file.
     * @param {object[]} validRows Các dòng hợp lệ.
     * @param {object[]} errors Các dòng lỗi.
     */
    function renderImportPreview(fileName, validRows, errors) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';

        const canImport = validRows.length > 0 && errors.length === 0;
        const previewRows = validRows.slice(0, 20);

        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>Kiểm tra file CSV</h3>
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
                </div>

                <div class="modal-body">
                    <div class="statrow">
                        <span class="pill">
                            File: <b>${escapeHtml(fileName)}</b>
                        </span>
                        <span class="pill">
                            Hợp lệ: <b>${validRows.length}</b>
                        </span>
                        <span class="pill">
                            Lỗi: <b>${errors.length}</b>
                        </span>
                    </div>

                    <div class="notice" style="margin-top:12px">
                        ${canImport
                            ? 'Tất cả dòng đều hợp lệ. Chị có thể nhập vào hệ thống.'
                            : 'Chưa thể nhập. Hãy sửa toàn bộ dòng lỗi rồi chọn lại file.'}
                    </div>

                    ${errors.length
                        ? `
                            <div class="section">
                                <h4>Dòng cần sửa</h4>
                                <div class="tablewrap">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Dòng</th>
                                                <th>Họ tên</th>
                                                <th>Mã HS</th>
                                                <th>Lỗi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${errors
                                                .slice(0, 50)
                                                .map((error) => `
                                                    <tr>
                                                        <td>${error.rowNumber}</td>
                                                        <td>${escapeHtml(error.fullName)}</td>
                                                        <td>${escapeHtml(error.studentCode)}</td>
                                                        <td>${escapeHtml(error.reasons.join(' '))}</td>
                                                    </tr>
                                                `)
                                                .join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `
                        : ''}

                    ${validRows.length
                        ? `
                            <div class="section">
                                <h4>Preview ${previewRows.length}/${validRows.length} dòng đầu</h4>
                                <div class="tablewrap">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Họ tên</th>
                                                <th>Mã HS</th>
                                                <th>Giới tính</th>
                                                <th>Tổ</th>
                                                <th>Mức hỗ trợ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${previewRows
                                                .map((row) => `
                                                    <tr>
                                                        <td>${escapeHtml(row.full_name)}</td>
                                                        <td>${escapeHtml(row.student_code)}</td>
                                                        <td>${escapeHtml(row.gender || '—')}</td>
                                                        <td>${escapeHtml(row.team ?? '—')}</td>
                                                        <td>${escapeHtml(row.support_level || 'Không')}</td>
                                                    </tr>
                                                `)
                                                .join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `
                        : ''}

                    <div
                        id="studentsImportError"
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
                        class="btn primary"
                        type="button"
                        id="studentsImportSubmit"
                        ${canImport ? '' : 'disabled'}
                    >
                        Nhập ${validRows.length} HS
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', () => modal.remove());
        });

        const submitButton = modal.querySelector(
            '#studentsImportSubmit',
        );
        const errorBox = modal.querySelector(
            '#studentsImportError',
        );

        if (!canImport || !submitButton) {
            return;
        }

        submitButton.addEventListener('click', async () => {
            await submitBulkImport(
                modal,
                submitButton,
                errorBox,
                validRows,
            );
        });
    }

    /**
     * INSERT toàn bộ dữ liệu hợp lệ vào Supabase.
     *
     * Supabase nhận một array trong một request. Nếu database trả lỗi,
     * ứng dụng không tự chạy lại từng dòng riêng lẻ, tránh trạng thái
     * import nửa chừng ở phía UI.
     *
     * @param {HTMLElement} modal Modal preview.
     * @param {HTMLButtonElement} submitButton Nút submit.
     * @param {HTMLElement} errorBox Vùng lỗi.
     * @param {object[]} validRows Dữ liệu hợp lệ.
     */
    async function submitBulkImport(
        modal,
        submitButton,
        errorBox,
        validRows,
    ) {
        clearImportError(errorBox);
        submitButton.disabled = true;
        submitButton.textContent = 'Đang nhập...';

        try {
            const payload = buildInsertPayload(validRows);
            const { data, error } = await sb
                .from('students')
                .insert(payload)
                .select(
                    'id,full_name,student_code,gender,team,support_level',
                );

            if (error) {
                throw error;
            }

            modal.remove();

            if (typeof loadAll === 'function') {
                await loadAll();
            }

            const insertedCount = Array.isArray(data)
                ? data.length
                : validRows.length;

            openImportMessageModal(
                'Nhập HS thành công',
                `Đã thêm ${insertedCount} HS vào hệ thống.`,
            );
        } catch (error) {
            console.error(
                '[Students Import] Bulk insert failed:',
                error,
            );

            showImportError(
                errorBox,
                formatDatabaseError(error),
            );

            submitButton.disabled = false;
            submitButton.textContent = `Nhập ${validRows.length} HS`;
        }
    }

    /**
     * Chuyển lỗi database thành thông báo có thể hiểu được với GVCN.
     *
     * @param {object} error Lỗi Supabase/PostgREST.
     * @returns {string} Thông báo thân thiện.
     */
    function formatDatabaseError(error) {
        if (error?.code === '23505') {
            return 'Có mã HS bị trùng trong database. Hãy kiểm tra lại file CSV và thử lại.';
        }

        return error?.message ||
            'Không thể nhập dữ liệu. Vui lòng kiểm tra file và thử lại.';
    }

    /**
     * Mở hộp chọn file CSV.
     */
    function openCsvImportPicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';

        input.addEventListener('change', async () => {
            const file = input.files?.[0];

            if (!file) {
                return;
            }

            if (
                !file.name.toLowerCase().endsWith('.csv') &&
                file.type !== 'text/csv'
            ) {
                openImportMessageModal(
                    'File không hợp lệ',
                    'Vui lòng chọn file CSV.',
                );
                return;
            }

            try {
                const csvText = await file.text();
                openCsvPreview(file.name, csvText);
            } catch (error) {
                console.error(
                    '[Students Import] Không đọc được file:',
                    error,
                );
                openImportMessageModal(
                    'Không đọc được file',
                    'Trình duyệt không thể đọc file CSV này.',
                );
            }
        });

        input.click();
    }

    /**
     * Gắn các nút import vào toolbar Học sinh.
     *
     * Không sửa markup HTML hiện có, giảm rủi ro ảnh hưởng page legacy.
     */
    function mountImportControls() {
        const actions = document.querySelector(
            '#students .section-title .actions',
        );

        if (!actions || actions.dataset.importReady === 'true') {
            return;
        }

        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.className = 'btn';
        downloadButton.textContent = 'Tải mẫu CSV';
        downloadButton.title =
            'Tải file mẫu để nhập nhiều HS cùng lúc';
        downloadButton.addEventListener(
            'click',
            downloadTemplateCsv,
        );

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'btn';
        importButton.textContent = 'Nhập CSV';
        importButton.title =
            'Nhập danh sách nhiều HS từ file CSV';
        importButton.addEventListener(
            'click',
            openCsvImportPicker,
        );

        const addButton = actions.querySelector(
            'button[onclick="openStudentForm()"]',
        );

        if (addButton) {
            actions.insertBefore(downloadButton, addButton);
            actions.insertBefore(importButton, addButton);
        } else {
            actions.append(downloadButton, importButton);
        }

        actions.dataset.importReady = 'true';
    }

    /**
     * Public API dùng cho test và các module V6 khác.
     */
    window.StudentsImportV6 = {
        CSV_HEADERS,
        parseCsv,
        mapCsvRows,
        validateImportRows,
        buildInsertPayload,
        createTemplateCsv,
        downloadTemplateCsv,
        openCsvImportPicker,
    };

    /**
     * Khởi tạo sau khi DOM sẵn sàng.
     */
    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            mountImportControls,
            { once: true },
        );
    } else {
        mountImportControls();
    }
})();
