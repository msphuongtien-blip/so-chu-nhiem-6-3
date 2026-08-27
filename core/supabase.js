/**
 * FILE: core/supabase.js
 *
 * Mục đích:
 * Tạo Supabase client dùng chung cho các module của ứng dụng.
 *
 * Trách nhiệm:
 * - Kiểm tra Supabase JS đã được tải.
 * - Tạo một client từ cấu hình hiện tại.
 * - Cung cấp client dùng chung qua SNCoreSupabase.client.
 *
 * Không chứa query tới bảng nghiệp vụ.
 */

/**
 * Tạo Supabase client từ cấu hình Core hiện tại.
 *
 * @returns {object} Supabase client.
 * @throws {Error} Khi Supabase JS hoặc Core config chưa sẵn sàng.
 */
function createClient() {
    if (!globalThis.SNCoreConfig) {
        throw new Error(
            'SNCoreConfig chưa được khởi tạo trước core/supabase.js.',
        );
    }

    if (!globalThis.supabase?.createClient) {
        throw new Error(
            'Supabase JS chưa được tải trước core/supabase.js.',
        );
    }

    return globalThis.supabase.createClient(
        globalThis.SNCoreConfig.SUPABASE_URL,
        globalThis.SNCoreConfig.SUPABASE_PUBLISHABLE_KEY,
    );
}

const SNCoreSupabase = Object.freeze({
    createClient,
    client: createClient(),
});

globalThis.SNCoreSupabase = SNCoreSupabase;
