/*
 * FILE: test-center-controls-v6.js
 *
 * Mục đích:
 * Bổ sung nút chạy từng cụm test trên Test Center V6.
 *
 * Thiết kế:
 * - Không sửa test runner hiện có.
 * - Mỗi cụm có nút chạy riêng.
 * - Chạy lại cụm chỉ cập nhật kết quả của cụm đó.
 * - Giữ nút Chạy tất cả của runner hiện tại.
 */

(function installTestCenterGroupControlsV6() {
    const GROUPS = [
        'Calculation',
        'Rollover',
        'Record edge cases',
        'Date → week',
        'Criteria',
        'Gọi tên học sinh',
        'Supabase read-only',
    ];

    function getTests() {
        /*
         * test-center-v6.js giữ danh sách test trong lexical scope `tests`.
         * Vì vậy module này dùng các nút để lọc/chạy qua một runner bridge
         * được đăng ký bên dưới. Nếu bridge chưa có, nút sẽ báo rõ thay vì
         * giả vờ chạy thành công.
         */
        return window.TestCenterV6?.tests || null;
    }

    function renderControls() {
        const container = document.getElementById('testGroups');
        if (!container || container.dataset.groupControlsInstalled === 'true') {
            return;
        }

        const runAll = document.getElementById('runAllButton');
        if (!runAll) {
            return;
        }

        container.dataset.groupControlsInstalled = 'true';

        /*
         * test-center-v6.js cũ chưa expose tests ra window.
         * Ta tạo bridge bằng cách yêu cầu runner hiện tại expose API ở lần
         * bootstrap tiếp theo; nếu chưa có, chỉ hiển thị hướng dẫn lỗi rõ ràng.
         */
        const sections = [...container.querySelectorAll('.qa-group')];
        for (const section of sections) {
            const title = section.querySelector('h3')?.textContent?.trim();
            if (!GROUPS.includes(title)) continue;

            const header = section.querySelector('.qa-group-header');
            if (!header || header.querySelector('.qa-group-run')) continue;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'qa-button qa-group-run';
            button.textContent = '▶ Chạy cụm này';
            button.dataset.group = title;
            button.addEventListener('click', () => {
                const api = getTests();
                if (!api?.runGroup) {
                    window.alert('Test Center chưa nạp API chạy từng cụm. Hãy tải lại trang để nạp bản mới nhất.');
                    return;
                }
                api.runGroup(title);
            });
            header.appendChild(button);
        }
    }

    const observer = new MutationObserver(renderControls);
    observer.observe(document.getElementById('testGroups') || document.body, {
        childList: true,
        subtree: true,
    });

    window.setTimeout(renderControls, 300);
})();
