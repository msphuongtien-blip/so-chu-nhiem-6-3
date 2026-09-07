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
    const date = new Date();
    const day = date.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + difference);

    return date.toISOString().slice(0, 10);
}

/**
 * Chuẩn hóa một ngày bất kỳ về ngày thứ Hai đầu tuần.
 *
 * @param {string} value Ngày dạng YYYY-MM-DD.
 * @returns {string} Ngày bắt đầu tuần.
 */
function compWeekStart(value) {
    const date = new Date(
        (value || getCurrentWeekStart()) + 'T00:00:00',
    );

    if (Number.isNaN(date.getTime())) {
        return getCurrentWeekStart();
    }

    const day = date.getDay();
    const difference = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + difference);

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
    const date = new Date(start + 'T00:00:00');

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const end = new Date(date);
    end.setDate(end.getDate() + 6);

    const format = (item) =>
        String(item.getDate()).padStart(2, '0') +
        '/' +
        String(item.getMonth() + 1).padStart(2, '0') +
        '/' +
        item.getFullYear();

    return 'Tuần ' + format(date) + ' – ' + format(end);
}
