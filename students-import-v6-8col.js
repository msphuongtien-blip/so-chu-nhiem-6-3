/**
 * FILE: students-import-v6-8col.js
 *
 * Mục đích:
 * C1.6 quản lý bulk import HS từ CSV theo đúng format CSV hiện tại của
 * hệ thống:
 * STT,Họ tên,Mã HS,Giới tính,Tổ,Thi đua,Mức hỗ trợ,Ghi chú
 *
 * Quy tắc:
 * - STT và Thi đua chỉ để tương thích với file export, không ghi vào DB.
 * - Họ tên và Mã HS là dữ liệu bắt buộc.
 * - Ghi chú được map vào `special_note` hiện có.
 * - Không import các field hệ thống hoặc điểm tính toán.
 * - Không INSERT trước khi GVCN nhìn thấy preview và xác nhận.
 */

(() => {
    'use strict';

    const CSV_HEADERS = [
        'STT',
        'Họ tên',
        'Mã HS',
        'Giới tính',
        'Tổ',
        'Thi đua',
        'Mức hỗ trợ',
        'Ghi chú',
    ];

    const REQUIRED_HEADERS = [
        'Họ tên',
        'Mã HS',
    ];

    const FIELD_MAP = {
        'Họ tên': 'full_name',
        'Mã HS': 'student_code',
        'Giới tính': 'gender',
        'Tổ': 'team',
        'Mức hỗ trợ': 'support_level',
        'Ghi chú': 'special_note',
    };

    const IGNORED_HEADERS = new Set([
        'STT',
        'Thi đua',
    ]);

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

    function normalizeCell(value) {
        return String(value ?? '')
            .replace(/^\uFEFF/, '')
            .trim();
    }

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
     * Parse CSV chuẩn RFC-like cho trường hợp dấu phẩy và xuống dòng nằm
     * trong ô có dấu ngoặc kép.
     */
    function parseCsv(csvText) {
        const text = String(csvText ?? '').replace(/^\uFEFF/, '');
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            const next = text[index + 1];

            if (character === '"') {
                if (inQuotes && next === '"') {
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
                if (character === '\r' && next === '\n') {
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
     * Map theo tên header, không phụ thuộc thứ tự cột.
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

        const requiredMissing = REQUIRED_HEADERS.filter(
            (header) => !normalized.includes(header.toLowerCase()),
        );

        if (requiredMissing.length) {
            throw new Error(
                `Thiếu cột bắt buộc: ${requiredMissing.join(', ')}`,
            );
        }

        const unknownHeaders = headers.filter((header) =>
            !CSV_HEADERS.some(
                (allowed) => allowed.toLowerCase() === header.toLowerCase(),
            ),
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

                headers.forEach((header, columnIndex) => {
                    const canonicalHeader = CSV_HEADERS.find(
                        (allowed) =>
                            allowed.toLowerCase() === header.toLowerCase(),
                    );

                    row[canonicalHeader] = normalizeCell(values[columnIndex]);
                });

                return row;
            })
            .filter((row) =>
                CSV_HEADERS.some(
                    (header) =>
                        !IGNORED_HEADERS.has(header) && row[header] !== '',
                ),
            );

        return { headers, rows };
    }

    /**
     * Chuẩn hóa giá trị Tổ. Chấp nhận cả `1` và `Tổ 1` để file export và
     * file do GVCN tự tạo đều có thể dùng được.
     */
    function normalizeTeam(value) {
        const text = normalizeCell(value);
        const matched = text.match(/^(?:Tổ\s*)?(\d+)$/i);
        return matched ? Number(matched[1]) : null;
    }

    function validateImportRows(rows, existingStudents = []) {
        const errors = [];
        const validRows = [];
        const seenCodes = new Map();
        const existingCodes = new Set(
            existingStudents.map((student) =>
                normalizeCell(student.student_code),
            ),
        );

        rows.forEach((row) => {
            const reasons = [];
            const name = normalizeCell(row['Họ tên']);
            const code = normalizeCell(row['Mã HS']);
            const teamText = normalizeCell(row['Tổ']);

            if (!name) {
                reasons.push('Thiếu họ tên.');
            }

            if (!/^\d{4,}$/.test(code)) {
                reasons.push('Mã HS phải gồm ít nhất 4 chữ số.');
            }

            if (existingCodes.has(code)) {
                reasons.push('Mã HS đã tồn tại trong hệ thống.');
            }

            if (seenCodes.has(code)) {
                reasons.push(
                    `Trùng mã HS với dòng ${seenCodes.get(code)} trong file.`,
                );
            }

            if (
                row['Giới tính'] &&
                !ALLOWED_GENDERS.has(row['Giới tính'])
            ) {
                reasons.push('Giới tính chỉ nhận: Nam, Nữ hoặc Khác.');
            }

            if (teamText) {
                const team = normalizeTeam(teamText);

                if (!Number.isInteger(team) || team < 1 || team > 4) {
                    reasons.push('Tổ phải là số 1–4 hoặc dạng Tổ 1–Tổ 4.');
                }
            }

            if (
                row['Mức hỗ trợ'] &&
                !ALLOWED_SUPPORT_LEVELS.has(row['Mức hỗ trợ'])
            ) {
                reasons.push(
                    'Mức hỗ trợ chỉ nhận: Không, Cần hỗ trợ, Cần can thiệp.',
                );
            }

            if (code) {
                seenCodes.set(code, row.__rowNumber);
            }

            if (reasons.length) {
                errors.push({
                    rowNumber: row.__rowNumber,
                    fullName: name || '(trống)',
                    studentCode: code || '(trống)',
                    reasons,
                });
                return;
            }

            validRows.push({
                full_name: name,
                student_code: code,
                gender: row['Giới tính'] || null,
                team: teamText ? normalizeTeam(teamText) : null,
                support_level: row['Mức hỗ trợ'] || 'Không',
                special_note: row['Ghi chú'] || '',
            });
        });

        return { validRows, errors };
    }

    function buildInsertPayload(rows) {
        return rows.map((row) => {
            const payload = {};

            Object.values(FIELD_MAP).forEach((field) => {
                payload[field] = row[field] ?? null;
            });

            return payload;
        });
    }

    function createTemplateCsv() {
        return `\uFEFF${CSV_HEADERS.join(',')}\n`;
    }

    function downloadTemplateCsv() {
        const blob = new Blob(
            [createTemplateCsv()],
            { type: 'text/csv;charset=utf-8' },
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

    function renderImportModal() {
        const existing = document.getElementById('studentsCsvImportModal');

        if (existing) {
            existing.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'studentsCsvImportModal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-head">
                    <div>
                        <h3>Nhập danh sách HS từ CSV</h3>
                        <div class="mini">
                            Dùng đúng file 8 cột của hệ thống.
                        </div>
                    </div>
                    <button class="btn small" type="button" data-close>
                        Đóng
                    </button>
                </div>

                <div class="modal-body">
                    <div class="notice">
                        <b>Format:</b>
                        STT · Họ tên · Mã HS · Giới tính · Tổ · Thi đua ·
                        Mức hỗ trợ · Ghi chú
                    </div>

                    <div class="actions" style="margin-top:12px">
                        <button
                            class="btn"
                            type="button"
                            id="studentsCsvTemplateButton"
                        >
                            Tải mẫu CSV
                        </button>
                        <label class="btn primary" for="studentsCsvFile">
                            Chọn file CSV
                        </label>
                        <input
                            id="studentsCsvFile"
                            type="file"
                            accept=".csv,text/csv"
                            hidden
                        >
                    </div>

                    <div id="studentsCsvFileName" class="mini" style="margin-top:8px">
                        Chưa chọn file.
                    </div>
                    <div id="studentsCsvSummary" style="margin-top:12px"></div>
                    <div id="studentsCsvPreview" style="margin-top:12px"></div>
                    <div id="studentsCsvError" class="mini" hidden></div>
                </div>

                <div class="modal-foot">
                    <button class="btn" type="button" data-close>
                        Hủy
                    </button>
                    <button
                        class="btn primary"
                        type="button"
                        id="studentsCsvImportButton"
                        disabled
                    >
                        Nhập vào hệ thống
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const fileInput = modal.querySelector('#studentsCsvFile');
        const fileName = modal.querySelector('#studentsCsvFileName');
        const summary = modal.querySelector('#studentsCsvSummary');
        const preview = modal.querySelector('#studentsCsvPreview');
        const errorBox = modal.querySelector('#studentsCsvError');
        const importButton = modal.querySelector('#studentsCsvImportButton');

        let pendingPayload = [];

        modal.querySelectorAll('[data-close]').forEach((button) => {
            button.addEventListener('click', () => modal.remove());
        });

        modal
            .querySelector('#studentsCsvTemplateButton')
            .addEventListener('click', downloadTemplateCsv);

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files?.[0];

            if (!file) {
                return;
            }

            clearState();
            fileName.textContent = `File đã chọn: ${file.name}`;

            try {
                const text = await file.text();
                const { rows } = mapCsvRows(parseCsv(text));
                const result = validateImportRows(
                    rows,
                    Array.isArray(students) ? students : [],
                );

                pendingPayload = buildInsertPayload(result.validRows);

                summary.innerHTML = `
                    <div class="statrow">
                        <span class="pill">Tổng dòng: <b>${rows.length}</b></span>
                        <span class="pill">Hợp lệ: <b>${result.validRows.length}</b></span>
                        <span class="pill">Lỗi: <b>${result.errors.length}</b></span>
                    </div>
                `;

                renderPreview(
                    result.validRows,
                    result.errors,
                );

                importButton.disabled =
                    result.errors.length > 0 ||
                    result.validRows.length === 0;
            } catch (error) {
                showImportError(
                    errorBox,
                    error?.message || 'Không thể đọc file CSV.',
                );
                importButton.disabled = true;
            }
        });

        importButton.addEventListener('click', async () => {
            if (!pendingPayload.length) {
                return;
            }

            importButton.disabled = true;
            importButton.textContent = 'Đang nhập...';

            try {
                if (role !== 'teacher') {
                    throw new Error('Chỉ GVCN mới được phép nhập HS.');
                }

                const { error } = await sb
                    .from('students')
                    .insert(pendingPayload);

                if (error) {
                    throw error;
                }

                if (typeof loadAll === 'function') {
                    await loadAll();
                }

                summary.innerHTML = `
                    <div class="notice">
                        <b>Đã nhập ${pendingPayload.length} HS thành công.</b>
                        Danh sách đã được đồng bộ lại từ Supabase.
                    </div>
                `;
                preview.innerHTML = '';
                fileName.textContent = 'Đã hoàn tất import.';
            } catch (error) {
                showImportError(
                    errorBox,
                    error?.message || 'Không thể nhập HS vào hệ thống.',
                );
                importButton.disabled = false;
                importButton.textContent = 'Nhập vào hệ thống';
            }
        });

        function clearState() {
            summary.innerHTML = '';
            preview.innerHTML = '';
            errorBox.hidden = true;
            errorBox.textContent = '';
            pendingPayload = [];
            importButton.disabled = true;
            importButton.textContent = 'Nhập vào hệ thống';
        }

        function showImportError(target, message) {
            target.hidden = false;
            target.textContent = message;
            target.style.color = '#b42318';
            target.style.marginTop = '10px';
        }

        function renderPreview(validRows, errors) {
            const validHtml = validRows
                .map(
                    (row, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${escapeHtml(row.full_name)}</td>
                            <td>${escapeHtml(row.student_code)}</td>
                            <td>${escapeHtml(row.gender || '')}</td>
                            <td>${row.team ?? ''}</td>
                            <td>${escapeHtml(row.support_level || '')}</td>
                            <td>${escapeHtml(row.special_note || '')}</td>
                        </tr>
                    `,
                )
                .join('');

            const errorHtml = errors
                .map(
                    (item) => `
                        <div class="notice danger" style="margin-top:6px">
                            Dòng ${item.rowNumber} ·
                            <b>${escapeHtml(item.fullName)}</b> ·
                            ${escapeHtml(item.studentCode)}
                            <div class="mini">
                                ${escapeHtml(item.reasons.join(' '))}
                            </div>
                        </div>
                    `,
                )
                .join('');

            preview.innerHTML = `
                ${
                    validRows.length
                        ? `
                            <h4>Preview dòng hợp lệ</h4>
                            <div class="tablewrap">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>STT</th>
                                            <th>Họ tên</th>
                                            <th>Mã HS</th>
                                            <th>Giới tính</th>
                                            <th>Tổ</th>
                                            <th>Mức hỗ trợ</th>
                                            <th>Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>${validHtml}</tbody>
                                </table>
                            </div>
                        `
                        : ''
                }
                ${
                    errors.length
                        ? `<h4 style="margin-top:16px">Dòng cần sửa</h4>${errorHtml}`
                        : ''
                }
            `;
        }
    }

    function mountImportControls() {
        const actions = document.querySelector(
            '#students .section-title .actions',
        );

        if (!actions || actions.dataset.csvImportReady === 'true') {
            return;
        }

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'btn';
        importButton.textContent = 'Nhập CSV';
        importButton.title = 'Nhập nhiều HS từ file CSV';
        importButton.addEventListener('click', renderImportModal);

        const addButton = actions.querySelector(
            'button[onclick="openStudentForm()"]',
        );

        if (addButton) {
            actions.insertBefore(importButton, addButton);
        } else {
            actions.appendChild(importButton);
        }

        actions.dataset.csvImportReady = 'true';
    }

    window.StudentsImportV6 = {
        CSV_HEADERS,
        parseCsv,
        mapCsvRows,
        validateImportRows,
        buildInsertPayload,
        createTemplateCsv,
        downloadTemplateCsv,
        renderImportModal,
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
