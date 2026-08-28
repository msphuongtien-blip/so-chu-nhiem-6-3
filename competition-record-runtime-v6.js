/**
 * FILE: competition-record-runtime-v6.js
 *
 * Mục đích:
 * Integration point cho luồng Ghi nhận V6.
 *
 * File này sẽ được nạp từ module competition-record-sync-v6.js hiện đã tồn
 * tại trong runtime. Không chứa UI và không tạo Supabase client mới.
 */

(function bootstrapCompetitionRecordRuntimeV6() {
    const serviceScriptId = 'competition-record-service-v6-script';
    const submitScriptId = 'competition-record-submit-v6-script';

    /**
     * Tạo script loader tối thiểu để giữ các module nghiệp vụ riêng file.
     */
    function loadScriptOnce(scriptId, src) {
        if (document.getElementById(scriptId)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = src;
        script.defer = true;

        document.head.appendChild(script);
    }

    loadScriptOnce(
        serviceScriptId,
        'competition-record-service-v6.js',
    );

    loadScriptOnce(
        submitScriptId,
        'competition-record-submit-v6.js',
    );
})();
