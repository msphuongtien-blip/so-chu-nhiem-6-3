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
