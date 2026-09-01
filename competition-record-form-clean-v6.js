/**
 * FILE: competition-record-form-clean-v6.js
 *
 * Mục đích:
 * Giữ Ngày do giáo viên chọn và loại hoàn toàn việc chọn Tuần thủ công.
 * Hệ thống tự tính tuần từ Ngày trước khi lưu record.
 *
 * Trách nhiệm:
 * - Giữ field Ngày cho người dùng.
 * - Xóa field Tuần khỏi UI.
 * - Tính week từ date bằng Calculation Engine V6.
 *
 * Không chịu trách nhiệm:
 * - Quản lý category/criteria.
 * - Tính ranking.
 * - Thay đổi database schema.
 */

/**
 * Loại duy nhất field Tuần khỏi form V6.
 * Field Ngày vẫn được giữ để giáo viên chọn ngày ghi nhận.
 */
function removeManualCompetitionWeekV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

/**
 * Submit record với tuần được hệ thống suy ra từ Ngày.
 */
async function submitCompetitionCleanV6() {
    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
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

/**
 * Replace legacy entry points after the V6 form has loaded.
 */
function installCleanCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormCleanV6() {
        await globalThis.openCompetitionFormV6();
        removeManualCompetitionWeekV6();
    };

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
    removeWeek: removeManualCompetitionWeekV6,
    submit: submitCompetitionCleanV6,
    install: installCleanCompetitionRecordFormV6,
});
