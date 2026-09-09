/**
 * FILE: core/refresh-workflow-v6.js
 *
 * Mục đích:
 * Entry point duy nhất cho workflow refresh dữ liệu lõi.
 *
 * Trách nhiệm:
 * - Tải lại students và competition_records theo cùng một chu kỳ.
 * - Đảm bảo các module không tự ghép nhiều query refresh khác nhau.
 *
 * Không render UI và không ghi dữ liệu.
 */

/**
 * Refresh các nguồn dữ liệu lõi đang dùng chung.
 *
 * @returns {Promise<{students: Array, competitionRecords: Array}>}
 */
async function refreshCoreDataV6() {
    const [studentRows, competitionRecords] = await Promise.all([
        SNCoreData.students(),
        SNCoreData.competitionRecords(),
    ]);

    return {
        students: studentRows,
        competitionRecords,
    };
}

globalThis.SNCoreRefresh = Object.freeze({
    coreData: refreshCoreDataV6,
});
