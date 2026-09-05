/**
 * FILE: competition-record-submit-v6.js
 *
 * Mục đích:
 * Thay entry point lưu của form Ghi nhận V6 bằng Record Service V6.
 *
 * Lý do tách file:
 * - Form V6 chịu trách nhiệm hiển thị và lấy dữ liệu từ DOM.
 * - Record Service chịu trách nhiệm INSERT và đồng bộ state.
 * - File này là integration layer nối hai phần trên.
 *
 * Kết quả:
 * - Không gọi addCompetition() legacy cho form V6.
 * - Lưu criteria_id thật thay vì chỉ lưu tên criteria.
 * - Sau khi lưu, các module đọc lại dữ liệu từ Supabase.
 * - Có thông báo rõ ràng khi lưu thành công hoặc khi cần refresh.
 */

const COMPETITION_RECORD_SUBMIT_MAX_WAIT_MS = 15000;
const COMPETITION_RECORD_SUBMIT_POLL_MS = 100;

/**
 * Escape text dùng trong thông báo lỗi lấy từ dữ liệu ngoài.
 *
 * Toast dùng textContent nên không cần escape HTML; helper này chỉ giữ
 * dữ liệu ở dạng chuỗi rõ ràng và tránh các giá trị undefined/null.
 */
function normalizeCompetitionSubmitTextV6(value) {
    return String(value ?? '').trim();
}

/**
 * Lấy Supabase client Core dùng chung.
 */
function getCompetitionSubmitClientV6() {
    return globalThis.SNCoreSupabase?.client || null;
}

/**
 * Hiển thị thông báo cho kết quả thao tác lưu.
 */
function showCompetitionSubmitToastV6(
    message,
    type = 'success',
) {
    const service =
        globalThis.CompetitionRecordServiceV6;

    if (
        typeof service?.showCompetitionRecordToastV6 ===
        'function'
    ) {
        service.showCompetitionRecordToastV6(
            message,
            type,
        );
        return;
    }

    const toast = document.createElement('div');
    toast.className =
        type === 'success'
            ? 'notice'
            : 'notice danger';
    toast.textContent = message;

    Object.assign(toast.style, {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: '9999',
        maxWidth: '420px',
    });

    document.body.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Lấy criteria đang được chọn và kiểm tra nó vẫn active.
 */
async function getSelectedCompetitionCriteriaV6(
    criteriaId,
    categoryId,
) {
    const client = getCompetitionSubmitClientV6();

    if (!client) {
        throw new Error(
            'Supabase Core chưa sẵn sàng.',
        );
    }

    const {
        data,
        error,
    } = await client
        .from('competition_criteria')
        .select(
            'id, name, active, category_id',
        )
        .eq('id', criteriaId)
        .single();

    if (error || !data) {
        throw new Error(
            'Không tìm thấy tiêu chí đã chọn.',
        );
    }

    if (
        !data.active ||
        String(data.category_id) !== String(categoryId)
    ) {
        throw new Error(
            'Tiêu chí không thuộc nhóm đang chọn hoặc đã được tắt.',
        );
    }

    return data;
}

/**
 * Thay implementation của submitCompetitionV6().
 *
 * Hàm đọc DOM hiện có, nhưng không phụ thuộc implementation cũ.
 */
async function submitCompetitionWithServiceV6() {
    const submitButton = document.querySelector(
        '[onclick="submitCompetitionV6()"]',
    );

    const originalLabel =
        submitButton?.textContent || 'Lưu';

    const studentId =
        document.getElementById('fStudentV6')?.value;
    const date =
        document.getElementById('fDateV6')?.value || '';
    const week =
        document.getElementById('fWeekV6')?.value ||
        globalThis.CompetitionCalculationV6?.getMonday?.(date) || '';
    const date =
        document.getElementById('fDateV6')?.value || '';
    const categoryId =
        document.getElementById('fGroupV6')?.value;
    const criteriaId =
        document.getElementById('fCriteriaV6')?.value;
    const points = Number(
        document.getElementById('fPointsV6')?.value,
    );
    const note = normalizeCompetitionSubmitTextV6(
        document.getElementById('fNoteV6')?.value,
    );

    const service =
        globalThis.CompetitionRecordServiceV6;

    if (typeof service?.saveCompetitionRecordV6 !== 'function') {
        showCompetitionSubmitToastV6(
            'Module lưu Ghi nhận chưa sẵn sàng. Vui lòng thử lại.',
            'error',
        );
        return;
    }

    if (
        !studentId ||
        !week ||
        !date ||
        !categoryId ||
        !criteriaId
    ) {
        showCompetitionSubmitToastV6(
            'Vui lòng chọn đầy đủ HS, nhóm và tiêu chí.',
            'error',
        );
        return;
    }

    if (!service.isCompetitionRecordScoreValidV6(points)) {
        showCompetitionSubmitToastV6(
            'Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.',
            'error',
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Đang lưu...';
    }

    try {
        const selectedCriteria =
            await getSelectedCompetitionCriteriaV6(
                criteriaId,
                categoryId,
            );

        const client = getCompetitionSubmitClientV6();
        const {
            data: authData,
            error: authError,
        } = await client.auth.getUser();

        if (authError || !authData?.user?.id) {
            throw new Error(
                'Không xác định được tài khoản GVCN đang đăng nhập.',
            );
        }

        const result =
            await service.saveCompetitionRecordV6({
                studentId,
                criteria: selectedCriteria,
                points,
                note,
                categoryId,
                week,
                date,
                createdBy: authData.user.id,
            });

        if (!result.ok) {
            showCompetitionSubmitToastV6(
                result.message || 'Không thể lưu ghi nhận.',
                'error',
            );
            return;
        }

        window.closeModal?.();

        if (result.refreshOk === false) {
            showCompetitionSubmitToastV6(
                'Đã lưu ghi nhận. Giao diện chưa đồng bộ lại được; hãy bấm Cập nhật từ Supabase.',
                'error',
            );
            return;
        }

        showCompetitionSubmitToastV6(
            'Đã lưu ghi nhận thi đua và cập nhật dữ liệu.',
            'success',
        );
    } catch (error) {
        console.error(
            '[Competition V6] submit service failed:',
            error,
        );

        showCompetitionSubmitToastV6(
            error?.message ||
                'Không thể lưu ghi nhận. Vui lòng thử lại.',
            'error',
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    }
}

/**
 * Chờ form V6 và service V6 cùng sẵn sàng.
 */
function bootstrapCompetitionRecordSubmitV6() {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
        const formReady =
            typeof window.submitCompetitionV6 ===
            'function';
        const serviceReady =
            typeof globalThis
                .CompetitionRecordServiceV6
                ?.saveCompetitionRecordV6 ===
            'function';

        if (!formReady || !serviceReady) {
            if (
                Date.now() - startedAt >=
                COMPETITION_RECORD_SUBMIT_MAX_WAIT_MS
            ) {
                window.clearInterval(timer);

                console.warn(
                    '[Competition V6] Record submit bootstrap timed out.',
                );
            }
            return;
        }

        window.clearInterval(timer);

        window.submitCompetitionV6 =
            submitCompetitionWithServiceV6;
    }, COMPETITION_RECORD_SUBMIT_POLL_MS);
}

bootstrapCompetitionRecordSubmitV6();
