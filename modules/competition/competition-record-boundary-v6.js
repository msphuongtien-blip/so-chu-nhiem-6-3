/* ===== competition-record-write-boundary-v6.js ===== */

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
 * - Thay đổi RLS hoặc schema.
 */

const COMPETITION_WRITE_BOUNDARY_SCORES_V6 = Object.freeze([
    -5,
    -4,
    -3,
    -2,
    -1,
    1,
    2,
    3,
    4,
    5,
]);

/**
 * Chuẩn hóa signature legacy thành input cho Record Service V6.
 */
function buildLegacyCompetitionRecordInputV6(input) {
    const points = Number(input.points);

    if (!COMPETITION_WRITE_BOUNDARY_SCORES_V6.includes(points)) {
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

function getCompetitionWriteBoundaryClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * State của app.js/core/state.js dùng lexical binding (`let currentUser`),
 * không tự động xuất hiện trên globalThis. Dùng `typeof` để đọc đúng state
 * khi boundary chạy cùng page; fallback globalThis giúp test/legacy caller
 * vẫn hoạt động khi state được expose công khai.
 */
function getCompetitionCurrentUserIdV6() {
    if (
        typeof currentUser !== 'undefined' &&
        currentUser?.id
    ) {
        return String(currentUser.id);
    }

    return globalThis.currentUser?.id
        ? String(globalThis.currentUser.id)
        : '';
}

/**
 * Resolve criteria theo id hoặc theo tên + category.
 * Tên criteria chỉ là compatibility fallback.
 */
async function resolveCompetitionCriteriaV6(
    criteriaId,
    criteriaName,
    categoryId,
) {
    const client = getCompetitionWriteBoundaryClientV6();

    if (!client) {
        throw new Error('Supabase Core chưa sẵn sàng. Vui lòng thử lại.');
    }

    let query = client
        .from('competition_criteria')
        .select('id, name, active, category_id')
        .eq('active', true);

    if (criteriaId) {
        query = query.eq('id', criteriaId);
    } else {
        query = query
            .eq('name', String(criteriaName || '').trim())
            .eq('category_id', Number(categoryId));
    }

    const { data, error } = await query.single();

    if (error || !data) {
        throw new Error('Không tìm thấy tiêu chí đã chọn.');
    }

    if (
        categoryId &&
        String(data.category_id) !== String(categoryId)
    ) {
        throw new Error('Tiêu chí không thuộc nhóm đang chọn.');
    }

    return data;
}

/**
 * Replacement cho addCompetition() legacy.
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
    const createdBy = getCompetitionCurrentUserIdV6();

    try {
        const criteria = await resolveCompetitionCriteriaV6(
            '',
            criteriaName,
            categoryId,
        );

        const input = buildLegacyCompetitionRecordInputV6({
            studentId,
            points,
            criteriaName: criteria.name,
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

globalThis.CompetitionRecordWriteBoundaryV6 = Object.freeze({
    COMPETITION_WRITE_BOUNDARY_SCORES_V6,
    buildLegacyCompetitionRecordInputV6,
    getCompetitionCurrentUserIdV6,
    resolveCompetitionCriteriaV6,
    addCompetitionThroughV6Boundary,
});

// Active boundary: all callers now resolve to the V6 record service.
globalThis.addCompetition = addCompetitionThroughV6Boundary;


/* ===== competition-legacy-boundary-v6.js ===== */

/**
 * FILE: competition-legacy-boundary-v6.js
 *
 * Mục đích:
 * Chặn các entry point Thi đua legacy còn được app.js khai báo và route
 * chúng sang các module V6 đã được kiểm thử.
 *
 * Trách nhiệm:
 * - Giữ compatibility với inline onclick hiện tại.
 * - Route form/submit/ghi nhận sang V6.
 * - Không chứa business calculation, Supabase CRUD hoặc rendering rules.
 *
 * Không chịu trách nhiệm:
 * - Tính điểm tuần.
 * - Tạo/sửa/xóa competition_records.
 * - Quản lý criteria.
 */

/**
 * Cài boundary sau khi app.js và toàn bộ module V6 đã được load.
 *
 * @returns {boolean} true khi các entry point bắt buộc đã được route.
 */
function installCompetitionLegacyBoundaryV6() {
    const recordForm = globalThis.openCompetitionFormV6;
    const writeBoundary = globalThis.addCompetitionThroughV6Boundary;
    const submitV6 = globalThis.submitCompetitionV6;

    if (typeof recordForm !== 'function') {
        return false;
    }

    if (typeof writeBoundary !== 'function') {
        return false;
    }

    if (typeof submitV6 !== 'function') {
        return false;
    }

    if (
        typeof globalThis.CompetitionRecordServiceV6
            ?.saveCompetitionRecordV6 !== 'function'
    ) {
        return false;
    }

    // Inline HTML vẫn gọi tên legacy nhưng không còn chạy implementation cũ.
    globalThis.openCompetitionForm = recordForm;
    globalThis.addCompetition = writeBoundary;
    globalThis.submitCompetition = submitV6;

    globalThis.__competitionLegacyBoundaryV6Installed = true;

    return true;
}

/**
 * Chờ các module V6 vì module-loader dùng classic scripts có defer.
 */
function bootstrapCompetitionLegacyBoundaryV6() {
    if (installCompetitionLegacyBoundaryV6()) {
        return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
        if (installCompetitionLegacyBoundaryV6()) {
            window.clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt >= 15000) {
            window.clearInterval(timer);
            console.warn(
                '[Competition V6] Legacy boundary bootstrap timed out.',
            );
        }
    }, 100);
}

/**
 * Public API cho Test Center.
 */
globalThis.CompetitionLegacyBoundaryV6 = Object.freeze({
    install: installCompetitionLegacyBoundaryV6,
});

bootstrapCompetitionLegacyBoundaryV6();
