/*
 * FILE: test-center-entry-v6.js
 *
 * Mục đích:
 * Thêm nút mở Test Center V6 từ ứng dụng chính.
 *
 * Không chứa test case và không thay đổi nghiệp vụ.
 */

(function mountTestCenterButtonV6() {
    const startedAt = Date.now();
    const timeoutMs = 15000;

    const timer = window.setInterval(() => {
        const nav = document.getElementById('teacherNav');

        if (nav && !document.getElementById('testCenterButtonV6')) {
            const button = document.createElement('button');
            button.id = 'testCenterButtonV6';
            button.type = 'button';
            button.textContent = '🧪 Kiểm tra hệ thống';
            button.title = 'Mở Test Center V6';
            button.addEventListener('click', () => {
                window.open(
                    'test-center-v6.html',
                    '_blank',
                    'noopener,noreferrer',
                );
            });

            nav.appendChild(button);
        }

        if (
            document.getElementById('testCenterButtonV6') ||
            Date.now() - startedAt >= timeoutMs
        ) {
            window.clearInterval(timer);
        }
    }, 250);
})();
