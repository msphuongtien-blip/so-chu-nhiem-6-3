/**
 * FILE: competition-snapshot-notification-v6.js
 *
 * Mục đích:
 * Thông báo đầu tuần và cho GVCN xem lại lịch sử cộng/trừ của tuần trước.
 *
 * Snapshot là bản chụp read-only của các lần cộng/trừ đã xảy ra trong tuần.
 * Không đọc lại competition_records hiện tại để tránh việc sửa/xóa sau đó
 * làm thay đổi lịch sử mà GVCN cần đối chiếu.
 *
 * Nếu phát hiện sai, GVCN tạo task sửa điểm; snapshot không có nút sửa trực tiếp.
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

function renderSnapshotRowsV6(rows) {
    return rows.map((row) => {
        const points = Number(row.points);
        const sign = points > 0 ? '+' : '';

        return `
            <tr>
                <td>${escapeSnapshotHtmlV6(row.date || '')}</td>
                <td>${escapeSnapshotHtmlV6(snapshotStudentNameV6(row.student_id))}</td>
                <td>${escapeSnapshotHtmlV6(row.group_name || '')}</td>
                <td>${escapeSnapshotHtmlV6(row.criteria || '')}</td>
                <td>${escapeSnapshotHtmlV6(`${sign}${points}`)}</td>
                <td>${escapeSnapshotHtmlV6(row.note || '')}</td>
                <td>
                    <button class="btn small" type="button"
                        onclick="createCompetitionIssueFromSnapshotV6('${escapeSnapshotHtmlV6(row.id)}','${escapeSnapshotHtmlV6(row.student_id)}','${escapeSnapshotHtmlV6(row.week)}','${escapeSnapshotHtmlV6(row.snapshot_id)}')">
                        Tạo task sửa điểm
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function showCompetitionSnapshotV6(rows, week) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (!modal || !title || !body) {
        return false;
    }

    title.textContent = `Lịch sử cộng/trừ — tuần ${week}`;
    body.innerHTML = rows.length
        ? `
            <div class="mini" style="margin-bottom:10px">
                Đây là bản chụp read-only của các lần cộng/trừ trong tuần. Không sửa trực tiếp tại snapshot.
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
                            <th>Đối chiếu</th>
                        </tr>
                    </thead>
                    <tbody>${renderSnapshotRowsV6(rows)}</tbody>
                </table>
            </div>
        `
        : '<div class="notice">Tuần trước không có phát sinh điểm cộng/trừ.</div>';

    modal.classList.remove('hidden');
    return true;
}

async function openPreviousCompetitionSnapshotV6(week) {
    const result = await getPreviousCompetitionSnapshotV6();

    if (result.error) {
        alert(`Không thể tải lịch sử tuần trước: ${result.error.message}`);
        return false;
    }

    if (!result.snapshotRows.length) {
        alert(`Chưa có snapshot cho tuần ${week || result.week}.`);
        return false;
    }

    markSnapshotViewedV6(result.week);
    return showCompetitionSnapshotV6(result.rows, result.week);
}

function hideCompetitionSnapshotNoticeV6() {
    const notice = document.getElementById('competitionSnapshotNoticeV6');

    if (notice) {
        notice.classList.add('hidden');
    }
}

function renderCompetitionSnapshotNoticeV6(week, count) {
    let notice = document.getElementById('competitionSnapshotNoticeV6');

    if (!notice) {
        const competitionPage = document.getElementById('competition');
        const firstCard = competitionPage?.querySelector('.grid.two');

        if (!firstCard) {
            return;
        }

        notice = document.createElement('div');
        notice.id = 'competitionSnapshotNoticeV6';
        notice.className = 'notice section';
        firstCard.insertAdjacentElement('afterend', notice);
    }

    notice.innerHTML = `
        <div>
            <b>Đã lưu lịch sử cộng/trừ tuần trước.</b>
            <div class="mini">${count} lần cộng/trừ · Tuần ${escapeSnapshotHtmlV6(week)}</div>
        </div>
        <div class="actions">
            <button class="btn primary" type="button" onclick="openPreviousCompetitionSnapshotV6('${escapeSnapshotHtmlV6(week)}')">
                Xem snapshot
            </button>
            <button class="btn" type="button" onclick="hideCompetitionSnapshotNoticeV6()">
                Xem sau
            </button>
        </div>
    `;

    notice.classList.remove('hidden');
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

    renderCompetitionSnapshotNoticeV6(result.week, result.rows.length);
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
    open: openPreviousCompetitionSnapshotV6,
    refresh: refreshCompetitionSnapshotNotificationV6,
    markViewed: markSnapshotViewedV6,
});
