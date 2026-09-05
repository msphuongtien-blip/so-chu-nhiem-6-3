/*
 * FILE: test-center-entry-v6.js
 *
 * Mục đích:
 * Thêm nút mở Test Center V6 từ khu vực Cài đặt của ứng dụng chính.
 *
 * Không chứa test case và không thay đổi nghiệp vụ.
 */

(function mountTestCenterButtonV6() {
    const startedAt = Date.now();
    const timeoutMs = 15000;

    const timer = window.setInterval(() => {
        const settingsPage = document.getElementById('settings');

        if (
            settingsPage &&
            !document.getElementById('testCenterButtonV6')
        ) {
            const card = document.createElement('div');
            card.className = 'card section';
            card.id = 'testCenterCardV6';
            card.innerHTML = `
                <div class="section-title">
                    <h2>Kiểm tra hệ thống</h2>
                </div>
                <p class="mini">
                    Chạy regression test trực tiếp trên phiên bản Vercel.
                </p>
                <button
                    id="testCenterButtonV6"
                    class="btn"
                    type="button"
                >
                    🧪 Mở Test Center
                </button>
            `;

            const button = card.querySelector('#testCenterButtonV6');

            button?.addEventListener('click', () => {
                window.open(
                    'test-center-v6.html',
                    '_blank',
                    'noopener,noreferrer',
                );
            });

            settingsPage.appendChild(card);
        }

        if (
            document.getElementById('testCenterButtonV6') ||
            Date.now() - startedAt >= timeoutMs
        ) {
            window.clearInterval(timer);
        }
    }, 250);
})();
