/**
 * FILE: competition-record-write-boundary-v6.js
 *
 * Mục đích:
 * Boundary chuyển luồng addCompetition() legacy sang Record Service V6.
 *
 * Trách nhiệm:
 * - Giữ nguyên signature mà app.js/form legacy đang sử dụng.
 * - Resolve criteria thật từ Supabase.
 * - Gọi CompetitionRecordServiceV6 để validate + INSERT.
 * - Không tự cập nhật competition_score.
 *
 * Không chịu trách nhiệm:
 * - Render form.
 * - Tính điểm tuần.
 * - Render ranking.
 * - Thay đổi database schema/RLS.
 */

/**
 * Chuẩn hóa signature legacy thành input cho Record Service V6.
 *
 * @param {object} input Dữ liệu từ addCompetition() legacy.
 * @returns {object} Input chuẩn của Record Service.
 */
function buildLegacyCompetitionRecordInputV6(input) {
    const points = Number(input.points);

    if (![-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].includes(points)) {
        throw new Error(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
        );
    }

    if (!input.criteriaId) {
        throw new Error('Thiếu criteria_id.');
    }

    if (!input.studentId || !input.categoryId || !input.week || !input.date) {
        throw new Error('Thiếu dữ liệu ghi nhận thi đua.');
    }

    if (!input.createdBy) {
        throw new Error('Không xác định được người tạo bản ghi.');
    }

    return {
        studentId: input.studentId,
        points,
        criteria: {
            id: input.criteriaId,
            name: String(input.criteriaName || '').trim(),
        },
        note: String(input.note || '').trim(),
        categoryId: Number(input.categoryId),
        week: input.week,
        date: input.date,
        createdBy: input.createdBy,
    };
}

/**
 * Lấy Supabase Core client.
 */
function getCompetitionWriteBoundaryClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * Resolve criteria theo id để bảo đảm history liên kết với criteria thật.
 */
async function resolveCompetitionCriteriaV6(criteriaId) {
    const client = getCompetitionWriteBoundaryClientV6();

    if (!client) {
        throw new Error('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
    }

    const { data, error } = await client
        .from('competition_criteria')
        .select('id, name, active')
        .eq('id', criteriaId)
        .single();

    if (error || !data) {
        throw new Error('Không tìm thấy tiêu chí đã chọn.');
    }

    if (!data.active) {
        throw new Error('Tiêu chí đã được tắt.');
    }

    return data;
}

/**
 * Replacement cho addCompetition() legacy.
 *
 * Signature được giữ nguyên để không phá các caller hiện tại.
 */
async function addCompetitionThroughV6Boundary(
    studentId,
    points,
    criteriaName,
    note,
    categoryId,
    week,
    date,
) {
    const createdBy = globalThis.currentUser?.id;

    try {
        const criteria = await resolveCompetitionCriteriaV6(
            globalThis.__competitionCriteriaIdForLegacyWrite || '',
        );

        const input = buildLegacyCompetitionRecordInputV6({
            studentId,
            points,
            criteriaName: criteria.name || criteriaName,
            note,
            categoryId,
            week,
            date,
            createdBy,
            criteriaId: criteria.id,
        });

        const service = globalThis.CompetitionRecordServiceV6;

        if (!service?.saveCompetitionRecordV6) {
            throw new Error('Competition Record Service V6 chưa sẵn sàng.');
        }

        const result = await service.saveCompetitionRecordV6(input);

        if (!result.ok) {
            alert(result.message || 'Không thể lưu ghi nhận.');
            return false;
        }

        return true;
    } catch (error) {
        console.error(
            '[Competition V6] Legacy write boundary failed:',
            error,
        );

        alert(error.message || 'Không thể lưu ghi nhận.');
        return false;
    }
}

/**
 * Vì signature legacy chỉ truyền tên criteria, module dùng một setter tạm
 * để submitCompetitionV6 có thể truyền criteria id trước khi gọi boundary.
 */
function setLegacyCompetitionCriteriaIdV6(criteriaId) {
    globalThis.__competitionCriteriaIdForLegacyWrite = criteriaId;
}

/**
 * Public API cho Test Center và các module V6.
 */
globalThis.CompetitionRecordWriteBoundaryV6 = Object.freeze({
    buildLegacyCompetitionRecordInputV6,
    resolveCompetitionCriteriaV6,
    addCompetitionThroughV6Boundary,
    setLegacyCompetitionCriteriaIdV6,
});
