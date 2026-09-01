/**
 * FILE: competition-snapshot-notification-v6.js
 *
 * Mục đích:
 * Hiển thị thông báo đầu tuần khi snapshot Thi đua của tuần trước đã có
 * và cho GVCN mở snapshot 44 học sinh.
 *
 * Trách nhiệm:
 * - Truy vấn snapshot tuần trước từ Supabase.
 * - Hiển thị [Xem snapshot] / [Xem sau].
 * - Ghi trạng thái đã xem bằng localStorage.
 * - Render snapshot trong modal dùng chung.
 *
 * Không chịu trách nhiệm:
 * - Tạo snapshot.
 * - Sửa snapshot.
 * - Ghi điểm vào competition_records.
 */

const COMPETITION_SNAPSHOT_TABLE_V6 = 'competition_weekly_snapshots';
const COMPETITION_SNAPSHOT_VIEWED_PREFIX_V6 =
    'competition-snapshot-viewed:';

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

async function getPreviousCompetitionSnapshotV6() {
    const client = snapshotClientV6();

    if (!client) {
        return {
            week: previousCompetitionSnapshotWeekV6(),
            rows: [],
            error: new Error('Supabase client chưa sẵn sàng.'),
        };
    }

    const week = previousCompetitionSnapshotWeekV6();
    const { data, error } = await client
        .from(COMPETITION_SNAPSHOT_TABLE_V6)
        .select(
            'student_id, week, week_end, start_score, total_plus, total_minus, total_change, final_score, group_name, rank',
        )
        .eq('week', week)
        .order('rank', { ascending: true })
        .order('final_score', { ascending: false });

    return {
        week,
        rows: data || [],
        error,
    };
}

function resolveStudentNameV6(studentId) {
    const list =
        (typeof students !== 'undefined' && Array.isArray(students))
            ? students
            : globalThis.students;

    const student = (list || []).find(
        (item) => String(item.id) === String(studentId),
    );

    return student?.full_name || student?.name || String(studentId);
}

function renderSnapshotRowsV6(rows) {
    return rows.map((row, index) => {
        const rank = row.rank ?? index + 1;
        const score = Number(row.final_score ?? 81);

        return `
            <tr>
                <td>${escapeSnapshotHtmlV6(rank)}</td>
                <td>${escapeSnapshotHtmlV6(resolveStudentNameV6(row.student_id))}</td>
                <td>${escapeSnapshotHtmlV6(score)}</td>
                <td>${escapeSnapshotHtmlV6(row.group_name || '')}</td>
                <td>${escapeSnapshotHtmlV6(row.total_plus || 0)}</td>
                <td>${escapeSnapshotHtmlV6(row.total_minus || 0)}</td>
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

    title.textContent = `Snapshot Thi đua — tuần ${week}`;
    body.innerHTML = `
        <div class="mini" style="margin-bottom:10px">
            Kết quả đã lưu · ${rows.length} học sinh
        </div>
        <div class="tablewrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>Hạng</th>
                        <th>Học sinh</th>
                        <th>Điểm</th>
                        <th>Huy hiệu</th>
                        <th>Cộng</th>
                        <th>Trừ</th>
                    </tr>
                </thead>
                <tbody>${renderSnapshotRowsV6(rows)}</tbody>
            </table>
        </div>
    `;

    modal.classList.remove('hidden');
    return true;
}

async function openPreviousCompetitionSnapshotV6(week) {
    const result = await getPreviousCompetitionSnapshotV6();

    if (result.error) {
        alert(`Không thể tải snapshot: ${result.error.message}`);
        return false;
    }

    if (!result.rows.length) {
        alert(`Chưa có snapshot cho tuần ${week || result.week}.`);
        return false;
    }

    markSnapshotViewedV6(result.week);
    return showCompetitionSnapshotV6(result.rows, result.week);
}

function hideCompetitionSnapshotNoticeV6() {
    const notice = document.getElementById(
        'competitionSnapshotNoticeV6',
    );

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
            <b>Snapshot thi đua tuần trước đã được lưu.</b>
            <div class="mini">${count} học sinh · Tuần ${escapeSnapshotHtmlV6(week)}</div>
        </div>
        <div class="actions">
            <button class="btn primary" onclick="openPreviousCompetitionSnapshotV6('${week}')">
                Xem snapshot
            </button>
            <button class="btn" onclick="hideCompetitionSnapshotNoticeV6()">
                Xem sau
            </button>
        </div>
    `;

    notice.classList.remove('hidden');
}

async function refreshCompetitionSnapshotNotificationV6() {
    if (!snapshotRoleIsTeacher()) {
        return;
    }

    const result = await getPreviousCompetitionSnapshotV6();

    if (result.error || !result.rows.length || isSnapshotViewedV6(result.week)) {
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
