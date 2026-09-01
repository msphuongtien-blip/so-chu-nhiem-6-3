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
 * - Bảo đảm module được nạp theo đúng thứ tự khai báo.
 */

function loadApplicationModule(scriptId, source) {
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
        return Promise.resolve(existingScript);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = source;
        script.defer = true;
        script.addEventListener('load', () => resolve(script), {
            once: true,
        });
        script.addEventListener('error', () => {
            reject(
                new Error(
                    `Không thể nạp module ứng dụng: ${source}`,
                ),
            );
        }, { once: true });
        document.head.appendChild(script);
    });
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
        'competition-record-form-v6-script',
        'competition-record-form-v6.js',
    ],
    [
        'competition-record-write-boundary-v6-script',
        'competition-record-write-boundary-v6.js',
    ],
    [
        'competition-ranking-ui-v6-script',
        'competition-ranking-ui-v6.js',
    ],
    [
        'competition-legacy-boundary-v6-script',
        'competition-legacy-boundary-v6.js',
    ],
    [
        'competition-record-form-clean-v6-script',
        'competition-record-form-clean-v6.js',
    ],
    [
        'competition-record-date-v6-script',
        'competition-record-date-v6.js',
    ],
    [
        'competition-record-edit-date-v6-script',
        'competition-record-edit-date-v6.js',
    ],
    [
        'competition-ranking-columns-v6-script',
        'competition-ranking-columns-v6.js',
    ],
    [
        'competition-issues-service-v6-script',
        'competition-issues-service-v6.js',
    ],
    [
        'competition-issues-renderer-v6-script',
        'competition-issues-renderer-v6.js',
    ],
    [
        'competition-snapshot-notification-v6-script',
        'competition-snapshot-notification-v6.js',
    ],
    [
        'student-autocomplete-v6-script',
        'student-autocomplete-v6.js',
    ],
    [
        'competition-record-form-final-v6-script',
        'competition-record-form-final-v6.js',
    ],
    ['test-center-entry-v6-script', 'test-center-entry-v6.js'],
];

/**
 * Nạp tuần tự để các module phụ thuộc không chạy trước module nền.
 */
async function loadApplicationModulesV6() {
    for (const [scriptId, source] of APPLICATION_MODULES) {
        try {
            await loadApplicationModule(scriptId, source);
        } catch (error) {
            console.error('[V6 Module Loader] Failed:', source, error);
        }
    }
}

globalThis.ApplicationModuleLoaderV6 = Object.freeze({
    loadApplicationModule,
    loadApplicationModulesV6,
    APPLICATION_MODULES,
});

loadApplicationModulesV6();
