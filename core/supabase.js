/**
 * FILE: core/supabase.js
 *
 * Mục đích:
 * Tạo Supabase client dùng chung cho toàn bộ ứng dụng.
 *
 * Dependency:
 * - core/config.js cung cấp CONFIG.
 * - CDN @supabase/supabase-js phải được load trước file này.
 *
 * Các module nghiệp vụ không được tự tạo client thứ hai nếu không có lý do
 * kiến trúc rõ ràng. Ở các bước refactor sau, client này sẽ thay thế dần
 * những client compatibility đang tồn tại trong các file V6.
 */

const sb = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY,
);
