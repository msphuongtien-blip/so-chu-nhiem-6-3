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

/**
 * Đồng bộ state sau khi sửa record.
 */
loadConfigModule(
    'competition-record-edit-sync-v6-script',
    'competition-record-edit-sync-v6.js',
);

/**
 * Bảo đảm Cài đặt tiêu chí luôn sử dụng layout nhóm V6.
 */
loadConfigModule(
    'competition-criteria-settings-ux-v6-script',
    'competition-criteria-settings-ux-v6.js',
);

/**
 * Calculation Engine V6.
 *
 * Engine thuần tính toán, không phụ thuộc DOM hay Supabase.
 */
loadConfigModule(
    'competition-calculation-v6-script',
    'competition-calculation-v6.js',
);

/**
 * Calculation Runtime V6.
 *
 * Adapter nối engine vào renderer Thi đua legacy trong giai đoạn chuyển tiếp.
 */
loadConfigModule(
    'competition-calculation-runtime-v6-script',
    'competition-calculation-runtime-v6.js',
);

/**
 * Record Date V6.
 *
 * GVCN chỉ chọn ngày ghi nhận; module tự suy ra tuần tương ứng.
 */
loadConfigModule(
    'competition-record-date-v6-script',
    'competition-record-date-v6.js',
);

/**
 * Edit Record Date V6.
 *
 * Form Sửa cũng chỉ cho chọn ngày; tuần được suy ra tự động từ ngày.
 */
loadConfigModule(
    'competition-record-edit-date-v6-script',
    'competition-record-edit-date-v6.js',
);
