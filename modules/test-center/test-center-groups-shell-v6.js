/* Test Center group shell. */
(function renderTestGroupShellV6() {
    const GROUPS = [
        'Calculation',
        'Rollover',
        'Record edge cases',
        'Date → week',
        'Criteria',
        'Gọi tên học sinh',
        'Snapshot & sửa điểm',
        'Supabase read-only',
    ];

    function install() {
        const container = document.getElementById('testGroups');
        if (!container) return;

        const existingNames = new Set(
            [...container.querySelectorAll('.qa-group h3')].map((node) => node.textContent.trim()),
        );

        for (const group of GROUPS) {
            if (existingNames.has(group)) continue;

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
            existingNames.add(group);
        }
    }

    install();
    window.setTimeout(install, 250);
    window.setTimeout(install, 1000);
})();
