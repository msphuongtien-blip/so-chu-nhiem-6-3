/**
 * FILE: core/utils.js
 *
 * Mục đích:
 * Chứa các utility thuần dùng chung cho nhiều module.
 *
 * Trách nhiệm:
 * - Truy cập DOM theo id.
 * - Escape dữ liệu trước khi đưa vào HTML string.
 * - Chuẩn hóa ngày local.
 * - Xác định ngày đầu tuần theo quy ước thứ Hai.
 *
 * Không gọi Supabase và không chứa nghiệp vụ của module riêng lẻ.
 */

/**
 * Lấy DOM element theo id.
 *
 * @param {string} id ID của element cần tìm.
 * @returns {HTMLElement|null} Element tìm được.
 */
function dom(id) {
    return document.getElementById(id);
}

/**
 * Escape các ký tự đặc biệt trước khi chèn dữ liệu vào HTML string.
 *
 * @param {*} value Giá trị cần escape.
 * @returns {string} Chuỗi HTML-safe.
 */
function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[character]),
    );
}

/**
 * Lấy ngày theo local timezone dưới dạng YYYY-MM-DD.
 *
 * @param {Date} [date] Ngày đầu vào; mặc định là hiện tại.
 * @returns {string} Ngày YYYY-MM-DD.
 */
function localDate(date = new Date()) {
    const timezoneOffset = date.getTimezoneOffset();
    const localTime = new Date(
        date.getTime() - timezoneOffset * 60 * 1000,
    );

    return localTime.toISOString().slice(0, 10);
}

/**
 * Trả về ngày thứ Hai của tuần chứa ngày đầu vào.
 *
 * @param {Date} [date] Ngày cần xác định tuần.
 * @returns {string} Ngày thứ Hai dạng YYYY-MM-DD.
 */
function getCurrentWeekStart(date = new Date()) {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    result.setDate(result.getDate() + diff);

    return localDate(result);
}

/**
 * Chuẩn hóa một ngày bất kỳ về ngày thứ Hai đầu tuần.
 *
 * @param {string|Date} value Ngày đầu vào.
 * @returns {string} Ngày đầu tuần dạng YYYY-MM-DD.
 */
function compWeekStart(value) {
    const parsed = value instanceof Date
        ? new Date(value)
        : new Date(`${value}T00:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return getCurrentWeekStart();
    }

    return getCurrentWeekStart(parsed);
}

const SNCoreUtils = Object.freeze({
    dom,
    escapeHtml,
    localDate,
    getCurrentWeekStart,
    compWeekStart,
});

globalThis.SNCoreUtils = SNCoreUtils;
