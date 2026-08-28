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
 * Compatibility bridges:
 * - Import CSV V6 được nạp động vì index.html hiện vẫn là entry point legacy.
 * - Criteria Settings bootstrap được nạp động để đồng bộ thời điểm
 *   khởi tạo UI với Category V6.
 *
 * Đây chỉ là integration layer tạm thời; UI/business logic vẫn nằm ở module
 * chức năng riêng.
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
 * Module runtime chính thức là `students-import-v6.js`.
 */
(function loadStudentCsvImportModule() {
    const scriptId = 'students-import-v6-script';

    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'students-import-v6.js';
    script.defer = true;

    document.head.appendChild(script);
})();

/**
 * Nạp bridge khởi tạo Criteria Settings.
 *
 * Bridge này không chứa logic Settings; nó chỉ chờ Category V6 và Settings V6
 * sẵn sàng để tránh lỗi race condition khi module được nạp theo nhiều bước.
 */
(function loadCriteriaSettingsBootstrapModule() {
    const scriptId = 'competition-criteria-settings-boot-v6-script';

    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'competition-criteria-settings-boot-v6.js';

    document.head.appendChild(script);
})();
