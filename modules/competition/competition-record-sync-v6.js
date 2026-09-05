/* ===== competition-record-sync-v6.js ===== */

/**
 * FILE: competition-record-sync-v6.js
 *
 * Mục đích:
 * Là integration layer cho luồng Ghi nhận thi đua V6 trong giai đoạn
 * refactor từ runtime legacy sang các module chuyên trách.
 *
 * Trách nhiệm:
 * - Giữ compatibility cho `addCompetition()` legacy.
 * - Nạp Record Service V6.
 * - Nạp Submit Adapter V6.
 * - Đảm bảo form V6 không phụ thuộc trực tiếp vào implementation legacy.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Thay đổi database schema.
 * - Thay đổi RLS.
 * - Render UI form.
 *
 * Kiến trúc:
 * - competition-record-service-v6.js: persistence + state sync.
 * - competition-record-submit-v6.js: DOM form + service integration.
 * - File này: compatibility/integration bootstrap.
 */

const COMPETITION_RECORD_SYNC_MAX_WAIT_MS = 15000;
const COMPETITION_RECORD_SYNC_INTERVAL_MS = 100;
const COMPETITION_RECORD_SERVICE_SCRIPT_ID =
    'competition-record-service-v6-script';
const COMPETITION_RECORD_SUBMIT_SCRIPT_ID =
    'competition-record-submit-v6-script';

/**
 * Hiển thị thông báo thành công nhẹ, không chặn thao tác như alert().
 *
 * Hàm này vẫn được giữ cho các luồng legacy đã dùng integration layer.
 */
function showCompetitionSuccessToastV6(message) {
    const existingToast = document.getElementById(
        'competitionSuccessToastV6',
    );

    existingToast?.remove();

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
 * Bọc addCompetition() legacy để các luồng V5 cũ vẫn tự đồng bộ cache.
 *
 * Form Ghi nhận V6 mới không còn gọi trực tiếp function này.
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
 * Nạp một module JavaScript động nếu module chưa tồn tại trong DOM.
 *
 * Dynamic loading giữ entry point legacy ổn định nhưng vẫn bảo đảm module
 * nghiệp vụ được đưa vào runtime thật sự.
 */
function loadCompetitionRuntimeScriptV6(
    scriptId,
    source,
) {
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
 * Bootstrap các module V6 cần cho luồng Ghi nhận.
 */
function bootstrapCompetitionRecordModulesV6() {
    loadCompetitionRuntimeScriptV6(
        COMPETITION_RECORD_SERVICE_SCRIPT_ID,
        'competition-record-service-v6.js',
    );

    loadCompetitionRuntimeScriptV6(
        COMPETITION_RECORD_SUBMIT_SCRIPT_ID,
        'competition-record-submit-v6.js',
    );
}

/**
 * Bootstrap integration sau khi app.js đã định nghĩa addCompetition().
 */
function bootstrapCompetitionRecordSyncV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        bootstrapCompetitionRecordModulesV6();

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


/* ===== competition-record-edit-sync-v6.js ===== */

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
