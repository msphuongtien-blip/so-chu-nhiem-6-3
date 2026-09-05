/**
 * FILE: competition-records-v6.js
 *
 * Mục đích: Domain module đã được hợp nhất theo chức năng để dễ bảo trì.
 */


/* ===== competition-record-service-v6.js ===== */

/**
 * FILE: competition-record-service-v6.js
 *
 * Mục đích:
 * Cung cấp service duy nhất cho thao tác Ghi nhận thi đua V6.
 *
 * Trách nhiệm:
 * - Validate dữ liệu record trước khi ghi.
 * - Ghi competition_records bằng Supabase client dùng chung của Core.
 * - Lưu criteria_id để lịch sử liên kết đúng với criteria thật.
 * - Đồng bộ lại state/cache sau khi ghi thành công.
 *
 * Không chịu trách nhiệm:
 * - Render form.
 * - Render bảng xếp hạng.
 * - Quản lý UI Cài đặt tiêu chí.
 * - Thay đổi RLS hoặc schema bằng JavaScript.
 *
 * Nguyên tắc:
 * - `competition_records` là nguồn dữ liệu gốc của lịch sử.
 * - Không cập nhật điểm tổng của HS bằng phép cộng/trừ thủ công.
 * - Sau khi INSERT, các module đọc lại dữ liệu từ Supabase.
 */

const COMPETITION_RECORD_SERVICE_V6_SCORES = Object.freeze([
    -5,
    -4,
    -3,
    -2,
    -1,
    1,
    2,
    3,
    4,
    5,
]);

/**
 * Lấy Supabase client dùng chung từ Core.
 *
 * Dùng `typeof`/optional chaining để tránh ReferenceError khi module
 * được nạp trước core/supabase.js.
 *
 * @returns {object|null} Supabase client hoặc null nếu Core chưa sẵn sàng.
 */
function getCompetitionRecordServiceClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * Kiểm tra score có nằm trong tập điểm hợp lệ hay không.
 *
 * @param {number} score Điểm cần kiểm tra.
 * @returns {boolean} true khi điểm hợp lệ.
 */
function isCompetitionRecordScoreValidV6(score) {
    return COMPETITION_RECORD_SERVICE_V6_SCORES.includes(
        Number(score),
    );
}

/**
 * Tạo payload chuẩn cho competition_records.
 *
 * Hàm này cố ý là pure function để dễ test và tránh phụ thuộc DOM.
 *
 * @param {object} input Dữ liệu record cần ghi.
 * @returns {object} Payload sẵn sàng gửi lên Supabase.
 */
function buildCompetitionRecordPayloadV6(input) {
    const {
        studentId,
        criteria,
        points,
        note = '',
        categoryId,
        week,
        date,
        createdBy,
    } = input;

    if (!studentId) {
        throw new Error('Thiếu học sinh.');
    }

    if (!criteria?.id) {
        throw new Error('Thiếu criteria_id.');
    }

    if (!criteria?.name) {
        throw new Error('Thiếu tên tiêu chí.');
    }

    if (!categoryId) {
        throw new Error('Thiếu category_id.');
    }

    if (!week || !date) {
        throw new Error('Thiếu tuần hoặc ngày ghi nhận.');
    }

    if (!createdBy) {
        throw new Error('Không xác định được người tạo bản ghi.');
    }

    const numericPoints = Number(points);

    if (!isCompetitionRecordScoreValidV6(numericPoints)) {
        throw new Error(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
        );
    }

    return {
        student_id: studentId,
        criteria_id: criteria.id,
        criteria: String(criteria.name).trim(),
        category_id: Number(categoryId),
        score: numericPoints,
        points: numericPoints,
        period: 'week',
        week: week,
        week_start: week,
        date,
        note: String(note || '').trim(),
        created_by: createdBy,
    };
}

/**
 * Đồng bộ cache sau khi INSERT.
 *
 * `loadCompetitionHistoryFromSupabase()` là API hiện có của app.js.
 * Gọi lại API này giúp renderCompetition() dùng dữ liệu mới thay vì cache cũ.
 *
 * @returns {Promise<boolean>} true nếu refresh thành công.
 */
async function refreshCompetitionRecordStateV6() {
    if (
        typeof window.loadCompetitionHistoryFromSupabase ===
        'function'
    ) {
        const refreshedRecords =
            await window.loadCompetitionHistoryFromSupabase();

        if (Array.isArray(globalThis.supabaseCache?.competitionRecords)) {
            globalThis.supabaseCache.competitionRecords =
                refreshedRecords || [];
        }
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        await window.loadStudentsFromSupabase();
    }

    if (typeof window.renderDashboard === 'function') {
        await window.renderDashboard();
    }

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    if (typeof window.renderStudents === 'function') {
        await window.renderStudents();
    }

    return true;
}

/**
 * Lưu một record thi đua mới và đồng bộ UI.
 *
 * @param {object} input Dữ liệu record.
 * @returns {Promise<{ok: boolean, data?: object, refreshOk?: boolean, message?: string}>}
 */
async function saveCompetitionRecordV6(input) {
    const client = getCompetitionRecordServiceClientV6();

    if (!client) {
        return {
            ok: false,
            message:
                'Supabase Core chưa sẵn sàng. Vui lòng thử lại.',
        };
    }

    let payload;

    try {
        payload = buildCompetitionRecordPayloadV6(input);
    } catch (error) {
        return {
            ok: false,
            message: error.message,
        };
    }

    const {
        data,
        error,
    } = await client
        .from('competition_records')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        console.error(
            '[Competition V6] Không thể lưu record:',
            error,
        );

        return {
            ok: false,
            message:
                'Không thể lưu ghi nhận: ' +
                error.message,
        };
    }

    let refreshOk = true;

    try {
        await refreshCompetitionRecordStateV6();
    } catch (error) {
        refreshOk = false;

        console.error(
            '[Competition V6] Record đã lưu nhưng refresh thất bại:',
            error,
        );
    }

    return {
        ok: true,
        data,
        refreshOk,
    };
}

/**
 * Public API để các module V6 khác dùng chung.
 */
globalThis.CompetitionRecordServiceV6 = Object.freeze({
    COMPETITION_RECORD_SERVICE_V6_SCORES,
    buildCompetitionRecordPayloadV6,
    isCompetitionRecordScoreValidV6,
    refreshCompetitionRecordStateV6,
    saveCompetitionRecordV6,
});


/* ===== competition-record-sync-v6.js ===== */

/**
 * FILE: competition-record-sync-v6.js
 *
 * Mục đích:
 * Là integration layer cho luồng Ghi nhận thi đua V6 trong giai đoạn
 * refactor từ runtime legacy sang các module chuyên trách.
 *
 * Trách nhiệm:
 * - Giữ compatibility cho `addCompetition()` legacy.
 * - Nạp Record Service V6.
 * - Nạp Submit Adapter V6.
 * - Đảm bảo form V6 không phụ thuộc trực tiếp vào implementation legacy.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm.
 * - Thay đổi database schema.
 * - Thay đổi RLS.
 * - Render UI form.
 *
 * Kiến trúc:
 * - competition-record-service-v6.js: persistence + state sync.
 * - competition-record-submit-v6.js: DOM form + service integration.
 * - File này: compatibility/integration bootstrap.
 */

const COMPETITION_RECORD_SYNC_MAX_WAIT_MS = 15000;
const COMPETITION_RECORD_SYNC_INTERVAL_MS = 100;
const COMPETITION_RECORD_SERVICE_SCRIPT_ID =
    'competition-record-service-v6-script';
const COMPETITION_RECORD_SUBMIT_SCRIPT_ID =
    'competition-record-submit-v6-script';

/**
 * Hiển thị thông báo thành công nhẹ, không chặn thao tác như alert().
 *
 * Hàm này vẫn được giữ cho các luồng legacy đã dùng integration layer.
 */
function showCompetitionSuccessToastV6(message) {
    const existingToast = document.getElementById(
        'competitionSuccessToastV6',
    );

    existingToast?.remove();

    const toast = document.createElement('div');
    toast.id = 'competitionSuccessToastV6';
    toast.className = 'notice';
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '9999',
        maxWidth: '420px',
    });

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Bọc addCompetition() legacy để các luồng V5 cũ vẫn tự đồng bộ cache.
 *
 * Form Ghi nhận V6 mới không còn gọi trực tiếp function này.
 */
function installCompetitionRecordSyncV6() {
    if (
        typeof window.addCompetition !== 'function' ||
        window.addCompetition.__syncWrappedV6
    ) {
        return false;
    }

    const originalAddCompetition = window.addCompetition;

    async function addCompetitionWithSyncV6(...args) {
        const ok = await originalAddCompetition(...args);

        if (!ok) {
            return false;
        }

        try {
            if (
                typeof window.loadCompetitionHistoryFromSupabase ===
                'function'
            ) {
                await window.loadCompetitionHistoryFromSupabase();
            }

            showCompetitionSuccessToastV6(
                'Đã lưu ghi nhận thi đua và cập nhật lịch sử.',
            );
        } catch (error) {
            console.error(
                '[Competition V6] Không thể đồng bộ lịch sử sau khi lưu:',
                error,
            );

            showCompetitionSuccessToastV6(
                'Đã lưu ghi nhận. Không thể tải lại lịch sử ngay; vui lòng bấm Cập nhật từ Supabase.',
            );
        }

        return true;
    }

    addCompetitionWithSyncV6.__syncWrappedV6 = true;
    window.addCompetition = addCompetitionWithSyncV6;

    return true;
}

/**
 * Nạp một module JavaScript động nếu module chưa tồn tại trong DOM.
 *
 * Dynamic loading giữ entry point legacy ổn định nhưng vẫn bảo đảm module
 * nghiệp vụ được đưa vào runtime thật sự.
 */
function loadCompetitionRuntimeScriptV6(
    scriptId,
    source,
) {
    if (document.getElementById(scriptId)) {
        return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = source;
    script.defer = true;

    document.head.appendChild(script);
}

/**
 * Bootstrap các module V6 cần cho luồng Ghi nhận.
 */
function bootstrapCompetitionRecordModulesV6() {
    loadCompetitionRuntimeScriptV6(
        COMPETITION_RECORD_SERVICE_SCRIPT_ID,
        'competition-record-service-v6.js',
    );

    loadCompetitionRuntimeScriptV6(
        COMPETITION_RECORD_SUBMIT_SCRIPT_ID,
        'competition-record-submit-v6.js',
    );
}

/**
 * Bootstrap integration sau khi app.js đã định nghĩa addCompetition().
 */
function bootstrapCompetitionRecordSyncV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        bootstrapCompetitionRecordModulesV6();

        if (installCompetitionRecordSyncV6()) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_RECORD_SYNC_MAX_WAIT_MS
        ) {
            window.clearInterval(timer);

            console.warn(
                '[Competition V6] Record sync bootstrap timed out.',
            );
        }
    }, COMPETITION_RECORD_SYNC_INTERVAL_MS);
}

bootstrapCompetitionRecordSyncV6();


/* ===== competition-record-student-picker-v6.js ===== */

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


/* ===== competition-render-helpers-v6.js ===== */

/**
 * FILE: competition-render-helpers-v6.js
 *
 * Mục đích:
 * Cung cấp các helper hiển thị cho module Thi đua V6 mà runtime legacy
 * `app.js` vẫn đang gọi.
 *
 * Trách nhiệm:
 * - Khôi phục helper `trendText()` bị thiếu sau quá trình tách module.
 * - Không thực hiện query Supabase.
 * - Không thay đổi cách tính điểm.
 *
 * Thiết kế:
 * - Helper nhận dữ liệu đã có sẵn trên object học sinh.
 * - Hàm luôn trả về chuỗi an toàn để renderer không làm hỏng toàn bộ UI.
 */

/**
 * Xác định xu hướng điểm thi đua từ lịch sử điểm của một HS.
 *
 * Quy ước:
 * - Không đủ dữ liệu để so sánh: "—".
 * - Điểm gần nhất tăng: "↗ Tăng".
 * - Điểm gần nhất giảm: "↘ Giảm".
 * - Điểm không đổi: "→ Ổn định".
 *
 * @param {Array<number|string>} scoreHistory Lịch sử điểm theo tuần.
 * @returns {string} Chuỗi hiển thị xu hướng.
 */
function trendText(scoreHistory) {
    if (!Array.isArray(scoreHistory) || scoreHistory.length < 2) {
        return '—';
    }

    const previous = Number(
        scoreHistory[scoreHistory.length - 2],
    );
    const latest = Number(
        scoreHistory[scoreHistory.length - 1],
    );

    if (!Number.isFinite(previous) || !Number.isFinite(latest)) {
        return '—';
    }

    if (latest > previous) {
        return '↗ Tăng';
    }

    if (latest < previous) {
        return '↘ Giảm';
    }

    return '→ Ổn định';
}

/**
 * Public API dành cho runtime legacy và các module V6.
 */
globalThis.CompetitionRenderHelpersV6 = Object.freeze({
    trendText,
});

/*
 * `renderCompetition()` của app.js gọi trực tiếp `trendText()` theo kiểu
 * global function. Giữ alias này trong thời gian migration để không phải
 * viết lại toàn bộ renderer legacy ngay trong C2.3.
 */
globalThis.trendText = trendText;


/* ===== competition-record-edit-sync-v6.js ===== */

/**
 * FILE: competition-record-edit-sync-v6.js
 *
 * Mục đích:
 * Đồng bộ state/UI sau khi GVCN sửa một record thi đua.
 *
 * Nguyên nhân của module:
 * - saveEditedCompetition() legacy cập nhật Supabase.
 * - Sau đó các renderer có thể vẫn đọc cache cũ.
 * - Trường hợp đổi HS A → B vì vậy không phản ánh ngay điểm của cả A và B.
 *
 * Trách nhiệm:
 * - Giữ nguyên nghiệp vụ update hiện tại của app.js.
 * - Sau update thành công, tải lại students và competition_records.
 * - Render lại các module phụ thuộc dữ liệu đó.
 *
 * Không chịu trách nhiệm:
 * - Tính lại điểm bằng phép cộng/trừ thủ công.
 * - Thay đổi schema hoặc RLS.
 */

const COMPETITION_EDIT_SYNC_WAIT_MS = 15000;
const COMPETITION_EDIT_SYNC_POLL_MS = 100;

let competitionEditSyncWrappedV6 = false;

/**
 * Refresh toàn bộ nguồn dữ liệu liên quan tới record thi đua.
 *
 * Tải dữ liệu mới trước khi render để tránh render bằng cache cũ.
 */
async function refreshCompetitionAfterEditV6() {
    if (typeof window.loadCompetitionHistoryFromSupabase === 'function') {
        await window.loadCompetitionHistoryFromSupabase();
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        await window.loadStudentsFromSupabase();
    }

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    if (typeof window.renderStudents === 'function') {
        await window.renderStudents();
    }

    if (typeof window.renderDashboard === 'function') {
        await window.renderDashboard();
    }
}

/**
 * Hiển thị toast không chặn thao tác.
 */
function showCompetitionEditSyncToastV6(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = isError ? 'notice danger' : 'notice';
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '9999',
        maxWidth: '420px',
    });

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Bọc saveEditedCompetition() của runtime legacy.
 *
 * Function legacy vẫn chịu trách nhiệm validation và UPDATE.
 * Wrapper chỉ chịu trách nhiệm refresh dữ liệu sau khi nó hoàn thành.
 */
function installCompetitionEditSyncV6() {
    if (
        competitionEditSyncWrappedV6 ||
        typeof window.saveEditedCompetition !== 'function'
    ) {
        return false;
    }

    const originalSaveEditedCompetition =
        window.saveEditedCompetition;

    async function saveEditedCompetitionWithSyncV6(...args) {
        const result = await originalSaveEditedCompetition(...args);

        try {
            await refreshCompetitionAfterEditV6();
            showCompetitionEditSyncToastV6(
                'Đã sửa record và cập nhật dữ liệu của các HS liên quan.',
            );
        } catch (error) {
            console.error(
                '[Competition V6] Không thể đồng bộ sau khi sửa record:',
                error,
            );

            showCompetitionEditSyncToastV6(
                'Đã sửa record nhưng giao diện chưa đồng bộ. Vui lòng bấm Cập nhật từ Supabase.',
                true,
            );
        }

        return result;
    }

    window.saveEditedCompetition =
        saveEditedCompetitionWithSyncV6;
    competitionEditSyncWrappedV6 = true;

    return true;
}

/**
 * Bootstrap sau khi app.js đã định nghĩa saveEditedCompetition().
 */
function bootstrapCompetitionEditSyncV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installCompetitionEditSyncV6()) {
            window.clearInterval(timer);
            return;
        }

        if (
            Date.now() - startedAt >=
            COMPETITION_EDIT_SYNC_WAIT_MS
        ) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Edit sync bootstrap timed out.',
            );
        }
    }, COMPETITION_EDIT_SYNC_POLL_MS);
}

bootstrapCompetitionEditSyncV6();


/* ===== competition-record-form-v6.js ===== */

/**
 * FILE: competition-record-form-v6.js
 *
 * Mục đích:
 * Thay thế UI form "Ghi nhận thi đua" của V5 bằng form V6 gọn hơn.
 *
 * Thiết kế:
 * - Không hiển thị các card criteria trùng lặp phía trên form.
 * - Nhóm tiêu chí lấy từ competition_categories.
 * - Criteria lấy từ competition_criteria và lọc theo category_id.
 * - Category 6 (Học tập) hoạt động giống 5 category còn lại.
 * - Thang điểm chỉ gồm -5…-1 và +1…+5; không có 0.
 * - Giáo viên chỉ chọn Ngày; Tuần luôn là dữ liệu dẫn xuất.
 *
 * Compatibility:
 * - Module giữ nguyên addCompetition(), renderStudents(),
 *   renderCompetition() và renderDashboard() đang có.
 * - Chỉ thay UI entry point openCompetitionForm().
 */

const RECORD_FORM_V6_CONFIG = {
    url:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    anonKey:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};

const recordFormV6Supabase = window.supabase.createClient(
    RECORD_FORM_V6_CONFIG.url,
    RECORD_FORM_V6_CONFIG.anonKey,
);

const RECORD_FORM_V6_SCORES = [
    -5,
    -4,
    -3,
    -2,
    -1,
    1,
    2,
    3,
    4,
    5,
];

function escapeRecordFormV6(value) {
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

function getRecordFormCategoriesV6() {
    return window.CompetitionCategoryV6
        ?.getActiveCompetitionCategoriesV6?.() || [];
}

function buildRecordGroupOptionsV6(
    categories,
    selectedId = '',
) {
    return categories
        .slice()
        .sort(
            (a, b) =>
                Number(a.sort_order || 0) -
                    Number(b.sort_order || 0) ||
                Number(a.id) - Number(b.id),
        )
        .map((category) => {
            const selected =
                String(category.id) === String(selectedId)
                    ? ' selected'
                    : '';

            return (
                '<option value="' +
                escapeRecordFormV6(category.id) +
                '"' +
                selected +
                '>' +
                escapeRecordFormV6(category.id) +
                '. ' +
                escapeRecordFormV6(category.name) +
                '</option>'
            );
        })
        .join('');
}

function buildRecordScoreOptionsV6(selected = 1) {
    return RECORD_FORM_V6_SCORES
        .map((value) => {
            const selectedAttr =
                Number(selected) === value ? ' selected' : '';
            const label = value > 0 ? '+' + value : String(value);

            return (
                '<option value="' +
                value +
                '"' +
                selectedAttr +
                '>' +
                label +
                ' điểm</option>'
            );
        })
        .join('');
}

async function loadRecordFormCriteriaV6() {
    const { data, error } = await recordFormV6Supabase
        .from('competition_criteria')
        .select(
            'id, name, type, points, active, sort_order, category_id, group_name',
        )
        .eq('active', true)
        .order('sort_order', {
            ascending: true,
        });

    if (error) {
        throw error;
    }

    return data || [];
}

function filterRecordFormCriteriaV6(
    criteria,
    categoryId,
) {
    return criteria.filter((item) => {
        if (item.category_id !== null && item.category_id !== undefined) {
            return String(item.category_id) === String(categoryId);
        }

        return String(item.group_name || '') === String(categoryId);
    });
}

function buildRecordCriteriaOptionsV6(
    criteria,
    categoryId,
) {
    return filterRecordFormCriteriaV6(criteria, categoryId)
        .map((item) => {
            return (
                '<option value="' +
                escapeRecordFormV6(item.id) +
                '">' +
                escapeRecordFormV6(item.name) +
                '</option>'
            );
        })
        .join('');
}

function refreshRecordFormCriteriaV6(criteria) {
    const groupSelect = document.getElementById('fGroupV6');
    const criteriaSelect = document.getElementById('fCriteriaV6');

    if (!groupSelect || !criteriaSelect) {
        return;
    }

    const options = buildRecordCriteriaOptionsV6(
        criteria,
        groupSelect.value,
    );

    criteriaSelect.innerHTML = options ||
        '<option value="">Chưa có tiêu chí trong nhóm này</option>';

    criteriaSelect.disabled = !options;
}

async function waitForRecordFormCategoriesV6() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const categories = getRecordFormCategoriesV6();

        if (categories.length) {
            return categories;
        }

        await new Promise((resolve) => {
            window.setTimeout(resolve, 100);
        });
    }

    return [];
}

/**
 * Tính Monday từ Ngày đã chọn. Không phụ thuộc module khác để tránh
 * trường hợp load-order làm form không xác định được Tuần.
 */
function getRecordFormWeekFromDateV6(dateValue) {
    if (typeof dateValue !== 'string' || !dateValue) {
        return '';
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

async function openCompetitionFormV6() {
    const categories = await waitForRecordFormCategoriesV6();

    if (!categories.length) {
        openModal(
            'Ghi nhận thi đua',
            '<div class="notice danger">Không tải được nhóm tiêu chí. Vui lòng thử lại.</div>',
        );
        return;
    }

    let criteria;

    try {
        criteria = await loadRecordFormCriteriaV6();
    } catch (error) {
        console.error(
            '[Competition V6] Không tải được criteria:',
            error,
        );

        openModal(
            'Ghi nhận thi đua',
            '<div class="notice danger">Không tải được danh sách tiêu chí. Vui lòng thử lại.</div>',
        );
        return;
    }

    const firstCategoryId = String(categories[0].id);

    const groupOptions = buildRecordGroupOptionsV6(
        categories,
        firstCategoryId,
    );

    openModal(
        'Ghi nhận thi đua',
        `
            <div class="field">
                <label>Học sinh</label>
                <select id="fStudentV6">
                    ${students
                        .map(
                            (student) =>
                                '<option value="' +
                                escapeRecordFormV6(student.id) +
                                '">' +
                                escapeRecordFormV6(student.full_name) +
                                '</option>',
                        )
                        .join('')}
                </select>
            </div>

            <div class="field">
                <label>Ngày</label>
                <input
                    id="fDateV6"
                    type="date"
                    value="${escapeRecordFormV6(localDate())}"
                >
            </div>

            <div class="field">
                <label>Nhóm tiêu chí</label>
                <select id="fGroupV6">
                    ${groupOptions}
                </select>
            </div>

            <div class="field">
                <label>Tiêu chí</label>
                <select id="fCriteriaV6"></select>
            </div>

            <div class="field">
                <label>Điểm</label>
                <select id="fPointsV6">
                    ${buildRecordScoreOptionsV6(1)}
                </select>
            </div>

            <div class="field">
                <label>📝 Ghi chú</label>
                <textarea
                    id="fNoteV6"
                    rows="4"
                    placeholder="Lỗi vi phạm, hành vi tích cực, khen thưởng hoặc nhận xét..."
                ></textarea>
            </div>

            <div class="actions">
                <button
                    class="btn"
                    type="button"
                    onclick="closeModal()"
                >
                    Đóng
                </button>
                <button
                    class="btn primary"
                    type="button"
                    onclick="submitCompetitionV6()"
                >
                    Lưu
                </button>
            </div>
        `,
    );

    refreshRecordFormCriteriaV6(criteria);

    document
        .getElementById('fGroupV6')
        ?.addEventListener('change', () => {
            refreshRecordFormCriteriaV6(criteria);
        });

    document
        .getElementById('fCriteriaV6')
        ?.focus();
}

async function submitCompetitionV6() {
    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = getRecordFormWeekFromDateV6(date);

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return false;
    }

    if (!RECORD_FORM_V6_SCORES.includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const {
        data: selectedCriteria,
        error,
    } = await recordFormV6Supabase
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const ok = await addCompetition(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();

    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

window.openCompetitionForm = openCompetitionFormV6;

window.CompetitionRecordFormV6 = {
    RECORD_FORM_V6_SCORES,
    buildRecordGroupOptionsV6,
    buildRecordScoreOptionsV6,
    filterRecordFormCriteriaV6,
    buildRecordCriteriaOptionsV6,
    getRecordFormWeekFromDateV6,
};


/* ===== competition-record-write-boundary-v6.js ===== */

/**
 * FILE: competition-record-write-boundary-v6.js
 *
 * Mục đích:
 * Boundary chuyển luồng addCompetition() legacy sang Record Service V6.
 *
 * Trách nhiệm:
 * - Giữ nguyên signature mà app.js/form legacy đang sử dụng.
 * - Resolve criteria thật từ Supabase.
 * - Gọi CompetitionRecordServiceV6 để validate + INSERT.
 * - Không tự cập nhật competition_score.
 *
 * Không chịu trách nhiệm:
 * - Render form.
 * - Tính điểm tuần.
 * - Render ranking.
 * - Thay đổi RLS hoặc schema.
 */

const COMPETITION_WRITE_BOUNDARY_SCORES_V6 = Object.freeze([
    -5,
    -4,
    -3,
    -2,
    -1,
    1,
    2,
    3,
    4,
    5,
]);

/**
 * Chuẩn hóa signature legacy thành input cho Record Service V6.
 */
function buildLegacyCompetitionRecordInputV6(input) {
    const points = Number(input.points);

    if (!COMPETITION_WRITE_BOUNDARY_SCORES_V6.includes(points)) {
        throw new Error(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
        );
    }

    if (!input.criteriaId) {
        throw new Error('Thiếu criteria_id.');
    }

    if (!input.studentId || !input.categoryId || !input.week || !input.date) {
        throw new Error('Thiếu dữ liệu ghi nhận thi đua.');
    }

    if (!input.createdBy) {
        throw new Error('Không xác định được người tạo bản ghi.');
    }

    return {
        studentId: input.studentId,
        points,
        criteria: {
            id: input.criteriaId,
            name: String(input.criteriaName || '').trim(),
        },
        note: String(input.note || '').trim(),
        categoryId: Number(input.categoryId),
        week: input.week,
        date: input.date,
        createdBy: input.createdBy,
    };
}

function getCompetitionWriteBoundaryClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * State của app.js/core/state.js dùng lexical binding (`let currentUser`),
 * không tự động xuất hiện trên globalThis. Dùng `typeof` để đọc đúng state
 * khi boundary chạy cùng page; fallback globalThis giúp test/legacy caller
 * vẫn hoạt động khi state được expose công khai.
 */
function getCompetitionCurrentUserIdV6() {
    if (
        typeof currentUser !== 'undefined' &&
        currentUser?.id
    ) {
        return String(currentUser.id);
    }

    return globalThis.currentUser?.id
        ? String(globalThis.currentUser.id)
        : '';
}

/**
 * Resolve criteria theo id hoặc theo tên + category.
 * Tên criteria chỉ là compatibility fallback.
 */
async function resolveCompetitionCriteriaV6(
    criteriaId,
    criteriaName,
    categoryId,
) {
    const client = getCompetitionWriteBoundaryClientV6();

    if (!client) {
        throw new Error('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
    }

    let query = client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('active', true);

    if (criteriaId) {
        query = query.eq('id', criteriaId);
    } else {
        query = query
            .eq('name', String(criteriaName || '').trim())
            .eq('category_id', Number(categoryId));
    }

    const { data, error } = await query.single();

    if (error || !data) {
        throw new Error('Không tìm thấy tiêu chí đã chọn.');
    }

    if (
        categoryId &&
        String(data.category_id) !== String(categoryId)
    ) {
        throw new Error('Tiêu chí không thuộc nhóm đang chọn.');
    }

    return data;
}

/**
 * Replacement cho addCompetition() legacy.
 * Signature được giữ nguyên để không phá các caller hiện tại.
 */
async function addCompetitionThroughV6Boundary(
    studentId,
    points,
    criteriaName,
    note,
    categoryId,
    week,
    date,
) {
    const createdBy = getCompetitionCurrentUserIdV6();

    try {
        const criteria = await resolveCompetitionCriteriaV6(
            '',
            criteriaName,
            categoryId,
        );

        const input = buildLegacyCompetitionRecordInputV6({
            studentId,
            points,
            criteriaName: criteria.name,
            note,
            categoryId,
            week,
            date,
            createdBy,
            criteriaId: criteria.id,
        });

        const service = globalThis.CompetitionRecordServiceV6;

        if (!service?.saveCompetitionRecordV6) {
            throw new Error('Competition Record Service V6 chưa sẵn sàng.');
        }

        const result = await service.saveCompetitionRecordV6(input);

        if (!result.ok) {
            alert(result.message || 'Không thể lưu ghi nhận.');
            return false;
        }

        return true;
    } catch (error) {
        console.error(
            '[Competition V6] Legacy write boundary failed:',
            error,
        );

        alert(error.message || 'Không thể lưu ghi nhận.');
        return false;
    }
}

globalThis.CompetitionRecordWriteBoundaryV6 = Object.freeze({
    COMPETITION_WRITE_BOUNDARY_SCORES_V6,
    buildLegacyCompetitionRecordInputV6,
    getCompetitionCurrentUserIdV6,
    resolveCompetitionCriteriaV6,
    addCompetitionThroughV6Boundary,
});

// Active boundary: all callers now resolve to the V6 record service.
globalThis.addCompetition = addCompetitionThroughV6Boundary;


/* ===== competition-record-form-clean-v6.js ===== */

/**
 * FILE: competition-record-form-clean-v6.js
 *
 * Boundary chuyển tiếp cho form ghi nhận thi đua V6.
 *
 * Nếu Final Boundary V6 đã được cài đặt, module này không được phép ghi đè
 * openCompetitionForm/submitCompetitionV6 nữa.
 */

function removeManualCompetitionWeekV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

async function submitCompetitionCleanV6() {
    if (globalThis.__finalCompetitionRecordFormV6Installed) {
        return globalThis.CompetitionRecordFormFinalV6?.submit?.() || false;
    }

    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Không thể xác định đầy đủ dữ liệu ghi nhận. Vui lòng thử lại.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const client = globalThis.SNCoreSupabase?.client || globalThis.sb;

    if (!client) {
        alert('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const { data: selectedCriteria, error } = await client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const writeBoundary =
        globalThis.CompetitionRecordWriteBoundaryV6
            ?.addCompetitionThroughV6Boundary;

    if (typeof writeBoundary !== 'function') {
        alert('Luồng lưu thi đua V6 chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const ok = await writeBoundary(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();
    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

function installCleanCompetitionRecordFormV6() {
    if (
        globalThis.__finalCompetitionRecordFormV6Installed ||
        typeof globalThis.openCompetitionFormV6 !== 'function'
    ) {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormCleanV6() {
        await globalThis.openCompetitionFormV6();
        removeManualCompetitionWeekV6();
    };

    globalThis.submitCompetitionV6 = submitCompetitionCleanV6;
    globalThis.__cleanCompetitionRecordFormV6Installed = true;
    return true;
}

const startedAt = Date.now();
const timer = window.setInterval(() => {
    if (installCleanCompetitionRecordFormV6()) {
        window.clearInterval(timer);
        return;
    }

    if (Date.now() - startedAt >= 15000) {
        window.clearInterval(timer);
    }
}, 100);

globalThis.CompetitionRecordFormCleanV6 = Object.freeze({
    removeWeek: removeManualCompetitionWeekV6,
    submit: submitCompetitionCleanV6,
    install: installCleanCompetitionRecordFormV6,
});


/* ===== competition-record-date-v6.js ===== */

/**
 * FILE: competition-record-date-v6.js
 *
 * Mục đích:
 * Chuẩn hóa UX ngày ghi nhận trong form Thi đua V6.
 *
 * Nguyên tắc:
 * - GVCN chỉ chọn Ngày.
 * - Tuần là dữ liệu dẫn xuất, hệ thống tự tính từ Ngày.
 * - Không cho người dùng chọn Tuần thủ công.
 * - Cùng một rule được dùng cho form thêm và form sửa.
 *
 * Không thay đổi schema database.
 */

const RECORD_DATE_V6_WAIT_MS = 15000;
const RECORD_DATE_V6_POLL_MS = 100;

let recordDateV6Initialized = false;
let recordDateV6OriginalOpenForm = null;
let recordDateV6OriginalEditForm = null;

/**
 * Tính Monday của tuần chứa ngày được chọn.
 */
function getRecordWeekFromDateV6(dateValue) {
    const engine = globalThis.CompetitionCalculationV6;

    if (engine && typeof engine.getMonday === 'function') {
        return engine.getMonday(dateValue);
    }

    if (typeof dateValue !== 'string' || !dateValue) {
        return '';
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

/**
 * Chuyển một field Tuần thành hidden field và hint read-only.
 */
function convertWeekFieldToDerivedV6(weekId, dateId, hintId) {
    const weekInput = document.getElementById(weekId);
    const dateInput = document.getElementById(dateId);

    if (!weekInput || !dateInput) {
        return false;
    }

    const weekField = weekInput.closest('.field');

    if (weekField) {
        weekField.remove();
    } else {
        weekInput.type = 'hidden';
    }

    const dateField = dateInput.closest('.field');

    if (!dateField) {
        return false;
    }

    const hiddenWeek = document.createElement('input');
    hiddenWeek.id = weekId;
    hiddenWeek.type = 'hidden';

    const hint = document.createElement('div');
    hint.id = hintId;
    hint.className = 'mini competition-record-date-hint-v6';

    dateField.appendChild(hiddenWeek);
    dateField.appendChild(hint);

    const sync = () => {
        const derivedWeek = getRecordWeekFromDateV6(dateInput.value);
        hiddenWeek.value = derivedWeek;
        hint.textContent = derivedWeek
            ? `Hệ thống tự xếp vào tuần bắt đầu ${derivedWeek}.`
            : 'Hệ thống sẽ tự xác định tuần từ Ngày.';
    };

    dateInput.addEventListener('change', sync);
    dateInput.addEventListener('input', sync);
    sync();

    return true;
}

/**
 * Chuẩn hóa form Ghi nhận mới.
 */
function normalizeAddRecordDateFormV6() {
    return convertWeekFieldToDerivedV6(
        'fWeek',
        'fDate',
        'fWeekHintV6',
    );
}

/**
 * Chuẩn hóa form Sửa ghi nhận.
 */
function normalizeEditRecordDateFormV6() {
    return convertWeekFieldToDerivedV6(
        'eWeek',
        'eDate',
        'eWeekHintV6',
    );
}

/**
 * Bọc form thêm và form sửa sau khi legacy renderer đã tạo DOM.
 */
function installRecordDateDerivedWeekV6() {
    if (!recordDateV6Initialized) {
        if (typeof window.openCompetitionForm === 'function') {
            recordDateV6OriginalOpenForm = window.openCompetitionForm;

            window.openCompetitionForm = async function openCompetitionFormDateV6() {
                await recordDateV6OriginalOpenForm();
                normalizeAddRecordDateFormV6();
            };
        }

        if (typeof window.editCompetitionRecord === 'function') {
            recordDateV6OriginalEditForm = window.editCompetitionRecord;

            window.editCompetitionRecord = async function editCompetitionRecordDateV6(id) {
                await recordDateV6OriginalEditForm(id);
                normalizeEditRecordDateFormV6();
            };
        }
    }

    const addReady = typeof recordDateV6OriginalOpenForm === 'function';
    const editReady = typeof recordDateV6OriginalEditForm === 'function';

    if (addReady || editReady) {
        recordDateV6Initialized = true;
        return true;
    }

    return false;
}

/**
 * Chờ các legacy entry point sẵn sàng.
 */
function bootstrapRecordDateV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        if (installRecordDateDerivedWeekV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= RECORD_DATE_V6_WAIT_MS) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Record date bootstrap timed out.',
            );
        }
    }, RECORD_DATE_V6_POLL_MS);
}

bootstrapRecordDateV6();

window.CompetitionRecordDateV6 = Object.freeze({
    getWeekFromDate: getRecordWeekFromDateV6,
    normalizeAddForm: normalizeAddRecordDateFormV6,
    normalizeEditForm: normalizeEditRecordDateFormV6,
});


/* ===== competition-record-edit-date-v6.js ===== */

/**
 * FILE: competition-record-edit-date-v6.js
 *
 * Mục đích:
 * Đồng bộ UX của form Sửa bản ghi với form Ghi nhận V6.
 *
 * Quy tắc:
 * - GVCN chỉ chọn Ngày ghi nhận.
 * - Tuần được suy ra tự động từ Ngày ghi nhận.
 * - `eWeek` vẫn được giữ phía sau để tương thích với saveEditedCompetition().
 * - Không thay đổi calculation engine hay database schema.
 */

function getEditedRecordWeekFromDateV6(dateValue) {
    const date = new Date(`${dateValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);

    return date.toISOString().slice(0, 10);
}

function syncEditedRecordWeekV6() {
    const dateInput = document.getElementById('eDate');
    const weekInput = document.getElementById('eWeek');

    if (!dateInput || !weekInput) {
        return false;
    }

    const derivedWeek = getEditedRecordWeekFromDateV6(
        dateInput.value,
    );

    if (weekInput.value !== derivedWeek) {
        weekInput.value = derivedWeek;
    }

    let helper = document.getElementById(
        'eWeekDerivedNoticeV6',
    );

    if (!helper) {
        helper = document.createElement('div');
        helper.id = 'eWeekDerivedNoticeV6';
        helper.className = 'mini';
        weekInput.parentElement?.appendChild(helper);
    }

    const helperText = derivedWeek
        ? `Tuần thi đua: ${derivedWeek} (hệ thống tự xác định)`
        : 'Tuần thi đua sẽ được hệ thống tự xác định.';

    // MutationObserver theo dõi modalBody. Không ghi text nếu nội dung đã
    // đúng, tránh tự tạo mutation mới và lặp vô hạn khi mở form Sửa.
    if (helper.textContent !== helperText) {
        helper.textContent = helperText;
    }

    return true;
}

function hideEditedRecordWeekFieldV6() {
    const weekInput = document.getElementById('eWeek');

    if (!weekInput) {
        return false;
    }

    const field = weekInput.closest('.field') || weekInput.parentElement;

    if (field) {
        field.classList.add('hidden');
    }

    return syncEditedRecordWeekV6();
}

function bindEditedRecordDateChangeV6() {
    const dateInput = document.getElementById('eDate');

    if (!dateInput || dateInput.dataset.weekSyncBoundV6 === 'true') {
        return;
    }

    dateInput.addEventListener(
        'change',
        syncEditedRecordWeekV6,
    );
    dateInput.dataset.weekSyncBoundV6 = 'true';
}

function bootstrapEditedRecordDateV6() {
    const modalBody = document.getElementById('modalBody');

    if (!modalBody) {
        return;
    }

    const applyToCurrentModal = () => {
        if (hideEditedRecordWeekFieldV6()) {
            bindEditedRecordDateChangeV6();
        }
    };

    applyToCurrentModal();

    const observer = new MutationObserver(() => {
        applyToCurrentModal();
    });

    observer.observe(modalBody, {
        childList: true,
        subtree: true,
    });
}

bootstrapEditedRecordDateV6();

window.CompetitionRecordEditDateV6 = {
    getWeekFromDate: getEditedRecordWeekFromDateV6,
    sync: syncEditedRecordWeekV6,
};


/* ===== competition-record-form-final-v6.js ===== */

/**
 * FILE: competition-record-form-final-v6.js
 *
 * Boundary cuối của form ghi nhận thi đua V6.
 *
 * Trách nhiệm:
 * - Giữ Ngày là field do GVCN chọn.
 * - Không cho GVCN chọn Tuần.
 * - Tự suy ra tuần từ Ngày.
 * - Bắt buộc chọn rõ học sinh trước khi lưu.
 * - Khóa submit handler V6 để không bị legacy ghi đè.
 */

function removeCompetitionWeekFieldFinalV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

/**
 * openModal có nút Đóng riêng ở modal head. Chỉ loại nút Đóng do form
 * chèn trong modalBody, tránh xóa nút đóng chính của modal.
 */
function removeDuplicateCompetitionFormCloseButtonV6() {
    const modalBody = document.getElementById('modalBody');

    if (!modalBody) {
        return;
    }

    const buttons = Array.from(modalBody.querySelectorAll('button'));

    buttons.forEach((button) => {
        if (button.textContent.trim() === 'Đóng') {
            button.remove();
        }
    });
}

function normalizeStudentSearchTextFinalV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Autocomplete giữ mã học sinh trong hidden input. Nếu một lớp UI legacy
 * làm mất hidden value nhưng ô hiển thị vẫn còn lựa chọn, phục hồi id từ
 * tên + Mã HS để không báo "thiếu học sinh" oan.
 */
function resolveStudentIdFromCompetitionFormV6() {
    const hiddenId = document.getElementById('fStudentV6')?.value || '';

    if (hiddenId) {
        return hiddenId;
    }

    const display =
        document.getElementById('fStudentV6DisplayV6')?.value || '';
    const normalizedDisplay = normalizeStudentSearchTextFinalV6(display);
    const sourceStudents =
        typeof students !== 'undefined' && Array.isArray(students)
            ? students
            : Array.isArray(globalThis.students)
                ? globalThis.students
                : [];

    if (!normalizedDisplay) {
        return '';
    }

    const match = sourceStudents.find((student) => {
        const name = normalizeStudentSearchTextFinalV6(student.full_name);
        const code = normalizeStudentSearchTextFinalV6(student.student_code);
        const combined = code ? `${name} · ${code}` : name;

        return (
            normalizedDisplay === combined ||
            normalizedDisplay === name ||
            normalizedDisplay === code
        );
    });

    return match?.id ? String(match.id) : '';
}

/**
 * Module-loader injects V6 scripts dynamically. Form may become clickable
 * before write boundary is available, so wait rather than failing early.
 */
async function waitForCompetitionWriteBoundaryV6(
    timeoutMs = 5000,
    intervalMs = 50,
) {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
        const writeBoundary =
            globalThis.CompetitionRecordWriteBoundaryV6
                ?.addCompetitionThroughV6Boundary;

        if (typeof writeBoundary === 'function') {
            return writeBoundary;
        }

        await new Promise((resolve) => {
            globalThis.setTimeout(resolve, intervalMs);
        });
    }

    return null;
}

async function submitCompetitionFinalV6() {
    const studentId = resolveStudentIdFromCompetitionFormV6();
    const date = document.getElementById('fDateV6')?.value || '';
    const categoryId = document.getElementById('fGroupV6')?.value || '';
    const criteriaId = document.getElementById('fCriteriaV6')?.value || '';
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const client =
        globalThis.SNCoreSupabase?.client ||
        globalThis.sb ||
        null;

    if (!client) {
        alert('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const { data: selectedCriteria, error } = await client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
    }

    const writeBoundary = await waitForCompetitionWriteBoundaryV6();

    if (typeof writeBoundary !== 'function') {
        alert('Luồng lưu thi đua V6 chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const ok = await writeBoundary(
        studentId,
        points,
        selectedCriteria.name,
        note,
        Number(categoryId),
        week,
        date,
    );

    if (!ok) {
        return false;
    }

    closeModal();
    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

function installFinalCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormFinalV6() {
        await globalThis.openCompetitionFormV6();
        removeCompetitionWeekFieldFinalV6();
        removeDuplicateCompetitionFormCloseButtonV6();
    };

    globalThis.submitCompetitionV6 = submitCompetitionFinalV6;
    globalThis.__finalCompetitionRecordFormV6Installed = true;
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installFinalCompetitionRecordFormV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionRecordFormFinalV6 = Object.freeze({
    removeWeek: removeCompetitionWeekFieldFinalV6,
    removeDuplicateCloseButton: removeDuplicateCompetitionFormCloseButtonV6,
    resolveStudentId: resolveStudentIdFromCompetitionFormV6,
    waitForWriter: waitForCompetitionWriteBoundaryV6,
    submit: submitCompetitionFinalV6,
    install: installFinalCompetitionRecordFormV6,
});


/* ===== competition-record-submit-v6.js ===== */

/**
 * FILE: competition-record-submit-v6.js
 *
 * Mục đích:
 * Thay entry point lưu của form Ghi nhận V6 bằng Record Service V6.
 *
 * Lý do tách file:
 * - Form V6 chịu trách nhiệm hiển thị và lấy dữ liệu từ DOM.
 * - Record Service chịu trách nhiệm INSERT và đồng bộ state.
 * - File này là integration layer nối hai phần trên.
 *
 * Kết quả:
 * - Không gọi addCompetition() legacy cho form V6.
 * - Lưu criteria_id thật thay vì chỉ lưu tên criteria.
 * - Sau khi lưu, các module đọc lại dữ liệu từ Supabase.
 * - Có thông báo rõ ràng khi lưu thành công hoặc khi cần refresh.
 */

const COMPETITION_RECORD_SUBMIT_MAX_WAIT_MS = 15000;
const COMPETITION_RECORD_SUBMIT_POLL_MS = 100;

/**
 * Escape text dùng trong thông báo lỗi lấy từ dữ liệu ngoài.
 *
 * Toast dùng textContent nên không cần escape HTML; helper này chỉ giữ
 * dữ liệu ở dạng chuỗi rõ ràng và tránh các giá trị undefined/null.
 */
function normalizeCompetitionSubmitTextV6(value) {
    return String(value ?? '').trim();
}

/**
 * Lấy Supabase client Core dùng chung.
 */
function getCompetitionSubmitClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * Hiển thị thông báo cho kết quả thao tác lưu.
 */
function showCompetitionSubmitToastV6(
    message,
    type = 'success',
) {
    const service =
        globalThis.CompetitionRecordServiceV6;

    if (
        typeof service?.showCompetitionRecordToastV6 ===
        'function'
    ) {
        service.showCompetitionRecordToastV6(
            message,
            type,
        );
        return;
    }

    const toast = document.createElement('div');
    toast.className =
        type === 'success'
            ? 'notice'
            : 'notice danger';
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '9999',
        maxWidth: '420px',
    });

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Lấy criteria đang được chọn và kiểm tra nó vẫn active.
 */
async function getSelectedCompetitionCriteriaV6(
    criteriaId,
    categoryId,
) {
    const client = getCompetitionSubmitClientV6();

    if (!client) {
        throw new Error(
            'Supabase Core chưa sẵn sàng.',
        );
    }

    const {
        data,
        error,
    } = await client
        .from('competition_criteria')
        .select(
            'id, name, active, category_id',
        )
        .eq('id', criteriaId)
        .single();

    if (error || !data) {
        throw new Error(
            'Không tìm thấy tiêu chí đã chọn.',
        );
    }

    if (
        !data.active ||
        String(data.category_id) !== String(categoryId)
    ) {
        throw new Error(
            'Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.',
        );
    }

    return data;
}

/**
 * Thay implementation của submitCompetitionV6().
 *
 * Hàm đọc DOM hiện có, nhưng không phụ thuộc implementation cũ.
 */
async function submitCompetitionWithServiceV6() {
    const submitButton = document.querySelector(
        '[onclick="submitCompetitionV6()"]',
    );

    const originalLabel =
        submitButton?.textContent || 'Lưu';

    const studentId =
        document.getElementById('fStudentV6')?.value;
    const week =
        document.getElementById('fWeekV6')?.value;
    const date =
        document.getElementById('fDateV6')?.value;
    const categoryId =
        document.getElementById('fGroupV6')?.value;
    const criteriaId =
        document.getElementById('fCriteriaV6')?.value;
    const points = Number(
        document.getElementById('fPointsV6')?.value,
    );
    const note = normalizeCompetitionSubmitTextV6(
        document.getElementById('fNoteV6')?.value,
    );

    const service =
        globalThis.CompetitionRecordServiceV6;

    if (typeof service?.saveCompetitionRecordV6 !== 'function') {
        showCompetitionSubmitToastV6(
            'Module lưu Ghi nhận chưa sẵn sàng. Vui lòng thử lại.',
            'error',
        );
        return;
    }

    if (
        !studentId ||
        !week ||
        !date ||
        !categoryId ||
        !criteriaId
    ) {
        showCompetitionSubmitToastV6(
            'Vui lòng chọn đầy đủ HS, nhóm và tiêu chí.',
            'error',
        );
        return;
    }

    if (!service.isCompetitionRecordScoreValidV6(points)) {
        showCompetitionSubmitToastV6(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
            'error',
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang lưu...';
    }

    try {
        const selectedCriteria =
            await getSelectedCompetitionCriteriaV6(
                criteriaId,
                categoryId,
            );

        const client = getCompetitionSubmitClientV6();
        const {
            data: authData,
            error: authError,
        } = await client.auth.getUser();

        if (authError || !authData?.user?.id) {
            throw new Error(
                'Không xác định được tài khoản GVCN đang đăng nhập.',
            );
        }

        const result =
            await service.saveCompetitionRecordV6({
                studentId,
                criteria: selectedCriteria,
                points,
                note,
                categoryId,
                week,
                date,
                createdBy: authData.user.id,
            });

        if (!result.ok) {
            showCompetitionSubmitToastV6(
                result.message || 'Không thể lưu ghi nhận.',
                'error',
            );
            return;
        }

        window.closeModal?.();

        if (result.refreshOk === false) {
            showCompetitionSubmitToastV6(
                'Đã lưu ghi nhận. Giao diện chưa đồng bộ lại được; hãy bấm Cập nhật từ Supabase.',
                'error',
            );
            return;
        }

        showCompetitionSubmitToastV6(
            'Đã lưu ghi nhận thi đua và cập nhật dữ liệu.',
            'success',
        );
    } catch (error) {
        console.error(
            '[Competition V6] submit service failed:',
            error,
        );

        showCompetitionSubmitToastV6(
            error?.message ||
                'Không thể lưu ghi nhận. Vui lòng thử lại.',
            'error',
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    }
}

/**
 * Chờ form V6 và service V6 cùng sẵn sàng.
 */
function bootstrapCompetitionRecordSubmitV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        const formReady =
            typeof window.submitCompetitionV6 ===
            'function';
        const serviceReady =
            typeof globalThis
                .CompetitionRecordServiceV6
                ?.saveCompetitionRecordV6 ===
            'function';

        if (!formReady || !serviceReady) {
            if (
                Date.now() - startedAt >=
                COMPETITION_RECORD_SUBMIT_MAX_WAIT_MS
            ) {
                window.clearInterval(timer);

                console.warn(
                    '[Competition V6] Record submit bootstrap timed out.',
                );
            }
            return;
        }

        window.clearInterval(timer);

        window.submitCompetitionV6 =
            submitCompetitionWithServiceV6;
    }, COMPETITION_RECORD_SUBMIT_POLL_MS);
}

bootstrapCompetitionRecordSubmitV6();
