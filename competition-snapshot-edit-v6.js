/**
 * FILE: competition-snapshot-edit-v6.js
 *
 * Mục đích:
 * Cho phép GVCN mở đúng luồng Sửa bản ghi hiện có ngay từ snapshot.
 *
 * Snapshot vẫn là audit history bất biến. Nút Sửa chỉ mở form sửa chuẩn;
 * không UPDATE snapshot và không tạo một write path riêng.
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

function renderCompetitionSnapshotRowsWithEditV6(rows) {
    return rows.map((row) => {
        const points = Number(row.points);
        const sign = points > 0 ? '+' : '';
        const recordId = escapeSnapshotHtmlV6(row.id || '');
        const studentId = escapeSnapshotHtmlV6(row.student_id || '');
        const week = escapeSnapshotHtmlV6(row.week || '');
        const snapshotId = escapeSnapshotHtmlV6(row.snapshot_id || '');

        return `
            <tr>
                <td>${escapeSnapshotHtmlV6(row.date || '')}</td>
                <td>${escapeSnapshotHtmlV6(snapshotStudentNameV6(row.student_id))}</td>
                <td>${escapeSnapshotHtmlV6(row.group_name || '')}</td>
                <td>${escapeSnapshotHtmlV6(row.criteria || '')}</td>
                <td>${escapeSnapshotHtmlV6(`${sign}${points}`)}</td>
                <td>${escapeSnapshotHtmlV6(row.note || '')}</td>
                <td>
                    <div class="actions">
                        <button class="btn small primary" type="button"
                            onclick="openCompetitionSnapshotRecordEditorV6('${recordId}')">
                            Sửa
                        </button>
                        <button class="btn small" type="button"
                            onclick="createCompetitionIssueFromSnapshotV6('${recordId}','${studentId}','${week}','${snapshotId}')">
                            Tạo task
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showCompetitionSnapshotWithEditV6(rows, week) {
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
                Snapshot là bản audit của tuần đã chốt. Nút Sửa mở luồng sửa chuẩn
                để cập nhật competition_records; snapshot lịch sử không bị ghi đè.
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
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>${renderCompetitionSnapshotRowsWithEditV6(rows)}</tbody>
                </table>
            </div>
        `
        : '<div class="notice">Tuần trước không có phát sinh điểm cộng/trừ.</div>';

    modal.classList.remove('hidden');
    return true;
}

function installCompetitionSnapshotEditV6() {
    if (
        globalThis.__competitionSnapshotEditV6Installed ||
        typeof globalThis.showCompetitionSnapshotV6 !== 'function'
    ) {
        return false;
    }

    globalThis.showCompetitionSnapshotV6 = showCompetitionSnapshotWithEditV6;
    globalThis.__competitionSnapshotEditV6Installed = true;
    return true;
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
    renderRows: renderCompetitionSnapshotRowsWithEditV6,
    show: showCompetitionSnapshotWithEditV6,
});
