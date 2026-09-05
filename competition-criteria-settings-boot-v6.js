/**
 * FILE: competition-criteria-settings-boot-v6.js
 *
 * Mục đích:
 * Đồng bộ thời điểm render của Cài đặt tiêu chí V6 với Category V6.
 *
 * Vì entry point hiện tại là legacy và các module được nạp theo nhiều bước,
 * Settings có thể khởi tạo trước khi 6 category được tải từ Supabase.
 * Bridge này chỉ chờ dependency sẵn sàng rồi yêu cầu Settings render lại.
 *
 * File không chứa logic CRUD và không truy cập trực tiếp vào dữ liệu HS.
 */

const CRITERIA_SETTINGS_BOOT_MAX_WAIT_MS = 15000;
const CRITERIA_SETTINGS_BOOT_INTERVAL_MS = 100;

/**
 * Kiểm tra Category V6 và Settings V6 đã sẵn sàng hay chưa.
 */
function areCriteriaSettingsDependenciesReadyV6() {
    const categories =
        window.CompetitionCategoryV6?.getActiveCompetitionCategoriesV6?.();

    const settings = window.CompetitionCriteriaSettingsV6;

    return (
        Array.isArray(categories) &&
        categories.length === 6 &&
        typeof settings?.render === 'function'
    );
}

/**
 * Chờ dependency rồi render lại Settings đúng một lần.
 */
function bootstrapCriteriaSettingsV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(async () => {
        if (areCriteriaSettingsDependenciesReadyV6()) {
            window.clearInterval(timer);

            await window.CompetitionCriteriaSettingsV6.render();
            return;
        }

        if (
            Date.now() - startedAt >=
            CRITERIA_SETTINGS_BOOT_MAX_WAIT_MS
        ) {
            window.clearInterval(timer);

            console.warn(
                '[Competition V6] Criteria Settings bootstrap timed out.',
            );
        }
    }, CRITERIA_SETTINGS_BOOT_INTERVAL_MS);
}

bootstrapCriteriaSettingsV6();
