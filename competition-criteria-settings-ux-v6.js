/**
 * FILE: competition-criteria-settings-ux-v6.js
 *
 * Mục đích:
 * Bảo đảm khu vực Cài đặt tiêu chí luôn dùng layout V6 đã duyệt.
 *
 * UX chính thức:
 * - Chọn một trong 6 nhóm trước.
 * - Chỉ hiển thị criteria thuộc nhóm đang chọn.
 * - Nhóm 6 (Học tập) luôn xuất hiện.
 *
 * Lý do tồn tại:
 * Runtime legacy vẫn có renderer renderCompetitionCriteria().
 * Module này là compatibility layer để ngăn renderer cũ làm UI V6 bị
 * thay thế lại bằng danh sách tất cả criteria.
 *
 * Không thay đổi dữ liệu database.
 */

const CRITERIA_SETTINGS_UX_WAIT_MS = 15000;
const CRITERIA_SETTINGS_UX_POLL_MS = 100;

let criteriaSettingsUxObserverV6 = null;
let criteriaSettingsUxRenderingV6 = false;

/**
 * Kiểm tra layout V6 đã tồn tại hay chưa.
 */
function hasCriteriaSettingsV6LayoutV6() {
    return Boolean(
        document.getElementById('criteriaSettingsTabsV6') &&
        document.getElementById('criteriaSettingsListV6'),
    );
}

/**
 * Yêu cầu renderer V6 dựng lại khu vực Cài đặt tiêu chí.
 */
async function enforceCriteriaSettingsV6() {
    const settingsApi = globalThis.CompetitionCriteriaSettingsV6;

    if (
        criteriaSettingsUxRenderingV6 ||
        typeof settingsApi?.render !== 'function'
    ) {
        return;
    }

    criteriaSettingsUxRenderingV6 = true;

    try {
        await settingsApi.render();
    } catch (error) {
        console.error(
            '[Competition V6] Không thể dựng lại Cài đặt tiêu chí:',
            error,
        );
    } finally {
        criteriaSettingsUxRenderingV6 = false;
    }
}

/**
 * Theo dõi thay đổi DOM của khu vực settings.
 *
 * Chỉ phản ứng khi renderer legacy thực sự thay nội dung bằng layout khác.
 */
function observeCriteriaSettingsV6() {
    const box = document.getElementById('criteriaSettings');

    if (!box || criteriaSettingsUxObserverV6) {
        return Boolean(box);
    }

    criteriaSettingsUxObserverV6 = new MutationObserver(() => {
        if (
            !criteriaSettingsUxRenderingV6 &&
            !hasCriteriaSettingsV6LayoutV6()
        ) {
            void enforceCriteriaSettingsV6();
        }
    });

    criteriaSettingsUxObserverV6.observe(box, {
        childList: true,
        subtree: true,
    });

    return true;
}

/**
 * Chờ module Settings V6 và DOM cùng sẵn sàng.
 */
function bootstrapCriteriaSettingsUxV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        observeCriteriaSettingsV6();

        const settingsReady =
            typeof globalThis.CompetitionCriteriaSettingsV6
                ?.render === 'function';
        const boxReady = Boolean(
            document.getElementById('criteriaSettings'),
        );

        if (settingsReady && boxReady) {
            window.clearInterval(timer);

            if (!hasCriteriaSettingsV6LayoutV6()) {
                void enforceCriteriaSettingsV6();
            }

            return;
        }

        if (
            Date.now() - startedAt >=
            CRITERIA_SETTINGS_UX_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Criteria settings UX bootstrap timed out.',
            );
        }
    }, CRITERIA_SETTINGS_UX_POLL_MS);
}

bootstrapCriteriaSettingsUxV6();
