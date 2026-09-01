/**
 * FILE: competition-record-form-clean-v6.js
 *
 * Boundary chuyển tiếp cho form ghi nhận thi đua V6.
 *
 * Nếu Final Boundary V6 đã được cài đặt, module này không được phép ghi đè
 * openCompetitionForm/submitCompetitionV6 nữa.
 */

function removeManualCompetitionWeekV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

async function submitCompetitionCleanV6() {
    if (globalThis.__finalCompetitionRecordFormV6Installed) {
        return globalThis.CompetitionRecordFormFinalV6?.submit?.() || false;
    }

    const studentId = document.getElementById('fStudentV6')?.value;
    const date = document.getElementById('fDateV6')?.value;
    const categoryId = document.getElementById('fGroupV6')?.value;
    const criteriaId = document.getElementById('fCriteriaV6')?.value;
    const points = Number(document.getElementById('fPointsV6')?.value);
    const note = document.getElementById('fNoteV6')?.value.trim() || '';
    const week = globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';

    if (!studentId || !date || !categoryId || !criteriaId || !week) {
        alert('Không thể xác định đầy đủ dữ liệu ghi nhận. Vui lòng thử lại.');
        return false;
    }

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
        return false;
    }

    const client = globalThis.SNCoreSupabase?.client || globalThis.sb;

    if (!client) {
        alert('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const { data: selectedCriteria, error } = await client
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

    const writeBoundary =
        globalThis.CompetitionRecordWriteBoundaryV6
            ?.addCompetitionThroughV6Boundary;

    if (typeof writeBoundary !== 'function') {
        alert('Luồng lưu thi đua V6 chưa sẵn sàng. Vui lòng thử lại.');
        return false;
    }

    const ok = await writeBoundary(
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

function installCleanCompetitionRecordFormV6() {
    if (
        globalThis.__finalCompetitionRecordFormV6Installed ||
        typeof globalThis.openCompetitionFormV6 !== 'function'
    ) {
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
