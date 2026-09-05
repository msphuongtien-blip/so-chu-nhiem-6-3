/**
 * FILE: core/module-loader.js
 *
 * Mục đích:
 * Nạp các module ứng dụng theo domain, sau khi Core và app legacy sẵn sàng.
 *
 * Quy tắc:
 * - Một file đại diện cho một domain chức năng.
 * - Không tách module theo từng function nhỏ.
 * - Thứ tự load được giữ rõ ràng để dependency dễ debug.
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
    ['competition-criteria-v6-script', 'competition-criteria-v6.js'],
    ['competition-records-v6-script', 'competition-records-v6.js'],
    ['competition-calculation-v6-script', 'competition-calculation-v6.js'],
    ['competition-ranking-v6-script', 'competition-ranking-v6.js'],
    ['competition-ui-v6-script', 'competition-ui-v6.js'],
    ['competition-issues-v6-script', 'competition-issues-v6.js'],
    ['competition-history-v6-script', 'competition-history-v6.js'],
    ['student-autocomplete-v6-script', 'student-autocomplete-v6.js'],
    ['test-center-entry-v6-script', 'test-center-entry-v6.js'],
];

/**
 * Nạp tuần tự để dependency không chạy trước module nền.
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
