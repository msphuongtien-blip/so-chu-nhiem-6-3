/**
 * FILE: modules/seating-chart.js
 *
 * Mục đích:
 * Module quản lý sơ đồ chỗ ngồi và quay tên ngẫu nhiên cho Sổ Chủ Nhiệm.
 *
 * Phạm vi:
 * - Hiển thị 48 vị trí theo 4 tổ.
 * - Kéo-thả/nhấn để đổi chỗ.
 * - Lưu vị trí, ghi chú và trạng thái vào Supabase.
 * - Quay tên theo lớp/tổ/nhóm chọn và lưu lịch sử.
 *
 * Không chịu trách nhiệm:
 * - CRUD hồ sơ học sinh.
 * - Tính điểm thi đua.
 * - Xác thực tài khoản.
 *
 * Ghi chú UX:
 * HTML Drag and Drop được dùng cho chuột; thao tác chọn hai ghế để
 * đổi chỗ được hỗ trợ song song cho màn hình cảm ứng.
 */

(() => {
    'use strict';

    const CLASS_KEY = '6/3';
    const SEAT_COUNT = 48;
    const TEAM_COUNT = 4;
    const SEATS_PER_TEAM = 12;

    let positions = [];
    let selectedSeat = null;
    let randomHistory = [];
    let randomBusy = false;
    let randomScope = 'all';
    let excludePicked = true;

    const state = {
        students: [],
        notes: new Map()
    };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));

    function initials(name) {
        return String(name || '?')
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((part) => part.charAt(0))
            .join('')
            .toUpperCase() || '?';
    }

    function studentById(studentId) {
        return state.students.find((student) => student.id === studentId) || null;
    }

    function teamLabel(team) {
        return `Tổ ${team}`;
    }

    // Module dùng cùng Supabase project và Auth session với ứng dụng chính.
    // Không sửa app.js để tránh kéo module mới vào legacy boundary của file lõi.
    function getApp() {
        if (typeof sb !== 'undefined' && sb?.from) {
            return sb;
        }

        throw new Error('Supabase client chưa sẵn sàng.');
    }

    async function getCurrentUserId() {
        const app = getApp();
        const { data, error } = await app.auth.getUser();

        if (error) throw error;
        return data.user?.id || null;
    }

    function openPage() {
        document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
        const page = document.getElementById('seatingChart');
        page?.classList.add('active');

        document.querySelectorAll('.nav button').forEach((button) => button.classList.remove('active'));
        document.getElementById('seatingChartNav')?.classList.add('active');

        const title = document.getElementById('pageTitle');
        if (title) title.textContent = 'Sơ đồ chỗ ngồi';

        loadAndRender();
    }

    function injectNavigation() {
        if (document.getElementById('seatingChartNav')) return;

        const nav = document.getElementById('teacherNav');
        if (!nav) return;

        const button = document.createElement('button');
        button.id = 'seatingChartNav';
        button.type = 'button';
        button.textContent = '🪑 Sơ đồ chỗ ngồi';
        button.addEventListener('click', openPage);
        nav.appendChild(button);
    }

    function injectPage() {
        if (document.getElementById('seatingChart')) return;

        const main = document.querySelector('.main');
        if (!main) return;

        const page = document.createElement('section');
        page.id = 'seatingChart';
        page.className = 'page';
        page.innerHTML = `
            <div class="sc-shell">
                <div class="sc-toolbar">
                    <div>
                        <div class="sc-kicker">LỚP 6/3 · SƠ ĐỒ LỚP</div>
                        <h2>Sơ đồ chỗ ngồi</h2>
                        <p>Kéo học sinh để đổi chỗ · Chạm hai ghế để đổi chỗ trên màn hình cảm ứng.</p>
                    </div>
                    <div class="sc-actions">
                        <select id="scViewMode" class="btn">
                            <option value="all">Toàn bộ lớp</option>
                            <option value="team1">Chỉ Tổ 1</option>
                            <option value="team2">Chỉ Tổ 2</option>
                            <option value="team3">Chỉ Tổ 3</option>
                            <option value="team4">Chỉ Tổ 4</option>
                        </select>
                        <button id="scShuffle" class="btn" type="button">↝ Xáo trộn chỗ ngồi</button>
                        <button id="scSave" class="btn primary" type="button">Lưu sơ đồ</button>
                    </div>
                </div>

                <div class="sc-classroom">
                    <div class="sc-board">
                        <span>BẢNG</span>
                        <small>GVCN</small>
                    </div>
                    <div id="scTeams" class="sc-teams"></div>
                </div>

                <div class="sc-random-grid">
                    <div class="sc-panel">
                        <div class="sc-panel-head">
                            <div>
                                <div class="sc-kicker">GAME SHOW</div>
                                <h3>Quay tên ngẫu nhiên</h3>
                            </div>
                            <button id="scResetHistory" class="btn small" type="button">Xóa lịch sử</button>
                        </div>

                        <div class="sc-picker-options">
                            <label><input type="radio" name="scRandomScope" value="all" checked> Toàn lớp</label>
                            <label><input type="radio" name="scRandomScope" value="team1"> Tổ 1</label>
                            <label><input type="radio" name="scRandomScope" value="team2"> Tổ 2</label>
                            <label><input type="radio" name="scRandomScope" value="team3"> Tổ 3</label>
                            <label><input type="radio" name="scRandomScope" value="team4"> Tổ 4</label>
                        </div>

                        <label class="sc-toggle">
                            <input id="scExcludePicked" type="checkbox" checked>
                            Không chọn lại học sinh đã quay
                        </label>

                        <div id="scWinner" class="sc-winner">
                            <div class="sc-stage-lights"></div>
                            <div class="sc-winner-label">SẴN SÀNG?</div>
                            <div id="scWinnerName" class="sc-winner-name">Nhấn QUAY TÊN</div>
                            <div id="scWinnerTeam" class="sc-winner-team">—</div>
                        </div>

                        <div class="sc-picker-actions">
                            <button id="scPick" class="sc-pick-button" type="button">◉ QUAY TÊN</button>
                            <button id="scUndoPick" class="btn" type="button">↶ Quay lại</button>
                        </div>
                    </div>

                    <div class="sc-panel">
                        <div class="sc-panel-head">
                            <div>
                                <div class="sc-kicker">LỊCH SỬ</div>
                                <h3>Học sinh đã được chọn</h3>
                            </div>
                            <span id="scHistoryCount" class="sc-history-count">0 lượt</span>
                        </div>
                        <div id="scHistory" class="sc-history"></div>
                    </div>
                </div>

                <div id="scStatus" class="sc-status" role="status"></div>
            </div>
        `;

        main.appendChild(page);
        bindEvents();
    }

    function bindEvents() {
        document.getElementById('scViewMode')?.addEventListener('change', (event) => {
            renderSeats(event.target.value);
        });

        document.getElementById('scShuffle')?.addEventListener('click', shuffleSeats);
        document.getElementById('scSave')?.addEventListener('click', () => savePositions());
        document.getElementById('scPick')?.addEventListener('click', pickRandomStudent);
        document.getElementById('scUndoPick')?.addEventListener('click', undoLastPick);
        document.getElementById('scResetHistory')?.addEventListener('click', resetPickHistory);
        document.getElementById('scExcludePicked')?.addEventListener('change', (event) => {
            excludePicked = event.target.checked;
        });

        document.querySelectorAll('input[name="scRandomScope"]').forEach((input) => {
            input.addEventListener('change', (event) => {
                randomScope = event.target.value;
            });
        });
    }

    async function loadAndRender() {
        injectNavigation();
        injectPage();

        try {
            const app = getApp();

            const [studentResult, positionResult, historyResult] = await Promise.all([
                app.from('students').select('*').order('full_name'),
                app.from('seating_positions')
                    .select('*')
                    .eq('class_key', CLASS_KEY)
                    .order('seat_number'),
                app.from('random_pick_history')
                    .select('id,student_id,scope,scope_team,picked_at')
                    .eq('class_key', CLASS_KEY)
                    .order('picked_at', { ascending: false })
                    .limit(50)
            ]);

            if (studentResult.error) throw studentResult.error;
            if (positionResult.error) throw positionResult.error;
            if (historyResult.error) throw historyResult.error;

            state.students = studentResult.data || [];
            positions = positionResult.data || [];
            randomHistory = historyResult.data || [];

            renderSeats(document.getElementById('scViewMode')?.value || 'all');
            renderHistory();
        } catch (error) {
            console.error('Seating chart load failed:', error);
            setStatus(`Không thể tải sơ đồ: ${error.message || error}`, true);
        }
    }

    function getVisibleTeams(viewMode) {
        if (viewMode === 'all') return [1, 2, 3, 4];
        const team = Number(viewMode.replace('team', ''));
        return Number.isInteger(team) && team >= 1 && team <= 4 ? [team] : [1, 2, 3, 4];
    }

    function seatsForTeam(team) {
        return positions
            .filter((seat) => seat.team === team)
            .sort((a, b) => a.column_number - b.column_number);
    }

    function renderSeats(viewMode = 'all') {
        const root = document.getElementById('scTeams');
        if (!root) return;

        root.innerHTML = getVisibleTeams(viewMode).map((team) => {
            const seats = seatsForTeam(team);

            return `
                <section class="sc-team sc-team-${team}" data-team="${team}">
                    <div class="sc-team-head">
                        <div>
                            <span class="sc-team-dot"></span>
                            <strong>${teamLabel(team)}</strong>
                        </div>
                        <span>${seats.filter((seat) => seat.student_id).length}/12 HS</span>
                    </div>
                    <div class="sc-seat-grid">
                        ${seats.map(renderSeat).join('')}
                    </div>
                </section>
            `;
        }).join('');

        bindSeatInteractions();
    }

    function renderSeat(seat) {
        const student = studentById(seat.student_id);
        const note = seat.note || '';
        const status = seat.status || '';
        // Mỗi tổ có 12 vị trí theo thứ tự 1→12, hiển thị thành 2 cột dọc,
        // mỗi cột 6 bàn. Không cần thay đổi dữ liệu seat hiện có.
        const visualColumn = Math.floor((Number(seat.column_number) - 1) / 6) + 1;
        const visualDesk = ((Number(seat.column_number) - 1) % 6) + 1;

        return `
            <article
                class="sc-seat ${student ? 'occupied' : 'empty'} ${selectedSeat === seat.id ? 'selected' : ''}"
                data-seat-id="${seat.id}"
                draggable="${Boolean(student)}"
                tabindex="0"
                aria-label="${student ? escapeHtml(student.full_name) : 'Ghế trống'}"
            >
                <div class="sc-seat-number">Cột ${visualColumn} · Bàn ${visualDesk}</div>
                ${student ? `
                    <div class="sc-student-card">
                        <div class="sc-avatar">
                            ${student.avatar_url
                                ? `<img src="${escapeHtml(student.avatar_url)}" alt="">`
                                : escapeHtml(initials(student.full_name))}
                        </div>
                        <div class="sc-student-info">
                            <strong>${escapeHtml(student.full_name)}</strong>
                            <span>Mã HS ${escapeHtml(student.student_code || '—')}</span>
                        </div>
                    </div>
                ` : `
                    <div class="sc-empty-seat">
                        <span>+</span>
                        <small>Ghế trống</small>
                    </div>
                `}
                <div class="sc-seat-footer">
                    <span class="sc-status-dot ${status ? 'has-status' : ''}" title="${escapeHtml(status || 'Chưa có trạng thái')}"></span>
                    <button type="button" class="sc-note-button" data-note-seat="${seat.id}" title="Ghi chú">⋯</button>
                </div>
                ${note ? `<div class="sc-note">${escapeHtml(note)}</div>` : ''}
            </article>
        `;
    }

    function bindSeatInteractions() {
        document.querySelectorAll('.sc-seat').forEach((seatElement) => {
            seatElement.addEventListener('dragstart', onDragStart);
            seatElement.addEventListener('dragover', onDragOver);
            seatElement.addEventListener('drop', onDrop);
            seatElement.addEventListener('dragend', onDragEnd);

            seatElement.addEventListener('click', (event) => {
                if (event.target.closest('.sc-note-button')) return;
                const seatId = seatElement.dataset.seatId;
                selectSeat(seatId);
            });

            seatElement.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectSeat(seatElement.dataset.seatId);
                }
            });
        });

        document.querySelectorAll('[data-note-seat]').forEach((button) => {
            button.addEventListener('click', () => editSeatDetails(button.dataset.noteSeat));
        });
    }

    function selectSeat(seatId) {
        if (!selectedSeat) {
            selectedSeat = seatId;
            renderSeats(document.getElementById('scViewMode')?.value || 'all');
            return;
        }

        if (selectedSeat === seatId) {
            selectedSeat = null;
            renderSeats(document.getElementById('scViewMode')?.value || 'all');
            return;
        }

        swapSeats(selectedSeat, seatId);
    }

    function onDragStart(event) {
        const seatId = event.currentTarget.dataset.seatId;
        const seat = positions.find((item) => item.id === seatId);
        if (!seat?.student_id) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', seatId);
        event.currentTarget.classList.add('dragging');
    }

    function onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    }

    async function onDrop(event) {
        event.preventDefault();

        const sourceSeatId = event.dataTransfer.getData('text/plain');
        const targetSeatId = event.currentTarget.dataset.seatId;

        document.querySelectorAll('.sc-seat').forEach((seat) => seat.classList.remove('drag-over'));

        if (!sourceSeatId || sourceSeatId === targetSeatId) return;
        await swapSeats(sourceSeatId, targetSeatId);
    }

    function onDragEnd() {
        document.querySelectorAll('.sc-seat').forEach((seat) => {
            seat.classList.remove('dragging', 'drag-over');
        });
    }

    async function swapSeats(sourceId, targetId) {
        const source = positions.find((seat) => seat.id === sourceId);
        const target = positions.find((seat) => seat.id === targetId);
        if (!source || !target) return;

        const sourceStudent = source.student_id;
        const targetStudent = target.student_id;

        source.student_id = targetStudent || null;
        target.student_id = sourceStudent || null;
        selectedSeat = null;

        renderSeats(document.getElementById('scViewMode')?.value || 'all');
        setStatus('Đã đổi chỗ trên sơ đồ. Nhấn “Lưu sơ đồ” để ghi vào hệ thống.');

        // Lưu ngay để tránh UX kiểu “đổi rồi nhưng quên lưu”.
        await persistAssignments([source, target]);
    }

    async function persistAssignments(changedSeats) {
        try {
            const app = getApp();
            const occupiedStudentIds = changedSeats.map((seat) => seat.student_id).filter(Boolean);

            // Bước 1: giải phóng các ghế bị ảnh hưởng để không vi phạm unique student_id.
            if (occupiedStudentIds.length) {
                const { error: clearError } = await app
                    .from('seating_positions')
                    .update({ student_id: null, updated_at: new Date().toISOString() })
                    .eq('class_key', CLASS_KEY)
                    .in('id', changedSeats.map((seat) => seat.id));

                if (clearError) throw clearError;
            }

            // Bước 2: ghi lại assignment mới.
            for (const seat of changedSeats) {
                const { error } = await app
                    .from('seating_positions')
                    .update({
                        student_id: seat.student_id,
                        note: seat.note || null,
                        status: seat.status || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', seat.id)
                    .eq('class_key', CLASS_KEY);

                if (error) throw error;
            }

            setStatus('Đã lưu vị trí vào Supabase.');
        } catch (error) {
            console.error('Seating position save failed:', error);
            setStatus(`Không lưu được sơ đồ: ${error.message || error}`, true);
            await loadAndRender();
        }
    }

    async function savePositions() {
        await persistAssignments(positions);
    }

    async function shuffleSeats() {
        if (!state.students.length) return;

        const available = positions.slice();
        const shuffledStudents = state.students.slice().sort(() => Math.random() - 0.5);

        // 48 ghế được giữ nguyên; nếu lớp có ít hơn 48 HS thì phần dư để trống.
        positions = available.map((seat, index) => ({
            ...seat,
            student_id: shuffledStudents[index]?.id || null
        }));

        selectedSeat = null;
        renderSeats(document.getElementById('scViewMode')?.value || 'all');
        await savePositions();
        setStatus('Đã xáo trộn ngẫu nhiên và lưu sơ đồ.');
    }

    async function editSeatDetails(seatId) {
        const seat = positions.find((item) => item.id === seatId);
        if (!seat) return;

        const student = studentById(seat.student_id);
        const note = window.prompt(
            student
                ? `Ghi chú cho ${student.full_name}:`
                : 'Ghi chú cho ghế trống:',
            seat.note || ''
        );

        if (note === null) return;

        const status = window.prompt(
            'Ký hiệu/trạng thái tùy chọn (ví dụ: cần hỗ trợ, đổi chỗ, ưu tiên...):',
            seat.status || ''
        );

        if (status === null) return;

        seat.note = note.trim();
        seat.status = status.trim();

        renderSeats(document.getElementById('scViewMode')?.value || 'all');
        await persistAssignments([seat]);
    }

    function candidateStudents() {
        let candidates = state.students.slice();

        if (randomScope.startsWith('team')) {
            const team = Number(randomScope.replace('team', ''));
            candidates = candidates.filter((student) => Number(student.team) === team);
        }

        if (excludePicked) {
            const pickedIds = new Set(
                randomHistory.map((record) => record.student_id)
            );
            candidates = candidates.filter((student) => !pickedIds.has(student.id));
        }

        return candidates;
    }

    async function pickRandomStudent() {
        if (randomBusy) return;

        let candidates = candidateStudents();

        // Nếu bật “không chọn lại” nhưng đã quay hết scope, tự reset vòng chọn
        // thay vì để nút quay rơi vào trạng thái không làm gì.
        if (!candidates.length && excludePicked) {
            const scopeRecords = randomHistory.filter((record) => record.scope === randomScope);
            if (scopeRecords.length) {
                candidates = candidateStudentsWithoutHistory();
                setStatus('Đã quay hết lượt trong phạm vi này. Bắt đầu vòng mới.');
            }
        }

        if (!candidates.length) {
            setStatus('Không có học sinh phù hợp với phạm vi đang chọn.', true);
            return;
        }

        randomBusy = true;

        const winner = candidates[Math.floor(Math.random() * candidates.length)];
        const nameElement = document.getElementById('scWinnerName');
        const winnerBox = document.getElementById('scWinner');

        nameElement?.classList.add('spinning');
        winnerBox?.classList.remove('winner');

        const duration = 1800;
        const startedAt = performance.now();

        const tick = (now) => {
            const elapsed = now - startedAt;
            const progress = Math.min(1, elapsed / duration);
            const speed = Math.max(50, 70 + progress * 220);

            if (progress < 1) {
                const preview = candidates[Math.floor(Math.random() * candidates.length)];
                if (nameElement) nameElement.textContent = preview.full_name;
                window.setTimeout(() => requestAnimationFrame(tick), speed);
                return;
            }

            finishPick(winner);
        };

        requestAnimationFrame(tick);
    }

    function candidateStudentsWithoutHistory() {
        let candidates = state.students.slice();

        if (randomScope.startsWith('team')) {
            const team = Number(randomScope.replace('team', ''));
            candidates = candidates.filter((student) => Number(student.team) === team);
        }

        return candidates;
    }

    async function finishPick(winner) {
        const nameElement = document.getElementById('scWinnerName');
        const teamElement = document.getElementById('scWinnerTeam');
        const winnerBox = document.getElementById('scWinner');

        if (nameElement) {
            nameElement.textContent = winner.full_name;
            nameElement.classList.remove('spinning');
        }

        if (teamElement) teamElement.textContent = teamLabel(winner.team);
        winnerBox?.classList.add('winner');

        playWinnerSound();

        try {
            const app = getApp();
            const currentUserId = await getCurrentUserId();
            const team = randomScope.startsWith('team')
                ? Number(randomScope.replace('team', ''))
                : null;

            const { data, error } = await app
                .from('random_pick_history')
                .insert({
                    class_key: CLASS_KEY,
                    student_id: winner.id,
                    scope: randomScope,
                    scope_team: team,
                    created_by: currentUserId
                })
                .select('id,student_id,scope,scope_team,picked_at')
                .single();

            if (error) throw error;

            randomHistory.unshift(data);
            randomHistory = randomHistory.slice(0, 50);
            renderHistory();
            setStatus(`Đã chọn: ${winner.full_name}`);
        } catch (error) {
            console.error('Random pick save failed:', error);
            setStatus(`Đã quay nhưng chưa lưu được lịch sử: ${error.message || error}`, true);
        } finally {
            randomBusy = false;
        }
    }

    function playWinnerSound() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            const context = new AudioContextClass();
            const oscillator = context.createOscillator();
            const gain = context.createGain();

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(520, context.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.22);
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.3);
        } catch (error) {
            // Âm thanh là enhancement; lỗi audio không được làm hỏng thao tác quay.
            console.debug('Winner sound unavailable:', error);
        }
    }

    function renderHistory() {
        const root = document.getElementById('scHistory');
        const count = document.getElementById('scHistoryCount');
        if (!root) return;

        if (count) count.textContent = `${randomHistory.length} lượt`;

        if (!randomHistory.length) {
            root.innerHTML = '<div class="sc-history-empty">Chưa có lượt quay nào.</div>';
            return;
        }

        root.innerHTML = randomHistory.slice(0, 12).map((record, index) => {
            const student = studentById(record.student_id);
            const time = new Date(record.picked_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="sc-history-row">
                    <span class="sc-history-index">${index + 1}</span>
                    <div>
                        <strong>${escapeHtml(student?.full_name || 'Học sinh đã xóa')}</strong>
                        <small>${record.scope.startsWith('team') ? teamLabel(record.scope_team) : 'Toàn lớp'} · ${time}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function undoLastPick() {
        const last = randomHistory[0];
        if (!last) {
            setStatus('Chưa có lượt quay để quay lại.', true);
            return;
        }

        try {
            const app = getApp();
            const { error } = await app
                .from('random_pick_history')
                .delete()
                .eq('id', last.id);

            if (error) throw error;

            randomHistory.shift();
            renderHistory();
            setStatus('Đã quay lại lượt trước.');
        } catch (error) {
            console.error('Undo random pick failed:', error);
            setStatus(`Không thể quay lại: ${error.message || error}`, true);
        }
    }

    async function resetPickHistory() {
        if (!randomHistory.length) return;
        if (!window.confirm('Xóa toàn bộ lịch sử quay tên của lớp 6/3?')) return;

        try {
            const app = getApp();
            const { error } = await app
                .from('random_pick_history')
                .delete()
                .eq('class_key', CLASS_KEY);

            if (error) throw error;

            randomHistory = [];
            renderHistory();
            setStatus('Đã xóa lịch sử quay tên.');
        } catch (error) {
            console.error('Reset random history failed:', error);
            setStatus(`Không thể xóa lịch sử: ${error.message || error}`, true);
        }
    }

    function setStatus(message, isError = false) {
        const element = document.getElementById('scStatus');
        if (!element) return;

        element.textContent = message;
        element.classList.toggle('error', isError);
    }

    window.seatingChartOpen = openPage;

    function init() {
        injectNavigation();
        injectPage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
