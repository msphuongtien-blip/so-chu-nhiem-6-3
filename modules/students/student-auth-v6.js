/**
 * FILE: student-auth-v6.js
 *
 * Mục đích:
 * Quản lý UI cấp/reset tài khoản học sinh và bắt buộc đổi mật khẩu lần đầu.
 *
 * Trách nhiệm:
 * - Gọi Edge Function server-side để cấp/reset tài khoản.
 * - Hiển thị kết quả theo từng học sinh.
 * - Không lưu hoặc đọc mật khẩu học sinh ở frontend.
 */

(() => {
    'use strict';

    const FUNCTION_NAME = 'provision-student-accounts';

    /**
     * Gọi Edge Function với session hiện tại của GVCN.
     *
     * @param {object} payload student_id nếu reset một HS; bỏ trống để cấp/reset toàn lớp.
     * @returns {Promise<object>} Kết quả server.
     */
    async function provisionStudentAccounts(payload = {}) {
        const { data: { session } } = await sb.auth.getSession();

        if (!session?.access_token) {
            throw new Error('Phiên đăng nhập đã hết hạn.');
        }

        const response = await fetch(
            `${CONFIG.SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            },
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.error) {
            throw new Error(result.error || 'Không thể xử lý tài khoản học sinh.');
        }

        return result;
    }

    /**
     * Hiển thị modal cấp/reset tài khoản.
     *
     * Việc chạy lại cùng một học sinh là an toàn: Edge Function reset tài khoản
     * hiện có thay vì tạo thêm học sinh hoặc hồ sơ mới.
     */
    async function openStudentAccountProvisioning() {
        if (role !== 'teacher') {
            alert('Chỉ GVCN được phép quản lý tài khoản học sinh.');
            return;
        }

        const confirmed = window.confirm(
            'Hệ thống sẽ cấp tài khoản cho học sinh chưa có tài khoản và reset tài khoản đã có.\\n\\n' +
            'Mật khẩu tạm thời = Mã HS. Học sinh sẽ bắt buộc đổi mật khẩu lần đầu đăng nhập.\\n\\n' +
            'Tiếp tục?',
        );

        if (!confirmed) return;

        try {
            const result = await provisionStudentAccounts();
            const failed = result.results?.filter(
                (item) => item.status === 'failed',
            ) || [];

            if (failed.length) {
                alert(
                    `Đã xử lý ${result.ready}/${result.total}. Có ${failed.length} tài khoản lỗi; có thể chạy lại mà không tạo HS mới.`,
                );
            } else {
                alert(`Đã xử lý thành công ${result.ready} tài khoản học sinh.`);
            }
        } catch (error) {
            alert(error.message || String(error));
        }
    }

    /**
     * Reset một tài khoản mà không tạo lại học sinh.
     *
     * @param {string} studentId UUID của học sinh.
     */
    async function resetStudentAccount(studentId) {
        if (!studentId || role !== 'teacher') return;

        const student = students.find(
            (item) => String(item.id) === String(studentId),
        );

        if (!student) {
            alert('Không tìm thấy học sinh.');
            return;
        }

        if (!window.confirm(
            `Reset tài khoản của ${student.full_name} về mật khẩu tạm thời = Mã HS?`,
        )) {
            return;
        }

        try {
            await provisionStudentAccounts({ student_id: studentId });
            alert('Đã reset tài khoản. Mật khẩu tạm thời là Mã HS và sẽ phải đổi khi đăng nhập.');
        } catch (error) {
            alert(error.message || String(error));
        }
    }

    globalThis.StudentAuthV6 = Object.freeze({
        provision: provisionStudentAccounts,
        openProvisioning: openStudentAccountProvisioning,
        reset: resetStudentAccount,
    });
})();