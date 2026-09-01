/**
 * FILE: core/config.js
 *
 * Mục đích:
 * Chứa các cấu hình tĩnh dùng chung cho toàn bộ ứng dụng.
 *
 * Trách nhiệm:
 * - Cung cấp phiên bản ứng dụng.
 * - Cung cấp thông tin kết nối Supabase hiện tại.
 *
 * Không chịu trách nhiệm:
 * - Khởi tạo Supabase client.
 * - Load module JavaScript.
 * - Đọc/ghi DOM hoặc dữ liệu nghiệp vụ.
 *
 * Dependency:
 * - Không phụ thuộc module ứng dụng khác.
 */

const APP_VERSION = 'V5-SUPABASE-DATABASE';

const CONFIG = Object.freeze({
    SUPABASE_URL:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    SUPABASE_ANON_KEY:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
});
