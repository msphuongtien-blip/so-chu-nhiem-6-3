/**
 * FILE: core/data-access-v6.js
 *
 * Mục đích:
 * Cung cấp entry point đọc dữ liệu dùng chung.
 *
 * Trách nhiệm:
 * - Đọc students và competition_records từ Supabase.
 * - Cập nhật đúng runtime cache/state hiện có.
 * - Không tạo dữ liệu và không thay đổi schema.
 */

/**
 * Chuẩn hóa danh sách học sinh theo một quy tắc duy nhất.
 *
 * @param {Array<object>} rows Dữ liệu students.
 * @returns {Array<object>} Danh sách đã sắp xếp.
 */
function normalizeStudentsV6(rows) {
    return (rows || [])
        .slice()
        .sort((a, b) =>
            String(a.full_name || '').localeCompare(
                String(b.full_name || ''),
                'vi',
                { sensitivity: 'base' },
            ),
        );
}

/**
 * Đọc danh sách học sinh hiện có.
 *
 * @returns {Promise<Array<object>>} Students.
 */
async function fetchStudentsV6() {
    const { data, error } = await sb
        .from('students')
        .select('*')
        .order('full_name');

    if (error) {
        throw error;
    }

    const normalized = normalizeStudentsV6(data);
    supabaseCache.students = normalized;
    students = normalized.slice();

    return students;
}

/**
 * Đọc toàn bộ lịch sử thi đua hiện có.
 *
 * @returns {Promise<Array<object>>} Competition records.
 */
async function fetchCompetitionRecordsV6() {
    const { data, error } = await sb
        .from('competition_records')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    supabaseCache.competitionRecords = data || [];
    supabaseCache.loadedAt = new Date();

    return supabaseCache.competitionRecords;
}

/**
 * Public data-access API.
 */
globalThis.SNCoreData = Object.freeze({
    students: fetchStudentsV6,
    competitionRecords: fetchCompetitionRecordsV6,
});
