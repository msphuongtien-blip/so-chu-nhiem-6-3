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

const APP_VERSION='V5-SUPABASE-DATABASE';
const CONFIG= {
    SUPABASE_URL:'https://fdyhnwklzizzbiyqqlxo.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy'
};
let sb=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY),currentUser=null,currentProfile=null,role='teacher',students=[],classSettings= {
    class_name:'6/3',school_year:'2026-2027',teacher_name:'Phượng Tiên'
},trendChart=null,studentChart=null,randomHistory=JSON.parse(localStorage.getItem('s6r')||'[]');
let supabaseCache= {
    students:[],competitionRecords:[],loadedAt:null
};
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
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
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


async function startSession(user){if(!user)return false;currentUser=user;const p=await sb.from('profiles').select('*').eq('id',user.id).single();if(p.error){await sb.auth.signOut();$('loginMsg').textContent='Tài khoản chưa có hồ sơ trong profiles.';return false}currentProfile=p.data;role=currentProfile.role;$('login').classList.add('hidden');$('app').classList.remove('hidden');setupUI();await loadAll();return true}
async function login() {
    // Lấy vùng hiển thị thông báo đăng nhập.
    const msg = $('loginMsg');

    // Xóa thông báo cũ.
    msg.textContent = '';

    // Giai đoạn 2 chỉ duy trì đăng nhập GVCN bằng Supabase Auth.
    // Đăng nhập học sinh bằng Mã HS sẽ được hoàn thiện ở Giai đoạn 3.
    if (role === 'student') {
        msg.textContent =
            'Đăng nhập học sinh bằng Mã HS sẽ được triển khai ở Giai đoạn 3.';
        return;
    }

    // Đăng nhập GVCN bằng email của tài khoản giáo viên trong Supabase Auth.
    const { data, error } = await sb.auth.signInWithPassword({
        email: $('email').value.trim(),
        password: $('password').value
    });

    // Hiển thị lỗi nếu đăng nhập thất bại.
    if (error) {
        msg.textContent = error.message;
        return;
    }

    // Khởi tạo phiên làm việc sau khi đăng nhập thành công.
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


function showPage(id,btn){document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id)?.classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');const t={dashboard:'Tổng quan',students:'Học sinh & hồ sơ',random:'Gọi tên ngẫu nhiên',attendance:'Điểm danh',competition:'Thi đua – xếp hạng',honors:'Bảng danh dự',discipline:'Nề nếp – kỷ luật',learning:'Nề nếp học tập',teams:'Theo dõi tổ',reports:'Báo cáo',alerts:'Cảnh báo',feedbackTeacher:'Phản hồi học sinh',messagesTeacher:'Tin nhắn',settings:'Cài đặt',sHome:'Trang chủ',sProfile:'Hồ sơ của em',sProgress:'Hành trình tiến bộ',sHonors:'Thành tích của em',sGoals:'Mục tiêu tuần',sFeedback:'Phản hồi',sMessages:'Tin nhắn từ GVCN'};$('pageTitle').textContent=t[id]||id;if(role==='teacher'&&id==='reports')renderReports();if(role==='teacher'&&id==='alerts')renderAlerts();}
async function loadSettings(){const {data}=await sb.from('class_settings').select('*').limit(1).maybeSingle();if(data)classSettings=data;$('classNameView').textContent=classSettings.class_name;$('teacherNameView').textContent=classSettings.teacher_name;$('yearTop').textContent=classSettings.school_year;$('loginYear').textContent=classSettings.school_year;$('classNameInput').value=classSettings.class_name;$('schoolYearInput').value=classSettings.school_year;$('teacherNameInput').value=classSettings.teacher_name}
async function loadAll(){await loadSettings();if(role==='teacher'){await Promise.all([loadStudentsFromSupabase(),loadCompetitionHistoryFromSupabase()]);await renderStudents();await renderDashboard();await renderAttendance();await renderCompetition();await renderHonors();await renderDiscipline();await renderLearning();await renderTeams();await renderAlerts();await renderTeacherFeedback();await renderTeacherMessages()}else await renderStudentAll()}
async function renderStudents(){if(!supabaseCache.students.length) await loadStudentsFromSupabase(); const data=supabaseCache.students;const vnNameKey=n=>{const parts=String(n||'').trim().split(/\s+/);return parts.length?parts[parts.length-1]:''};students=(data||[]).sort((a,b)=>{const ka=vnNameKey(a.full_name),kb=vnNameKey(b.full_name);return ka.localeCompare(kb,'vi',{sensitivity:'base'})||String(a.full_name||'').localeCompare(String(b.full_name||''),'vi',{sensitivity:'base'});});const q=($('studentSearch')?.value||'').toLowerCase();const rows=students.filter(s=>(s.full_name+' '+(s.student_code||'')+' '+(s.team||'')).toLowerCase().includes(q));$('studentBody').innerHTML=rows.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.full_name)+'</b></td><td>'+esc(s.student_code)+'</td><td>'+esc(s.gender||'')+'</td><td>Tổ '+(s.team||'')+'</td><td>'+Number(s.competition_score||0).toFixed(1)+'</td><td>'+groupBadge(s.competition_score)+'</td><td><button class="btn small" onclick=editStudent("'+s.id+'")>Sửa</button></td></tr>').join('')||'<tr><td colspan="8" class="mini">Chưa có học sinh.</td></tr>'}
function group(score){score=Number(score||0);return score>=91?'💎 Kim cương':score>=81?'🥇 Vàng':score>=66?'🥈 Bạc':score>=50?'🥉 Đồng':'🔩 Sắt'}function groupBadge(score){const s=group(score);const c=s.includes('Kim')?'diamond':s.includes('Vàng')?'gold':s.includes('Bạc')?'silver':s.includes('Đồng')?'bronze':'iron';return '<span class="badge '+c+'">'+s+'</span>'}
async function renderDashboard(){const total=students.length;$('mTotal').textContent=total;const avg=total?students.reduce((a,s)=>a+Number(s.competition_score||0),0)/total:0;$('mAvg').textContent=avg.toFixed(1);const care=students.filter(s=>['Cần hỗ trợ','Cần can thiệp'].includes(s.support_level)).length;$('mSupport').textContent=care;const date=localDate();const {data:att}=await sb.from('attendance').select('status').eq('attendance_date',date);const present=(att||[]).filter(x=>x.status==='present').length;$('mPresent').textContent=present;$('mAttendanceSub').textContent=(att||[]).length+' lượt đã ghi';const top=[...students].sort((a,b)=>Number(b.competition_score||0)-Number(a.competition_score||0)).slice(0,5);$('topStudents').innerHTML=top.map((s,i)=>'<div class="notice"><b>'+(i+1)+'. '+esc(s.full_name)+'</b> <span class="badge '+(Number(s.competition_score||0)>=81?'good':'watch')+'">'+Number(s.competition_score||0).toFixed(1)+'</span><div class="mini">'+group(s.competition_score)+'</div></div>').join('')||'<div class="mini">Chưa có dữ liệu.</div>';$('careStudents').innerHTML=students.filter(s=>s.support_level).slice(0,6).map(s=>'<div class="notice '+(s.support_level==='Cần can thiệp'?'danger':'warn')+'"><b>'+esc(s.full_name)+'</b><div class="mini">'+esc(s.support_level)+' · '+esc(s.progress_note||'')+'</div></div>').join('')||'<div class="mini">Chưa có học sinh cần quan tâm.</div>';const ranks=[...students].sort((a,b)=>Number(b.competition_score||0)-Number(a.competition_score||0));$('classRankView').textContent=total?'Theo điểm TB '+avg.toFixed(1):'—';renderTrend(ranks)}
function renderTrend(){const labels=['Tuần 1','Tuần 2','Tuần 3','Tuần 4'];const vals=[0,0,0,0];students.forEach(s=>{const h=s.score_history||[];h.forEach((v,i)=>{if(i<4)vals[i]+=Number(v||0)})});if(trendChart)trendChart.destroy();trendChart=new Chart($('trendChart'),{type:'line',data:{labels,datasets:[{label:'Điểm thi đua',data:vals.map(v=>students.length?v/students.length:0),tension:.35}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}})}
function localDate(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
async function renderAttendance(){const date=$('attendanceDate').value||localDate();$('attendanceDate').value=date;const {data}=await sb.from('attendance').select('*').eq('attendance_date',date);const map=new Map((data||[]).map(x=>[x.student_id,x.status]));$('attendanceBody').innerHTML=students.map((s,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(s.full_name)+'</b></td><td>'+s.team+'</td><td><select class="btn" data-att="'+s.id+'"><option value="present" '+(map.get(s.id)==='present'?'selected':'')+'>Có mặt</option><option value="excused" '+(map.get(s.id)==='excused'?'selected':'')+'>Vắng có phép</option><option value="absent" '+(map.get(s.id)==='absent'?'selected':'')+'>Vắng không phép</option><option value="late" '+(map.get(s.id)==='late'?'selected':'')+'>Đi muộn</option><option value="early_leave" '+(map.get(s.id)==='early_leave'?'selected':'')+'>Về sớm</option></select></td></tr>').join('');const counts={present:0,excused:0,absent:0,late:0,early_leave:0};(data||[]).forEach(x=>counts[x.status]=(counts[x.status]||0)+1);$('attendanceSummary').innerHTML=Object.entries(counts).map(([k,v])=>'<span class="pill">'+attLabel(k)+': <b>'+v+'</b></span>').join('')}
function attLabel(k){return {present:'Có mặt',excused:'Vắng phép',absent:'Vắng không phép',late:'Đi muộn',early_leave:'Về sớm'}[k]||k}
$('attendanceDate').addEventListener('change',renderAttendance);async function saveAttendance(){const date=$('attendanceDate').value;for(const s of students){const el=document.querySelector('[data-att="'+s.id+'"]');if(el)await sb.from('attendance').upsert({student_id:s.id,attendance_date:date,status:el.value,created_by:currentUser.id},{onConflict:'student_id,attendance_date'})}await renderAttendance();await renderDashboard();alert('Đã lưu điểm danh ngày '+date)}
function compWeekStart(value){
  const d=new Date((value||'')+'T00:00:00');
  if(isNaN(d)) return getCurrentWeekStart();
  const day=d.getDay(), diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff); return d.toISOString().slice(0,10);
}
function compWeekInput(){ const el=$('compWeekFilter'); if(el&&!el.value) el.value=getCurrentWeekStart(); return compWeekStart(el?.value); }
function categoryName(id){return ({1:'Giờ giấc – chuyên cần',2:'Nội quy – trật tự',3:'Vệ sinh – môi trường',4:'Tác phong – trang phục',5:'Trách nhiệm – ứng xử'})[String(id)]||'Trách nhiệm – ứng xử'}
function categoryIdFromName(name){const n=String(name||'').toLowerCase(); if(n.includes('đúng giờ')||n.includes('đi muộn')||n.includes('chuyên cần')||n.includes('vắng'))return 1;if(n.includes('trật tự')||n.includes('nội quy'))return 2;if(n.includes('vệ sinh')||n.includes('môi trường'))return 3;if(n.includes('tác phong')||n.includes('trang phục')||n.includes('đồng phục'))return 4;return 5}
function calculateStudentWeek(studentId,week){const rows=supabaseCache.competitionRecords.filter(r=>r.student_id===studentId);const weeks=[...new Set(rows.map(r=>r.week).filter(Boolean))].sort();let start=81,target=compWeekStart(week);for(const w of weeks){if(w>target)break;const total=rows.filter(r=>r.week===w).reduce((a,r)=>a+Number(r.score||0),0);const end=Math.max(0,Math.min(100,start+total));if(w===target)return end;start=end>=91?91:end>=81?81:end>=66?71:end>=50?61:51;}return 81;}
function calculateStudentMonth(studentId,week){const d=new Date(week+'T00:00:00'),start=new Date(d.getFullYear(),d.getMonth(),1),next=new Date(d.getFullYear(),d.getMonth()+1,1),ss=start.toISOString().slice(0,10),nn=next.toISOString().slice(0,10);const data=supabaseCache.competitionRecords.filter(r=>r.student_id===studentId&&String(r.date||'')>=ss&&String(r.date||'')<nn);return Math.max(0,Math.min(100,81+data.reduce((a,r)=>a+Number(r.score||0),0)));}
async function renderCompetition(){
  const week=compWeekInput();

  /* Không phụ thuộc vào mảng students đã được tải ở bước trước.
     Đọc trực tiếp 44 HS + toàn bộ lịch sử trong một lượt để tránh
     44 request tuần tự làm bảng không render/timeout. */
  const studentRows=supabaseCache.students; const studentError=null;

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

  if($('compStudentFilter')){
    const old=$('compStudentFilter').value||'';
    $('compStudentFilter').innerHTML='<option value="">Tất cả học sinh</option>'+
      allStudents.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('');
    $('compStudentFilter').value=old;
  }

  const sf=$('compStudentFilter')?.value||'';
  const gf=$('compGroupFilter')?.value||'';

  /* Lấy toàn bộ lịch sử một lần. Đây là Source of Truth cho xếp hạng. */
  const history=supabaseCache.competitionRecords; const historyError=null;

  if(historyError){
    console.error('Thi đua - không tải được lịch sử:',historyError);
  }

  const records=history||[];

  /* Tính điểm tuần theo chuỗi rollover từ lịch sử, không cộng bù vào điểm tổng. */
  const weeklyCache={};
  function calcWeek(studentId,targetWeek){
    const key=studentId+'|'+targetWeek;
    if(weeklyCache[key]!==undefined)return weeklyCache[key];

    const rows=records
      .filter(r=>r.student_id===studentId && r.week)
      .sort((a,b)=>String(a.week).localeCompare(String(b.week)));

    const weeks=[...new Set(rows.map(r=>String(r.week)))];
    let start=81;
    let result=81;

    if(weeks.length){
      for(const w of weeks){
        if(w>targetWeek)break;
        const total=rows.filter(r=>String(r.week)===w)
          .reduce((sum,r)=>sum+Number(r.score||0),0);
        result=Math.max(0,Math.min(100,start+total));
        if(w===targetWeek){
          weeklyCache[key]=result;
          return result;
        }
        start=result>=91?91:result>=81?81:result>=66?71:result>=50?61:51;
      }
    }

    weeklyCache[key]=targetWeek>=getCurrentWeekStart() ? start : result;
    return weeklyCache[key];
  }

  function calcMonth(studentId,targetWeek){
    const d=new Date(targetWeek+'T00:00:00');
    const start=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
    const nextDate=new Date(d.getFullYear(),d.getMonth()+1,1);
    const next=nextDate.getFullYear()+'-'+String(nextDate.getMonth()+1).padStart(2,'0')+'-01';
    const total=records
      .filter(r=>r.student_id===studentId && String(r.date||'')>=start && String(r.date||'')<next)
      .reduce((sum,r)=>sum+Number(r.score||0),0);
    return Math.max(0,Math.min(100,81+total));
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
      const selected=sf&&s.id===sf?' style="background:#eff6ff"':'';
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

  const selectedRank=sf?rows.findIndex(x=>x.id===sf)+1:null;
  if($('compRank'))$('compRank').textContent=selectedRank||'—';
  if($('compAvg'))$('compAvg').textContent=rows.length
    ?(rows.reduce((sum,s)=>sum+s.weekly,0)/rows.length).toFixed(1)
    :'81.0';

  /* LỊCH SỬ: độc lập với bảng xếp hạng. */
  const filtered=records.filter(x=>
    (!week||String(x.week||x.week_start||'')===String(week)) &&
    (!sf||x.student_id===sf) &&
    (!gf||String(x.category_id)===String(gf))
  );

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
    openModal('Sửa bản ghi thi đua','<div class="field"><label>Học sinh</label><select id="eStudent">'+students.map(s=>'<option value="'+s.id+'" '+(s.id===r.student_id?'selected':'')+'>'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Tuần</label><input id="eWeek" type="date" value="'+esc(r.week||r.week_start||getCurrentWeekStart())+'"></div><div class="field"><label>Ngày</label><input id="eDate" type="date" value="'+esc(r.date||String(r.created_at||'').slice(0,10))+'"></div><div class="field"><label>Nhóm tiêu chí</label><select id="eGroup">'+[1,2,3,4,5].map(i=>'<option value="'+i+'" '+(Number(r.category_id||5)===i?'selected':'')+'>'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Tiêu chí</label><select id="eCriteria">'+(criteria||[]).map(c=>'<option value="'+c.name+'" '+(c.name===r.criteria?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></div><div class="field"><label>Điểm</label><select id="ePoints">'+[-5,-4,-3,-2,-1,1,2,3,4,5].map(v=>'<option value="'+v+'" '+(Number(r.score||r.points)===v?'selected':'')+'>'+((v>0?'+':'')+v)+'</option>').join('')+'</select></div><div class="field"><label>Ghi chú</label><textarea id="eNote" rows="4">'+esc(r.note||'')+'</textarea></div><div class="actions"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="deleteCompetitionRecord(\''+r.id+'\')">Xóa</button><button class="btn primary" onclick="saveEditedCompetition(\''+r.id+'\')">Sửa</button></div>');
}
async function saveEditedCompetition(id) {
    const valid=[-5,-4,-3,-2,-1,1,2,3,4,5], points=Number($('ePoints').value), newStudent=$('eStudent').value; if(!valid.includes(points))return alert('Điểm không hợp lệ.');
    const payload= {
        student_id:newStudent,week:compWeekStart($('eWeek').value),week_start:compWeekStart($('eWeek').value),date:$('eDate').value,category_id:Number($('eGroup').value),criteria:$('eCriteria').value,score:points,points:points,note:$('eNote').value.trim()
    };
    const {
        error
    }
    =await sb.from('competition_records').update(payload).eq('id',id); if(error)return alert('Không thể sửa: '+error.message); closeModal(); await renderStudents(); await renderCompetition(); await renderDashboard();
}
async function deleteCompetitionRecord(id) {
    if(!confirm('Xóa bản ghi này? Ghi chú và điểm của bản ghi sẽ bị xóa khỏi lịch sử, sau đó điểm sẽ được tính lại từ lịch sử còn lại.'))return; const {
        error
    }
    =await sb.from('competition_records').delete().eq('id',id); if(error)return alert('Không thể xóa: '+error.message); closeModal(); await renderStudents(); await renderCompetition(); await renderDashboard();
}
async function rolloverCompetitionWeek() {
    if(role!=='teacher')return; const {
        error
    }
    =await sb.rpc('rollover_competition_week'); if(error)console.warn(error.message);
}
function getCurrentWeekStart() {
    const d=new Date();const day=d.getDay(),diff=day===0?-6:1-day;d.setDate(d.getDate()+diff);return d.toISOString().slice(0,10)
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
        if(!data)return;openModal('Điều chỉnh tiêu chí thi đua','<div class="field"><label>Tên tiêu chí</label><input id="crName" value="'+esc(data.name)+'"></div><div class="field"><label>Nhóm tiêu chí</label><select id="crGroup">'+[1,2,3,4,5].map(i=>'<option value="'+i+'" '+(String(data.group_name||5)===String(i)?'selected':'')+'>'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Mức điểm mặc định</label><select id="crPoints">'+scoreOptions(Number(data.points)*(data.type==='minus'?-1:1))+'</select></div><button class="btn primary" onclick="saveCriteria(\''+id+'\')">Lưu</button>')
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
    openModal('Thêm tiêu chí thi đua','<div class="field"><label>Tên tiêu chí</label><input id="crName"></div><div class="field"><label>Nhóm tiêu chí</label><select id="crGroup">'+[1,2,3,4,5].map(i=>'<option value="'+i+'">'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Mức điểm mặc định</label><select id="crPoints">'+scoreOptions(1)+'</select></div><button class="btn primary" onclick="createCriteria()">Thêm</button>')
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
        const groups=[1,2,3,4,5],gm= {
        };(data||[]).forEach(c=>(gm[c.group_name||5]??=[]).push(c));const gh=groups.map(id=>'<div class="criteria-group"><h4>Nhóm '+id+': '+categoryName(id)+'</h4><div class="criteria-items">'+((gm[id]||[]).map(c=>'<span class="criteria-chip">'+esc(c.name)+'</span>').join('')||'<span class="mini">Chưa có tiêu chí.</span>')+'</div></div>').join('');openModal('Ghi nhận thi đua','<div class="field"><label>Học sinh</label><select id="fStudent">'+students.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Tuần</label><input id="fWeek" type="date" value="'+getCurrentWeekStart()+'"></div><div class="field"><label>Ngày</label><input id="fDate" type="date" value="'+localDate()+'"></div>'+gh+'<div class="field"><label>Nhóm tiêu chí</label><select id="fGroup" onchange="filterCriteriaByGroup()">'+groups.map(i=>'<option value="'+i+'">'+i+'. '+categoryName(i)+'</option>').join('')+'</select></div><div class="field"><label>Tiêu chí</label><select id="fCriteria">'+(data||[]).map(c=>'<option value="'+c.id+'" data-group="'+(c.group_name||5)+'">'+esc(c.name)+'</option>').join('')+'</select></div><div class="field"><label>Điểm</label><select id="fPoints">'+scoreOptions(1)+'</select></div><div class="field"><label>📝 Ghi chú</label><textarea id="fNote" rows="4" placeholder="Lỗi vi phạm, hành vi tích cực, khen thưởng hoặc nhận xét..."></textarea></div><div class="actions"><button class="btn primary" onclick="submitCompetition()">Lưu</button></div>');filterCriteriaByGroup();
    }
    )
}
function filterCriteriaByGroup() {
    const g=$('fGroup')?.value;if(!g)return;const sel=$('fCriteria');[...sel.options].forEach(o=>o.hidden=String(o.dataset.group)!==String(g));const first=[...sel.options].find(o=>!o.hidden);if(first)sel.value=first.value
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
async function renderDiscipline() {
    const {
        data
    }
    =await sb.from('discipline_records').select('*,students(full_name,student_code)').order('created_at', {
        ascending:false
    }
    ).limit(100);const counts= {
        gio:'0',vesinh:'0',trattu:'0',tacphong:'0'
    };(data||[]).forEach(x=>counts[x.category]=(Number(counts[x.category]||0)+1));$('disciplineStats').innerHTML=Object.entries( {
        gio:'Giờ giấc',vesinh:'Vệ sinh',trattu:'Trật tự',tacphong:'Tác phong'
    }
    ).map(([k,v])=>'<span class="pill">'+v+': <b>'+counts[k]+'</b></span>').join('');$('disciplineList').innerHTML=(data||[]).map(x=>'<div class="notice '+(x.level==='Cần hỗ trợ'?'danger':'')+'"><b>'+esc(x.students?.full_name||'')+'</b> · '+esc(x.category_label||x.category)+' · '+esc(x.item||'')+' · '+esc(x.level)+'<div class="mini">'+new Date(x.created_at).toLocaleString('vi-VN')+'</div></div>').join('')||'<div class="mini">Chưa có ghi nhận.</div>'
}
function openDisciplineForm() {
    openModal('Ghi nhận nề nếp','<div class="field"><label>Học sinh</label><select id="dStudent">'+students.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Nhóm</label><select id="dCat"><option value="gio">Giờ giấc</option><option value="vesinh">Vệ sinh</option><option value="trattu">Trật tự</option><option value="tacphong">Tác phong</option></select></div><div class="field"><label>Nội dung</label><input id="dItem"></div><div class="field"><label>Mức</label><select id="dLevel"><option>Tốt</option><option>Nhắc nhở</option><option>Cần hỗ trợ</option><option>Cần can thiệp</option></select></div><button class="btn primary" onclick="submitDiscipline()">Lưu</button>')
}
async function submitDiscipline() {
    const labels= {
        gio:'Giờ giấc',vesinh:'Vệ sinh',trattu:'Trật tự',tacphong:'Tác phong'
    };await sb.from('discipline_records').insert( {
        student_id:$('dStudent').value,category:$('dCat').value,category_label:labels[$('dCat').value],item:$('dItem').value,level:$('dLevel').value,created_by:currentUser.id
    }
    );closeModal();await renderDiscipline();await renderAlerts()
}
async function renderLearning() {
    const {
        data
    }
    =await sb.from('learning_records').select('*,students(full_name,student_code)').order('created_at', {
        ascending:false
    }
    ).limit(150);$('learningList').innerHTML=(data||[]).map(x=>'<div class="notice"><b>'+esc(x.students?.full_name||'')+'</b> · '+esc(x.subject||'')+' · '+esc(x.status||'')+' · '+esc(x.score||'')+'<div>'+esc(x.note||'')+'</div><div class="mini">'+new Date(x.created_at).toLocaleString('vi-VN')+'</div></div>').join('')||'<div class="mini">Chưa có dữ liệu học tập.</div>'
}
function openLearningForm() {
    openModal('Cập nhật nề nếp học tập','<div class="field"><label>Học sinh</label><select id="lStudent">'+students.map(s=>'<option value="'+s.id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Môn học</label><input id="lSubject" placeholder="KHTN, Toán,..."></div><div class="field"><label>Nội dung</label><select id="lStatus"><option>Hoàn thành nhiệm vụ</option><option>Chưa hoàn thành nhiệm vụ</option><option>Chuẩn bị bài tốt</option><option>Thiếu sách vở/đồ dùng</option><option>Tích cực phát biểu</option><option>Kết quả giảm sút</option><option>Cần giáo viên hỗ trợ</option></select></div><div class="field"><label>Điểm/đánh giá</label><input id="lScore"></div><div class="field"><label>Nhận xét</label><textarea id="lNote" rows="3"></textarea></div><button class="btn primary" onclick="submitLearning()">Lưu</button>')
}
async function submitLearning() {
    await sb.from('learning_records').insert( {
        student_id:$('lStudent').value,subject:$('lSubject').value,status:$('lStatus').value,score:$('lScore').value,note:$('lNote').value,created_by:currentUser.id
    }
    );closeModal();await renderLearning();await renderAlerts()
}
async function renderTeams() {
    const arr=[1,2,3,4].map(t=> {
        const a=students.filter(s=>Number(s.team)===t);return {
            team:t,n:a.length,avg:a.length?a.reduce((x,s)=>x+Number(s.competition_score||0),0)/a.length:0
        }
    }
    ).sort((a,b)=>b.avg-a.avg);$('teamBody').innerHTML=arr.map((x,i)=>'<tr><td>'+((i+1))+'</td><td>Tổ '+x.team+'</td><td>'+x.avg.toFixed(1)+'</td><td>'+x.n+'</td><td>—</td></tr>').join('');$('teamCards').innerHTML=arr.map((x,i)=>'<div class="card"><div class="label">Hạng '+(i+1)+'</div><div class="metric">Tổ '+x.team+'</div><div class="mini">Điểm TB '+x.avg.toFixed(1)+' · '+x.n+' HS</div></div>').join('')
}
async function renderAlerts() {
    const by= {
    };students.forEach(s=>by[s.id]=[]);const [d,l]=await Promise.all([sb.from('discipline_records').select('student_id,level,created_at'),sb.from('learning_records').select('student_id,status,created_at')]);(d.data||[]).forEach(x=>by[x.student_id]?.push(x.level));(l.data||[]).forEach(x=>by[x.student_id]?.push(x.status));const alerts=students.map(s=> {
        const a=by[s.id]||[];const severe=a.filter(x=>['Cần can thiệp','Kết quả giảm sút','Cần giáo viên hỗ trợ'].includes(x)).length;const warn=a.filter(x=>['Nhắc nhở','Chưa hoàn thành nhiệm vụ','Thiếu sách vở/đồ dùng'].includes(x)).length;return {
            ...s,severe,warn
        }
    }
    ).filter(s=>s.severe||s.warn||s.support_level);$('alertsBox').innerHTML=alerts.map(s=> {
        const level=s.severe>=2?'Cần can thiệp':s.severe||s.support_level==='Cần hỗ trợ'?'Cần hỗ trợ':'Cần theo dõi';const c=level==='Cần can thiệp'?'danger':level==='Cần hỗ trợ'?'orange':'watch';return '<div class="notice '+c+'"><b>'+esc(s.full_name)+'</b> <span class="badge '+c+'">'+level+'</span><div class="mini">'+s.severe+' tín hiệu nghiêm trọng · '+s.warn+' tín hiệu theo dõi</div></div>'
    }
    ).join('')||'<div class="mini">Chưa có cảnh báo.</div>'
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
function openStudentForm(student) {
    // Xác định form đang dùng để thêm mới hay chỉnh sửa.
    const isEdit = Boolean(student);

    // Tạo form chỉ chứa thông tin hồ sơ cần thiết.
    // Email, ngày sinh và dữ liệu phụ huynh đã được loại bỏ ở Phase 2.
    openModal(
        isEdit ? 'Chỉnh sửa học sinh' : 'Thêm học sinh',
        '<div class="grid two">' +
        '<div class="field"><label>Họ tên</label>' +
        '<input id="sfName" value="' +
        esc(student?.full_name || '') +
        '"></div>' +
        '<div class="field"><label>Mã HS</label>' +
        '<input id="sfCode" value="' +
        esc(student?.student_code || '') +
        '" inputmode="numeric" maxlength="4"></div>' +
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
        '<option ' + (!student?.support_level ? 'selected' : '') + '>Không</option>' +
        '<option ' + (student?.support_level === 'Theo dõi' ? 'selected' : '') + '>Theo dõi</option>' +
        '<option ' + (student?.support_level === 'Cần hỗ trợ' ? 'selected' : '') + '>Cần hỗ trợ</option>' +
        '<option ' + (student?.support_level === 'Cần can thiệp' ? 'selected' : '') + '>Cần can thiệp</option>' +
        '</select></div>' +
        '<div class="field"><label>Ghi chú đặc biệt</label>' +
        '<textarea id="sfNote" rows="3">' +
        esc(student?.special_note || '') +
        '</textarea></div>' + +
        '<div class="field"><label>Ghi chú tiến bộ</label>' +
        '<textarea id="sfProgress" rows="3">' +
        esc(student?.progress_note || '') +
        '</textarea></div>' +
        '<button class="btn primary" onclick="saveStudent(' +
        (isEdit ? "'" + student.id + "'" : 'null') +
        ')">Lưu học sinh</button>'
    );
}


async function saveStudent(id) {
    // Thu thập dữ liệu hồ sơ từ form.
    const payload = {
        full_name: $('sfName').value.trim(),
        student_code: $('sfCode').value.trim() || null,
        gender: $('sfGender').value,
        team: Number($('sfTeam').value) || null,
        support_level:
            $('sfSupport').value === 'Không'
                ? ''
                : $('sfSupport').value,
        special_note: $('sfNote').value.trim(),
        progress_note: $('sfProgress').value.trim()
    };

    // Kiểm tra thông tin bắt buộc.
    if (!payload.full_name || !payload.student_code) {
        alert('Cần họ tên và mã HS.');
        return;
    }

    // Mã học sinh phải là đúng 4 chữ số.
    if (!/^\d{4}$/.test(payload.student_code)) {
        alert('Mã HS phải gồm 4 chữ số, ví dụ 6301.');
        return;
    }

    // Nếu đang chỉnh sửa, cập nhật đúng một học sinh theo id.
    if (id) {
        const { error } = await sb
            .from('students')
            .update(payload)
            .eq('id', id);

        // Dừng nếu database trả lỗi.
        if (error) {
            alert(error.message);
            return;
        }
    } else {
        // Giai đoạn 2 chỉ tạo hồ sơ học sinh.
        // Việc cấp tài khoản đăng nhập bằng Mã HS thuộc Giai đoạn 3.
        const { error } = await sb
            .from('students')
            .insert(payload);

        // Dừng nếu database trả lỗi.
        if (error) {
            alert(error.message);
            return;
        }
    }

    // Đóng modal sau khi lưu thành công.
    closeModal();

    // Đọc lại dữ liệu để giao diện đồng bộ với Supabase.
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
    =await sb.from('students').select('*').eq('user_id',currentUser.id).single();if(!s)return;window.me=s;$('studentAvatar').textContent=s.full_name.slice(0,1).toUpperCase();$('sProfileName').textContent=s.full_name;$('sProfileMeta').textContent='Lớp '+classSettings.class_name+' · Tổ '+(s.team||'—')+' · GVCN '+classSettings.teacher_name;$('studentHomeBox').innerHTML='<div class="studenthero"><div class="bigavatar">'+esc(s.full_name.slice(0,1))+'</div><div><h2>Chào '+esc(s.full_name)+'!</h2><p class="mutedline">Mỗi ngày một tiến bộ – Mỗi tuần một thành tích!</p></div></div><div class="grid cards section"><div><div class="label">Điểm thi đua</div><div class="metric">'+Number(s.competition_score||0).toFixed(1)+'</div></div><div><div class="label">Nhóm</div><div class="metric">'+group(s.competition_score)+'</div></div><div><div class="label">Chuyên cần</div><div class="metric">'+Number(s.attendance_percent||0).toFixed(1)+'%</div></div><div><div class="label">Hỗ trợ</div><div class="metric">'+esc(s.support_level||'Tốt')+'</div></div></div>';$('sProfileBox').innerHTML='<div class="grid two"><div><p><b>Họ tên:</b> '+esc(s.full_name)+'</p><p><b>Mã học sinh:</b> '+esc(s.student_code||'')+'</p></div><div><p><b>Tổ:</b> '+(s.team||'')+'</p><p><b>GVCN:</b> '+esc(classSettings.teacher_name)+'</p><p><b>Chuyên cần:</b> '+Number(s.attendance_percent||0).toFixed(1)+'%</p><p><b>Huy hiệu:</b> '+Number(s.badge_count||0)+'</p></div></div>';$('spScore').textContent=Number(s.competition_score||0).toFixed(1);$('spAttendance').textContent=Number(s.attendance_percent||0).toFixed(1)+'%';const [d,l]=await Promise.all([sb.from('discipline_records').select('*').eq('student_id',s.id),sb.from('learning_records').select('*').eq('student_id',s.id)]);$('spDiscipline').textContent=(d.data||[]).length?'Có '+d.data.length+' ghi nhận':'Tốt';$('spLearning').textContent=(l.data||[]).length?'Có '+l.data.length+' ghi nhận':'Tốt';if(studentChart)studentChart.destroy();studentChart=new Chart($('studentChart'), {
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
    );await renderStudentHonors(s.id);await renderGoals();await renderStudentFeedback();await renderStudentMessages()
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
async function renderTeacherMessages() {
    const {
        data
    }
    =await sb.from('teacher_messages').select('*').order('created_at', {
        ascending:false
    }
    );$('messagesTeacherBox').innerHTML=(data||[]).map(x=>'<div class="notice"><b>'+esc(x.title)+'</b> · '+esc(x.target_type)+'<div>'+esc(x.content)+'</div><div class="mini">'+new Date(x.created_at).toLocaleString('vi-VN')+'</div></div>').join('')||'<div class="mini">Chưa có tin nhắn.</div>'
}
function openMessageForm() {
    openModal('Gửi tin nhắn cho học sinh','<div class="field"><label>Đối tượng</label><select id="msgTarget"><option value="all">Toàn lớp</option><option value="student">Một học sinh</option></select></div><div class="field" id="msgStudentField"><label>Học sinh</label><select id="msgStudent">'+students.map(s=>'<option value="'+s.user_id+'">'+esc(s.full_name)+'</option>').join('')+'</select></div><div class="field"><label>Tiêu đề</label><input id="msgTitle"></div><div class="field"><label>Nội dung</label><textarea id="msgContent" rows="4"></textarea></div><button class="btn primary" onclick="sendTeacherMessage()">Gửi</button>');$('msgTarget').onchange=()=> {
        $('msgStudentField').style.display=$('msgTarget').value==='student'?'block':'none'
    };$('msgStudentField').style.display='none'
}
async function sendTeacherMessage() {
    await sb.from('teacher_messages').insert( {
        teacher_id:currentUser.id,target_type:$('msgTarget').value,target_user_id:$('msgTarget').value==='student'?$('msgStudent').value:null,title:$('msgTitle').value,content:$('msgContent').value
    }
    );closeModal();await renderTeacherMessages()
}
async function renderStudentMessages() {
    const {
        data
    }
    =await sb.from('teacher_messages').select('*').order('created_at', {
        ascending:false
    }
    );$('studentMessages').innerHTML=(data||[]).filter(x=>x.target_type==='all'||x.target_user_id===currentUser.id).map(x=>'<div class="notice"><b>'+esc(x.title)+'</b><div>'+esc(x.content)+'</div><div class="mini">'+new Date(x.created_at).toLocaleString('vi-VN')+'</div></div>').join('')||'<div class="mini">Chưa có tin nhắn.</div>'
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
