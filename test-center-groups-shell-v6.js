/*
 * FILE: test-center-groups-shell-v6.js
 *
 * Mục đích:
 * Tạo sẵn các cụm test trên UI ngay khi Test Center mở.
 * Không phụ thuộc vào nút "Chạy tất cả" của runner legacy.
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

    function install() {
        const container = document.getElementById('testGroups');
        if (!container) return;

        for (const group of GROUPS) {
            if ([...container.querySelectorAll('.qa-group h3')].some((node) => node.textContent.trim() === group)) {
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
                        <span class="qa-name">Sẵn sàng — bấm "Chạy cụm này" để kiểm tra riêng nhóm này.</span>
                    </li>
                </ul>
            `;
            container.appendChild(section);
        }
    }

    install();
    window.setTimeout(install, 250);
    window.setTimeout(install, 1000);
})();
