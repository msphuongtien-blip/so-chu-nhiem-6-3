/**
 * FILE: competition-issues-v6.js
 *
 * Mục đích: Quản lý và hiển thị issue của Thi đua.
 * Mỗi file đại diện cho một domain nghiệp vụ, không tách theo từng function.
 */

\n/* ===== competition-issues-service-v6.js ===== */\n\n/**
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
\n\n/* ===== competition-issues-renderer-v6.js ===== */\n\n/**
 * FILE: competition-issues-renderer-v6.js
 *
 * Mục đích:
 * Hiển thị notification cho các task sửa điểm đang OPEN.
 *
 * Trách nhiệm:
 * - Hiển thị số task cần GVCN xử lý.
 * - Cho GVCN mở record gốc trong màn hình lịch sử để sửa.
 * - Cho GVCN ghi nhận đã xử lý và chuyển task sang RESOLVED.
 *
 * Không chỉnh sửa competition_records trực tiếp.
 */

function competitionIssueServiceV6() {
    return globalThis.CompetitionIssuesServiceV6 || null;
}

function competitionIssuesEscapeHtmlV6(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        }[character]),
    );
}

function competitionIssuesStudentNameV6(studentId) {
    const list =
        typeof students !== 'undefined' && Array.isArray(students)
            ? students
            : globalThis.students;
    const student = (list || []).find(
        (item) => String(item.id) === String(studentId),
    );

    return student?.full_name || student?.name || String(studentId);
}

function competitionIssuesNoticeElementV6() {
    let notice = document.getElementById('competitionIssuesNoticeV6');

    if (notice) {
        return notice;
    }

    const competitionPage = document.getElementById('competition');
    const firstCard = competitionPage?.querySelector('.grid.two');

    if (!firstCard) {
        return null;
    }

    notice = document.createElement('div');
    notice.id = 'competitionIssuesNoticeV6';
    notice.className = 'notice section';
    firstCard.insertAdjacentElement('afterend', notice);
    return notice;
}

/**
 * Mở task để GVCN quay về record lịch sử và sửa bằng flow hiện có.
 * @param {string} recordId ID competition_record.
 */
function openCompetitionIssueRecordV6(recordId) {
    if (typeof globalThis.editCompetitionRecord === 'function') {
        globalThis.editCompetitionRecord(recordId);
        return;
    }

    alert('Màn hình sửa bản ghi thi đua chưa sẵn sàng.');
}

/**
 * Hiển thị danh sách task OPEN trong modal dùng chung.
 * @param {Array} issues Danh sách issue.
 */
function showCompetitionIssuesV6(issues) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (!modal || !title || !body) {
        return false;
    }

    title.textContent = 'Task sửa điểm thi đua';
    body.innerHTML = issues.length
        ? issues.map((issue) => `
            <div class="notice" style="margin-bottom:10px">
                <b>${competitionIssuesEscapeHtmlV6(competitionIssuesStudentNameV6(issue.student_id))}</b>
                <div class="mini">Tuần ${competitionIssuesEscapeHtmlV6(issue.week)} · OPEN</div>
                <div style="margin:6px 0">${competitionIssuesEscapeHtmlV6(issue.description)}</div>
                <div class="actions">
                    <button class="btn small" type="button"
                        onclick="openCompetitionIssueRecordV6('${competitionIssuesEscapeHtmlV6(issue.competition_record_id || '')}')">
                        Mở bản ghi để sửa
                    </button>
                    <button class="btn small" type="button"
                        onclick="resolveCompetitionIssueV6('${competitionIssuesEscapeHtmlV6(issue.id)}')">
                        Đã sửa — đóng task
                    </button>
                </div>
            </div>
        `).join('')
        : '<div class="notice">Không còn task sửa điểm đang mở.</div>';

    modal.classList.remove('hidden');
    return true;
}

/**
 * Refresh notification task sửa điểm.
 */
async function refreshCompetitionIssuesNotificationV6() {
    const service = competitionIssueServiceV6();
    const notice = competitionIssuesNoticeElementV6();

    if (!service || !notice) {
        return;
    }

    try {
        const issues = await service.listOpenIssues();

        if (!issues.length) {
            notice.classList.add('hidden');
            return;
        }

        notice.innerHTML = `
            <div>
                <b>Có ${issues.length} task cần sửa điểm thi đua.</b>
                <div class="mini">Các task này sẽ còn thông báo cho đến khi GVCN xử lý và đóng task.</div>
            </div>
            <div class="actions">
                <button class="btn primary" type="button" onclick="openCompetitionIssuesV6()">
                    Xem task
                </button>
            </div>
        `;
        notice.classList.remove('hidden');
    } catch (error) {
        console.error('refreshCompetitionIssuesNotificationV6:', error);
    }
}

async function openCompetitionIssuesV6() {
    const service = competitionIssueServiceV6();

    if (!service) {
        alert('Luồng task sửa điểm chưa sẵn sàng.');
        return false;
    }

    try {
        return showCompetitionIssuesV6(await service.listOpenIssues());
    } catch (error) {
        alert(`Không thể tải task sửa điểm: ${error.message}`);
        return false;
    }
}

async function createCompetitionIssueFromSnapshotV6(
    competitionRecordId,
    studentId,
    week,
    snapshotId = '',
) {
    const service = competitionIssueServiceV6();

    if (!service) {
        alert('Luồng task sửa điểm chưa sẵn sàng.');
        return false;
    }

    const description = window.prompt(
        'Nhập nội dung cần kiểm tra/sửa cho bản ghi này:',
        'Kiểm tra lại thông tin điểm cộng/trừ đã nhập.',
    );

    if (!description?.trim()) {
        return false;
    }

    try {
        await service.createIssue({
            competitionRecordId,
            studentId,
            week,
            snapshotId,
            description: description.trim(),
        });
        await refreshCompetitionIssuesNotificationV6();
        alert('Đã tạo task sửa điểm. Hệ thống sẽ nhắc cho đến khi task được xử lý.');
        return true;
    } catch (error) {
        alert(`Không thể tạo task: ${error.message}`);
        return false;
    }
}

async function resolveCompetitionIssueV6(issueId) {
    const service = competitionIssueServiceV6();

    if (!service) {
        return false;
    }

    const resolutionNote = window.prompt(
        'Ghi chú xử lý task (ví dụ: đã sửa ngày/điểm/tiêu chí):',
        'Đã kiểm tra và sửa dữ liệu.',
    );

    if (resolutionNote === null) {
        return false;
    }

    try {
        await service.resolveIssue(issueId, resolutionNote);
        await refreshCompetitionIssuesNotificationV6();
        await openCompetitionIssuesV6();
        return true;
    } catch (error) {
        alert(`Không thể đóng task: ${error.message}`);
        return false;
    }
}

function installCompetitionIssuesNotificationV6() {
    if (globalThis.__competitionIssuesNotificationV6Installed) {
        return false;
    }

    const render = globalThis.renderCompetition;
    if (typeof render !== 'function') {
        return false;
    }

    globalThis.renderCompetition = async function renderCompetitionWithIssuesV6(...args) {
        const result = await render(...args);
        await refreshCompetitionIssuesNotificationV6();
        return result;
    };

    globalThis.__competitionIssuesNotificationV6Installed = true;
    void refreshCompetitionIssuesNotificationV6();
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionIssuesNotificationV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionIssuesRendererV6 = Object.freeze({
    refresh: refreshCompetitionIssuesNotificationV6,
    open: openCompetitionIssuesV6,
    createFromSnapshot: createCompetitionIssueFromSnapshotV6,
    resolve: resolveCompetitionIssueV6,
});
