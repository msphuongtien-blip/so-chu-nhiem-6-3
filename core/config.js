/**
 * FILE: core/config.js
 *
 * Mục đích:
 * Chứa các cấu hình tĩnh dùng chung cho toàn bộ ứng dụng.
 *
 * Quy tắc:
 * - Không chứa dữ liệu học sinh.
 * - Không chứa logic nghiệp vụ.
 * - Không khởi tạo Supabase ở file này.
 *
 * Đây cũng là integration layer tạm thời trong quá trình tách V5 sang V6.
 */

const APP_VERSION = 'V5-SUPABASE-DATABASE';

const CONFIG = {
    SUPABASE_URL:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    SUPABASE_ANON_KEY:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

/**
 * Nạp một module JavaScript một lần.
 *
 * Config chỉ chịu trách nhiệm nối các module vào runtime.
 */
function loadConfigModule(scriptId, source) {
    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = source;
    script.defer = true;

    document.head.appendChild(script);
}

/**
 * Import CSV V6.
 */
loadConfigModule(
    'students-import-v6-script',
    'students-import-v6.js',
);

/**
 * Criteria Settings V6.
 */
loadConfigModule(
    'competition-criteria-settings-boot-v6-script',
    'competition-criteria-settings-boot-v6.js',
);

/**
 * Đồng bộ lịch sử record V6.
 */
loadConfigModule(
    'competition-record-sync-v6-script',
    'competition-record-sync-v6.js',
);

/**
 * Student Picker V6.
 */
loadConfigModule(
    'competition-student-picker-v6-script',
    'competition-record-student-picker-v6.js',
);

/**
 * Helper render V6.
 */
loadConfigModule(
    'competition-render-helpers-v6-script',
    'competition-render-helpers-v6.js',
);

/**
 * UX V6 cho xếp hạng và form Sửa record.
 */
loadConfigModule(
    'competition-ux-v6-script',
    'competition-ux-v6.js',
);
