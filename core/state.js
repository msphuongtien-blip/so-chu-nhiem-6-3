/**
 * FILE: core/state.js
 *
 * Mục đích:
 * Định nghĩa shape state dùng chung của website.
 *
 * Đợt A chỉ chuẩn hóa state hiện có; không thêm nghiệp vụ mới.
 */

/**
 * Tạo một state sạch với đúng các giá trị mặc định của ứng dụng hiện tại.
 *
 * @returns {object} Application state mới.
 */
function createInitialState() {
    return {
        currentUser: null,
        currentProfile: null,
        role: 'teacher',
        students: [],
        classSettings: {
            class_name: '6/3',
            school_year: '2026-2027',
            teacher_name: 'Phượng Tiên',
        },
        trendChart: null,
        studentChart: null,
        randomHistory: [],
        supabaseCache: {
            students: [],
            competitionRecords: [],
            loadedAt: null,
        },
    };
}

const SNCoreState = Object.freeze({
    createInitialState,
});

globalThis.SNCoreState = SNCoreState;
