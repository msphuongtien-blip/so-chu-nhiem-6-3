/**
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
