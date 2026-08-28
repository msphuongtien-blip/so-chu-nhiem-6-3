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
 * Trách nhiệm:
 * - Khởi tạo đúng một client dùng chung.
 * - Expose client qua SNCoreSupabase cho các module được tách dần.
 *
 * Không chịu trách nhiệm:
 * - Query một bảng nghiệp vụ cụ thể.
 * - Xử lý Authentication flow.
 * - Thay đổi RLS hoặc schema.
 */

/**
 * Khởi tạo Supabase client từ cấu hình Core.
 *
 * @returns {object} Supabase client dùng chung.
 * @throws {Error} Khi Supabase JS hoặc CONFIG chưa được tải.
 */
function createSupabaseClient() {
    if (!globalThis.CONFIG) {
        throw new Error(
            'CONFIG chưa được khởi tạo trước core/supabase.js.',
        );
    }

    if (!globalThis.supabase?.createClient) {
        throw new Error(
            'Supabase JS chưa được tải trước core/supabase.js.',
        );
    }

    return globalThis.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
    );
}

const sb = createSupabaseClient();

/**
 * Namespace Core cho các module mới trong giai đoạn refactor.
 *
 * app.js hiện tại vẫn dùng biến `sb` trực tiếp để bảo toàn behavior.
 * Module mới lấy cùng client ở đây thay vì tạo client Supabase thứ hai.
 */
globalThis.SNCoreSupabase = Object.freeze({
    client: sb,
    createClient: createSupabaseClient,
});
