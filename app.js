/**
 * FILE: app.js
 *
 * Mục đích:
 * Đây là file logic chính của Sổ Chủ Nhiệm V5. File này điều phối
 * trạng thái phiên đăng nhập, dữ liệu lấy từ Supabase, các thao tác CRUD,
 * tính toán và render giao diện cho GVCN và học sinh.
 *
 * Nguồn dữ liệu:
 * - Supabase: dữ liệu học sinh, điểm danh, thi đua, nề nếp, học tập,
 *   danh dự, phản hồi, tin nhắn và cài đặt lớp.
 * - localStorage: chỉ lưu lịch sử gọi tên phía trình duyệt.
 *
 * Nguyên tắc bảo trì:
 * - Không hard-code danh sách học sinh làm nguồn dữ liệu.
 * - Không tắt RLS để xử lý lỗi frontend.
 * - Với dữ liệu nghiệp vụ, ưu tiên đọc lại từ database thay vì giữ các
 *   giá trị tổng có thể bị lệch.
 *
 * Cách đọc file cho người mới:
 * 1. CONFIG / khởi tạo Supabase.
 * 2. Helper DOM ($, esc).
 * 3. Authentication / session.
 * 4. Load dữ liệu.
 * 5. Render từng module.
 * 6. Form / CRUD.
 */

async function loadStudentsFromSupabase() {
    const {
        data,error
    }
    =await sb.from('students').select('*').order('full_name');
    if(error)throw error;
    supabaseCache.students=data||[];
    students=supabaseCache.students.slice().sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'vi', {
        sensitivity:'base'
    }
    ));
    return students;
}
async function loadCompetitionHistoryFromSupabase() {
    const {
        data,error
    }
    =await sb.from('competition_records').select('*').order('date', {
        ascending:false
    }
    ).order('created_at', {
        ascending:false
    }
    );
    if(error)throw error;
    supabaseCache.competitionRecords=data||[];
    supabaseCache.loadedAt=new Date();
    return supabaseCache.competitionRecords;
}
async function refreshSupabaseData() {
    try {
        await Promise.all([loadStudentsFromSupabase(),loadCompetitionHistoryFromSupabase(),loadSettings()]);
        await renderDashboard();
        await renderCompetition();
        await renderStudents();
        if($('supabaseStatus'))$('supabaseStatus').textContent='Đã đọc dữ liệu trực tiếp từ Supabase lúc '+new Date().toLocaleTimeString('vi-VN');
        if($('supabaseDataStatus'))$('supabaseDataStatus').textContent='Đã đồng bộ từ Supabase lúc '+new Date().toLocaleTimeString('vi-VN')+' · '+students.length+' học sinh · '+supabaseCache.competitionRecords.length+' bản ghi thi đua';
        return true;
    }
    catch(e) {
        console.error('Supabase refresh failed',e);
        alert('Không thể đọc dữ liệu từ Supabase: '+(e.message||e));
        return false;
    }
}
function setRole(newRole) {
    // Lưu vai trò mà người dùng đang chọn.
    role = newRole;

    // Cập nhật trạng thái active của hai tab.
    $('teacherTab').classList.toggle('active', role === 'teacher');
    $('studentTab').classList.toggle('active', role === 'student');

    // Đổi nhãn trường đăng nhập theo vai trò.
    $('loginIdentifierLabel').textContent =
        role === 'teacher' ? 'Tài khoản GVCN' : 'Mã HS';

    // Ô vẫn giữ id cũ để không phải thay đổi nhiều code.
    $('email').type = role === 'teacher' ? 'email' : 'text';
    $('email').placeholder =
        role === 'teacher' ? 'Email GVCN' : 'Ví dụ: 6301';

    // Hiển thị ghi chú rõ ràng về luồng học sinh.
    $('studentLoginNotice')?.classList.toggle('hidden', role !== 'student');

    // Xóa thông báo cũ.
    $('loginMsg').textContent = '';
}


async function startSession(user){
    if(!user)return false;

    currentUser=user;
    const p=await sb.from('profiles').select('*').eq('id',user.id).single();

    if(p.error){
        await sb.auth.signOut();
        $('loginMsg').textContent='Tài khoản chưa có hồ sơ trong profiles.';
        return false;
    }

    currentProfile=p.data;
    role=currentProfile.role;
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    setupUI();

    if(role==='student' && user.user_metadata?.force_password_change){
        openForcedStudentPasswordChange();
        return true;
    }

    await loadAll();
    return true;
}

function openForcedStudentPasswordChange(){
    openModal(
        'Đổi mật khẩu lần đầu',
        '<div class="notice">Mật khẩu tạm thời phải được đổi trước khi sử dụng hệ thống.</div>'+
        '<div class="field"><label>Mật khẩu mới</label><input id="forcedNewPass" type="password" autocomplete="new-password"></div>'+
        '<div class="field"><label>Nhập lại mật khẩu mới</label><input id="forcedNewPass2" type="password" autocomplete="new-password"></div>'+
        '<div id="forcedPassMsg" class="mini" role="alert" aria-live="polite"></div>'+
        '<button class="btn primary" onclick="submitForcedStudentPassword()">Lưu mật khẩu mới</button>',
    );
}

async function submitForcedStudentPassword(){
    const password=$('forcedNewPass').value;
    const confirmation=$('forcedNewPass2').value;
    const msg=$('forcedPassMsg');

    if(password.length<8){
        msg.textContent='Mật khẩu mới phải có ít nhất 8 ký tự.';
        return;
    }

    if(password===String(currentUser.user_metadata?.student_code||'')){
        msg.textContent='Mật khẩu mới không được trùng Mã HS.';
        return;
    }

    if(password!==confirmation){
        msg.textContent='Hai mật khẩu chưa trùng nhau.';
        return;
    }

    const {error}=await sb.auth.updateUser({
        password,
        data:{
            ...currentUser.user_metadata,
            force_password_change:false,
        },
    });

    if(error){
        msg.textContent=error.message;
        return;
    }

    currentUser={
        ...currentUser,
        user_metadata:{
            ...currentUser.user_metadata,
            force_password_change:false,
        },
    };

    closeModal();
    await loadAll();
}

async function login() {
    const msg = $('loginMsg');
    msg.textContent = '';

    const loginIdentifier = $('email').value.trim();
    const authEmail = role === 'student'
        ? loginIdentifier.toLowerCase() + '@student.so-chu-nhiem.local'
        : loginIdentifier;

    const { data, error } = await sb.auth.signInWithPassword({
        email: authEmail,
        password: $('password').value
    });

    if (error) {
        msg.textContent = error.message;
        return;
    }

    await startSession(data.user);
}
sb.auth.getSession().then(async ({data})=>{if(data.session)await startSession(data.session.user)});
function setupUI() {
    // Chỉ hiển thị menu đúng với vai trò tài khoản hiện tại.
    $('teacherNav').classList.toggle('hidden', role !== 'teacher');
    $('studentNav').classList.toggle('hidden', role !== 'student');

    // Với GVCN, có thể dùng email của tài khoản Auth làm fallback.
    // Với học sinh, chỉ sử dụng tên hồ sơ và không hiển thị email.
    const displayName =
        currentProfile.full_name ||
        (role === 'teacher' ? currentUser.email : 'Học sinh');

    // Cập nhật khu vực hiển thị người dùng.
    $('who').innerHTML =
        '<div class="avatar">' +
        esc(displayName.slice(0, 1).toUpperCase()) +
        '</div><div><b>' +
        esc(displayName) +
        '</b><div class="mini">' +
        (role === 'teacher' ? 'GVCN' : 'Học sinh') +
        '</div></div>';

    // Cập nhật tên và vai trò ở cuối sidebar.
    $('sideWho').textContent = displayName;
    $('sideRole').textContent =
        role === 'teacher' ? 'Giáo viên chủ nhiệm' : 'Học sinh';

    // Hiển thị hướng dẫn đăng nhập học sinh theo kế hoạch Phase 3.
    $('studentLoginNotice')?.classList.toggle('hidden', role !== 'student');

    // Mở page mặc định theo vai trò.
    showPage(role === 'teacher' ? 'dashboard' : 'sHome');
}


function showPage(id,btn){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id)?.classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');const t={dashboard:'Tổng quan',students:'Học sinh & hồ sơ',random:'Gọi tên ngẫu nhiên',attendance:'Điểm danh',competition:'Thi đua – xếp hạng',honors:'Bảng danh dự',teams:'Theo dõi tổ',reports:'Báo cáo',alerts:'Cảnh báo',feedbackTeacher:'Phản hồi học sinh',settings:'Cài đặt',sHome:'Trang chủ',sProfile:'Hồ sơ của em',sProgress:'Hành trình tiến bộ',sHonors:'Thành tích của em',sGoals:'Mục tiêu tuần',sFeedback:'Phản hồi'};$('pageTitle').textContent=t[id]||id;if(role==='teacher'&&id==='reports')renderReports();if(role==='teacher'&&id==='alerts')renderAlerts();}
async function loadSettings(){const {data}=await sb.from('class_settings').select('*').limit(1).maybeSingle();if(data)classSettings=data;$('classNameView').textContent=classSettings.class_name;$('teacherNameView').textContent=classSettings.teacher_name;$('yearTop').textContent=classSettings.school_year;$('loginYear').textContent=classSettings.school_year;$('classNameInput').value=classSettings.class_name;$('schoolYearInput').value=classSettings.school_year;$('teacherNameInput').value=classSettings.teacher_name}
async function loadAll(){
    await loadSettings();

    if(role==='teacher'){
        await Promise.all([
            loadStudentsFromSupabase(),
            loadCompetitionHistoryFromSupabase(),
        ]);

        // The Competition renderer must not run until every V6 module has
        // finished loading. This removes browser-dependent bootstrap races.
        if(globalThis.ApplicationModuleLoaderV6?.ready){
            await globalThis.ApplicationModuleLoaderV6.ready;
        }

        await renderStudents();
        await renderDashboard();
        await renderAttendance();
        await renderCompetition();
        await renderHonors();
        await renderTeams();
        await renderAlerts();
        // Teacher feedback navigation has been removed.
    }else{
        await renderStudentAll();
    }
}
async function renderStudents(){if(!supabaseCache.students.length) await loadStudentsFromSupabase(); const data=supabaseCache.students;const vnNameKey=n=>{const parts=String(n||'').trim().split(/\s+/);return parts.length?parts[parts.length-1]:''};students=(data||[]).sort((a,b)=>{const ka=vnNameKey(a.full_name),kb=vnNameKey(b.full_name);return ka.localeCompare(kb,'vi',{sensitivity:'base'})||String(a.full_name||'').localeCompare(String(b.full_name||''),'vi',{sensitivity:'base'});});const q=($('studentSearch')?.value||'').toLowerCase();const rows=students.filter(s=>(s.full_name+' '+(s.student_code||'')+' '+(s.team||'')).toLowerCase().includes(q));$('studentBody').innerHTML=rows.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.full_name)+'</b></td><td>'+esc(s.student_code)+'</td><td>'+esc(s.gender||'')+'</td><td>Tổ '+(s.team||'')+'</td><td>'+Number(s.competition_score||0).toFixed(1)+'</td><td>'+groupBadge(s.competition_score)+'</td><td><button class="btn small" onclick=editStudent("'+s.id+'")>Sửa</button></td></tr>').join('')||'<tr><td colspan="8" class="mini">Chưa có học sinh.</td></tr>'}
function group(score){score=Number(score||0);return score>=91?'💎 Kim cương':score>=81?'🥇 Vàng':score>=66?'🥈 Bạc':score>=50?'🥉 Đồng':'🔩 Sắt'}function groupBadge(score){const s=group(score);const c=s.includes('Kim')?'diamond':s.includes('Vàng')?'gold':s.includes('Bạc')?'silver':s.includes('Đồng')?'bronze':'iron';return '<span class="badge '+c+'">'+s+'</span>'}
async function renderDashboard(){const total=students.length;$('mTotal').textContent=total;const avg=total?students.reduce((a,s)=>a+Number(s.competition_score||0),0)/total:0;$('mAvg').textContent=avg.toFixed(1);const care=students.filter(s=>['Cần hỗ trợ','Cần can thiệp'].includes(s.support_level)).length;$('mSupport').textContent=care;const date=localDate();const {data:att}=await sb.from('attendance').select('status').eq('attendance_date',date);const present=(att||[]).filter(x=>x.status==='present').length;$('mPresent').textContent=present;$('mAttendanceSub').textContent=(att||[]).length+' lượt đã ghi';const top=[...students].sort((a,b)=>Number(b.competition_score||0)-Number(a.competition_score||0)).slice(0,5);$('topStudents').innerHTML=top.map((s,i)=>'<div class="notice"><b>'+(i+1)+'. '+esc(s.full_name)+'</b> <span class="badge '+(Number(s.competition_score||0)>=81?'good':'watch')+'">'+Number(s.competition_score||0).toFixed(1)+'</span><div class="mini">'+group(s.competition_score)+'</div></div>').join('')||'<div class="mini">Chưa có dữ liệu.</div>';$('careStudents').innerHTML=students.filter(s=>s.support_level).slice(0,6).map(s=>'<div class="notice '+(s.support_level==='Cần can thiệp'?'danger':'warn')+'"><b>'+esc(s.full_name)+'</b><div class="mini">'+esc(s.support_level)+' · '+esc(s.progress_note||'')+'</div></div>').join('')||'<div class="mini">Chưa có học sinh cần quan tâm.</div>';const ranks=[...students].sort((a,b)=>Number(b.competition_score||0)-Number(a.competition_score||0));$('classRankView').textContent=total?'Theo điểm TB '+avg.toFixed(1):'—';renderTrend(ranks)}
function renderTrend(){const labels=['Tuần 1','Tuần 2','Tuần 3','Tuần 4'];const vals=[0,0,0,0];students.forEach(s=>{const h=s.score_history||[];h.forEach((v,i)=>{if(i<4)vals[i]+=Number(v||0)})});if(trendChart)trendChart.destroy();trendChart=new Chart($('trendChart'),{type:'line',data:{labels,datasets:[{label:'Điểm thi đua',data:vals.map(v=>students.length?v/students.length:0),tension:.35}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}})}
async function renderAttendance(){const date=$('attendanceDate').value||localDate();$('attendanceDate').value=date;const {data}=await sb.from('attendance').select('*').eq('attendance_date',date);const map=new Map((data||[]).map(x=>[x.student_id,x.status]));$('attendanceBody').innerHTML=students.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.full_name)+'</b></td><td>'+s.team+'</td><td><select class="btn" data-att="'+s.id+'"><option value="present" '+(map.get(s.id)==='present'?'selected':'')+'>Có mặt</option><option value="excused" '+(map.get(s.id)==='excused'?'selected':'')+'>Vắng có phép</option><option value="absent" '+(map.get(s.id)==='absent'?'selected':'')+'>Vắng không phép</option><option value="late" '+(map.get(s.id)==='late'?'selected':'')+'>Đi muộn</option><option value="early_leave" '+(map.get(s.id)==='early_leave'?'selected':'')+'>Về sớm</option></select></td></tr>').join('');const counts={present:0,excused:0,absent:0,late:0,early_leave:0};(data||[]).forEach(x=>counts[x.status]=(counts[x.status]||0)+1);$('attendanceSummary').innerHTML=Object.entries(counts).map(([k,v])=>'<span class="pill">'+attLabel(k)+': <b>'+v+'</b></span>').join('')}
function attLabel(k){return {present:'Có mặt',excused:'Vắng phép',absent:'Vắng không phép',late:'Đi muộn',early_leave:'Về sớm'}[k]||k}
$('attendanceDate').addEventListener('change',renderAttendance);async function saveAttendance(){const date=$('attendanceDate').value;for(const s of students){const el=document.querySelector('[data-att="'+s.id+'"]');if(el)await sb.from('attendance').upsert({student_id:s.id,attendance_date:date,status:el.value,created_by:currentUser.id},{onConflict:'student_id,attendance_date'})}await renderAttendance();await renderDashboard();alert('Đã lưu điểm danh ngày '+date)}
function compWeekInput(){ const el=$('compWeekFilter'); if(el&&!el.value) el.value=getCurrentWeekStart(); return compWeekStart(el?.value); }
function categoryName(id){return ({1:'Giờ giấc – chuyên cần',2:'Nội quy – trật tự',3:'Vệ sinh – môi trường',4:'Tác phong – trang phục',5:'Trách nhiệm – ứng xử',6:'Học tập'})[String(id)]||'Học tập'}
function categoryIdFromName(name){const n=String(name||'').toLowerCase(); if(n.includes('đúng giờ')||n.includes('đi muộn')||n.includes('chuyên cần')||n.includes('vắng'))return 1;if(n.includes('trật tự')||n.includes('nội quy'))return 2;if(n.includes('vệ sinh')||n.includes('môi trường'))return 3;if(n.includes('tác phong')||n.includes('trang phục')||n.includes('đồng phục'))return 4;if(n.includes('học tập')||n.includes('học'))return 6;return 5}
function calculateStudentWeek(studentId,week){const rows=supabaseCache.competitionRecords.filter(r=>r.student_id===studentId);const weeks=[...new Set(rows.map(r=>r.week).filter(Boolean))].sort();let start=81,target=compWeekStart(week);for(const w of weeks){if(w>target)break;const total=rows.filter(r=>r.week===w).reduce((a,r)=>a+Number(r.score||0),0);const end=Math.max(0,Math.min(100,start+total));if(w===target)return end;start=end>=91?91:end>=81?81:end>=66?71:end>=50?61:51;}return 81;}
function calculateStudentMonth(studentId,week){const d=new Date(week+'T00:00:00'),start=new Date(d.getFullYear(),d.getMonth(),1),next=new Date(d.getFullYear(),d.getMonth()+1,1),ss=start.toISOString().slice(0,10),nn=next.toISOString().slice(0,10);const data=supabaseCache.competitionRecords.filter(r=>r.student_id===studentId&&String(r.date||'')>=ss&&String(r.date||'')<nn);return Math.max(0,Math.min(100,81+data.reduce((a,r)=>a+Number(r.score||0),0)));}
let competitionRenderRequestId = 0;

async function renderCompetition(){
  /*
   * Thi đua is a live data module. Never trust an old in-memory cache when
   * the page is opened/re-opened: always read the current students and
   * competition history from Supabase first.
   *
   * The request id prevents a slower, older render from overwriting a newer
   * render when the teacher clicks the sidebar repeatedly.
   */
  const requestId = ++competitionRenderRequestId;
  const week=compWeekInput();

  if ($('competitionRecent')) {
    $('competitionRecent').innerHTML =
      '<div class="mini">Đang tải lịch sử thi đua...</div>';
  }

  try {
    const [studentsResult, historyResult] = await Promise.all([
      sb.from('students').select('*').order('full_name', { ascending: true }),
      sb.from('competition_records')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);

    if (requestId !== competitionRenderRequestId) {
      return;
    }

    if (studentsResult.error) {
      throw studentsResult.error;
    }

    if (historyResult.error) {
      throw historyResult.error;
    }

    supabaseCache.students = studentsResult.data || [];
    supabaseCache.competitionRecords = historyResult.data || [];
    supabaseCache.loadedAt = new Date();

    students = supabaseCache.students.slice().sort((a,b) =>
      String(a.full_name || '').localeCompare(
        String(b.full_name || ''),
        'vi',
        { sensitivity: 'base' }
      )
    );
  } catch (error) {
    console.error('Thi đua - tải dữ liệu trực tiếp thất bại:', error);

    if ($('rankBody')) {
      $('rankBody').innerHTML =
        '<tr><td colspan="6" class="mini">Không thể tải dữ liệu thi đua. Vui lòng thử lại.</td></tr>';
    }

    if ($('competitionRecent')) {
      $('competitionRecent').innerHTML =
        '<div class="mini history-empty">Không thể tải lịch sử thi đua. Vui lòng thử lại.</div>';
    }

    return;
  }

  const weekAfterFreshLoad = compWeekInput();
  if (weekAfterFreshLoad !== week) {
    return;
  }

  /*
   * Data was freshly loaded above. Use only that snapshot for this render.
   * This keeps ranking, student scores and history consistent with one
   * Supabase read cycle.
   */
  const studentRows=supabaseCache.students;
  const studentError=null;

  if(studentError){
    console.error('Thi đua - không tải được học sinh:',studentError);
    if($('rankBody')) $('rankBody').innerHTML='<tr><td colspan="6">Không tải được danh sách học sinh.</td></tr>';
    return;
  }

  const allStudents=studentRows||[];
  students=allStudents;

  if(allStudents.length!==44){
    console.warn('Thi đua: số học sinh hiện tại =',allStudents.length,'; yêu cầu giao diện là 44.');
  }

  if (globalThis.CompetitionRankingUIV6?.mountStudentFilter) {
    globalThis.CompetitionRankingUIV6.mountStudentFilter();
  }

  const selectedStudentIds =
    globalThis.CompetitionRankingUIV6?.getSelectedStudentIds?.() || [];
  const gf=$('compGroupFilter')?.value||'';

  /* Toàn bộ lịch sử vừa được đọc trực tiếp từ Supabase. */
  const history=supabaseCache.competitionRecords;
  const historyError=null;

  if(historyError){
    console.error('Thi đua - không tải được lịch sử:',historyError);
  }

  const records=history||[];

  /*
   * Tính điểm tuần từ cùng calculation engine V6 được dùng bởi Test Center.
   * Không duy trì một công thức thứ hai trong renderer vì hai công thức có
   * thể cho kết quả khác nhau sau khi rollover hoặc khi lịch sử thay đổi.
   */
  const weeklyCache = {};

  function calcWeek(studentId, targetWeek) {
    const key = String(studentId) + '|' + String(targetWeek);

    if (weeklyCache[key] !== undefined) {
      return weeklyCache[key];
    }

    const engine = globalThis.CompetitionCalculationV6;

    if (engine) {
      weeklyCache[key] = engine.calculateWeekScore(
        records,
        studentId,
        targetWeek,
      );
      return weeklyCache[key];
    }

    /*
     * Fallback chỉ dùng nếu calculation engine chưa bootstrap kịp.
     * Giữ đúng contract 81 điểm nền và rollover hiện tại.
     */
    const rows = records
      .filter((record) => {
        return (
          String(record.student_id) === String(studentId) &&
          compWeekStart(
            record.week ||
              record.week_start ||
              record.date,
          ) === compWeekStart(targetWeek)
        );
      });

    const total = rows.reduce(
      (sum, record) => sum + Number(record.score ?? record.points ?? 0),
      0,
    );

    weeklyCache[key] = Math.max(
      0,
      Math.min(100, 81 + total),
    );

    return weeklyCache[key];
  }

  function calcMonth(studentId, targetWeek) {
    const d = new Date(targetWeek + 'T00:00:00');
    const start =
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-01';
    const nextDate = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      1,
    );
    const next =
      nextDate.getFullYear() +
      '-' +
      String(nextDate.getMonth() + 1).padStart(2, '0') +
      '-01';

    const total = records
      .filter((record) => {
        return (
          String(record.student_id) === String(studentId) &&
          String(record.date || '') >= start &&
          String(record.date || '') < next
        );
      })
      .reduce(
        (sum, record) =>
          sum + Number(record.score ?? record.points ?? 0),
        0,
      );

    return Math.max(0, Math.min(100, 81 + total));
  }

  const rows=allStudents.map(s=>({
    ...s,
    weekly:calcWeek(s.id,week),
    monthly:calcMonth(s.id,week)
  }));

  rows.sort((a,b)=>
    b.weekly-a.weekly ||
    String(a.full_name||'').localeCompare(String(b.full_name||''),'vi',{sensitivity:'base'})
  );

  if($('rankBody')){
    $('rankBody').innerHTML=rows.map((s,i)=>{
      const selected=selectedStudentIds.includes(String(s.id))
        ?' style="background:#eff6ff"':'';

      return '<tr'+selected+'>'+
        '<td><b>'+(i+1)+'</b></td>'+
        '<td><b>'+esc(s.full_name)+'</b></td>'+
        '<td><b>'+Number(s.weekly).toFixed(0)+'</b></td>'+
        '<td>'+Number(s.monthly).toFixed(0)+'</td>'+
        '<td>'+groupBadge(s.weekly)+'</td>'+
        '<td>'+trendText(s.score_history)+'</td>'+
      '</tr>';
    }).join('');
  }

  const selectedRankRows = rows
    .map((student, index) => ({
      student,
      rank: index + 1,
    }))
    .filter(item =>
      selectedStudentIds.includes(String(item.student.id)),
    );

  if ($('compRank')) {
    if (!selectedRankRows.length) {
      $('compRank').textContent = '—';
      $('compRank').removeAttribute('title');
    } else {
      const rankingText = selectedRankRows
        .map(item => '#' + item.rank)
        .join(', ');
      $('compRank').textContent = rankingText + ' / 44';
      $('compRank').title = selectedRankRows
        .map(
          item =>
            item.student.full_name +
            ': #' +
            item.rank +
            ' / 44',
        )
        .join('\n');
    }
  }
  if($('compAvg'))$('compAvg').textContent=rows.length
    ?(rows.reduce((sum,s)=>sum+s.weekly,0)/rows.length).toFixed(1)
    :'81.0';

  /* LỊCH SỬ: độc lập với bảng xếp hạng. */
  /*
   * Lịch sử phải được lọc theo tuần đã chuẩn hóa.
   * Record có thể lưu week, week_start hoặc chỉ có date; cả ba đều
   * được quy về thứ Hai đầu tuần trước khi so sánh.
   */
  /*
   * Lịch sử dùng khoảng ngày của tuần làm khóa lọc chính.
   * Không phụ thuộc vào parsing lại record.week/week_start qua Date, vì
   * các record đã lưu canonical week_start = thứ Hai của tuần.
   * Có fallback theo date để tương thích record cũ chỉ có date.
   */
  /*
   * History and ranking must share exactly one canonical week contract.
   * Older records may populate week, week_start, or only date.
   */
  const calculationEngine = globalThis.CompetitionCalculationV6;
  const normalizeRecordWeek =
    calculationEngine?.getRecordWeek ||
    ((record) => {
      for (const value of [
        record?.week_start,
        record?.week,
        record?.date,
      ]) {
        const normalized = String(value || '').slice(0, 10);
        if (/^\\d{4}-\\d{2}-\\d{2}$/.test(normalized)) {
          return compWeekStart(normalized);
        }
      }
      return '';
    });

  const historyWeekStart =
    calculationEngine?.getMonday?.(week) ||
    compWeekStart(week);

  const historyWeekEndDate = new Date(
    historyWeekStart + 'T00:00:00Z',
  );
  historyWeekEndDate.setUTCDate(historyWeekEndDate.getUTCDate() + 7);
  const historyWeekEnd = historyWeekEndDate.toISOString().slice(0, 10);

  const filtered = records.filter((record) => {
    const canonicalWeek = normalizeRecordWeek(record);
    const recordDate = String(
      record?.date || String(record?.created_at || '').slice(0, 10),
    ).slice(0, 10);

    return (
      (
        canonicalWeek === historyWeekStart ||
        (
          recordDate >= historyWeekStart &&
          recordDate < historyWeekEnd
        )
      ) &&
      (!selectedStudentIds.length ||
        selectedStudentIds.includes(String(record.student_id))) &&
      (!gf || String(record.category_id) === String(gf))
    );
  });

  const studentMap=Object.fromEntries(allStudents.map(s=>[s.id,s.full_name]));

  const plus=filtered.filter(x=>Number(x.score)>0).reduce((a,x)=>a+Number(x.score),0);
  const minus=filtered.filter(x=>Number(x.score)<0).reduce((a,x)=>a+Number(x.score),0);
  if($('compPlus'))$('compPlus').textContent='+'+plus;
  if($('compMinus'))$('compMinus').textContent=minus;

  if($('competitionRecent')){
    $('competitionRecent').innerHTML=
      '<div class="tablewrap competition-history-wrap">'+
      '<table class="table competition-history-table">'+
      '<thead><tr><th>Ngày</th><th>Học sinh</th><th>Nhóm tiêu chí</th><th>Tiêu chí</th><th>Điểm</th><th>Ghi chú</th><th>Người tạo</th><th>Thao tác</th></tr></thead>'+
      '<tbody>'+
      filtered.map(x=>'<tr>'+
        '<td>'+esc(x.date||String(x.created_at||'').slice(0,10))+'</td>'+
        '<td><b>'+esc(studentMap[x.student_id]||'Không xác định')+'</b></td>'+
        '<td>'+esc(categoryName(x.category_id))+'</td>'+
        '<td>'+esc(x.criteria||'')+'</td>'+
        '<td><b>'+(Number(x.score)>0?'+':'')+Number(x.score||0)+'</b></td>'+
        '<td>'+esc(x.note||'')+'</td>'+
        '<td>'+esc(x.created_by||'')+'</td>'+
        '<td><div class="actions"><button class="btn small" onclick="editCompetitionRecord(\''+x.id+'\')">Sửa</button><button class="btn small danger" onclick="deleteCompetitionRecord(\''+x.id+'\')">Xóa</button></div></td>'+
'</tr>').join('')+
'</tbody></table></div>'+
(!filtered.length?'<div class="mini history-empty">Không có bản ghi trong tuần đang chọn. Hãy đổi bộ lọc Tuần để xem lịch sử của tuần khác.</div>':'<div class="mini history-count">Đang hiển thị <b>'+filtered.length+'</b> bản ghi.</div>');
}
await renderCompetitionCriteria();
}
async function addCompetition(studentId,points,criteria,note='',categoryId=5,week=getCurrentWeekStart(),date=localDate()) {
    const valid=[-5,-4,-3,-2,-1,1,2,3,4,5]; if(!valid.includes(Number(points)))return alert('Điểm chỉ được chọn từ -5 đến -1 hoặc +1 đến +5.');
    const payload= {
        student_id:studentId,score:Number(points),points:Number(points),criteria,note:String(note||'').trim(),period:'week',week_start:compWeekStart(week),week:compWeekStart(week),date,category_id:Number(categoryId),created_by:currentUser.id
    };
    const {
        error
    }
    =await sb.from('competition_records').insert(payload); if(error) {
        console.error(error);alert('Không thể lưu ghi nhận: '+error.message);return false;
    }
    // Refresh both source-of-truth caches after a successful write.
    // This prevents the history panel and the 44-student ranking from
    // displaying stale data until the user manually refreshes the page.
    await Promise.all([
        loadStudentsFromSupabase(),
        loadCompetitionHistoryFromSupabase(),
    ]);
    return true;
}
async function editCompetitionRecord(id) {
    const {
        data:r,error
    }
    =await sb.from('competition_records').select('*').eq('id',id).single(); if(error||!r)return alert('Không tìm thấy bản ghi.');
    const {
        data:criteria
    }
    =await sb.from('competition_criteria').select('*').eq('active',true).order('sort_order');
    openModal('Sửa bản ghi thi đua','<div class="field"><label>Học sinh</label><select id="eStudent">'+students.map(s=>'<option value="'+s.id+'" '+(s.id===r.student_id?'selected':'')+'>'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Tuần</label><input id="eWeek" type="date" value="'+esc(r.week||r.week_start||getCurrentWeekStart())+'"></div><div class="field"><label>Ngày</label><input id="eDate" type="date" value="'+esc(r.date||String(r.created_at||'').slice(0,10))+'"></div><div class="field"><label>Nhóm tiêu chí</label><select id="eGroup">'+[1,2,3,4,5,6].map(i=>'<option value="'+i+'" '+(Number(r.category_id||5)===i?'selected':'')+'>'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Tiêu chí</label><select id="eCriteria">'+(criteria||[]).map(c=>'<option value="'+c.name+'" '+(c.name===r.criteria?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div><div class="field"><label>Điểm</label><select id="ePoints">'+[-5,-4,-3,-2,-1,1,2,3,4,5].map(v=>'<option value="'+v+'" '+(Number(r.score||r.points)===v?'selected':'')+'>'+((v>0?'+':'')+v)+'</option>').join('')+'</select></div><div class="field"><label>Ghi chú</label><textarea id="eNote" rows="4">'+esc(r.note||'')+'</textarea></div><div class="actions"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="deleteCompetitionRecord(\''+r.id+'\')">Xóa</button><button class="btn primary" onclick="saveEditedCompetition(\''+r.id+'\')">Sửa</button></div>');
}
async function saveEditedCompetition(id) {
    const valid=[-5,-4,-3,-2,-1,1,2,3,4,5], points=Number($('ePoints').value), newStudent=$('eStudent').value; if(!valid.includes(points))return alert('Điểm không hợp lệ.');
    const payload= {
        student_id:newStudent,week:compWeekStart($('eWeek').value),week_start:compWeekStart($('eWeek').value),date:$('eDate').value,category_id:Number($('eGroup').value),criteria:$('eCriteria').value,score:points,points:points,note:$('eNote').value.trim()
    };
    const {
        error
    }
    =await sb.from('competition_records').update(payload).eq('id',id); if(error)return alert('Không thể sửa: '+error.message); closeModal(); await Promise.all([loadStudentsFromSupabase(),loadCompetitionHistoryFromSupabase()]); await renderStudents(); await renderCompetition(); await renderDashboard();
}
async function deleteCompetitionRecord(id) {
    if(!confirm('Xóa bản ghi này? Ghi chú và điểm của bản ghi sẽ bị xóa khỏi lịch sử, sau đó điểm sẽ được tính lại từ lịch sử còn lại.'))return; const {
        error
    }
    =await sb.from('competition_records').delete().eq('id',id); if(error)return alert('Không thể xóa: '+error.message); closeModal(); await Promise.all([loadStudentsFromSupabase(),loadCompetitionHistoryFromSupabase()]); await renderStudents(); await renderCompetition(); await renderDashboard();
}
async function rolloverCompetitionWeek() {
    if(role!=='teacher')return; const {
        error
    }
    =await sb.rpc('rollover_competition_week'); if(error)console.warn(error.message);
}
async function renderCompetitionCriteria() {
    const box=$('criteriaSettings');if(!box)return;const {
        data,error
    }
    =await sb.from('competition_criteria').select('*').order('sort_order');if(error) {
        box.innerHTML='<div class="mini">Không tải được tiêu chí.</div>';return
    }
    box.innerHTML='<div class="criteria-grid">'+(data||[]).map(c=> {
        const signed=Number(c.points)*(c.type==='minus'?-1:1);return '<div class="notice"><div><b>'+esc(c.name)+'</b> <span class="mini">Nhóm '+esc(c.group_name||'5')+' · mặc định '+(signed>0?'+':'')+signed+'</span></div><div class="mini">Thang điểm: -5,-4,-3,-2,-1,+1,+2,+3,+4,+5</div><div class="actions"><button class="btn small" onclick="editCriteria(\''+c.id+'\')">Sửa</button><button class="btn small" onclick="toggleCriteria(\''+c.id+'\','+(c.active?'false':'true')+')">'+(c.active?'Tắt':'Bật')+'</button></div></div>'
    }
    ).join('')+'</div><button class="btn" onclick="addCriteria()">+ Thêm tiêu chí</button>'
}
function scoreOptions(selected) {
    return [-5,-4,-3,-2,-1,1,2,3,4,5].map(v=>'<option value="'+v+'" '+(Number(selected)===v?'selected':'')+'>'+((v>0?'+':'')+v)+' điểm</option>').join('')
}
function editCriteria(id) {
    sb.from('competition_criteria').select('*').eq('id',id).single().then(( {
        data
    }
    )=> {
        if(!data)return;openModal('Điều chỉnh tiêu chí thi đua','<div class="field"><label>Tên tiêu chí</label><input id="crName" value="'+esc(data.name)+'"></div><div class="field"><label>Nhóm tiêu chí</label><select id="crGroup">'+[1,2,3,4,5,6].map(i=>'<option value="'+i+'" '+(String(data.group_name||5)===String(i)?'selected':'')+'>'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Mức điểm mặc định</label><select id="crPoints">'+scoreOptions(Number(data.points)*(data.type==='minus'?-1:1))+'</select></div><button class="btn primary" onclick="saveCriteria(\''+id+'\')">Lưu</button>')
    }
    )
}
async function saveCriteria(id) {
    const name=$('crName').value.trim(),points=Number($('crPoints').value),group=String($('crGroup').value);if(!name||![ -5,-4,-3,-2,-1,1,2,3,4,5].includes(points))return alert('Thông tin tiêu chí không hợp lệ.');const {
        error
    }
    =await sb.from('competition_criteria').update( {
        name,points:Math.abs(points),type:points<0?'minus':'plus',group_name:group,updated_at:new Date().toISOString()
    }
    ).eq('id',id);if(error)return alert(error.message);closeModal();await renderCompetitionCriteria()
}
function addCriteria() {
    openModal('Thêm tiêu chí thi đua','<div class="field"><label>Tên tiêu chí</label><input id="crName"></div><div class="field"><label>Nhóm tiêu chí</label><select id="crGroup">'+[1,2,3,4,5,6].map(i=>'<option value="'+i+'">'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Mức điểm mặc định</label><select id="crPoints">'+scoreOptions(1)+'</select></div><button class="btn primary" onclick="createCriteria()">Thêm</button>')
}
async function createCriteria() {
    const name=$('crName').value.trim(),points=Number($('crPoints').value),group=String($('crGroup').value);if(!name||![ -5,-4,-3,-2,-1,1,2,3,4,5].includes(points))return alert('Thông tin tiêu chí không hợp lệ.');const {
        data:existing
    }
    =await sb.from('competition_criteria').select('sort_order').order('sort_order', {
        ascending:false
    }
    ).limit(1);const sort=(existing?.[0]?.sort_order||0)+1;const {
        error
    }
    =await sb.from('competition_criteria').insert( {
        name,points:Math.abs(points),type:points<0?'minus':'plus',group_name:group,sort_order:sort
    }
    );if(error)return alert(error.message);closeModal();await renderCompetitionCriteria()
}
async function toggleCriteria(id,active) {
    const {
        error
    }
    =await sb.from('competition_criteria').update( {
        active,updated_at:new Date().toISOString()
    }
    ).eq('id',id);if(error)alert(error.message);else await renderCompetitionCriteria()
}
function openCompetitionForm() {
    sb.from('competition_criteria').select('*').eq('active',true).order('sort_order').then(( {
        data
    }
    )=> {
        const groups=[1,2,3,4,5,6],gm= {
        };(data||[]).forEach(c=>(gm[c.group_name||5]??=[]).push(c));const gh=groups.map(id=>'<div class="criteria-group"><h4>Nhóm '+id+': '+categoryName(id)+'</h4><div class="criteria-items">'+((gm[id]||[]).map(c=>'<span class="criteria-chip">'+esc(c.name)+'</span>').join('')||'<span class="mini">Chưa có tiêu chí.</span>')+'</div></div>').join('');openModal('Ghi nhận thi đua','<div class="field"><label>Học sinh</label><select id="fStudent">'+students.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Tuần</label><input id="fWeek" type="date" value="'+getCurrentWeekStart()+'"></div><div class="field"><label>Ngày</label><input id="fDate" type="date" value="'+localDate()+'"></div>'+gh+'<div class="field"><label>Nhóm tiêu chí</label><select id="fGroup" onchange="filterCriteriaByGroup()">'+groups.map(i=>'<option value="'+i+'">'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Tiêu chí</label><select id="fCriteria">'+(data||[]).map(c=>'<option value="'+c.id+'" data-group="'+(c.group_name||5)+'">'+esc(c.name)+'</option>').join('')+'</select></div><div class="field"><label>Điểm</label><select id="fPoints">'+scoreOptions(1)+'</select></div><div class="field"><label>📝 Ghi chú</label><textarea id="fNote" rows="4" placeholder="Lỗi vi phạm, hành vi tích cực, khen thưởng hoặc nhận xét..."></textarea></div><div class="actions"><button class="btn primary" onclick="submitCompetition()">Lưu</button></div>');filterCriteriaByGroup();
    }
    )
}
function syncCompetitionPointsToCriteria() {
    const criterion = $('fCriteria')?.selectedOptions?.[0];
    const points = Number(criterion?.dataset?.points || 1);
    const pointsSelect = $('fPoints');

    if (pointsSelect) {
        pointsSelect.value = String(points);
    }
}

function filterCriteriaByGroup() {
    const g=$('fGroup')?.value;if(!g)return;const sel=$('fCriteria');[...sel.options].forEach(o=>o.hidden=String(o.dataset.group)!==String(g));const first=[...sel.options].find(o=>!o.hidden);if(first) {
        sel.value=first.value;
        syncCompetitionPointsToCriteria();
    }
}
async function submitCompetition() {
    const c=await sb.from('competition_criteria').select('*').eq('id',$('fCriteria').value).single();const points=Number($('fPoints').value);if(c.error||!c.data)return alert('Không tìm thấy tiêu chí.');const ok=await addCompetition($('fStudent').value,points,c.data.name,$('fNote').value.trim(),Number($('fGroup').value),$('fWeek').value,$('fDate').value);if(ok) {
        closeModal();await renderStudents();await renderCompetition();await renderDashboard();
    }
}
async function renderHonors() {
    const period=$('honorPeriod').value;const {
        data
    }
    =await sb.from('honors').select('*,students(full_name,student_code)').eq('period',period).order('created_at', {
        ascending:false
    }
    );$('honorList').innerHTML=(data||[]).map(x=>'<div class="honor"><div class="ico">'+esc(x.icon||'🌟')+'</div><div><b>'+esc(x.title)+'</b><div>'+esc(x.students?.full_name||'')+'</div><div class="mini">'+esc(x.reason||'')+' · '+new Date(x.created_at).toLocaleDateString('vi-VN')+'</div></div></div>').join('')||'<div class="mini">Chưa có danh hiệu. Hệ thống có thể đề xuất sau khi có dữ liệu.</div>'
}
$('honorPeriod').addEventListener('change',renderHonors);function openHonorForm() {
    openModal('Bảng danh dự','<div class="field"><label>Học sinh</label><select id="hStudent">'+students.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Danh hiệu</label><select id="hTitle"><option>🌟 Học sinh xuất sắc</option><option>📚 Học tập tiến bộ</option><option>🤝 Học sinh tích cực hỗ trợ bạn</option><option>🧹 Gương mẫu về nề nếp</option><option>💡 Học sinh tích cực phát biểu</option><option>❤️ Học sinh có tinh thần trách nhiệm</option></select></div><div class="field"><label>Lý do</label><textarea id="hReason" rows="3"></textarea></div><button class="btn primary" onclick="submitHonor()">Lưu danh dự</button>')
}
async function submitHonor() {
    const title=$('hTitle').value;const icon=title.split(' ')[0];await sb.from('honors').insert( {
        student_id:$('hStudent').value,title,icon,reason:$('hReason').value,period:$('honorPeriod').value,created_by:currentUser.id
    }
    );closeModal();await renderHonors()
}
async function renderTeams() {
    const arr=[1,2,3,4].map(t=> {
        const a=students.filter(s=>Number(s.team)===t);return {
            team:t,n:a.length,avg:a.length?a.reduce((x,s)=>x+Number(s.competition_score||0),0)/a.length:0
        }
    }
    ).sort((a,b)=>b.avg-a.avg);$('teamBody').innerHTML=arr.map((x,i)=>'<tr><td>'+((i+1))+'</td><td>Tổ '+x.team+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.n+'</td><td>—</td></tr>').join('');$('teamCards').innerHTML=arr.map((x,i)=>'<div class="card"><div class="label">Hạng '+(i+1)+'</div><div class="metric">Tổ '+x.team+'</div><div class="mini">Điểm TB '+x.avg.toFixed(1)+' · '+x.n+' HS</div></div>').join('')
}
/**
 * Build student alerts from competition records.
 *
 * The old learning/discipline modules are retired. Alerts now use the
 * competition module as the single source of behavioral signals.
 */
async function renderAlerts() {
    const week = typeof compWeekInput === 'function'
        ? compWeekInput()
        : getCurrentWeekStart();

    const records = (supabaseCache.competitionRecords || [])
        .filter(record => String(record.week || record.week_start || '') === String(week));

    const byStudent = new Map();

    records.forEach(record => {
        const score = Number(record.score || 0);

        if (score >= 0) {
            return;
        }

        const current = byStudent.get(record.student_id) || {
            total: 0,
            count: 0,
            notes: [],
        };

        current.total += score;
        current.count += 1;

        const note = record.note || record.item || record.reason || '';
        if (note) {
            current.notes.push(String(note));
        }

        byStudent.set(record.student_id, current);
    });

    const alerts = students
        .map(student => ({
            ...student,
            ...(byStudent.get(student.id) || {
                total: 0,
                count: 0,
                notes: [],
            }),
        }))
        .filter(student => student.count > 0)
        .sort((a, b) => a.total - b.total);

    const box = $('alertsBox');

    if (!box) {
        return;
    }

    box.innerHTML = alerts.length
        ? alerts.map(student => {
            const severe = student.total <= -5;
            const level = severe ? 'Cần quan tâm' : 'Cần theo dõi';
            const tone = severe ? 'danger' : 'watch';
            const notes = student.notes.slice(0, 2).join(' · ');

            return `<div class="notice ${tone}">
                <b>${esc(student.full_name)}</b>
                <span class="badge ${tone}">${level}</span>
                <div class="mini">Thi đua tuần: ${student.total} điểm · ${student.count} lượt ghi nhận</div>
                ${notes ? `<div class="mini">${esc(notes)}</div>` : ''}
            </div>`;
        }).join('')
        : '<div class="mini">Chưa có cảnh báo từ dữ liệu thi đua tuần này.</div>';
}
function periodRange(period) {
    const now=new Date();const end=new Date(now);end.setHours(23,59,59,999);const start=new Date(now);if(period==='day')start.setHours(0,0,0,0);else if(period==='week') {
        const day=(start.getDay()+6)%7;start.setDate(start.getDate()-day);start.setHours(0,0,0,0)
    } else {
        start.setDate(1);start.setHours(0,0,0,0)
    }
    return {
        start:start.toISOString(),end:end.toISOString(),startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)
    }
}
async function renderReports() {
    const period=$('reportPeriod').value;const r=periodRange(period);const [ {
        data:att
    }, {
        data:comp
    }, {
        data:hon
    }, {
        data:fb
    }
    ]=await Promise.all([sb.from('attendance').select('*').gte('attendance_date',r.startDate).lte('attendance_date',r.endDate),sb.from('competition_records').select('*').gte('created_at',r.start).lte('created_at',r.end).order('created_at', {
        ascending:false
    }
    ),sb.from('honors').select('*').gte('created_at',r.start).lte('created_at',r.end).order('created_at', {
        ascending:false
    }
    ),sb.from('feedback').select('*').gte('created_at',r.start).lte('created_at',r.end).order('created_at', {
        ascending:false
    }
    )]);const present=(att||[]).filter(x=>x.status==='present').length;const late=(att||[]).filter(x=>x.status==='late').length;const absent=(att||[]).filter(x=>x.status==='absent').length;const avg=students.length?students.reduce((a,s)=>a+Number(s.competition_score||0),0)/students.length:0;const progress=students.filter(s=>trendText(s.score_history).includes('Tăng')).map(s=>esc(s.full_name)).join(', ')||'Chưa đủ dữ liệu';const top=[...students].sort((a,b)=>Number(b.competition_score||0)-Number(a.competition_score||0)).slice(0,5).map(s=>esc(s.full_name)).join(', ')||'Chưa có dữ liệu';$('reportBox').innerHTML='<div class="grid cards"><div class="card"><div class="label">Điểm thi đua TB</div><div class="metric">'+avg.toFixed(1)+'</div></div><div class="card"><div class="label">Lượt có mặt</div><div class="metric">'+present+'</div></div><div class="card"><div class="label">Đi muộn</div><div class="metric">'+late+'</div></div><div class="card"><div class="label">Vắng không phép</div><div class="metric">'+absent+'</div></div></div><div class="section card"><h2>Báo cáo '+periodLabel(period)+'</h2><p><b>Khoảng:</b> '+r.startDate+' → '+r.endDate+'</p><p><b>Học sinh tiến bộ:</b> '+progress+'</p><p><b>Học sinh nổi bật:</b> '+top+'</p><p><b>Danh dự:</b> '+(hon||[]).length+' · <b>Ghi nhận thi đua:</b> '+(comp||[]).length+' · <b>Phản hồi:</b> '+(fb||[]).length+'</p><p><b>Phản hồi chưa trả lời:</b> '+(fb||[]).filter(x=>!x.teacher_reply).length+'</p></div>';
}
function periodLabel(p) {
    return {
        day:'ngày',week:'tuần',month:'tháng'
    }
    [p]||p
}
function printReport() {
    window.print()
}
function openClassSettings() {
    showPage('settings')
}
async function saveClassSettings() {
    const payload= {
        class_name:$('classNameInput').value.trim()||'6/3',school_year:$('schoolYearInput').value.trim()||'2026-2027',teacher_name:$('teacherNameInput').value.trim()||'Phượng Tiên',updated_at:new Date().toISOString()
    };const {
        data
    }
    =await sb.from('class_settings').select('id').limit(1).maybeSingle();let e;if(data)e=await sb.from('class_settings').update(payload).eq('id',data.id);else e=await sb.from('class_settings').insert(payload);$('settingsMsg').textContent=e.error?e.error.message:'Đã lưu thông tin lớp.';await loadSettings()
}
/**
 * Tách phần số lớp từ tên lớp để tạo tiền tố mã học sinh.
 *
 * Ví dụ:
 * - "6/3"  -> "63"
 * - "6/10" -> "610"
 * - "7/2"  -> "72"
 *
 * @param {string} className Tên lớp đang được cấu hình.
 * @returns {string} Tiền tố số dùng để sinh student_code.
 */
function getStudentCodePrefix(className) {
    // Chuyển tên lớp thành chuỗi để xử lý an toàn.
    const normalizedClassName = String(className || '').trim();

    // Chỉ giữ lại các chữ số trong tên lớp.
    return normalizedClassName.replace(/\D/g, '');
}

/**
 * Tìm mã học sinh tiếp theo dựa trên các mã đang tồn tại trong database.
 *
 * Nguyên tắc:
 * - Không dựa vào số lượng học sinh.
 * - Tìm số thứ tự lớn nhất hiện có trong cùng tiền tố lớp.
 * - Tăng số thứ tự lên 1.
 * - Phần số thứ tự luôn được đệm thành tối thiểu 2 chữ số.
 *
 * Ví dụ lớp 6/3:
 * 6301 ... 6344 -> mã tiếp theo là 6345.
 *
 * @returns {Promise<string>} Mã học sinh tiếp theo.
 */
async function generateNextStudentCode() {
    // Lấy tiền tố từ tên lớp hiện tại.
    const classPrefix = getStudentCodePrefix(classSettings.class_name);

    // Không thể sinh mã nếu chưa có thông tin lớp.
    if (!classPrefix) {
        throw new Error('Chưa xác định được mã lớp để tạo mã học sinh.');
    }

    // Đọc mã học sinh hiện có từ Supabase.
    const { data, error } = await sb
        .from('students')
        .select('student_code')
        .like('student_code', `${classPrefix}%`);

    // Nếu truy vấn thất bại, chuyển lỗi cho function gọi xử lý.
    if (error) {
        throw error;
    }

    // Tách phần số thứ tự sau tiền tố lớp và tìm số lớn nhất.
    const maxSequence = (data || [])
        .map(student => String(student.student_code || ''))
        .filter(code => code.startsWith(classPrefix))
        .map(code => Number(code.slice(classPrefix.length)))
        .filter(sequence => Number.isInteger(sequence) && sequence >= 1)
        .reduce((max, sequence) => Math.max(max, sequence), 0);

    // Tăng số thứ tự lên 1 để tạo mã mới.
    const nextSequence = maxSequence + 1;

    // Đệm số thứ tự thành tối thiểu 2 chữ số.
    return `${classPrefix}${String(nextSequence).padStart(2, '0')}`;
}

/**
 * Mở form Thêm/Sửa học sinh.
 *
 * Khi thêm mới, mã học sinh được hệ thống tự sinh và chỉ hiển thị để GVCN kiểm tra.
 * Khi chỉnh sửa, mã hiện tại chỉ được hiển thị và không cho thay đổi.
 *
 * @param {object|null} student Học sinh đang sửa hoặc null nếu thêm mới.
 */
async function openStudentForm(student) {
    // Xác định form đang dùng để thêm mới hay chỉnh sửa.
    const isEdit = Boolean(student);

    // Với học sinh mới, lấy mã dự kiến trực tiếp từ database.
    let nextStudentCode = student?.student_code || '';

    if (!isEdit) {
        try {
            nextStudentCode = await generateNextStudentCode();
        } catch (error) {
            alert(`Không thể tạo mã học sinh tự động: ${error.message || error}`);
            return;
        }
    }

    // Hiển thị form hồ sơ tối giản.
    // Email, ngày sinh và dữ liệu phụ huynh đã được loại bỏ ở Phase 2.
    openModal(
        isEdit ? 'Chỉnh sửa học sinh' : 'Thêm học sinh',
        '<div class="grid two">' +
        '<div class="field"><label>Họ tên</label>' +
        '<input id="sfName" value="' +
        esc(student?.full_name || '') +
        '"></div>' +
        '<div class="field"><label>Mã HS ' +
        (isEdit ? '' : 'dự kiến') +
        '</label>' +
        '<div class="pill"><b>' +
        esc(nextStudentCode) +
        '</b>' +
        (isEdit ? '' : ' · Hệ thống tự động gán khi lưu') +
        '</div></div>' +
        '</div>' +
        '<div class="grid two">' +
        '<div class="field"><label>Giới tính</label>' +
        '<select id="sfGender">' +
        '<option ' + (student?.gender === 'Nam' ? 'selected' : '') + '>Nam</option>' +
        '<option ' + (student?.gender === 'Nữ' ? 'selected' : '') + '>Nữ</option>' +
        '<option ' + (student?.gender === 'Khác' ? 'selected' : '') + '>Khác</option>' +
        '</select></div>' +
        '<div class="field"><label>Tổ</label>' +
        '<input id="sfTeam" type="number" min="1" max="4" value="' +
        (student?.team || '') +
        '"></div>' +
        '</div>' +
        '<div class="field"><label>Mức hỗ trợ</label>' +
        '<select id="sfSupport">' +
        '<option ' + (student?.support_level === 'Không' || !student?.support_level ? 'selected' : '') + '>Không</option>' +
        '<option ' + (student?.support_level === 'Theo dõi' ? 'selected' : '') + '>Theo dõi</option>' +
        '<option ' + (student?.support_level === 'Cần hỗ trợ' ? 'selected' : '') + '>Cần hỗ trợ</option>' +
        '<option ' + (student?.support_level === 'Cần can thiệp' ? 'selected' : '') + '>Cần can thiệp</option>' +
        '</select></div>' +
        '<div class="field"><label>Ghi chú đặc biệt</label>' +
        '<textarea id="sfNote" rows="3">' +
        esc(student?.special_note || '') +
        '</textarea></div>' +
        '<div class="field"><label>Ghi chú tiến bộ</label>' +
        '<textarea id="sfProgress" rows="3">' +
        esc(student?.progress_note || '') +
        '</textarea></div>' +
        '<button class="btn primary" onclick="saveStudent(' +
        (isEdit ? "'" + student.id + "'" : 'null') +
        ')">' +
        'Lưu học sinh</button>'
    );
}

/**
 * Lưu một học sinh mới hoặc cập nhật học sinh hiện tại.
 *
 * Khi thêm mới:
 * - Tự sinh student_code.
 * - competition_score = 81.
 * - attendance_percent = 100.
 * - support_level = "Không".
 *
 * Khi chỉnh sửa:
 * - Giữ nguyên student_code.
 * - Chỉ cập nhật các thông tin được phép sửa.
 *
 * @param {string|null} id ID học sinh khi chỉnh sửa; null khi thêm mới.
 */
async function saveStudent(id) {
    // Thu thập các trường được phép chỉnh sửa từ form.
    const payload = {
        full_name: $('sfName').value.trim(),
        gender: $('sfGender').value,
        team: Number($('sfTeam').value) || null,
        support_level: $('sfSupport').value || 'Không',
        special_note: $('sfNote').value.trim(),
        progress_note: $('sfProgress').value.trim()
    };

    // Họ tên là thông tin bắt buộc.
    if (!payload.full_name) {
        alert('Cần nhập họ tên học sinh.');
        return;
    }

    // Nếu đang chỉnh sửa, tuyệt đối không sửa student_code.
    if (id) {
        const { error } = await sb
            .from('students')
            .update(payload)
            .eq('id', id);

        // Hiển thị lỗi nếu database từ chối cập nhật.
        if (error) {
            alert(error.message);
            return;
        }
    } else {
        // Sinh mã mới ngay trước lúc INSERT để hạn chế mã dự kiến bị cũ.
        let generatedStudentCode;

        try {
            generatedStudentCode = await generateNextStudentCode();
        } catch (error) {
            alert(`Không thể tạo mã học sinh tự động: ${error.message || error}`);
            return;
        }

        // Dữ liệu mặc định dành cho một học sinh mới.
        const newStudentPayload = {
            ...payload,
            student_code: generatedStudentCode,
            competition_score: 81,
            attendance_percent: 100,
            support_level: 'Không'
        };

        // Thêm học sinh mới vào database.
        const { error } = await sb
            .from('students')
            .insert(newStudentPayload);

        // Hiển thị lỗi nếu insert thất bại.
        if (error) {
            alert(error.message);
            return;
        }
    }

    // Đóng form sau khi thao tác thành công.
    closeModal();

    // Tải lại dữ liệu để UI đồng bộ hoàn toàn với database.
    await loadAll();
}


function editStudent(id) {
    const s=students.find(x=>x.id===id);if(s)openStudentForm(s)
}
function exportCSV() {
    // Tạo tiêu đề CSV bằng các trường hồ sơ hiện còn được sử dụng.
    const header =
        'STT,Họ tên,Mã HS,Giới tính,Tổ,Thi đua,Mức hỗ trợ,Ghi chú\n';

    // Chuyển từng học sinh thành một dòng CSV.
    const body = students
        .map((student, index) => [
            index + 1,
            student.full_name,
            student.student_code,
            student.gender,
            student.team,
            student.competition_score,
            student.support_level,
            student.special_note
        ])
        .map(row =>
            row
                .map(value =>
                    '"' +
                    String(value ?? '').replaceAll('"', '""') +
                    '"'
                )
                .join(',')
        )
        .join('\n');

    // Tạo Blob CSV trong trình duyệt.
    const file = new Blob(
        ['\ufeff' + header + body],
        { type: 'text/csv' }
    );

    // Tạo liên kết tạm và kích hoạt tải file.
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = 'so-chu-nhiem-6-3.csv';
    link.click();
}
async function randomStudent() {
    if(randomRunning)return;const scope=$('randomScope').value;const pool=getRandomPool(scope);if(!pool.length) {
        $('randomStatus').textContent='Chưa có học sinh trong phạm vi này.';return
    }
    const winner=chooseRandomCandidate(scope);if(!winner)return;randomRunning=true;$('randomButton').disabled=true;$('randomButton').textContent='⏳ ĐANG CHỌN...';$('randomName').classList.remove('winner');$('randomName').classList.add('spinning');$('randomStatus').textContent='Vòng quay đang bắt đầu...';$('randomMeta').textContent=pool.length+' học sinh trong phạm vi '+(scope==='all'?'toàn lớp':scope.replace('team','Tổ '));playTone(440,.08,'sine',.025);await sleep(350);for(let n=3;n>=1;n--) {
        $('randomStatus').textContent='Chuẩn bị... '+n;playCountdown(n);await sleep(330)
    }
    $('randomStatus').textContent='Đang chọn...';const recent=randomHistory.slice(-Math.min(8,pool.length));const recentSet=new Set(recent.map(String));const spinPool=pool.filter(s=>!recentSet.has(String(s.id)));const visiblePool=spinPool.length?spinPool:pool;const started=performance.now();let tick=0;while(performance.now()-started<1850) {
        const preview=visiblePool[Math.floor(Math.random()*visiblePool.length)];$('randomName').textContent=preview.full_name;playSpinTick();tick++;await sleep(Math.max(55,95-tick*1.2))
    }
    $('randomName').textContent=winner.full_name;$('randomName').classList.remove('spinning');$('randomName').classList.add('winner');$('randomMeta').textContent='Tổ '+(winner.team||'—')+' · '+(winner.student_code||'')+' · Lượt #'+(randomHistory.length+1);$('randomStatus').textContent='🎉 Mời em!';playWinnerSound();speakStudent(winner.full_name);randomHistory.push(winner.id);if(randomHistory.length>50)randomHistory.shift();localStorage.setItem('s6r',JSON.stringify(randomHistory));renderRandomHistory();await sleep(500);randomRunning=false;$('randomButton').disabled=false;$('randomButton').textContent='🎲 GỌI TÊN NGẪU NHIÊN'
}
function renderRandomHistory() {
    const map=new Map(students.map(s=>[s.id,s]));$('randomHistory').innerHTML=randomHistory.slice(-10).reverse().map((id,i)=> {
        const s=map.get(id);return s?'<div class="notice"><b>'+(randomHistory.length-i)+'. '+esc(s.full_name)+'</b> · Tổ '+(s.team||'—')+'</div>':''
    }
    ).join('')||'<div class="mini">Chưa có lịch sử.</div>'
}
function resetRandomHistory() {
    if(randomRunning)return;randomHistory=[];localStorage.removeItem('s6r');renderRandomHistory();$('randomName').textContent='Sẵn sàng?';$('randomName').classList.remove('winner','spinning');$('randomStatus').textContent='Nhấn nút để bắt đầu.';$('randomMeta').textContent=''
}
async function renderStudentAll() {
    const {
        data:s
    }
    =await sb.from('students').select('*').eq('user_id',currentUser.id).single();if(!s)return;window.me=s;$('studentAvatar').textContent=s.full_name.slice(0,1).toUpperCase();$('sProfileName').textContent=s.full_name;$('sProfileMeta').textContent='Lớp '+classSettings.class_name+' · Tổ '+(s.team||'—')+' · GVCN '+classSettings.teacher_name;$('studentHomeBox').innerHTML='<div class="studenthero"><div class="bigavatar">'+esc(s.full_name.slice(0,1))+'</div><div><h2>Chào '+esc(s.full_name)+'!</h2><p class="mutedline">Mỗi ngày một tiến bộ – Mỗi tuần một thành tích!</p></div></div><div class="grid cards section"><div><div class="label">Điểm thi đua</div><div class="metric">'+Number(s.competition_score||0).toFixed(1)+'</div></div><div><div class="label">Nhóm</div><div class="metric">'+group(s.competition_score)+'</div></div><div><div class="label">Chuyên cần</div><div class="metric">'+Number(s.attendance_percent||0).toFixed(1)+'%</div></div><div><div class="label">Hỗ trợ</div><div class="metric">'+esc(s.support_level||'Không')+'</div></div></div>';$('sProfileBox').innerHTML='<div class="grid two"><div><p><b>Họ tên:</b> '+esc(s.full_name)+'</p><p><b>Mã học sinh:</b> '+esc(s.student_code||'')+'</p></div><div><p><b>Tổ:</b> '+(s.team||'')+'</p><p><b>GVCN:</b> '+esc(classSettings.teacher_name)+'</p><p><b>Chuyên cần:</b> '+Number(s.attendance_percent||0).toFixed(1)+'%</p><p><b>Huy hiệu:</b> '+Number(s.badge_count||0)+'</p></div></div>';$('spScore').textContent=Number(s.competition_score||0).toFixed(1);$('spAttendance').textContent=Number(s.attendance_percent||0).toFixed(1)+'%';if(studentChart)studentChart.destroy();studentChart=new Chart($('studentChart'), {
        type:'line',data: {
            labels:['T1','T2','T3','T4'],datasets:[ {
                label:'Điểm thi đua',data:(s.score_history||[]).slice(-4),tension:.35
            }
            ]
        },options: {
            responsive:true,plugins: {
                legend: {
                    display:false
                }
            },scales: {
                y: {
                    min:0,max:100
                }
            }
        }
    }
    );await renderStudentHonors(s.id);await renderGoals();await renderStudentFeedback()
}
async function renderStudentHonors(id) {
    const {
        data
    }
    =await sb.from('honors').select('*').eq('student_id',id).order('created_at', {
        ascending:false
    }
    );$('studentHonors').innerHTML=(data||[]).map(x=>'<div class="honor"><div class="ico">'+esc(x.icon||'🌟')+'</div><div><b>'+esc(x.title)+'</b><div class="mini">'+esc(x.reason||'')+'</div></div></div>').join('')||'<div class="mini">Chưa có thành tích.</div>';const {
        data:all
    }
    =await sb.from('honors').select('*,students(full_name)').order('created_at', {
        ascending:false
    }
    ).limit(20);$('studentHonorBoard').innerHTML=(all||[]).map(x=>'<div class="notice">'+esc(x.icon||'🌟')+' <b>'+esc(x.title)+'</b> · '+esc(x.students?.full_name||'')+'</div>').join('')||'<div class="mini">Chưa có dữ liệu.</div>'
}
async function renderGoals() {
    const {
        data
    }
    =await sb.from('student_goals').select('*').eq('student_user_id',currentUser.id).order('week_start', {
        ascending:false
    }
    ).limit(6);const latest=data?.[0];if(latest) {
        $('goal1').value=latest.goal1||'';$('goal2').value=latest.goal2||'';$('goal3').value=latest.goal3||'';$('goalNote').value=latest.note||''
    }
    $('goalHistory').innerHTML=(data||[]).map(x=>'<div class="notice"><b>Tuần '+esc(x.week_start)+'</b><div>'+esc(x.goal1||'')+' · '+esc(x.goal2||'')+' · '+esc(x.goal3||'')+'</div><div class="mini">'+esc(x.self_assessment||'Chưa tự đánh giá')+'</div></div>').join('')
}
async function saveGoal() {
    const week=new Date();week.setDate(week.getDate()-((week.getDay()+6)%7));const {
        error
    }
    =await sb.from('student_goals').insert( {
        student_user_id:currentUser.id,week_start:week.toISOString().slice(0,10),goal1:$('goal1').value,goal2:$('goal2').value,goal3:$('goal3').value,note:$('goalNote').value
    }
    );alert(error?error.message:'Đã lưu mục tiêu tuần.');if(!error)await renderGoals()
}
async function sendFeedback() {
    const text=$('feedbackText').value.trim();if(!text)return;const {
        error
    }
    =await sb.from('feedback').insert( {
        student_user_id:currentUser.id,content:text,feedback_type:$('feedbackType').value,is_private:$('feedbackPrivate').checked
    }
    );$('feedbackMsg').textContent=error?error.message:'Đã gửi phản hồi tới GVCN.';if(!error) {
        $('feedbackText').value='';await renderStudentFeedback()
    }
}
async function renderStudentFeedback() {
    const {
        data
    }
    =await sb.from('feedback').select('*').eq('student_user_id',currentUser.id).order('created_at', {
        ascending:false
    }
    );$('studentFeedbackHistory').innerHTML=(data||[]).map(x=>'<div class="notice"><b>'+esc(x.feedback_type||'Phản hồi')+'</b><div>'+esc(x.content)+'</div>'+(x.teacher_reply?'<div class="mini">GVCN: '+esc(x.teacher_reply)+'</div>':'<div class="mini">Đang chờ GVCN phản hồi.</div>')+'</div>').join('')||''
}
async function renderTeacherFeedback() {
    const {
        data,error
    }
    =await sb.from('feedback').select('*').order('created_at', {
        ascending:false
    }
    );if(error) {
        $('feedbackTeacherBox').innerHTML='<div class="mini">'+esc(error.message)+'</div>';return
    }
    const names=new Map(students.map(s=>[s.user_id,s.full_name]));$('feedbackTeacherBox').innerHTML=(data||[]).map(x=>'<div class="notice"><b>'+esc(names.get(x.student_user_id)||'Học sinh')+'</b> · '+esc(x.feedback_type||'Phản hồi')+' · '+new Date(x.created_at).toLocaleString('vi-VN')+'<div>'+esc(x.content)+'</div>'+(x.is_private?'<span class="badge orange">Riêng tư</span> ':'')+(x.teacher_reply?'<div class="mini">Đã trả lời: '+esc(x.teacher_reply)+'</div>':'<button class="btn small" onclick="replyFeedback(\''+x.id+'\')">Trả lời</button>')+'</div>').join('')||'<div class="mini">Chưa có phản hồi.</div>'
}
async function replyFeedback(id) {
    const reply=prompt('Phản hồi cho học sinh:');if(!reply)return;await sb.from('feedback').update( {
        teacher_reply:reply,replied_at:new Date().toISOString()
    }
    ).eq('id',id);await renderTeacherFeedback()
}
async function changePassword() {
    if($('newPass').value.length<6||$('newPass').value!==$('newPass2').value) {
        $('passMsg').textContent='Mật khẩu mới từ 6 ký tự và phải trùng nhau.';return
    }
    const {
        error
    }
    =await sb.auth.updateUser( {
        password:$('newPass').value
    }
    );$('passMsg').textContent=error?error.message:'Đã đổi mật khẩu.'
}
function openModal(title,body) {
    $('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').classList.remove('hidden')
}
function closeModal() {
    $('modal').classList.add('hidden')
}
async function logout() {
    await sb.auth.signOut();location.reload()
}
window.addEventListener('keydown',e=> {
    if(e.key==='Escape')closeModal()
}
);
