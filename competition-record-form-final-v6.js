/**
 * FILE: competition-record-form-final-v6.js
 *
 * Boundary cuối của form ghi nhận thi đua V6.
 *
 * Trách nhiệm:
 * - Giữ Ngày là field do GVCN chọn.
 * - Không cho GVCN chọn Tuần.
 * - Tự suy ra tuần từ Ngày.
 * - Bắt buộc chọn rõ học sinh trước khi lưu.
 * - Đảm bảo submitCompetitionV6 không bị app legacy ghi đè do thứ tự script.
 */

function removeCompetitionWeekFieldFinalV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

async function submitCompetitionFinalV6() {
    const studentId = document.getElementById('fStudentV6')?.value || '';
    const date = document.getElementById('fDateV6')?.value || '';
    const categoryId = document.getElementById('fGroupV6')?.value || '';
    const criteriaId = document.getElementById('fCriteriaV6')?.value || '';
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Vui lòng chọn đầy đủ học sinh, nhóm và tiêu chí.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const { data: selectedCriteria, error } = await sb
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('id', criteriaId)
        .single();

    if (error || !selectedCriteria) {
        alert('Không tìm thấy tiêu chí đã chọn.');
        return false;
    }

    if (
        !selectedCriteria.active ||
        String(selectedCriteria.category_id) !== String(categoryId)
    ) {
        alert('Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.');
        return false;
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
        return false;
    }

    closeModal();
    await renderStudents();
    await renderCompetition();
    await renderDashboard();
    return true;
}

function installFinalCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormFinalV6() {
        await globalThis.openCompetitionFormV6();
        removeCompetitionWeekFieldFinalV6();
    };

    globalThis.submitCompetitionV6 = submitCompetitionFinalV6;
    globalThis.__finalCompetitionRecordFormV6Installed = true;
    return true;
}

const startedAt = Date.now();
const timer = window.setInterval(() => {
    if (installFinalCompetitionRecordFormV6()) {
        window.clearInterval(timer);
        return;
    }

    if (Date.now() - startedAt >= 15000) {
        window.clearInterval(timer);
    }
}, 100);

globalThis.CompetitionRecordFormFinalV6 = Object.freeze({
    removeWeek: removeCompetitionWeekFieldFinalV6,
    submit: submitCompetitionFinalV6,
    install: installFinalCompetitionRecordFormV6,
});
