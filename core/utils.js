/**
 * FILE: core/utils.js
 *
 * Mục đích:
 * Chứa các utility thuần và helper DOM dùng chung.
 *
 * Utility ở đây không được thực hiện CRUD hoặc chứa logic riêng của một
 * module nghiệp vụ.
 */

/**
 * Lấy một phần tử DOM theo id.
 *
 * @param {string} id ID của phần tử cần tìm.
 * @returns {HTMLElement|null} Phần tử hoặc null nếu không tồn tại.
 */
const $ = (id) => document.getElementById(id);

/**
 * Escape text trước khi đưa vào HTML string.
 *
 * @param {*} value Giá trị cần escape.
 * @returns {string} Chuỗi an toàn để chèn vào HTML.
 */
const esc = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (match) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[match]),
    );

/**
 * Parse một ngày YYYY-MM-DD mà không phụ thuộc timezone của trình duyệt.
 *
 * @param {string} value Ngày dạng YYYY-MM-DD.
 * @returns {Date|null} Date UTC hoặc null nếu không hợp lệ.
 */
function parseDateOnly(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        return null;
    }

    const date = new Date(
        Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
        ),
    );

    if (
        date.getUTCFullYear() !== Number(match[1]) ||
        date.getUTCMonth() !== Number(match[2]) - 1 ||
        date.getUTCDate() !== Number(match[3])
    ) {
        return null;
    }

    return date;
}

/**
 * Trả về ngày hiện tại theo múi giờ local của trình duyệt.
 *
 * @returns {string} Ngày dạng YYYY-MM-DD.
 */
function localDate() {
    const now = new Date();
    const local = new Date(
        now.getTime() - now.getTimezoneOffset() * 60000,
    );

    return local.toISOString().slice(0, 10);
}

/**
 * Lấy ngày thứ Hai đầu tuần hiện tại.
 *
 * @returns {string} Ngày bắt đầu tuần dạng YYYY-MM-DD.
 */
function getCurrentWeekStart() {
    const date = parseDateOnly(localDate());

    if (!date) {
        return '';
    }

    const day = date.getUTCDay();
    const difference = day === 0 ? -6 : 1 - day;

    date.setUTCDate(date.getUTCDate() + difference);

    return date.toISOString().slice(0, 10);
}

/**
 * Chuẩn hóa một ngày bất kỳ về ngày thứ Hai đầu tuần.
 *
 * Quy tắc dùng Date UTC cho date-only để không bị lệch tuần do timezone.
 *
 * @param {string} value Ngày dạng YYYY-MM-DD.
 * @returns {string} Ngày bắt đầu tuần.
 */
function compWeekStart(value) {
    const date = parseDateOnly(value || getCurrentWeekStart());

    if (!date) {
        return getCurrentWeekStart();
    }

    const day = date.getUTCDay();
    const difference = day === 0 ? -6 : 1 - day;

    date.setUTCDate(date.getUTCDate() + difference);

    return date.toISOString().slice(0, 10);
}

/**
 * Trả về nhãn tuần theo khoảng thứ Hai–Chủ nhật.
 *
 * @param {string} value Một ngày bất kỳ trong tuần.
 * @returns {string} Ví dụ: "Tuần 07/09/2026 – 13/09/2026".
 */
function compWeekRange(value) {
    const start = compWeekStart(value);
    const date = parseDateOnly(start);

    if (!date) {
        return '';
    }

    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 6);

    const format = (item) =>
        String(item.getUTCDate()).padStart(2, '0') +
        '/' +
        String(item.getUTCMonth() + 1).padStart(2, '0') +
        '/' +
        item.getUTCFullYear();

    return 'Tuần ' + format(date) + ' – ' + format(end);
}
