/**
 * FILE: students-import-v6.js
 *
 * Mục đích:
 * Bulk import HS bằng CSV với contract tối giản:
 * Họ tên, Giới tính, Ghi chú.
 *
 * Quy tắc:
 * - STT do giao diện tự tạo.
 * - Mã HS do hệ thống tự sinh theo rule của form thêm 1 HS.
 * - Tổ bổ sung sau trên web.
 * - Thi đua do module Thi đua quản lý.
 * - Mức hỗ trợ dùng default "Không" của database.
 * - Ô trống không được đưa vào payload INSERT.
 */

(() => {
    'use strict';

    const CSV_HEADERS = ['Họ tên', 'Giới tính', 'Ghi chú'];
    const REQUIRED_HEADERS = ['Họ tên'];
    const ALLOWED_GENDERS = new Set(['Nam', 'Nữ', 'Khác']);

    /** Chuẩn hóa một ô CSV và bỏ BOM/khoảng trắng dư. */
    function normalizeCell(value) {
        return String(value ?? '')
            .replace(/^\uFEFF/, '')
            .trim();
    }

    /**
     * Parse CSV có hỗ trợ dấu phẩy trong ô, dấu ngoặc kép và CRLF/LF.
     *
     * @param {string} text Nội dung CSV.
     * @returns {string[][]} Ma trận dòng/cột.
     */
    function parseCsv(text) {
        const input = String(text ?? '').replace(/^\uFEFF/, '');
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;

        for (let i = 0; i < input.length; i += 1) {
            const char = input[i];
            const next = input[i + 1];

            if (char === '"') {
                if (quoted && next === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
                continue;
            }

            if (char === ',' && !quoted) {
                row.push(cell);
                cell = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !quoted) {
                if (char === '\r' && next === '\n') {
                    i += 1;
                }
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
                continue;
            }

            cell += char;
        }

        if (quoted) {
            throw new Error('File CSV có dấu ngoặc kép chưa được đóng đúng cách.');
        }

        if (cell !== '' || row.length > 0) {
            row.push(cell);
            rows.push(row);
        }

        return rows;
    }

    /**
     * Map CSV theo tên header để người dùng có thể đổi thứ tự cột.
     * Chỉ 3 header chính thức được chấp nhận.
     */
    function mapCsvRows(matrix) {
        if (!matrix.length) {
            throw new Error('File CSV đang trống.');
        }

        const headers = matrix[0].map(normalizeCell);
        const normalized = headers.map((header) => header.toLowerCase());

        const duplicate = normalized.find(
            (header, index) => normalized.indexOf(header) !== index,
        );
        if (duplicate) {
            throw new Error(`Header CSV bị trùng: ${duplicate}`);
        }

        const missing = REQUIRED_HEADERS.filter(
            (header) => !normalized.includes(header.toLowerCase()),
        );
        if (missing.length) {
            throw new Error(`Thiếu cột bắt buộc: ${missing.join(', ')}`);
        }

        const unknown = normalized.filter(
            (header) =>
                !CSV_HEADERS.some(
                    (allowed) => allowed.toLowerCase() === header,
                ),
        );
        if (unknown.length) {
            throw new Error(
                `CSV có cột không được hỗ trợ: ${unknown.join(', ')}`,
            );
        }

        const rows = matrix.slice(1)
            .map((values, index) => {
                const row = { __rowNumber: index + 2 };

                CSV_HEADERS.forEach((header) => {
                    const columnIndex = normalized.indexOf(header.toLowerCase());
                    row[header] = normalizeCell(
                        columnIndex >= 0 ? values[columnIndex] : '',
                    );
                });

                return row;
            })
            .filter((row) =>
                CSV_HEADERS.some((header) => row[header] !== ''),
            );

        return { headers, rows };
    }

    /**
     * Kiểm tra dữ liệu người dùng nhập.
     * Mã HS không còn nằm trong file nên không validate mã HS tại đây.
     */
    function validateImportRows(rows) {
        const errors = [];
        const validRows = [];

        rows.forEach((row) => {
            const name = normalizeCell(row['Họ tên']);
            const gender = normalizeCell(row['Giới tính']);
            const note = normalizeCell(row['Ghi chú']);
            const rowErrors = [];

            if (!name) {
                rowErrors.push('Thiếu họ tên.');
            }

            if (gender && !ALLOWED_GENDERS.has(gender)) {
                rowErrors.push('Giới tính chỉ nhận: Nam, Nữ hoặc Khác.');
            }

            if (rowErrors.length) {
                errors.push({
                    rowNumber: row.__rowNumber,
                    fullName: name || '(trống)',
                    reasons: rowErrors,
                });
                return;
            }

            validRows.push({
                full_name: name,
                ...(gender ? { gender } : {}),
                ...(note ? { special_note: note } : {}),
            });
        });

        return { validRows, errors };
    }

    /**
     * Lấy prefix mã HS từ tên lớp.
     * Ví dụ lớp 6/3 -> prefix 63.
     */
    function getStudentCodePrefix(className) {
        return String(className || '').trim().replace(/\D/g, '');
    }

    /**
     * Sinh mã HS theo đúng rule đang dùng ở form thêm 1 HS.
     * Không nhận mã HS từ CSV.
     */
    function generateStudentCodes(count, existingStudents, className) {
        const prefix = getStudentCodePrefix(className);
        if (!prefix) {
            throw new Error('Chưa xác định được mã lớp để tạo mã HS.');
        }

        const maxSequence = (existingStudents || [])
            .map((student) => normalizeCell(student.student_code))
            .filter((code) => code.startsWith(prefix))
            .map((code) => Number(code.slice(prefix.length)))
            .filter((value) => Number.isInteger(value) && value > 0)
            .reduce((max, value) => Math.max(max, value), 0);

        return Array.from({ length: count }, (_, index) => {
            const sequence = maxSequence + index + 1;
            return `${prefix}${String(sequence).padStart(2, '0')}`;
        });
    }

    /**
     * Tạo payload INSERT.
     * Các field trống bị loại hoàn toàn; database tự áp dụng default.
     */
    function buildInsertPayload(validRows, studentCodes) {
        if (validRows.length !== studentCodes.length) {
            throw new Error('Số dòng và số mã HS được sinh không khớp.');
        }

        return validRows.map((row, index) => ({
            full_name: row.full_name,
            student_code: studentCodes[index],
            ...(row.gender ? { gender: row.gender } : {}),
            ...(row.special_note
                ? { special_note: row.special_note }
                : {}),
        }));
    }

    /** Tạo template Import CSV 3 cột. */
    function createTemplateCsv() {
        return `\uFEFF${CSV_HEADERS.join(',')}\n`;
    }

    /** Tải template xuống máy GVCN. */
    function downloadTemplateCsv() {
        const blob = new Blob(
            [createTemplateCsv()],
            { type: 'text/csv;charset=utf-8' },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'template_import_hoc_sinh_6-3.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>\"']/g,
            (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '\"': '&quot;',
                "'": '&#039;',
            }[char]),
        );
    }

    /**
     * Preview trước khi ghi DB.
     * Mã HS dự kiến được hiển thị nhưng không phải dữ liệu nhập từ CSV.
     */
    function renderImportPreview(
        fileName,
        validRows,
        errors,
        studentCodes,
    ) {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        const canImport = validRows.length > 0 && errors.length === 0;
        const errorHtml = errors.map((error) => `
            <div class="notice danger" style="margin-bottom:8px">
                <b>Dòng ${error.rowNumber}</b> ·
                ${escapeHtml(error.fullName)}
                <div class="mini">
                    ${escapeHtml(error.reasons.join(' '))}
                </div>
            </div>
        `).join('');

        const rowsHtml = validRows.slice(0, 50).map((row, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(row.full_name)}</td>
                <td>${escapeHtml(studentCodes[index])}</td>
                <td>${escapeHtml(row.gender || '—')}</td>
                <td>${escapeHtml(row.special_note || '—')}</td>
            </tr>
        `).join('');

        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <h3>Nhập danh sách HS</h3>
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
                </div>
                <div class="modal-body">
                    <p class="mini">
                        File: <b>${escapeHtml(fileName)}</b>
                    </p>
                    <div class="notice" style="margin:12px 0">
                        <b>${validRows.length}</b> HS hợp lệ ·
                        <b>${errors.length}</b> dòng lỗi.<br>
                        Mã HS và STT do hệ thống tự tạo ·
                        Mức hỗ trợ mặc định: <b>Không</b>.
                    </div>
                    ${errorHtml}
                    ${canImport ? `
                        <div class="tablewrap">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Họ tên</th>
                                        <th>Mã HS dự kiến</th>
                                        <th>Giới tính</th>
                                        <th>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                    ` : ''}
                    <div id="studentImportRuntimeError"
                         class="notice danger"
                         style="margin-top:10px"
                         hidden></div>
                </div>
                <div class="modal-foot">
                    <button class="btn" type="button" data-close>Hủy</button>
                    <button class="btn primary"
                            type="button"
                            id="studentImportConfirm"
                            ${canImport ? '' : 'disabled'}>
                        Nhập ${validRows.length} HS
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', close);
        });

        if (!canImport) {
            return;
        }

        modal.querySelector('#studentImportConfirm').addEventListener(
            'click',
            async () => {
                const button = modal.querySelector('#studentImportConfirm');
                button.disabled = true;
                button.textContent = 'Đang nhập...';

                try {
                    const payload = buildInsertPayload(
                        validRows,
                        studentCodes,
                    );
                    const { error } = await sb
                        .from('students')
                        .insert(payload);

                    if (error) {
                        throw error;
                    }

                    close();

                    if (typeof loadAll === 'function') {
                        await loadAll();
                    } else if (typeof renderStudents === 'function') {
                        await renderStudents();
                    }
                } catch (error) {
                    button.disabled = false;
                    button.textContent = `Nhập ${validRows.length} HS`;
                    const errorBox = modal.querySelector(
                        '#studentImportRuntimeError',
                    );
                    errorBox.hidden = false;
                    errorBox.textContent =
                        `Không thể import: ${error?.message || error}`;
                }
            },
        );
    }

    /** Mở file picker và tạo preview. */
    async function openCsvImportPicker() {
        if (typeof role !== 'undefined' && role !== 'teacher') {
            openImportMessageModal(
                'Không thể nhập CSV',
                'Chỉ GVCN mới được phép nhập danh sách HS.',
            );
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                const matrix = parseCsv(await file.text());
                const mapped = mapCsvRows(matrix);
                const validation = validateImportRows(mapped.rows);
                const existingStudents = Array.isArray(students)
                    ? students
                    : [];
                const className = classSettings?.class_name || '6/3';
                const codes = generateStudentCodes(
                    validation.validRows.length,
                    existingStudents,
                    className,
                );

                renderImportPreview(
                    file.name,
                    validation.validRows,
                    validation.errors,
                    codes,
                );
            } catch (error) {
                openImportMessageModal(
                    'Không thể đọc file CSV',
                    error?.message || 'File CSV không hợp lệ.',
                );
            }
        });

        input.click();
    }

    /** Tạo modal lỗi độc lập với modal import chính. */
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

    /** Gắn nút Import cạnh nút Xuất CSV của giao diện hiện tại. */
    function mountImportControls() {
        const page = document.getElementById('students');
        const actions = page?.querySelector('.section-title .actions');
        if (!actions || actions.querySelector('#studentCsvImportButton')) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'studentCsvImportButton';
        button.type = 'button';
        button.className = 'btn';
        button.textContent = 'Nhập CSV';
        button.title = 'Nhập danh sách HS từ file CSV';
        button.addEventListener('click', openCsvImportPicker);

        const exportButton = actions.querySelector(
            'button[onclick="exportCSV()"]',
        );

        if (exportButton) {
            exportButton.insertAdjacentElement('afterend', button);
        } else {
            actions.prepend(button);
        }
    }

    window.StudentsImportV6 = {
        CSV_HEADERS,
        parseCsv,
        mapCsvRows,
        validateImportRows,
        getStudentCodePrefix,
        generateStudentCodes,
        buildInsertPayload,
        createTemplateCsv,
        downloadTemplateCsv,
        openCsvImportPicker,
        mountImportControls,
    };

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