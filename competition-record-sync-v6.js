/**
 * FILE: competition-record-sync-v6.js
 *
 * Mục đích:
 * Đồng bộ cache lịch sử sau khi Ghi nhận thi đua được lưu thành công.
 *
 * Nguyên nhân:
 * - addCompetition() trước đây chỉ INSERT vào Supabase.
 * - renderCompetition() đọc từ supabaseCache.competitionRecords.
 * - Vì cache chưa được tải lại, record mới không xuất hiện ngay trên giao diện.
 *
 * Trách nhiệm:
 * - Giữ nguyên addCompetition() legacy.
 * - Sau INSERT thành công, đọc lại lịch sử từ Supabase.
 * - Hiển thị thông báo thành công rõ ràng cho GVCN.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Thay đổi database schema.
 * - Thay đổi RLS.
 */

const COMPETITION_RECORD_SYNC_MAX_WAIT_MS = 15000;
const COMPETITION_RECORD_SYNC_INTERVAL_MS = 100;

/**
 * Hiển thị thông báo thành công nhẹ, không chặn thao tác như alert().
 */
function showCompetitionSuccessToastV6(message) {
    const existingToast = document.getElementById(
        'competitionSuccessToastV6',
    );

    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'competitionSuccessToastV6';
    toast.className = 'notice';
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '9999',
        maxWidth: '420px',
    });

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Chờ addCompetition() của app.js tồn tại rồi mới bọc function.
 */
function installCompetitionRecordSyncV6() {
    if (
        typeof window.addCompetition !== 'function' ||
        window.addCompetition.__syncWrappedV6
    ) {
        return false;
    }

    const originalAddCompetition = window.addCompetition;

    async function addCompetitionWithSyncV6(...args) {
        const ok = await originalAddCompetition(...args);

        if (!ok) {
            return false;
        }

        try {
            if (
                typeof window.loadCompetitionHistoryFromSupabase ===
                'function'
            ) {
                await window.loadCompetitionHistoryFromSupabase();
            }

            showCompetitionSuccessToastV6(
                'Đã lưu ghi nhận thi đua và cập nhật lịch sử.',
            );
        } catch (error) {
            console.error(
                '[Competition V6] Không thể đồng bộ lịch sử sau khi lưu:',
                error,
            );

            showCompetitionSuccessToastV6(
                'Đã lưu ghi nhận. Không thể tải lại lịch sử ngay; vui lòng bấm Cập nhật từ Supabase.',
            );
        }

        return true;
    }

    addCompetitionWithSyncV6.__syncWrappedV6 = true;
    window.addCompetition = addCompetitionWithSyncV6;

    return true;
}

/**
 * Bootstrap module sau khi app.js đã định nghĩa addCompetition().
 */
function bootstrapCompetitionRecordSyncV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installCompetitionRecordSyncV6()) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_RECORD_SYNC_MAX_WAIT_MS
        ) {
            window.clearInterval(timer);

            console.warn(
                '[Competition V6] Record sync bootstrap timed out.',
            );
        }
    }, COMPETITION_RECORD_SYNC_INTERVAL_MS);
}

bootstrapCompetitionRecordSyncV6();
