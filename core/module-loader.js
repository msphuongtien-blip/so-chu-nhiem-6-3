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

const V6_ASSET_VERSION = '20260906-competition-render-pipeline-1';

function loadApplicationModule(scriptId, source) {
    /*
     * Module scripts are loaded dynamically, so they need the same cache-bust
     * version as the entry scripts in index.html. This prevents one browser
     * from running an older V6 module after another browser has the new one.
     */
    const versionedSource = source.includes('?')
        ? `${source}&v=${V6_ASSET_VERSION}`
        : `${source}?v=${V6_ASSET_VERSION}`;
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
        return Promise.resolve(existingScript);
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = versionedSource;
        script.defer = true;
        script.addEventListener('load', () => resolve(script), {
            once: true,
        });
        script.addEventListener('error', () => {
            reject(
                new Error(
                    `Không thể nạp module ứng dụng: ${versionedSource}`,
                ),
            );
        }, { once: true });
        document.head.appendChild(script);
    });
}

const APPLICATION_MODULES = [
    ['competition-category-v6-script', 'modules/competition/competition-v6-category.js'],

    ['students-import-v6-script', 'modules/students/students-import-v6.js'],
    [
        'competition-criteria-settings-boot-v6-script',
        'modules/competition/competition-criteria-v6.js',
    ],
    [
        'competition-record-sync-v6-script',
        'modules/competition/competition-record-sync-v6.js',
    ],
    [
        'competition-student-picker-v6-script',
        'modules/competition/competition-record-student-picker-v6.js',
    ],
    [
        'competition-render-helpers-v6-script',
        'modules/competition/competition-renderer-v6.js',
    ],
    ['competition-ux-v6-script', 'modules/competition/competition-ux-v6.js'],
    [
        'competition-record-edit-sync-v6-script',
        'modules/competition/competition-record-sync-v6.js',
    ],
    [
        'competition-criteria-settings-ux-v6-script',
        'modules/competition/competition-criteria-v6.js',
    ],
    [
        'competition-calculation-v6-script',
        'modules/competition/competition-calculation-v6.js',
    ],
    [
        'competition-calculation-runtime-v6-script',
        'modules/competition/competition-calculation-runtime-v6.js',
    ],
    [
        'competition-record-form-v6-script',
        'modules/competition/competition-record-form-v6.js',
    ],
    [
        'competition-record-write-boundary-v6-script',
        'modules/competition/competition-record-boundary-v6.js',
    ],
    [
        'competition-ranking-ui-v6-script',
        'modules/competition/competition-ranking-ui-v6.js',
    ],
    [
        'competition-legacy-boundary-v6-script',
        'modules/competition/competition-record-boundary-v6.js',
    ],
    [
        'competition-record-form-clean-v6-script',
        'modules/competition/competition-record-form-v6.js',
    ],
    [
        'competition-record-date-v6-script',
        'modules/competition/competition-record-date-v6.js',
    ],
    [
        'competition-record-edit-date-v6-script',
        'modules/competition/competition-record-date-v6.js',
    ],
    [
        'competition-ranking-columns-v6-script',
        'modules/competition/competition-ranking-columns-v6.js',
    ],
    [
        'competition-issues-service-v6-script',
        'modules/competition/competition-issues-service-v6.js',
    ],
    [
        'competition-issues-renderer-v6-script',
        'modules/competition/competition-issues-renderer-v6.js',
    ],
    [
        'competition-recalculation-v6-script',
        'modules/competition/competition-recalculation-v6.js',
    ],
    [
        'competition-snapshot-notification-v6-script',
        'modules/competition/competition-snapshot-notification-v6.js',
    ],
    [
        'competition-snapshot-edit-v6-script',
        'modules/competition/competition-snapshot-edit-v6.js',
    ],
    [
        'student-autocomplete-v6-script',
        'modules/students/student-autocomplete-v6.js',
    ],
    [
        'competition-record-form-final-v6-script',
        'modules/competition/competition-record-form-v6.js',
    ],
    ['test-center-entry-v6-script', 'test-center-entry-v6.js'],
    [
        'competition-render-pipeline-v6-script',
        'modules/competition/competition-renderer-v6.js',
    ],
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

const applicationModulesReadyV6 = loadApplicationModulesV6();

globalThis.ApplicationModuleLoaderV6 = Object.freeze({
    loadApplicationModule,
    loadApplicationModulesV6,
    APPLICATION_MODULES,
    ready: applicationModulesReadyV6,
});
