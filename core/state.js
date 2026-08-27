/**
 * FILE: core/state.js
 *
 * Mục đích:
 * Sở hữu state runtime dùng chung trong application hiện tại.
 *
 * Giai đoạn A không đổi tên các biến legacy mà app.js đang sử dụng.
 * Chúng được chuyển nguyên vẹn sang Core để giảm rủi ro thay đổi behavior.
 * Những module mới có thể đọc cùng state này; ở giai đoạn refactor sâu hơn,
 * state sẽ được đóng gói thành một object có API rõ ràng hơn.
 */

let currentUser = null;
let currentProfile = null;
let role = 'teacher';
let students = [];
let classSettings = {
    class_name: '6/3',
    school_year: '2026-2027',
    teacher_name: 'Phượng Tiên',
};

let trendChart = null;
let studentChart = null;

let randomHistory = JSON.parse(
    localStorage.getItem('s6r') || '[]',
);

let supabaseCache = {
    students: [],
    competitionRecords: [],
    loadedAt: null,
};
