/**
 * FILE: competition-record-form-clean-v6.js
 *
 * Mục đích:
 * Chặn hoàn toàn việc người dùng phải nhập Ngày hoặc Tuần khi ghi nhận
 * thi đua. Hệ thống dùng ngày hiện tại và tự suy ra thứ Hai của tuần.
 *
 * Không thay đổi:
 * - Cấu trúc 6 nhóm tiêu chí.
 * - Danh sách tiêu chí.
 * - Thang điểm -5…-1 và +1…+5.
 * - competition_records schema.
 */

function removeManualCompetitionDatesV6() {
    document.getElementById('fDateV6')?.closest('.field')?.remove();
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

async function submitCompetitionCleanV6() {
    const studentId = document.getElementById('fStudentV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const date = localDate();
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !categoryId || !criteriaId || !date || !week) {
        alert('Không thể xác định đầy đủ dữ liệu ghi nhận. Vui lòng thử lại.');
        return;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return;
    }

    const { data: selectedCriteria, error } = await sb
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return;
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
        return;
    }

    closeModal();
    await renderStudents();
    await renderCompetition();
    await renderDashboard();
}

async function openCompetitionFormCleanV6() {
    await globalThis.openCompetitionFormV6();
    removeManualCompetitionDatesV6();
}

function installCleanCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = openCompetitionFormCleanV6;
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
    removeManualDates: removeManualCompetitionDatesV6,
    submit: submitCompetitionCleanV6,
    install: installCleanCompetitionRecordFormV6,
});
