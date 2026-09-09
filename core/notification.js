/**
 * FILE: core/notification.js
 *
 * Mục đích:
 * Cung cấp notification/toast và trạng thái loading dùng chung.
 *
 * Trách nhiệm:
 * - Hiển thị success/error/info/warning nhất quán.
 * - Hiển thị loading không chặn UI ngoài vùng thao tác liên quan.
 * - Tự tạo container khi ứng dụng chưa có markup notification.
 *
 * Không chịu trách nhiệm:
 * - Xử lý business logic.
 * - Ghi dữ liệu.
 */

/**
 * Tạo notification container nếu DOM chưa khai báo.
 *
 * @returns {HTMLElement} Container dùng chung.
 */
function ensureNotificationContainer() {
    let container = document.getElementById('snNotificationContainer');

    if (container) {
        return container;
    }

    container = document.createElement('div');
    container.id = 'snNotificationContainer';
    container.className = 'sn-notification-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);

    return container;
}

/**
 * Hiển thị toast dùng chung.
 *
 * @param {string} message Nội dung thông báo.
 * @param {'success'|'error'|'info'|'warning'} type Loại thông báo.
 * @param {number} duration Thời gian hiển thị.
 * @returns {HTMLElement} Toast vừa tạo.
 */
function showNotification(message, type = 'info', duration = 3200) {
    const container = ensureNotificationContainer();
    const toast = document.createElement('div');

    toast.className = 'sn-notification sn-notification-' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = String(message || '');

    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 220);
    }, duration);

    return toast;
}

/**
 * Hiển thị trạng thái loading cho một thao tác.
 *
 * @param {string} message Nội dung loading.
 * @returns {{close: function}} Handle để đóng loading.
 */
function showLoading(message = 'Đang xử lý...') {
    const container = ensureNotificationContainer();
    const toast = document.createElement('div');

    toast.className = 'sn-notification sn-notification-info is-loading';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-busy', 'true');

    const spinner = document.createElement('span');
    spinner.className = 'sn-notification-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.textContent = String(message);

    toast.append(spinner, text);
    container.appendChild(toast);

    return {
        close() {
            toast.remove();
        },
    };
}

/**
 * API public dùng chung.
 */
globalThis.SNNotification = Object.freeze({
    show: showNotification,
    success: (message, duration) =>
        showNotification(message, 'success', duration),
    error: (message, duration) =>
        showNotification(message, 'error', duration),
    info: (message, duration) =>
        showNotification(message, 'info', duration),
    warning: (message, duration) =>
        showNotification(message, 'warning', duration),
    loading: showLoading,
});
