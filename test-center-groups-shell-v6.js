/*
 * FILE: test-center-groups-shell-v6.js
 *
 * Mục đích:
 * Tạo sẵn các cụm test trên UI ngay khi Test Center mở.
 * Không phụ thuộc vào nút "Chạy tất cả" của runner legacy.
 *
 * Trách nhiệm:
 * - Render shell cho từng cụm test.
 * - Bảo đảm mỗi cụm có một vị trí ổn định để runner riêng gắn nút.
 *
 * Không chịu trách nhiệm:
 * - Chạy assertion.
 * - Ghi dữ liệu production.
 * - Chứa logic nghiệp vụ của ứng dụng.
 */

(function renderTestGroupShellV6() {
    const GROUPS = [
        'Calculation',
        'Rollover',
        'Record edge cases',
        'Date → week',
        'Criteria',
        'Gọi tên học sinh',
        'Supabase read-only',
    ];

    /**
     * Render các khung test nếu chúng chưa tồn tại.
     *
     * Runner riêng sẽ tìm các section này để gắn nút và kết quả test.
     * Vì vậy shell phải tồn tại ngay cả khi runner chưa được bấm.
     *
     * @returns {void}
     */
    function install() {
        const container = document.getElementById('testGroups');

        if (!container) {
            return;
        }

        const existingNames = new Set(
            [...container.querySelectorAll('.qa-group h3')].map((node) =>
                node.textContent.trim(),
            ),
        );

        for (const group of GROUPS) {
            if (existingNames.has(group)) {
                continue;
            }

            const section = document.createElement('section');
            section.className = 'qa-group';
            section.innerHTML = `
                <div class="qa-group-header">
                    <h3>${group}</h3>
                    <span class="qa-badge neutral">Chưa chạy</span>
                </div>
                <ul class="qa-list">
                    <li class="qa-row">
                        <span class="qa-badge neutral">READY</span>
                        <span class="qa-name">
                            Sẵn sàng — bấm "Chạy cụm này" để kiểm tra riêng nhóm này.
                        </span>
                    </li>
                </ul>
            `;

            container.appendChild(section);
            existingNames.add(group);
        }
    }

    install();
    window.setTimeout(install, 250);
    window.setTimeout(install, 1000);
})();
