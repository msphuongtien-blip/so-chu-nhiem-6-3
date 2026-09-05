/**
 * FILE: competition-record-edit-sync-v6.js
 *
 * Mục đích:
 * Đồng bộ state/UI sau khi GVCN sửa một record thi đua.
 *
 * Nguyên nhân của module:
 * - saveEditedCompetition() legacy cập nhật Supabase.
 * - Sau đó các renderer có thể vẫn đọc cache cũ.
 * - Trường hợp đổi HS A → B vì vậy không phản ánh ngay điểm của cả A và B.
 *
 * Trách nhiệm:
 * - Giữ nguyên nghiệp vụ update hiện tại của app.js.
 * - Sau update thành công, tải lại students và competition_records.
 * - Render lại các module phụ thuộc dữ liệu đó.
 *
 * Không chịu trách nhiệm:
 * - Tính lại điểm bằng phép cộng/trừ thủ công.
 * - Thay đổi schema hoặc RLS.
 */

const COMPETITION_EDIT_SYNC_WAIT_MS = 15000;
const COMPETITION_EDIT_SYNC_POLL_MS = 100;

let competitionEditSyncWrappedV6 = false;

/**
 * Refresh toàn bộ nguồn dữ liệu liên quan tới record thi đua.
 *
 * Tải dữ liệu mới trước khi render để tránh render bằng cache cũ.
 */
async function refreshCompetitionAfterEditV6() {
    if (typeof window.loadCompetitionHistoryFromSupabase === 'function') {
        await window.loadCompetitionHistoryFromSupabase();
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        await window.loadStudentsFromSupabase();
    }

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    if (typeof window.renderStudents === 'function') {
        await window.renderStudents();
    }

    if (typeof window.renderDashboard === 'function') {
        await window.renderDashboard();
    }
}

/**
 * Hiển thị toast không chặn thao tác.
 */
function showCompetitionEditSyncToastV6(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = isError ? 'notice danger' : 'notice';
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
 * Bọc saveEditedCompetition() của runtime legacy.
 *
 * Function legacy vẫn chịu trách nhiệm validation và UPDATE.
 * Wrapper chỉ chịu trách nhiệm refresh dữ liệu sau khi nó hoàn thành.
 */
function installCompetitionEditSyncV6() {
    if (
        competitionEditSyncWrappedV6 ||
        typeof window.saveEditedCompetition !== 'function'
    ) {
        return false;
    }

    const originalSaveEditedCompetition =
        window.saveEditedCompetition;

    async function saveEditedCompetitionWithSyncV6(...args) {
        const result = await originalSaveEditedCompetition(...args);

        try {
            await refreshCompetitionAfterEditV6();
            showCompetitionEditSyncToastV6(
                'Đã sửa record và cập nhật dữ liệu của các HS liên quan.',
            );
        } catch (error) {
            console.error(
                '[Competition V6] Không thể đồng bộ sau khi sửa record:',
                error,
            );

            showCompetitionEditSyncToastV6(
                'Đã sửa record nhưng giao diện chưa đồng bộ. Vui lòng bấm Cập nhật từ Supabase.',
                true,
            );
        }

        return result;
    }

    window.saveEditedCompetition =
        saveEditedCompetitionWithSyncV6;
    competitionEditSyncWrappedV6 = true;

    return true;
}

/**
 * Bootstrap sau khi app.js đã định nghĩa saveEditedCompetition().
 */
function bootstrapCompetitionEditSyncV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installCompetitionEditSyncV6()) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_EDIT_SYNC_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Edit sync bootstrap timed out.',
            );
        }
    }, COMPETITION_EDIT_SYNC_POLL_MS);
}

bootstrapCompetitionEditSyncV6();
