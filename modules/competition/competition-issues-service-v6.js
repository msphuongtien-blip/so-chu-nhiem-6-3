/**
 * FILE: competition-issues-service-v6.js
 *
 * Mục đích:
 * Quản lý task báo lỗi dữ liệu thi đua mà GVCN tạo khi đối chiếu snapshot.
 *
 * Trách nhiệm:
 * - Tạo issue OPEN gắn với competition_record.
 * - Liệt kê issue OPEN để tạo notification nhắc việc.
 * - Chuyển issue sang RESOLVED sau khi GVCN đã sửa dữ liệu.
 *
 * Không sửa snapshot và không tự sửa competition_records.
 */

const COMPETITION_ISSUES_TABLE_V6 = 'competition_data_issues';

function competitionIssuesClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

function competitionIssueCurrentUserIdV6() {
    if (typeof currentUser !== 'undefined' && currentUser?.id) {
        return currentUser.id;
    }

    return globalThis.currentUser?.id || null;
}

/**
 * Tạo một task OPEN cho một record mà GVCN nghi ngờ nhập sai.
 * @param {Object} payload Thông tin student, week, record và mô tả lỗi.
 * @returns {Promise<Object>} Issue vừa tạo.
 */
async function createIssue(payload) {
    const client = competitionIssuesClientV6();
    const reportedBy = competitionIssueCurrentUserIdV6();

    if (!client) {
        throw new Error('Supabase client chưa sẵn sàng.');
    }
    if (!reportedBy) {
        throw new Error('Không xác định được tài khoản GVCN.');
    }

    const description = String(payload?.description || '').trim();
    if (!description) {
        throw new Error('Task sửa điểm cần có mô tả.');
    }

    const existing = await client
        .from(COMPETITION_ISSUES_TABLE_V6)
        .select('id')
        .eq('competition_record_id', payload.competitionRecordId)
        .eq('status', 'OPEN')
        .limit(1);

    if (existing.error) {
        throw existing.error;
    }
    if (existing.data?.length) {
        return existing.data[0];
    }

    const insertPayload = {
        student_id: payload.studentId,
        week: payload.week,
        snapshot_id: payload.snapshotId || null,
        competition_record_id: payload.competitionRecordId,
        issue_type: 'SCORE_ENTRY_ERROR',
        description,
        status: 'OPEN',
        reported_by: reportedBy,
    };

    const { data, error } = await client
        .from(COMPETITION_ISSUES_TABLE_V6)
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

/**
 * Lấy toàn bộ task OPEN cho GVCN hiện tại.
 * @returns {Promise<Array>} Danh sách task đang chờ xử lý.
 */
async function listOpenIssues() {
    const client = competitionIssuesClientV6();

    if (!client) {
        throw new Error('Supabase client chưa sẵn sàng.');
    }

    const { data, error } = await client
        .from(COMPETITION_ISSUES_TABLE_V6)
        .select(
            'id, student_id, week, competition_record_id, issue_type, description, status, reported_by, created_at, resolution_note',
        )
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

/**
 * Đóng task sau khi GVCN đã sửa record ở màn hình lịch sử.
 * @param {string} issueId ID của issue.
 * @param {string} resolutionNote Ghi chú xử lý.
 * @returns {Promise<Object>} Issue đã RESOLVED.
 */
async function resolveIssue(issueId, resolutionNote) {
    const client = competitionIssuesClientV6();
    const resolvedBy = competitionIssueCurrentUserIdV6();

    if (!client) {
        throw new Error('Supabase client chưa sẵn sàng.');
    }
    if (!resolvedBy) {
        throw new Error('Không xác định được tài khoản GVCN.');
    }

    const { data, error } = await client
        .from(COMPETITION_ISSUES_TABLE_V6)
        .update({
            status: 'RESOLVED',
            resolution_note: String(resolutionNote || '').trim(),
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy,
            updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)
        .eq('status', 'OPEN')
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
}

globalThis.CompetitionIssuesServiceV6 = Object.freeze({
    createIssue,
    listOpenIssues,
    resolveIssue,
});
