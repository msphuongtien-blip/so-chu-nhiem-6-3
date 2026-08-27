/**
 * FILE: random-picker-v6-compat.js
 *
 * Mục đích:
 * Khôi phục các dependency runtime còn thiếu của chức năng Gọi tên
 * ngẫu nhiên đang được gọi từ app.js.
 *
 * File này chỉ xử lý runtime/UI của random picker. Không ghi dữ liệu
 * Supabase và không thay đổi dữ liệu học sinh.
 */

/**
 * Trạng thái đang chạy của random picker.
 * `randomStudent()` trong app.js tham chiếu identifier này trực tiếp.
 */
var randomRunning = false;

/**
 * AudioContext được khởi tạo sau thao tác click của người dùng.
 * Cách này tương thích tốt hơn với chính sách autoplay của trình duyệt.
 */
var randomAudioContext = null;

/**
 * Kiểm tra tùy chọn âm thanh trên giao diện.
 *
 * @returns {boolean} True khi âm thanh được bật hoặc checkbox không tồn tại.
 */
function isRandomSoundEnabled() {
    const checkbox = document.getElementById('randomSound');

    return checkbox ? checkbox.checked : true;
}

/**
 * Lấy hoặc tạo AudioContext cho random picker.
 *
 * @returns {AudioContext|null} AudioContext hoặc null nếu không hỗ trợ.
 */
function getRandomAudioContext() {
    if (!isRandomSoundEnabled()) {
        return null;
    }

    const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
        return null;
    }

    if (!randomAudioContext) {
        randomAudioContext = new AudioContextConstructor();
    }

    if (randomAudioContext.state === 'suspended') {
        randomAudioContext.resume().catch((error) => {
            console.warn(
                '[Random Picker] Không thể resume AudioContext:',
                error,
            );
        });
    }

    return randomAudioContext;
}

/**
 * Lấy danh sách học sinh theo phạm vi random.
 *
 * @param {string} scope `all` hoặc `team1` ... `team4`.
 * @returns {Array<object>} Pool học sinh hợp lệ.
 */
function getRandomPool(scope) {
    const source = Array.isArray(students) ? students : [];

    if (scope === 'all' || !scope) {
        return source.slice();
    }

    const teamNumber = Number(
        String(scope).replace('team', ''),
    );

    if (!Number.isInteger(teamNumber)) {
        return [];
    }

    return source.filter(
        (student) => Number(student.team) === teamNumber,
    );
}

/**
 * Chọn học sinh ưu tiên người chưa xuất hiện trong lịch sử gần đây.
 *
 * Nếu toàn bộ pool đều đã xuất hiện gần đây, fallback về toàn bộ pool.
 * Không thay đổi dữ liệu học sinh.
 *
 * @param {string} scope Phạm vi random.
 * @returns {object|null} Học sinh được chọn.
 */
function chooseRandomCandidate(scope) {
    const pool = getRandomPool(scope);

    if (!pool.length) {
        return null;
    }

    const history = Array.isArray(randomHistory)
        ? randomHistory
        : [];
    const recent = history.slice(
        -Math.min(8, pool.length),
    );
    const recentSet = new Set(
        recent.map(String),
    );

    const candidates = pool.filter(
        (student) => !recentSet.has(String(student.id)),
    );
    const availablePool = candidates.length
        ? candidates
        : pool;
    const index = Math.floor(
        Math.random() * availablePool.length,
    );

    return availablePool[index] || null;
}

/**
 * Chờ một khoảng thời gian bất đồng bộ.
 *
 * @param {number} milliseconds Số mili-giây cần chờ.
 * @returns {Promise<void>} Promise hoàn thành sau thời gian chờ.
 */
function sleep(milliseconds) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

/**
 * Phát một tone ngắn. Lỗi audio không làm hỏng random picker.
 *
 * @param {number} frequency Tần số âm thanh.
 * @param {number} duration Thời lượng tính bằng giây.
 * @param {OscillatorType} type Kiểu sóng.
 * @param {number} volume Âm lượng từ 0 đến 1.
 */
function playTone(
    frequency,
    duration,
    type = 'sine',
    volume = 0.03,
) {
    const context = getRandomAudioContext();

    if (!context) {
        return;
    }

    try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startTime = context.currentTime;
        const endTime = startTime + duration;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            frequency,
            startTime,
        );

        gain.gain.setValueAtTime(
            volume,
            startTime,
        );
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            endTime,
        );

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startTime);
        oscillator.stop(endTime);
    } catch (error) {
        console.warn(
            '[Random Picker] Không thể phát tone:',
            error,
        );
    }
}

/**
 * Phát tone countdown 3-2-1.
 *
 * @param {number} number Số countdown hiện tại.
 */
function playCountdown(number) {
    const frequencies = {
        3: 660,
        2: 550,
        1: 440,
    };

    playTone(
        frequencies[number] || 440,
        0.09,
        'sine',
        0.035,
    );
}

/**
 * Phát tick nhẹ trong lúc random đang quay.
 */
function playSpinTick() {
    playTone(
        900,
        0.035,
        'square',
        0.012,
    );
}

/**
 * Phát chuỗi âm thanh khi tìm được học sinh.
 */
function playWinnerSound() {
    playTone(523.25, 0.12, 'sine', 0.035);

    window.setTimeout(() => {
        playTone(659.25, 0.12, 'sine', 0.035);
    }, 90);

    window.setTimeout(() => {
        playTone(783.99, 0.18, 'sine', 0.04);
    }, 180);
}

/**
 * Đọc tên học sinh bằng Web Speech API nếu trình duyệt hỗ trợ.
 *
 * @param {string} studentName Tên học sinh cần đọc.
 */
function speakStudent(studentName) {
    if (!isRandomSoundEnabled()) {
        return;
    }

    if (!('speechSynthesis' in window)) {
        return;
    }

    const utterance = new SpeechSynthesisUtterance(
        String(studentName || ''),
    );

    utterance.lang = 'vi-VN';
    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}
