/**
 * FILE: core/module-loader.js
 *
 * Mục đích:
 * Nạp các module chuyển tiếp V6 sau khi Core và app legacy đã sẵn sàng.
 *
 * Trách nhiệm:
 * - Giữ dependency loading tập trung ở một nơi.
 * - Không đưa DOM, Supabase query hoặc business logic vào Core config.
 * - Bảo đảm mỗi module chỉ được thêm vào DOM một lần.
 *
 * Không chịu trách nhiệm:
 * - Thực hiện nghiệp vụ.
 * - Tạo Supabase client.
 * - Thay đổi dữ liệu database.
 *
 * Dependency:
 * - core/config.js, core/supabase.js, core/state.js, core/utils.js.
 * - app.js phải được load trước module-loader.js.
 */

/**
 * Nạp một classic script chuyển tiếp nếu script chưa tồn tại.
 *
 * @param {string} scriptId ID duy nhất của thẻ script.
 * @param {string} source Đường dẫn module cần nạp.
 * @returns {void}
 */
function loadApplicationModule(scriptId, source) {
    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = source;
    script.defer = true;

    document.head.appendChild(script);
}

const APPLICATION_MODULES = [
    ['students-import-v6-script', 'students-import-v6.js'],
    [
        'competition-criteria-settings-boot-v6-script',
        'competition-criteria-settings-boot-v6.js',
    ],
    [
        'competition-record-sync-v6-script',
        'competition-record-sync-v6.js',
    ],
    [
        'competition-student-picker-v6-script',
        'competition-record-student-picker-v6.js',
    ],
    [
        'competition-render-helpers-v6-script',
        'competition-render-helpers-v6.js',
    ],
    ['competition-ux-v6-script', 'competition-ux-v6.js'],
    [
        'competition-record-edit-sync-v6-script',
        'competition-record-edit-sync-v6.js',
    ],
    [
        'competition-criteria-settings-ux-v6-script',
        'competition-criteria-settings-ux-v6.js',
    ],
    [
        'competition-calculation-v6-script',
        'competition-calculation-v6.js',
    ],
    [
        'competition-calculation-runtime-v6-script',
        'competition-calculation-runtime-v6.js',
    ],
    [
        'competition-record-date-v6-script',
        'competition-record-date-v6.js',
    ],
    [
        'competition-record-edit-date-v6-script',
        'competition-record-edit-date-v6.js',
    ],
    ['test-center-entry-v6-script', 'test-center-entry-v6.js'],
];

APPLICATION_MODULES.forEach(([scriptId, source]) => {
    loadApplicationModule(scriptId, source);
});
