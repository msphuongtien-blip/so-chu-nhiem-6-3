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
 * Compatibility bridge C1.6:
 * Module import CSV được nạp động vì index.html hiện vẫn là entry point legacy.
 * Sau khi hoàn tất refactor entry point, loader này sẽ được chuyển về
 * index.html và xóa khỏi config.js.
 */

const APP_VERSION = 'V5-SUPABASE-DATABASE';

const CONFIG = {
    SUPABASE_URL:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    SUPABASE_ANON_KEY:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

/**
 * Nạp module import CSV một lần.
 *
 * `defer` ở index.html giữ thứ tự Core → app. Loader này chỉ có nhiệm vụ
 * bridge tạm thời, không chứa logic import.
 */
(function loadStudentCsvImportModule() {
    const scriptId = 'students-import-v6-8col-script';

    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'students-import-v6-8col.js';
    script.defer = true;

    document.head.appendChild(script);
})();
