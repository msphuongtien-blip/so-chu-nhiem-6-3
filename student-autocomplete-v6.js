/**
 * FILE: student-autocomplete-v6.js
 *
 * UX dùng chung cho mọi form cần chọn học sinh.
 * - Tìm theo họ tên hoặc Mã HS.
 * - Không dùng dropdown dài 44 học sinh.
 * - Giữ nguyên id field cũ dưới dạng hidden value để submit handler hiện tại
 *   tiếp tục hoạt động.
 * - Hỗ trợ Enter, ArrowUp/ArrowDown và Escape.
 * - Form tạo mới luôn bắt buộc GVCN chọn rõ một học sinh; không tự chọn HS đầu.
 */

const STUDENT_AUTOCOMPLETE_V6_MAX_RESULTS = 8;
const STUDENT_AUTOCOMPLETE_V6_TARGETS = Object.freeze({
    fStudentV6: 'id',
    fStudent: 'id',
    eStudent: 'id',
    hStudent: 'id',
    dStudent: 'id',
    lStudent: 'id',
    msgStudent: 'user_id',
});

const STUDENT_AUTOCOMPLETE_V6_PRESERVE_INITIAL_VALUE = new Set([
    'eStudent',
]);

function getStudentAutocompleteSourceV6() {
    if (typeof students !== 'undefined' && Array.isArray(students)) {
        return students;
    }

    return Array.isArray(globalThis.students)
        ? globalThis.students
        : [];
}

function normalizeStudentAutocompleteV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function filterStudents(sourceStudents, keyword) {
    const query = normalizeStudentAutocompleteV6(keyword);

    if (!query) {
        return [];
    }

    return (Array.isArray(sourceStudents) ? sourceStudents : [])
        .filter((student) => {
            const name = normalizeStudentAutocompleteV6(
                student.full_name,
            );
            const code = normalizeStudentAutocompleteV6(
                student.student_code,
            );

            return name.includes(query) || code.includes(query);
        })
        .slice(0, STUDENT_AUTOCOMPLETE_V6_MAX_RESULTS);
}

function resolveStudentValue(student, valueField) {
    if (!student) {
        return '';
    }

    return String(student[valueField] ?? '');
}

function escapeStudentAutocompleteV6(value) {
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

function findStudentForValueV6(value) {
    const allStudents = getStudentAutocompleteSourceV6();
    const normalized = String(value ?? '');

    return allStudents.find((student) =>
        String(student.id ?? '') === normalized ||
        String(student.user_id ?? '') === normalized,
    ) || null;
}

function studentAutocompleteMarkupV6(fieldId) {
    return `
        <div
            class="student-autocomplete-v6"
            data-student-autocomplete="${fieldId}"
        >
            <div class="student-autocomplete-input-wrap-v6">
                <input
                    id="${fieldId}DisplayV6"
                    type="text"
                    autocomplete="off"
                    placeholder="Gõ tên hoặc Mã HS..."
                    aria-label="Tìm học sinh theo họ tên hoặc Mã HS"
                >
                <button
                    type="button"
                    class="student-autocomplete-clear-v6 hidden"
                    aria-label="Bỏ chọn học sinh"
                >
                    ×
                </button>
            </div>
            <div class="student-autocomplete-results-v6 hidden"></div>
            <div class="mini student-autocomplete-hint-v6">
                Tìm nhanh bằng họ tên hoặc Mã HS.
            </div>
        </div>
    `;
}

function mountStudentAutocompleteV6(select) {
    if (
        !select ||
        select.dataset.studentAutocompleteMounted === 'true'
    ) {
        return false;
    }

    const fieldId = select.id;
    const valueField = STUDENT_AUTOCOMPLETE_V6_TARGETS[fieldId];

    if (!valueField) {
        return false;
    }

    const parent = select.parentElement;

    if (!parent) {
        return false;
    }

    const currentValue = STUDENT_AUTOCOMPLETE_V6_PRESERVE_INITIAL_VALUE.has(
        fieldId,
    )
        ? select.value
        : '';
    const label = parent.querySelector('label');
    const wrapper = document.createElement('div');

    wrapper.innerHTML = `
        ${label ? '<label>Học sinh</label>' : ''}
        <input
            id="${fieldId}"
            type="hidden"
            value="${escapeStudentAutocompleteV6(currentValue)}"
        >
        ${studentAutocompleteMarkupV6(fieldId)}
    `;

    parent.replaceChild(wrapper, select);

    const picker = wrapper.querySelector('.student-autocomplete-v6');
    const input = wrapper.querySelector(`#${fieldId}DisplayV6`);
    const results = wrapper.querySelector(
        '.student-autocomplete-results-v6',
    );
    const clear = wrapper.querySelector(
        '.student-autocomplete-clear-v6',
    );
    const hidden = wrapper.querySelector(`#${fieldId}`);

    let activeIndex = -1;

    const closeResults = () => {
        results.classList.add('hidden');
        results.innerHTML = '';
        activeIndex = -1;
    };

    const selectStudent = (student) => {
        hidden.value = resolveStudentValue(student, valueField);
        input.value = `${student.full_name || ''}${
            student.student_code
                ? ` · ${student.student_code}`
                : ''
        }`;
        clear.classList.toggle('hidden', !input.value);
        closeResults();
    };

    const renderResults = () => {
        const matches = filterStudents(
            getStudentAutocompleteSourceV6(),
            input.value,
        );

        if (!input.value.trim()) {
            closeResults();
            return;
        }

        if (!matches.length) {
            results.innerHTML =
                '<div class="student-autocomplete-empty-v6">' +
                'Không tìm thấy học sinh phù hợp.' +
                '</div>';
            results.classList.remove('hidden');
            return;
        }

        results.innerHTML = matches
            .map(
                (student, index) => `
                    <button
                        type="button"
                        class="student-autocomplete-option-v6"
                        data-index="${index}"
                    >
                        <span>
                            <strong>${escapeStudentAutocompleteV6(
                                student.full_name,
                            )}</strong>
                            <small>${escapeStudentAutocompleteV6(
                                student.student_code || 'Chưa có Mã HS',
                            )}</small>
                        </span>
                        ${
                            student.team
                                ? `<small>Tổ ${escapeStudentAutocompleteV6(
                                      student.team,
                                  )}</small>`
                                : ''
                        }
                    </button>
                `,
            )
            .join('');

        results.classList.remove('hidden');
    };

    input.addEventListener('input', () => {
        hidden.value = '';
        clear.classList.toggle('hidden', !input.value.trim());
        activeIndex = -1;
        renderResults();
    });

    input.addEventListener('keydown', (event) => {
        const options = [
            ...results.querySelectorAll(
                '.student-autocomplete-option-v6',
            ),
        ];

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activeIndex = Math.min(
                activeIndex + 1,
                options.length - 1,
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
        } else if (
            event.key === 'Enter' &&
            activeIndex >= 0 &&
            options[activeIndex]
        ) {
            event.preventDefault();
            options[activeIndex].click();
            return;
        } else if (event.key === 'Escape') {
            closeResults();
            return;
        } else {
            return;
        }

        options.forEach((option, index) => {
            option.classList.toggle(
                'is-active',
                index === activeIndex,
            );
        });
    });

    results.addEventListener('click', (event) => {
        const option = event.target.closest(
            '.student-autocomplete-option-v6',
        );

        if (!option) {
            return;
        }

        const matches = filterStudents(
            getStudentAutocompleteSourceV6(),
            input.value,
        );
        const student = matches[Number(option.dataset.index)];

        if (student) {
            selectStudent(student);
        }
    });

    clear.addEventListener('click', () => {
        hidden.value = '';
        input.value = '';
        clear.classList.add('hidden');
        input.focus();
        closeResults();
    });

    document.addEventListener('click', (event) => {
        if (!picker.contains(event.target)) {
            closeResults();
        }
    });

    const previousStudent = findStudentForValueV6(currentValue);

    if (previousStudent) {
        selectStudent(previousStudent);
    }

    select.dataset.studentAutocompleteMounted = 'true';
    input.focus();
    return true;
}

function mountAllStudentAutocompletesV6(root = document) {
    Object.keys(STUDENT_AUTOCOMPLETE_V6_TARGETS).forEach(
        (fieldId) => {
            const select = root.querySelector?.(`#${fieldId}`);

            if (select && select.tagName === 'SELECT') {
                mountStudentAutocompleteV6(select);
            }
        },
    );
}

function loadStudentAutocompleteStylesV6() {
    if (
        document.querySelector(
            'link[data-student-autocomplete-v6-style]',
        )
    ) {
        return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'student-autocomplete-v6.css';
    link.dataset.studentAutocompleteV6Style = 'true';
    document.head.appendChild(link);
}

function bootstrapStudentAutocompleteV6() {
    if (
        typeof document === 'undefined' ||
        typeof MutationObserver === 'undefined'
    ) {
        return;
    }

    loadStudentAutocompleteStylesV6();

    const observer = new MutationObserver(() => {
        mountAllStudentAutocompletesV6();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    mountAllStudentAutocompletesV6();
}

globalThis.StudentAutocompleteV6 = Object.freeze({
    filterStudents,
    normalizeStudentAutocompleteV6,
    resolveStudentValue,
    mountStudentAutocompleteV6,
    mountAllStudentAutocompletesV6,
});

if (typeof document !== 'undefined') {
    bootstrapStudentAutocompleteV6();
}
