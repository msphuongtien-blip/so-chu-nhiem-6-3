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
 * - Chỉ giữ nút đóng của modal; bỏ nút Đóng lặp trong footer form.
 * - Khóa submit handler V6 để không bị legacy ghi đè.
 */

function removeCompetitionWeekFieldFinalV6() {
    document.getElementById('fWeekV6')?.closest('.field')?.remove();
}

/**
 * openModal có nút Đóng riêng ở modal head. Chỉ loại nút Đóng do form
 * chèn trong modalBody, tránh xóa nút đóng chính của modal.
 */
function removeDuplicateCompetitionFormCloseButtonV6() {
    const modalBody = document.getElementById('modalBody');

    if (!modalBody) {
        return;
    }

    const buttons = Array.from(modalBody.querySelectorAll('button'));

    buttons.forEach((button) => {
        if (button.textContent.trim() === 'Đóng') {
            button.remove();
        }
    });
}

function normalizeStudentSearchTextFinalV6(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Autocomplete giữ mã học sinh trong hidden input. Nếu một lớp UI legacy
 * làm mất hidden value nhưng ô hiển thị vẫn còn lựa chọn, phục hồi id từ
 * tên + Mã HS để không báo "thiếu học sinh" oan.
 */
function resolveStudentIdFromCompetitionFormV6() {
    const hiddenId = document.getElementById('fStudentV6')?.value || '';

    if (hiddenId) {
        return hiddenId;
    }

    const display = document.getElementById('fStudentV6DisplayV6')?.value || '';
    const normalizedDisplay = normalizeStudentSearchTextFinalV6(display);
    const sourceStudents =
        typeof students !== 'undefined' && Array.isArray(students)
            ? students
            : Array.isArray(globalThis.students)
                ? globalThis.students
                : [];

    if (!normalizedDisplay) {
        return '';
    }

    const match = sourceStudents.find((student) => {
        const name = normalizeStudentSearchTextFinalV6(student.full_name);
        const code = normalizeStudentSearchTextFinalV6(student.student_code);
        const combined = code
            ? `${name} · ${code}`
            : name;

        return (
            normalizedDisplay === combined ||
            normalizedDisplay === name ||
            normalizedDisplay === code
        );
    });

    return match?.id ? String(match.id) : '';
}

/**
 * Module-loader injecteert V6 scripts dynamisch. Daardoor kan het formulier
 * al klikbaar zijn terwijl de write boundary nog niet klaar is. Wachten is
 * veiliger dan een directe "niet beschikbaar" foutmelding.
 */
async function waitForCompetitionWriteBoundaryV6(
    timeoutMs = 5000,
    intervalMs = 50,
) {
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
        const writeBoundary =
            globalThis.CompetitionRecordWriteBoundaryV6
                ?.addCompetitionThroughV6Boundary;

        if (typeof writeBoundary === 'function') {
            return writeBoundary;
        }

        await new Promise((resolve) => {
            globalThis.setTimeout(resolve, intervalMs);
        });
    }

    return null;
}

async function submitCompetitionFinalV6() {
    const studentId = resolveStudentIdFromCompetitionFormV6();
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

    const client =
        globalThis.SNCoreSupabase?.client ||
        globalThis.sb ||
        null;

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

    const writeBoundary = await waitForCompetitionWriteBoundaryV6();

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

function installFinalCompetitionRecordFormV6() {
    if (typeof globalThis.openCompetitionFormV6 !== 'function') {
        return false;
    }

    globalThis.openCompetitionForm = async function openCompetitionFormFinalV6() {
        await globalThis.openCompetitionFormV6();
        removeCompetitionWeekFieldFinalV6();
        removeDuplicateCompetitionFormCloseButtonV6();
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
    removeDuplicateCloseButton: removeDuplicateCompetitionFormCloseButtonV6,
    resolveStudentId: resolveStudentIdFromCompetitionFormV6,
    waitForWriter: waitForCompetitionWriteBoundaryV6,
    submit: submitCompetitionFinalV6,
    install: installFinalCompetitionRecordFormV6,
});
