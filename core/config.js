/**
 * FILE: core/config.js
 *
 * Mục đích:
 * Chứa các cấu hình tĩnh dùng chung cho toàn bộ ứng dụng.
 *
 * Quy tắc:
 * - Không chứa dữ liệu học sinh.
 * - Không chứa logic nghiệp vụ.
 * - Không khởi tạo Supabase ở file này.
 */

const APP_VERSION = 'V5-SUPABASE-DATABASE';

const CONFIG = {
    SUPABASE_URL:
        'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    SUPABASE_ANON_KEY:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
};
