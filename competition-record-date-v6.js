/**
 * FILE: competition-record-date-v6.js
 *
 * Mục đích:
 * Chuẩn hóa UX ngày ghi nhận trong form Thi đua V6.
 *
 * Nguyên tắc:
 * - GVCN chỉ chọn một ngày ghi nhận.
 * - `week` là dữ liệu dẫn xuất, được hệ thống tự tính từ ngày.
 * - Không cho người dùng nhập hai ngày độc lập.
 * - Không thay đổi schema database.
 *
 * Ví dụ:
 * - 09/09/2026 -> week 07/09/2026.
 * - 12/09/2026 -> week 07/09/2026.
 * - 14/09/2026 -> week 14/09/2026.
 */

const RECORD_DATE_V6_WAIT_MS = 15000;
const RECORD_DATE_V6_POLL_MS = 100;

let recordDateV6Initialized = false;
let recordDateV6OriginalOpenForm = null;

/**
 * Lấy đầu tuần từ Calculation Engine V6.
 *
 * Có fallback nhỏ để module vẫn hoạt động trong giai đoạn bootstrap nếu
 * calculation engine chưa sẵn sàng tại thời điểm form được mở.
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
 * Đồng bộ hidden `week` và dòng giải thích tuần.
 */
function syncRecordWeekFromDateV6() {
    const dateInput = document.getElementById('fDateV6');
    const weekInput = document.getElementById('fWeekV6');
    const weekHint = document.getElementById('fWeekHintV6');

    if (!dateInput || !weekInput) {
        return;
    }

    const derivedWeek = getRecordWeekFromDateV6(dateInput.value);

    weekInput.value = derivedWeek;

    if (weekHint) {
        weekHint.textContent = derivedWeek
            ? `Hệ thống tự xếp ngày này vào tuần bắt đầu ${derivedWeek}.`
            : 'Hệ thống sẽ tự xác định tuần từ ngày ghi nhận.';
    }
}

/**
 * Thay field Tuần bằng hidden field và dòng thông tin read-only.
 */
function convertRecordWeekFieldToDerivedV6() {
    const weekInput = document.getElementById('fWeekV6');
    const dateInput = document.getElementById('fDateV6');

    if (!weekInput || !dateInput) {
        return false;
    }

    const weekField = weekInput.closest('.field');

    if (weekField) {
        weekField.remove();
    }

    const dateField = dateInput.closest('.field');

    if (!dateField) {
        return false;
    }

    const hiddenWeek = document.createElement('input');
    hiddenWeek.id = 'fWeekV6';
    hiddenWeek.type = 'hidden';

    const hint = document.createElement('div');
    hint.id = 'fWeekHintV6';
    hint.className = 'mini competition-record-date-hint-v6';

    dateField.appendChild(hiddenWeek);
    dateField.appendChild(hint);

    dateInput.addEventListener('change', syncRecordWeekFromDateV6);
    dateInput.addEventListener('input', syncRecordWeekFromDateV6);

    syncRecordWeekFromDateV6();

    return true;
}

/**
 * Bọc entry point Ghi nhận V6 sau khi các module form khác đã khởi tạo.
 */
function installRecordDateDerivedWeekV6() {
    if (
        recordDateV6Initialized ||
        typeof window.openCompetitionForm !== 'function'
    ) {
        return false;
    }

    recordDateV6OriginalOpenForm = window.openCompetitionForm;

    window.openCompetitionForm = async function openCompetitionFormDateV6() {
        await recordDateV6OriginalOpenForm();
        convertRecordWeekFieldToDerivedV6();
    };

    recordDateV6Initialized = true;
    return true;
}

/**
 * Chờ entry point Ghi nhận sẵn sàng.
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
});
