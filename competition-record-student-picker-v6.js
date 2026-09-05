/**
 * FILE: competition-record-student-picker-v6.js
 *
 * Mục đích:
 * Thay riêng phần chọn học sinh trong form Ghi nhận thi đua V6.
 *
 * UX:
 * - Không dùng dropdown dài chứa toàn bộ HS.
 * - GVCN có thể tìm theo họ tên hoặc Mã HS.
 * - Kết quả được rút gọn ngay khi gõ.
 * - Khi chọn kết quả, hệ thống vẫn lưu student_id thật.
 *
 * Compatibility:
 * - Không thay đổi database schema.
 * - Không thay đổi addCompetition().
 * - Không thay đổi calculation engine.
 * - Chỉ thay entry point openCompetitionForm() sau khi form V6 gốc đã sẵn sàng.
 */

const STUDENT_PICKER_V6_MAX_RESULTS = 8;
const STUDENT_PICKER_V6_WAIT_MS = 15000;
const STUDENT_PICKER_V6_POLL_MS = 100;

let studentPickerOriginalOpenFormV6 = null;
let studentPickerInitializedV6 = false;
let studentPickerDocumentClickBoundV6 = false;
let selectedStudentPickerIdV6 = '';

/**
 * Escape dữ liệu HS trước khi đưa vào HTML.
 */
function escapeStudentPickerHtmlV6(value) {
    return String(value ?? '').replace(
        /[&<>\"']/g,
        (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '\"': '&quot;',
            "'": '&#039;',
        }[character]),
    );
}

/**
 * Chuẩn hóa chuỗi tìm kiếm để không phân biệt hoa/thường và dấu tiếng Việt.
 */
function normalizeStudentPickerSearchV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Lọc HS theo họ tên hoặc Mã HS.
 *
 * @param {Array<object>} sourceStudents Danh sách HS hiện tại.
 * @param {string} keyword Từ khóa tìm kiếm.
 * @returns {Array<object>} Danh sách kết quả đã giới hạn.
 */
function filterStudentsForPickerV6(sourceStudents, keyword) {
    const normalizedKeyword =
        normalizeStudentPickerSearchV6(keyword);

    if (!normalizedKeyword) {
        return [];
    }

    return sourceStudents
        .filter((student) => {
            const name = normalizeStudentPickerSearchV6(
                student.full_name,
            );
            const code = normalizeStudentPickerSearchV6(
                student.student_code,
            );

            return (
                name.includes(normalizedKeyword) ||
                code.includes(normalizedKeyword)
            );
        })
        .slice(0, STUDENT_PICKER_V6_MAX_RESULTS);
}

/**
 * Đóng danh sách gợi ý.
 */
function closeStudentPickerResultsV6() {
    const results = document.getElementById(
        'studentPickerResultsV6',
    );

    if (results) {
        results.classList.add('hidden');
        results.innerHTML = '';
    }
}

/**
 * Hiển thị kết quả tìm kiếm.
 */
function renderStudentPickerResultsV6(keyword) {
    const input = document.getElementById(
        'studentPickerInputV6',
    );
    const results = document.getElementById(
        'studentPickerResultsV6',
    );

    if (!input || !results) {
        return;
    }

    const matches = filterStudentsForPickerV6(
        Array.isArray(students) ? students : [],
        keyword,
    );

    if (!keyword.trim()) {
        closeStudentPickerResultsV6();
        return;
    }

    if (!matches.length) {
        results.innerHTML = `
            <div class="student-picker-empty-v6">
                Không tìm thấy HS phù hợp.
            </div>
        `;
        results.classList.remove('hidden');
        return;
    }

    results.innerHTML = matches
        .map((student) => {
            const name = escapeStudentPickerHtmlV6(
                student.full_name,
            );
            const code = escapeStudentPickerHtmlV6(
                student.student_code || 'Chưa có Mã HS',
            );
            const team = student.team
                ? ` · Tổ ${escapeStudentPickerHtmlV6(student.team)}`
                : '';

            return `
                <button
                    class="student-picker-option-v6"
                    type="button"
                    data-student-picker-id="${escapeStudentPickerHtmlV6(student.id)}"
                >
                    <span class="student-picker-name-v6">${name}</span>
                    <span class="student-picker-meta-v6">
                        ${code}${team}
                    </span>
                </button>
            `;
        })
        .join('');

    results.classList.remove('hidden');
}

/**
 * Cập nhật HS đã chọn và input hiển thị.
 */
function selectStudentPickerV6(student) {
    const input = document.getElementById(
        'studentPickerInputV6',
    );
    const hiddenStudentId = document.getElementById(
        'fStudentV6',
    );

    if (!input || !hiddenStudentId || !student) {
        return;
    }

    selectedStudentPickerIdV6 = String(student.id);
    hiddenStudentId.value = selectedStudentPickerIdV6;
    input.value = `${student.full_name} · ${student.student_code || ''}`.trim();

    closeStudentPickerResultsV6();
}

/**
 * Xóa HS đã chọn để GVCN chọn lại.
 */
function clearStudentPickerV6() {
    selectedStudentPickerIdV6 = '';

    const input = document.getElementById(
        'studentPickerInputV6',
    );
    const hiddenStudentId = document.getElementById(
        'fStudentV6',
    );

    if (input) {
        input.value = '';
        input.focus();
    }

    if (hiddenStudentId) {
        hiddenStudentId.value = '';
    }

    closeStudentPickerResultsV6();
}

/**
 * Tạo UI chọn HS autocomplete.
 *
 * `students` vẫn là source dữ liệu hiện tại đã được load từ Supabase.
 */
function buildStudentPickerMarkupV6() {
    return `
        <div class="student-picker-v6">
            <input
                id="fStudentV6"
                type="hidden"
                value=""
            >
            <div class="student-picker-input-wrap-v6">
                <input
                    id="studentPickerInputV6"
                    type="text"
                    autocomplete="off"
                    placeholder="Gõ họ tên hoặc Mã HS..."
                    aria-label="Tìm học sinh theo họ tên hoặc Mã HS"
                >
                <button
                    id="studentPickerClearV6"
                    class="student-picker-clear-v6 hidden"
                    type="button"
                    aria-label="Bỏ chọn học sinh"
                >
                    ×
                </button>
            </div>
            <div
                id="studentPickerResultsV6"
                class="student-picker-results-v6 hidden"
            ></div>
            <div
                id="studentPickerHintV6"
                class="mini student-picker-hint-v6"
            >
                Gõ tên hoặc Mã HS để thu hẹp danh sách.
            </div>
        </div>
    `;
}

/**
 * Đóng gợi ý khi GVCN click ra ngoài picker.
 *
 * Listener chỉ đăng ký một lần trong toàn bộ vòng đời trang để tránh
 * tạo nhiều event handler sau mỗi lần mở form.
 */
function bindStudentPickerDocumentClickV6() {
    if (studentPickerDocumentClickBoundV6) {
        return;
    }

    document.addEventListener('click', (event) => {
        const picker = event.target.closest(
            '.student-picker-v6',
        );

        if (!picker) {
            closeStudentPickerResultsV6();
        }
    });

    studentPickerDocumentClickBoundV6 = true;
}

/**
 * Gắn event cho autocomplete.
 */
function bindStudentPickerEventsV6() {
    const input = document.getElementById(
        'studentPickerInputV6',
    );
    const clearButton = document.getElementById(
        'studentPickerClearV6',
    );
    const results = document.getElementById(
        'studentPickerResultsV6',
    );

    if (!input || !clearButton || !results) {
        return;
    }

    input.addEventListener('input', () => {
        selectedStudentPickerIdV6 = '';

        const hiddenStudentId = document.getElementById(
            'fStudentV6',
        );

        if (hiddenStudentId) {
            hiddenStudentId.value = '';
        }

        clearButton.classList.toggle(
            'hidden',
            !input.value.trim(),
        );

        renderStudentPickerResultsV6(input.value);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim() && !selectedStudentPickerIdV6) {
            renderStudentPickerResultsV6(input.value);
        }
    });

    clearButton.addEventListener('click', () => {
        clearStudentPickerV6();
        clearButton.classList.add('hidden');
    });

    results.addEventListener('click', (event) => {
        const option = event.target.closest(
            '[data-student-picker-id]',
        );

        if (!option) {
            return;
        }

        const studentId = option.dataset.studentPickerId;
        const student = (Array.isArray(students) ? students : [])
            .find(
                (item) => String(item.id) === String(studentId),
            );

        if (!student) {
            return;
        }

        selectStudentPickerV6(student);
        clearButton.classList.remove('hidden');
    });

    bindStudentPickerDocumentClickV6();
}

/**
 * Mở form Ghi nhận V6 với autocomplete HS.
 *
 * Các phần còn lại được giữ nguyên logic của form V6 hiện tại bằng cách
 * gọi original form, sau đó thay riêng select HS bằng picker.
 */
async function openCompetitionFormWithStudentPickerV6() {
    if (typeof studentPickerOriginalOpenFormV6 !== 'function') {
        return;
    }

    await studentPickerOriginalOpenFormV6();

    const studentSelect = document.getElementById('fStudentV6');

    if (!studentSelect) {
        return;
    }

    const previousStudentId = studentSelect.value;
    const parent = studentSelect.parentElement;

    if (!parent) {
        return;
    }

    const label = parent.querySelector('label');

    parent.innerHTML = `
        ${label ? '<label>Học sinh</label>' : ''}
        ${buildStudentPickerMarkupV6()}
    `;

    if (previousStudentId) {
        const previousStudent =
            (Array.isArray(students) ? students : [])
                .find(
                    (student) =>
                        String(student.id) ===
                        String(previousStudentId),
                );

        if (previousStudent) {
            selectStudentPickerV6(previousStudent);
            document
                .getElementById('studentPickerClearV6')
                ?.classList.remove('hidden');
        }
    }

    bindStudentPickerEventsV6();

    document
        .getElementById('studentPickerInputV6')
        ?.focus();
}

/**
 * Tự nạp CSS riêng cho picker, tránh sửa index.html chỉ vì style.
 */
function loadStudentPickerStylesV6() {
    if (
        document.querySelector(
            'link[data-student-picker-v6-style]',
        )
    ) {
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'competition-record-student-picker-v6.css';
    link.dataset.studentPickerV6Style = 'true';

    document.head.appendChild(link);
}

/**
 * Chờ form V6 được load rồi mới thay entry point.
 */
function bootstrapStudentPickerV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (
            typeof window.openCompetitionForm ===
                'function' &&
            !studentPickerInitializedV6
        ) {
            studentPickerOriginalOpenFormV6 =
                window.openCompetitionForm;

            window.openCompetitionForm =
                openCompetitionFormWithStudentPickerV6;

            studentPickerInitializedV6 = true;
            window.clearInterval(timer);
            loadStudentPickerStylesV6();

            return;
        }

        if (
            Date.now() - startedAt >=
            STUDENT_PICKER_V6_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Không thể khởi tạo Student Picker.',
            );
        }
    }, STUDENT_PICKER_V6_POLL_MS);
}

bootstrapStudentPickerV6();

/**
 * Public namespace phục vụ test và module khác.
 */
window.CompetitionStudentPickerV6 = {
    filterStudentsForPickerV6,
    normalizeStudentPickerSearchV6,
};
