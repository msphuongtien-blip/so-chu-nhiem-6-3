/**
 * FILE: competition-history-v6.js
 *
 * Mục đích: Tái tính lịch sử và quản lý snapshot.
 * Mỗi file đại diện cho một domain nghiệp vụ, không tách theo từng function.
 */

\n/* ===== competition-recalculation-v6.js ===== */\n\n/**
 * FILE: competition-recalculation-v6.js
 *
 * Mục đích:
 * Tái tính chuỗi điểm thi đua từ tuần được sửa đến tuần cuối có dữ liệu.
 *
 * Nguồn sự thật vẫn là competition_records. Không ghi tổng điểm tuần vào
 * students hoặc snapshot; calculation engine tự suy ra rollover khi render.
 */

function getCompetitionRecalculationEngineV6() {
    return globalThis.CompetitionCalculationV6 || null;
}

function normalizeCompetitionRecalculationWeekV6(value) {
    const engine = getCompetitionRecalculationEngineV6();

    if (!engine?.getMonday) {
        throw new Error('Calculation engine V6 chưa sẵn sàng.');
    }

    const week = engine.getMonday(value);

    if (!week) {
        throw new Error('Tuần cần tính lại không hợp lệ.');
    }

    return week;
}

function getCompetitionRecalculationWeeksV6(
    records,
    studentsList,
    startWeek,
) {
    const engine = getCompetitionRecalculationEngineV6();
    const normalizedStartWeek = normalizeCompetitionRecalculationWeekV6(
        startWeek,
    );
    const weeks = new Set();

    (records || []).forEach((record) => {
        const week = engine.getMonday(
            record.week || record.week_start || record.date,
        );

        if (week && week >= normalizedStartWeek) {
            weeks.add(week);
        }
    });

    const sortedWeeks = [...weeks].sort();

    if (!sortedWeeks.length) {
        return [normalizedStartWeek];
    }

    return sortedWeeks;
}

function calculateCompetitionRecalculationV6(
    records,
    studentsList,
    startWeek,
) {
    const engine = getCompetitionRecalculationEngineV6();
    const weeks = getCompetitionRecalculationWeeksV6(
        records,
        studentsList,
        startWeek,
    );
    const students = Array.isArray(studentsList) ? studentsList : [];
    const calculations = [];

    weeks.forEach((week) => {
        students.forEach((student) => {
            calculations.push({
                week,
                studentId: student.id,
                weeklyScore: engine.calculateWeekScore(
                    records,
                    student.id,
                    week,
                ),
            });
        });
    });

    return {
        startWeek: normalizeCompetitionRecalculationWeekV6(startWeek),
        weeks,
        calculations,
    };
}

async function recalculateCompetitionFromWeekV6(startWeek) {
    const normalizedStartWeek = normalizeCompetitionRecalculationWeekV6(
        startWeek,
    );
    let records = globalThis.supabaseCache?.competitionRecords || [];
    let studentsList =
        Array.isArray(globalThis.students) ? globalThis.students : [];

    if (typeof window.loadCompetitionHistoryFromSupabase === 'function') {
        records = await window.loadCompetitionHistoryFromSupabase();
    }

    if (typeof window.loadStudentsFromSupabase === 'function') {
        studentsList = await window.loadStudentsFromSupabase();
    }

    const result = calculateCompetitionRecalculationV6(
        records || [],
        studentsList || [],
        normalizedStartWeek,
    );

    if (typeof window.renderCompetition === 'function') {
        await window.renderCompetition();
    }

    return {
        ok: true,
        ...result,
    };
}

function getEditedCompetitionWeekBeforeSaveV6() {
    const dateInput = document.getElementById('eDate');

    if (!dateInput?.value) {
        return '';
    }

    const editDateApi = globalThis.CompetitionRecordEditDateV6;

    if (editDateApi?.getWeekFromDate) {
        return editDateApi.getWeekFromDate(dateInput.value);
    }

    return normalizeCompetitionRecalculationWeekV6(dateInput.value);
}

function installCompetitionEditRecalculationV6() {
    const originalSave = globalThis.saveEditedCompetition;

    if (
        globalThis.__competitionEditRecalculationV6Installed ||
        typeof originalSave !== 'function'
    ) {
        return false;
    }

    globalThis.saveEditedCompetition = async function saveEditedCompetitionWithRecalculationV6(...args) {
        const startWeek = getEditedCompetitionWeekBeforeSaveV6();
        const result = await originalSave(...args);

        if (result === false || !startWeek) {
            return result;
        }

        try {
            await recalculateCompetitionFromWeekV6(startWeek);
        } catch (error) {
            console.error(
                '[Competition V6] Historical recalculation failed:',
                error,
            );
            alert(
                'Bản ghi đã được lưu nhưng hệ thống chưa tái tính được toàn bộ chuỗi tuần. Vui lòng cập nhật lại trang.',
            );
        }

        return result;
    };

    globalThis.__competitionEditRecalculationV6Installed = true;
    return true;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionEditRecalculationV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionRecalculationV6 = Object.freeze({
    normalizeWeek: normalizeCompetitionRecalculationWeekV6,
    getWeeks: getCompetitionRecalculationWeeksV6,
    calculate: calculateCompetitionRecalculationV6,
    recalculateFromWeek: recalculateCompetitionFromWeekV6,
    getEditedWeekBeforeSave: getEditedCompetitionWeekBeforeSaveV6,
    installEditHook: installCompetitionEditRecalculationV6,
});
\n\n/* ===== competition-snapshot-notification-v6.js ===== */\n\n/**
 * FILE: competition-snapshot-notification-v6.js
 *
 * Mục đích:
 * Thông báo giữa màn hình để GVCN đối chiếu lịch sử cộng/trừ của tuần trước.
 *
 * Snapshot là bản chụp read-only. Nút Sửa chỉ mở luồng sửa chuẩn của
 * competition_records; snapshot không bị ghi đè.
 *
 * GVCN có thể Xem sau hoặc đối chiếu ngay. Xem sau không đánh dấu hoàn tất.
 * Chỉ "Đã đối chiếu – Đóng" mới ngăn prompt lại cho đúng phiên bản snapshot đã xem.
 *
 * Quy tắc nguồn dữ liệu:
 * - record_history chỉ là lịch sử audit.
 * - Chỉ hiển thị record nếu record gốc vẫn tồn tại trong competition_records
 *   và vẫn thuộc đúng tuần snapshot.
 * - Nếu toàn bộ record gốc của snapshot đã bị xóa/chuyển tuần, không hiện snapshot.
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

function snapshotViewedKeyV6(week, snapshotRows = []) {
    const fingerprint = (snapshotRows || [])
        .map((row) => `${row.id}:${row.updated_at || ''}`)
        .sort()
        .join('|');

    return `${COMPETITION_SNAPSHOT_VIEWED_PREFIX_V6}${week}:${fingerprint}`;
}

function isSnapshotViewedV6(week, snapshotRows = []) {
    return localStorage.getItem(snapshotViewedKeyV6(week, snapshotRows)) === '1';
}

function markSnapshotViewedV6(week, snapshotRows = []) {
    localStorage.setItem(snapshotViewedKeyV6(week, snapshotRows), '1');
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

function snapshotRecordWeekV6(record) {
    const value = record?.week || record?.week_start || record?.date || '';

    if (!value) {
        return '';
    }

    return snapshotMondayV6(String(value));
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
        .select('id, student_id, date, week, week_start, criteria, points, note, category_id')
        .in('id', ids);

    if (result.error) {
        console.error('[Competition V6] Không tải được trạng thái record snapshot:', result.error);
        return new Map();
    }

    return new Map(
        (result.data || []).map((record) => [String(record.id), record]),
    );
}

function filterSnapshotRowsToLiveRecordsV6(rows, week, currentRecords) {
    return (rows || []).filter((snapshotRow) => {
        const currentRecord = currentRecords.get(String(snapshotRow.id || ''));

        if (!currentRecord) {
            return false;
        }

        return snapshotRecordWeekV6(currentRecord) === snapshotRecordWeekV6({ week });
    });
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
        .select('id, student_id, week, record_history, updated_at')
        .eq('week', week);

    if (snapshotResult.error) {
        return {
            week,
            rows: [],
            snapshotRows: [],
            error: snapshotResult.error,
        };
    }

    const snapshotRows = snapshotResult.data || [];
    const rows = snapshotRows.flatMap((snapshot) =>
        Array.isArray(snapshot.record_history)
            ? snapshot.record_history.map((record) => ({
                ...record,
                student_id: record.student_id || snapshot.student_id,
                week: snapshot.week,
                snapshot_id: snapshot.id,
            }))
            : [],
    );

    const currentRecords = await getCurrentCompetitionRecordsForSnapshotV6(rows);
    const liveRows = filterSnapshotRowsToLiveRecordsV6(
        rows,
        week,
        currentRecords,
    );

    return {
        week,
        rows: liveRows,
        snapshotRows,
        currentRecords,
        error: null,
    };
}

function snapshotRecordStatusV6(snapshotRow, currentRecord) {
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
        const currentRecord = currentRecords.get(String(row.id || ''));
        const status = snapshotRecordStatusV6(row, currentRecord);
        const recordId = escapeSnapshotHtmlV6(row.id || '');

        return `
            <tr>
                <td>${escapeSnapshotHtmlV6(row.date || '')}</td>
                <td>${escapeSnapshotHtmlV6(snapshotStudentNameV6(row.student_id))}</td>
                <td>${escapeSnapshotHtmlV6(row.group_name || '')}</td>
                <td>${escapeSnapshotHtmlV6(row.criteria || '')}</td>
                <td>${escapeSnapshotHtmlV6(`${sign}${points}`)}</td>
                <td>${escapeSnapshotHtmlV6(row.note || '')}</td>
                <td><span class="mini ${status.className}">${status.label}</span></td>
                <td><button class="btn small primary" type="button" onclick="openCompetitionSnapshotRecordEditorV6('${recordId}')">Sửa</button></td>
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

function confirmCompetitionSnapshotV6(week, snapshotRows = []) {
    markSnapshotViewedV6(week, snapshotRows);
    hideCompetitionSnapshotNoticeV6();
}

async function showCompetitionSnapshotWithStatusV6(rows, week, snapshotRows = [], currentRecords = null) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    if (!modal || !title || !body) {
        return false;
    }

    const recordsMap = currentRecords || await getCurrentCompetitionRecordsForSnapshotV6(rows);
    const liveRows = filterSnapshotRowsToLiveRecordsV6(rows, week, recordsMap);

    if (!liveRows.length) {
        return false;
    }

    title.textContent = `Đối chiếu thi đua tuần ${week}`;
    body.innerHTML = `
        <div class="mini" style="margin-bottom:10px">Kiểm tra các lần cộng/trừ của tuần trước. Nếu đúng, chọn <b>Đã đối chiếu – Đóng</b>. Nếu sai, chọn <b>Sửa</b> để mở luồng sửa chuẩn.</div>
        <div class="tablewrap"><table class="table"><thead><tr><th>Ngày</th><th>Học sinh</th><th>Nhóm</th><th>Tiêu chí</th><th>Điểm</th><th>Ghi chú</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${renderSnapshotRowsV6(liveRows, recordsMap)}</tbody></table></div>
        <div class="actions" style="margin-top:14px; justify-content:flex-end">
            <button class="btn" type="button" onclick="deferCompetitionSnapshotV6()">Xem sau</button>
            <button class="btn primary" type="button" onclick='confirmCompetitionSnapshotV6(${JSON.stringify(week)}, ${JSON.stringify(snapshotRows)})'>Đã đối chiếu – Đóng</button>
        </div>
    `;

    modal.classList.remove('hidden');
    return true;
}

async function showCompetitionSnapshotV6(rows, week, snapshotRows = []) {
    return showCompetitionSnapshotWithStatusV6(rows, week, snapshotRows);
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

    return showCompetitionSnapshotWithStatusV6(
        result.rows,
        result.week,
        result.snapshotRows,
        result.currentRecords,
    );
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
        isSnapshotViewedV6(result.week, result.snapshotRows)
    ) {
        return;
    }

    await showCompetitionSnapshotWithStatusV6(
        result.rows,
        result.week,
        result.snapshotRows,
        result.currentRecords,
    );
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
\n\n/* ===== competition-snapshot-edit-v6.js ===== */\n\n/**
 * FILE: competition-snapshot-edit-v6.js
 *
 * Compatibility wrapper for the snapshot edit API.
 *
 * Snapshot rendering is owned by competition-snapshot-notification-v6.js.
 * The Sửa action opens the existing competition_records editor flow; this
 * module intentionally does not override the viewer or create correction tasks.
 */

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

function installCompetitionSnapshotEditV6() {
    if (globalThis.__competitionSnapshotEditV6Installed) {
        return true;
    }

    if (typeof globalThis.CompetitionSnapshotNotificationV6?.show === 'function') {
        globalThis.__competitionSnapshotEditV6Installed = true;
        return true;
    }

    return false;
}

if (typeof window !== 'undefined' && window.document) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionSnapshotEditV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
        }
    }, 100);
}

globalThis.CompetitionSnapshotEditV6 = Object.freeze({
    openRecordEditor: openCompetitionSnapshotRecordEditorV6,
    install: installCompetitionSnapshotEditV6,
});
