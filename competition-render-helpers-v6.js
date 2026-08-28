/**
 * FILE: competition-render-helpers-v6.js
 *
 * Mục đích:
 * Cung cấp các helper hiển thị cho module Thi đua V6 mà runtime legacy
 * `app.js` vẫn đang gọi.
 *
 * Trách nhiệm:
 * - Khôi phục helper `trendText()` bị thiếu sau quá trình tách module.
 * - Không thực hiện query Supabase.
 * - Không thay đổi cách tính điểm.
 *
 * Thiết kế:
 * - Helper nhận dữ liệu đã có sẵn trên object học sinh.
 * - Hàm luôn trả về chuỗi an toàn để renderer không làm hỏng toàn bộ UI.
 */

/**
 * Xác định xu hướng điểm thi đua từ lịch sử điểm của một HS.
 *
 * Quy ước:
 * - Không đủ dữ liệu để so sánh: "—".
 * - Điểm gần nhất tăng: "↗ Tăng".
 * - Điểm gần nhất giảm: "↘ Giảm".
 * - Điểm không đổi: "→ Ổn định".
 *
 * @param {Array<number|string>} scoreHistory Lịch sử điểm theo tuần.
 * @returns {string} Chuỗi hiển thị xu hướng.
 */
function trendText(scoreHistory) {
    if (!Array.isArray(scoreHistory) || scoreHistory.length < 2) {
        return '—';
    }

    const previous = Number(
        scoreHistory[scoreHistory.length - 2],
    );
    const latest = Number(
        scoreHistory[scoreHistory.length - 1],
    );

    if (!Number.isFinite(previous) || !Number.isFinite(latest)) {
        return '—';
    }

    if (latest > previous) {
        return '↗ Tăng';
    }

    if (latest < previous) {
        return '↘ Giảm';
    }

    return '→ Ổn định';
}

/**
 * Public API dành cho runtime legacy và các module V6.
 */
globalThis.CompetitionRenderHelpersV6 = Object.freeze({
    trendText,
});

/*
 * `renderCompetition()` của app.js gọi trực tiếp `trendText()` theo kiểu
 * global function. Giữ alias này trong thời gian migration để không phải
 * viết lại toàn bộ renderer legacy ngay trong C2.3.
 */
globalThis.trendText = trendText;
