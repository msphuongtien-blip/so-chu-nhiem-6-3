/**
 * FILE: competition-record-date-v6.js
 *
 * Mục đích:
 * Chuẩn hóa UX ngày ghi nhận trong form Thi đua V6.
 *
 * Nguyên tắc:
 * - GVCN chỉ chọn Ngày.
 * - Tuần là dữ liệu dẫn xuất, hệ thống tự tính từ Ngày.
 * - Không cho người dùng chọn Tuần thủ công.
 * - Cùng một rule được dùng cho form thêm và form sửa.
 *
 * Không thay đổi schema database.
 */

const RECORD_DATE_V6_WAIT_MS = 15000;
const RECORD_DATE_V6_POLL_MS = 100;

let recordDateV6Initialized = false;
let recordDateV6OriginalOpenForm = null;
let recordDateV6OriginalEditForm = null;

/**
 * Tính Monday của tuần chứa ngày được chọn.
 */
function getRecordWeekFromDateV6(dateValue) {
    const engine = globalThis.CompetitionCalculationV6;

    if (engine && typeof engine.getMonday === 'function') {
        return engine.getMonday(dateValue);
    }

    if (typeof dateValue !== 'string' || !dateValue) {
        return '';
    }

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
 * Chuyển một field Tuần thành hidden field và hint read-only.
 */
function convertWeekFieldToDerivedV6(weekId, dateId, hintId) {
    const weekInput = document.getElementById(weekId);
    const dateInput = document.getElementById(dateId);

    if (!weekInput || !dateInput) {
        return false;
    }

    const weekField = weekInput.closest('.field');

    if (weekField) {
        weekField.remove();
    } else {
        weekInput.type = 'hidden';
    }

    const dateField = dateInput.closest('.field');

    if (!dateField) {
        return false;
    }

    const hiddenWeek = document.createElement('input');
    hiddenWeek.id = weekId;
    hiddenWeek.type = 'hidden';

    const hint = document.createElement('div');
    hint.id = hintId;
    hint.className = 'mini competition-record-date-hint-v6';

    dateField.appendChild(hiddenWeek);
    dateField.appendChild(hint);

    const sync = () => {
        const derivedWeek = getRecordWeekFromDateV6(dateInput.value);
        hiddenWeek.value = derivedWeek;
        hint.textContent = derivedWeek
            ? `Hệ thống tự xếp vào tuần bắt đầu ${derivedWeek}.`
            : 'Hệ thống sẽ tự xác định tuần từ Ngày.';
    };

    dateInput.addEventListener('change', sync);
    dateInput.addEventListener('input', sync);
    sync();

    return true;
}

/**
 * Chuẩn hóa form Ghi nhận mới.
 */
function normalizeAddRecordDateFormV6() {
    return convertWeekFieldToDerivedV6(
        'fWeek',
        'fDate',
        'fWeekHintV6',
    );
}

/**
 * Chuẩn hóa form Sửa ghi nhận.
 */
function normalizeEditRecordDateFormV6() {
    return convertWeekFieldToDerivedV6(
        'eWeek',
        'eDate',
        'eWeekHintV6',
    );
}

/**
 * Bọc form thêm và form sửa sau khi legacy renderer đã tạo DOM.
 */
function installRecordDateDerivedWeekV6() {
    if (!recordDateV6Initialized) {
        if (typeof window.openCompetitionForm === 'function') {
            recordDateV6OriginalOpenForm = window.openCompetitionForm;

            window.openCompetitionForm = async function openCompetitionFormDateV6() {
                await recordDateV6OriginalOpenForm();
                normalizeAddRecordDateFormV6();
            };
        }

        if (typeof window.editCompetitionRecord === 'function') {
            recordDateV6OriginalEditForm = window.editCompetitionRecord;

            window.editCompetitionRecord = async function editCompetitionRecordDateV6(id) {
                await recordDateV6OriginalEditForm(id);
                normalizeEditRecordDateFormV6();
            };
        }
    }

    const addReady = typeof recordDateV6OriginalOpenForm === 'function';
    const editReady = typeof recordDateV6OriginalEditForm === 'function';

    if (addReady || editReady) {
        recordDateV6Initialized = true;
        return true;
    }

    return false;
}

/**
 * Chờ các legacy entry point sẵn sàng.
 */
function bootstrapRecordDateV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installRecordDateDerivedWeekV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= RECORD_DATE_V6_WAIT_MS) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Record date bootstrap timed out.',
            );
        }
    }, RECORD_DATE_V6_POLL_MS);
}

bootstrapRecordDateV6();

window.CompetitionRecordDateV6 = Object.freeze({
    getWeekFromDate: getRecordWeekFromDateV6,
    normalizeAddForm: normalizeAddRecordDateFormV6,
    normalizeEditForm: normalizeEditRecordDateFormV6,
});
