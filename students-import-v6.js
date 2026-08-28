/**
 * FILE: students-import-v6.js
 *
 * Mục đích:
 * C1.6.1–C1.6.2 chuẩn hóa contract và UI khởi đầu cho chức năng
 * bulk import học sinh bằng CSV.
 *
 * Phạm vi hiện tại:
 * - Xác định các cột hồ sơ được phép import.
 * - Tạo file template CSV.
 * - Gắn nút "Nhập CSV" và "Tải mẫu CSV" vào khu vực Học sinh.
 *
 * Chưa thực hiện:
 * - Parse CSV thực tế.
 * - Validation từng dòng.
 * - Duplicate detection.
 * - INSERT vào Supabase.
 *
 * Nguyên tắc:
 * - Không cho giáo viên nhập các field hệ thống có default hoặc dữ liệu
 *   tính toán tự động.
 * - Không tạo student ID ở frontend.
 * - Không tạo dữ liệu học sinh giả.
 */

(() => {
    'use strict';

    /**
     * Các cột hồ sơ được phép import.
     *
     * `id`, `user_id`, điểm thi đua, phần trăm điểm danh, timestamp...
     * không nằm trong template vì database tự quản lý các field này.
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

    /**
     * Tạo nội dung CSV mẫu.
     *
     * Dòng dữ liệu mẫu để trống, tránh vô tình đưa dữ liệu giả vào database.
     *
     * @returns {string} Nội dung CSV UTF-8.
     */
    function createTemplateCsv() {
        return `${CSV_HEADERS.join(',')}\n`;
    }

    /**
     * Tải template CSV về máy giáo viên.
     *
     * `Blob` tạo dữ liệu file trực tiếp trong trình duyệt; không cần
     * upload template lên server.
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
     * Mở hộp chọn file CSV.
     *
     * C1.6.3 sẽ tiếp tục từ đây để đọc và validate nội dung file.
     */
    function openCsvImportPicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';

        input.addEventListener('change', () => {
            const file = input.files?.[0];

            if (!file) {
                return;
            }

            window.alert(
                `Đã chọn file "${file.name}".\n` +
                'Phần đọc và kiểm tra CSV sẽ được triển khai ở C1.6.3.',
            );
        });

        input.click();
    }

    /**
     * Gắn các nút bulk import vào toolbar Học sinh.
     *
     * Module chỉ bổ sung UI; không thay đổi markup hiện có trong index.html.
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
            'Tải file mẫu để nhập nhiều học sinh cùng lúc';
        downloadButton.addEventListener(
            'click',
            downloadTemplateCsv,
        );

        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'btn';
        importButton.textContent = 'Nhập CSV';
        importButton.title =
            'Nhập danh sách nhiều học sinh từ file CSV';
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
