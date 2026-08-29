/**
 * FILE: competition-record-edit-date-v6.js
 *
 * Mục đích:
 * Đồng bộ UX của form Sửa bản ghi với form Ghi nhận V6.
 *
 * Quy tắc:
 * - GVCN chỉ chọn Ngày ghi nhận.
 * - Tuần được suy ra tự động từ Ngày ghi nhận.
 * - `eWeek` vẫn được giữ phía sau để tương thích với saveEditedCompetition().
 * - Không thay đổi calculation engine hay database schema.
 */

/**
 * Tính ngày thứ Hai của tuần chứa ngày đã chọn.
 *
 * @param {string} dateValue Ngày dạng YYYY-MM-DD.
 * @returns {string} Tuần bắt đầu dạng YYYY-MM-DD.
 */
function getEditedRecordWeekFromDateV6(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

/**
 * Đồng bộ field tuần nội bộ và hiển thị thông tin tuần suy ra.
 */
function syncEditedRecordWeekV6() {
    const dateInput = document.getElementById('eDate');
    const weekInput = document.getElementById('eWeek');

    if (!dateInput || !weekInput) {
        return;
    }

    const derivedWeek = getEditedRecordWeekFromDateV6(
        dateInput.value,
    );

    weekInput.value = derivedWeek;

    let helper = document.getElementById(
        'eWeekDerivedNoticeV6',
    );

    if (!helper) {
        helper = document.createElement('div');
        helper.id = 'eWeekDerivedNoticeV6';
        helper.className = 'mini';
        weekInput.parentElement?.appendChild(helper);
    }

    helper.textContent = derivedWeek
        ? `Tuần thi đua: ${derivedWeek} (hệ thống tự xác định)`
        : 'Tuần thi đua sẽ được hệ thống tự xác định.';
}

/**
 * Ẩn input tuần legacy nhưng vẫn duy trì giá trị để save function cũ
 * nhận đúng dữ liệu.
 */
function hideEditedRecordWeekFieldV6() {
    const weekInput = document.getElementById('eWeek');

    if (!weekInput) {
        return false;
    }

    const field = weekInput.closest('.field') || weekInput.parentElement;

    if (field) {
        field.classList.add('hidden');
    }

    syncEditedRecordWeekV6();
    return true;
}

/**
 * Theo dõi modal để áp dụng date-only ngay sau khi form Sửa render.
 */
function bootstrapEditedRecordDateV6() {
    const startedAt = Date.now();
    const waitMs = 15000;

    const timer = window.setInterval(() => {
        const dateInput = document.getElementById('eDate');
        const weekInput = document.getElementById('eWeek');

        if (dateInput && weekInput) {
            hideEditedRecordWeekFieldV6();

            dateInput.addEventListener(
                'change',
                syncEditedRecordWeekV6,
            );

            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= waitMs) {
            window.clearInterval(timer);
        }
    }, 100);
}

bootstrapEditedRecordDateV6();

window.CompetitionRecordEditDateV6 = {
    getWeekFromDate: getEditedRecordWeekFromDateV6,
    sync: syncEditedRecordWeekV6,
};
