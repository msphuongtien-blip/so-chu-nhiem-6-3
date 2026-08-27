/**
 * FILE: core/config.js
 *
 * Mục đích:
 * Chứa các hằng số cấu hình dùng chung của website.
 *
 * Trách nhiệm:
 * - Cung cấp version hiện tại của ứng dụng.
 * - Cung cấp URL Supabase hiện tại.
 * - Cung cấp publishable key hiện tại.
 *
 * Không chứa:
 * - DOM logic.
 * - Nghiệp vụ.
 * - Database query.
 * - Authentication flow.
 */

const SNCoreConfig = Object.freeze({
    APP_VERSION: 'V5-SUPABASE-DATABASE',
    SUPABASE_URL: 'https://fdyhnwklzizzbiyqqlxo.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:
        'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
});

globalThis.SNCoreConfig = SNCoreConfig;
