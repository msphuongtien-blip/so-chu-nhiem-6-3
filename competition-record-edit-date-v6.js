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

function syncEditedRecordWeekV6() {
    const dateInput = document.getElementById('eDate');
    const weekInput = document.getElementById('eWeek');

    if (!dateInput || !weekInput) {
        return false;
    }

    const derivedWeek = getEditedRecordWeekFromDateV6(
        dateInput.value,
    );

    if (weekInput.value !== derivedWeek) {
        weekInput.value = derivedWeek;
    }

    let helper = document.getElementById(
        'eWeekDerivedNoticeV6',
    );

    if (!helper) {
        helper = document.createElement('div');
        helper.id = 'eWeekDerivedNoticeV6';
        helper.className = 'mini';
        weekInput.parentElement?.appendChild(helper);
    }

    const helperText = derivedWeek
        ? `Tuần thi đua: ${derivedWeek} (hệ thống tự xác định)`
        : 'Tuần thi đua sẽ được hệ thống tự xác định.';

    // MutationObserver theo dõi modalBody. Không ghi text nếu nội dung đã
    // đúng, tránh tự tạo mutation mới và lặp vô hạn khi mở form Sửa.
    if (helper.textContent !== helperText) {
        helper.textContent = helperText;
    }

    return true;
}

function hideEditedRecordWeekFieldV6() {
    const weekInput = document.getElementById('eWeek');

    if (!weekInput) {
        return false;
    }

    const field = weekInput.closest('.field') || weekInput.parentElement;

    if (field) {
        field.classList.add('hidden');
    }

    return syncEditedRecordWeekV6();
}

function bindEditedRecordDateChangeV6() {
    const dateInput = document.getElementById('eDate');

    if (!dateInput || dateInput.dataset.weekSyncBoundV6 === 'true') {
        return;
    }

    dateInput.addEventListener(
        'change',
        syncEditedRecordWeekV6,
    );
    dateInput.dataset.weekSyncBoundV6 = 'true';
}

function bootstrapEditedRecordDateV6() {
    const modalBody = document.getElementById('modalBody');

    if (!modalBody) {
        return;
    }

    const applyToCurrentModal = () => {
        if (hideEditedRecordWeekFieldV6()) {
            bindEditedRecordDateChangeV6();
        }
    };

    applyToCurrentModal();

    const observer = new MutationObserver(() => {
        applyToCurrentModal();
    });

    observer.observe(modalBody, {
        childList: true,
        subtree: true,
    });
}

bootstrapEditedRecordDateV6();

window.CompetitionRecordEditDateV6 = {
    getWeekFromDate: getEditedRecordWeekFromDateV6,
    sync: syncEditedRecordWeekV6,
};
