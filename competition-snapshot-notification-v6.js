/**
 * FILE: competition-snapshot-notification-v6.js
 *
 * Mục đích:
 * Thông báo giữa màn hình để GVCN đối chiếu lịch sử cộng/trừ của tuần trước.
 *
 * Snapshot là bản chụp read-only. Nút Sửa chỉ mở luồng sửa chuẩn của
 * competition_records; snapshot không bị ghi đè.
 *
 * GVCN có thể Xem sau hoặc đối chiếu ngay. Xem sau không đánh dấu hoàn tất.
 * Chỉ "Đã đối chiếu – Đóng" mới ngăn prompt lại cho cùng một tuần.
 */

const COMPETITION_SNAPSHOT_TABLE_V6 = 'competition_weekly_snapshots';
const COMPETITION_SNAPSHOT_VIEWED_PREFIX_V6 = 'competition-snapshot-viewed:';

function snapshotLocalDateV6() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function snapshotMondayV6(value) {
    const date = new Date(`${value}T00:00:00Z`);
    const day = date.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;

    date.setUTCDate(date.getUTCDate() + diff);
    return date.toISOString().slice(0, 10);
}

function previousCompetitionSnapshotWeekV6() {
    const currentMonday = snapshotMondayV6(snapshotLocalDateV6());
    const date = new Date(`${currentMonday}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0, 10);
}

function snapshotViewedKeyV6(week) {
    return `${COMPETITION_SNAPSHOT_VIEWED_PREFIX_V6}${week}`;
}

function isSnapshotViewedV6(week) {
    return localStorage.getItem(snapshotViewedKeyV6(week)) === '1';
}

function markSnapshotViewedV6(week) {
    localStorage.setItem(snapshotViewedKeyV6(week), '1');
}

function escapeSnapshotHtmlV6(value) {
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

function snapshotClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

function snapshotRoleIsTeacherV6() {
    if (typeof role !== 'undefined') {
        return role === 'teacher';
    }

    return globalThis.role === 'teacher';
}

function snapshotStudentNameV6(studentId) {
    const list =
        typeof students !== 'undefined' && Array.isArray(students)
            ? students
            : globalThis.students;
    const student = (list || []).find(
        (item) => String(item.id) === String(studentId),
    );

    return student?.full_name || student?.name || String(studentId);
}

async function getPreviousCompetitionSnapshotV6() {
    const client = snapshotClientV6();
    const week = previousCompetitionSnapshotWeekV6();

    if (!client) {
        return {
            week,
            rows: [],
            snapshotRows: [],
            error: new Error('Supabase client chưa sẵn sàng.'),
        };
    }

    const snapshotResult = await client
        .from(COMPETITION_SNAPSHOT_TABLE_V6)
        .select('id, student_id, week, record_history')
        .eq('week', week);

    if (snapshotResult.error) {
        return {
            week,
            rows: [],
            snapshotRows: [],
            error: snapshotResult.error,
        };
    }

    const rows = (snapshotResult.data || []).flatMap((snapshot) =>
        Array.isArray(snapshot.record_history)
            ? snapshot.record_history.map((record) => ({
                ...record,
                student_id: record.student_id || snapshot.student_id,
                week: snapshot.week,
                snapshot_id: snapshot.id,
            }))
            : [],
    );

    return {
        week,
        rows,
        snapshotRows: snapshotResult.data || [],
        error: null,
    };
}

async function getCurrentCompetitionRecordsForSnapshotV6(rows) {
    const client = snapshotClientV6();
    const ids = [...new Set(
        (rows || [])
            .map((row) => String(row.id || '').trim())
            .filter(Boolean),
    )];

    if (!client || !ids.length) {
        return new Map();
    }

    const result = await client
        .from('competition_records')
        .select('id, student_id, date, criteria, points, note, category_id')
        .in('id', ids);

    if (result.error) {
        console.error('[Competition V6] Không tải được trạng thái record snapshot:', result.error);
        return new Map();
    }

    return new Map(
        (result.data || []).map((record) => [String(record.id), record]),
    );
}

function snapshotRecordStatusV6(snapshotRow, currentRecord) {
    if (!currentRecord) {
        return {
            label: 'Đã xóa',
            className: 'snapshot-status-deleted',
        };
    }

    const fields = ['student_id', 'date', 'criteria', 'points', 'note', 'category_id'];
    const changed = fields.some((field) =>
        String(currentRecord[field] ?? '') !== String(snapshotRow[field] ?? ''),
    );

    return changed
        ? { label: 'Đã cập nhật', className: 'snapshot-status-updated' }
        : { label: 'Chưa thay đổi', className: 'snapshot-status-pending' };
}

function openCompetitionSnapshotRecordEditorV6(recordId) {
    const normalizedRecordId = String(recordId || '').trim();

    if (!normalizedRecordId) {
        alert('Snapshot không có mã bản ghi để sửa.');
        return false;
    }

    if (typeof globalThis.editCompetitionRecord !== 'function') {
        alert('Màn hình sửa bản ghi thi đua chưa sẵn sàng.');
        return false;
    }

    globalThis.editCompetitionRecord(normalizedRecordId);
    return true;
}

function renderSnapshotRowsV6(rows, currentRecords = new Map()) {
    return rows.map((row) => {
        const points = Number(row.points);
        const sign = points > 0 ? '+' : '';
        const status = snapshotRecordStatusV6(
            row,
            currentRecords.get(String(row.id || '')),
        );
        const recordId = escapeSnapshotHtmlV6(row.id || '');

        return `
            <tr>
                <td>${escapeSnapshotHtmlV6(row.date || '')}</td>
                <td>${escapeSnapshotHtmlV6(snapshotStudentNameV6(row.student_id))}</td>
                <td>${escapeSnapshotHtmlV6(row.group_name || '')}</td>
                <td>${escapeSnapshotHtmlV6(row.criteria || '')}</td>
                <td>${escapeSnapshotHtmlV6(`${sign}${points}`)}</td>
                <td>${escapeSnapshotHtmlV6(row.note || '')}</td>
                <td>
                    <span class="mini ${status.className}">${status.label}</span>
                </td>
                <td>
                    <button class="btn small primary" type="button"
                        onclick="openCompetitionSnapshotRecordEditorV6('${recordId}')">
                        Sửa
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function hideCompetitionSnapshotNoticeV6() {
    const notice = document.getElementById('competitionSnapshotNoticeV6');

    if (notice) {
        notice.classList.add('hidden');
    }

    const modal = document.getElementById('modal');

    if (modal) {
        modal.classList.add('hidden');
    }
}

function deferCompetitionSnapshotV6() {
    hideCompetitionSnapshotNoticeV6();
}

function confirmCompetitionSnapshotV6(week) {
    markSnapshotViewedV6(week);
    hideCompetitionSnapshotNoticeV6();
}

async function showCompetitionSnapshotWithStatusV6(rows, week) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (!modal || !title || !body) {
        return false;
    }

    const currentRecords = await getCurrentCompetitionRecordsForSnapshotV6(rows);

    title.textContent = `Đối chiếu thi đua tuần ${week}`;
    body.innerHTML = rows.length
        ? `
            <div class="mini" style="margin-bottom:10px">
                Kiểm tra các lần cộng/trừ của tuần trước. Nếu đúng, chọn
                <b>Đã đối chiếu – Đóng</b>. Nếu sai, chọn <b>Sửa</b> để mở luồng sửa chuẩn.
            </div>
            <div class="tablewrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Ngày</th>
                            <th>Học sinh</th>
                            <th>Nhóm</th>
                            <th>Tiêu chí</th>
                            <th>Điểm</th>
                            <th>Ghi chú</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>${renderSnapshotRowsV6(rows, currentRecords)}</tbody>
                </table>
            </div>
            <div class="actions" style="margin-top:14px; justify-content:flex-end">
                <button class="btn" type="button" onclick="deferCompetitionSnapshotV6()">
                    Xem sau
                </button>
                <button class="btn primary" type="button" onclick="confirmCompetitionSnapshotV6('${escapeSnapshotHtmlV6(week)}')">
                    Đã đối chiếu – Đóng
                </button>
            </div>
        `
        : '<div class="notice">Tuần trước không có phát sinh điểm cộng/trừ.</div>';

    modal.classList.remove('hidden');
    return true;
}

async function showCompetitionSnapshotV6(rows, week) {
    return showCompetitionSnapshotWithStatusV6(rows, week);
}

async function openPreviousCompetitionSnapshotV6(week) {
    const result = await getPreviousCompetitionSnapshotV6();

    if (result.error) {
        alert(`Không thể tải lịch sử tuần trước: ${result.error.message}`);
        return false;
    }

    if (!result.snapshotRows.length || !result.rows.length) {
        alert(`Tuần ${week || result.week} không có phát sinh cộng/trừ để đối chiếu.`);
        return false;
    }

    return showCompetitionSnapshotWithStatusV6(result.rows, result.week);
}

async function refreshCompetitionSnapshotNotificationV6() {
    if (!snapshotRoleIsTeacherV6()) {
        return;
    }

    const result = await getPreviousCompetitionSnapshotV6();

    if (
        result.error ||
        !result.snapshotRows.length ||
        !result.rows.length ||
        isSnapshotViewedV6(result.week)
    ) {
        return;
    }

    await showCompetitionSnapshotWithStatusV6(result.rows, result.week);
}

function installCompetitionSnapshotNotificationV6() {
    const render = globalThis.renderCompetition;

    if (
        typeof render !== 'function' ||
        globalThis.__competitionSnapshotNotificationV6Installed
    ) {
        return false;
    }

    globalThis.renderCompetition = async function renderCompetitionWithSnapshotNoticeV6(...args) {
        const result = await render(...args);
        await refreshCompetitionSnapshotNotificationV6();
        return result;
    };

    globalThis.__competitionSnapshotNotificationV6Installed = true;
    void refreshCompetitionSnapshotNotificationV6();
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionSnapshotNotificationV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionSnapshotNotificationV6 = Object.freeze({
    previousWeek: previousCompetitionSnapshotWeekV6,
    load: getPreviousCompetitionSnapshotV6,
    show: showCompetitionSnapshotV6,
    showWithCurrentStatus: showCompetitionSnapshotWithStatusV6,
    open: openPreviousCompetitionSnapshotV6,
    refresh: refreshCompetitionSnapshotNotificationV6,
    markViewed: markSnapshotViewedV6,
    defer: deferCompetitionSnapshotV6,
    confirm: confirmCompetitionSnapshotV6,
    getCurrentRecords: getCurrentCompetitionRecordsForSnapshotV6,
});
