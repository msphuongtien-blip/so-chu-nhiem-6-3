const SUPABASE_URL = "https://fdyhnwklzizzbiyqqlxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = { user:null, profile:null, students:[], attendance:[], learning:[], discipline:[], feedback:[], competition:[], view:"dashboard" };

const $ = (s) => document.querySelector(s);
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today = () => new Date().toISOString().slice(0,10);

function toast(msg){ const el=document.createElement("div"); el.className="toast"; el.textContent=msg; $("#toast-root").appendChild(el); setTimeout(()=>el.remove(),2800); }
function fmtDate(v){ if(!v) return "—"; return new Date(v+"T00:00:00").toLocaleDateString("vi-VN"); }
function badge(text, type="neutral"){ return `<span class="badge ${type}">${esc(text)}</span>`; }
function statusBadge(s){ const m={present:["Có mặt","good"],late:["Đi trễ","warn"],absent:["Vắng","bad"],excused:["Có phép","neutral"]}; const x=m[s]||[s,"neutral"]; return badge(x[0],x[1]); }

async function loadData(){
  const queries = await Promise.all([
    sb.from("profiles").select("*").eq("id",state.user.id).maybeSingle(),
    sb.from("students").select("*").order("full_name"),
    sb.from("attendance").select("*").order("attendance_date",{ascending:false}),
    sb.from("learning_records").select("*").order("created_at",{ascending:false}),
    sb.from("discipline_records").select("*").order("created_at",{ascending:false}),
    sb.from("feedback").select("*").order("created_at",{ascending:false}),
    sb.from("competition_records").select("*").order("created_at",{ascending:false})
  ]);
  const [p,st,a,l,d,f,c]=queries;
  if(p.error) console.warn(p.error);
  if(st.error) throw st.error;
  state.profile=p.data; state.students=st.data||[]; state.attendance=a.data||[]; state.learning=l.data||[]; state.discipline=d.data||[]; state.feedback=f.data||[]; state.competition=c.data||[];
  $("#user-name").textContent=state.profile?.full_name || "GVCN";
  $("#user-email").textContent=state.user.email || "";
  render();
}

function render(){
  const titles={dashboard:"Tổng quan lớp 6/3",students:"Danh sách học sinh",attendance:"Điểm danh",learning:"Theo dõi học tập",discipline:"Nề nếp & kỷ luật",competition:"Thi đua",feedback:"Phản hồi"};
  $("#page-title").textContent=titles[state.view];
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  const views={dashboard:renderDashboard,students:renderStudents,attendance:renderAttendance,learning:renderLearning,discipline:renderDiscipline,competition:renderCompetition,feedback:renderFeedback};
  $("#view-root").innerHTML=views[state.view]();
  bindViewEvents();
}

function renderDashboard(){
  const n=state.students.length;
  const presentToday=state.attendance.filter(x=>x.attendance_date===today()&&x.status==="present").length;
  const absentToday=state.attendance.filter(x=>x.attendance_date===today()&&x.status==="absent").length;
  const needsSupport=state.students.filter(x=>x.support_level&&x.support_level!=="none").length;
  const avg=state.students.length ? (state.students.reduce((s,x)=>s+Number(x.competition_score||0),0)/n).toFixed(1):"0.0";
  const recent=state.discipline.slice(0,5);
  return `<div class="grid grid-4">
    <div class="card stat"><div><div class="label">Sĩ số</div><div class="value">${n}</div><div class="hint">Học sinh trong lớp</div></div></div>
    <div class="card stat"><div><div class="label">Có mặt hôm nay</div><div class="value">${presentToday}</div><div class="hint">${absentToday} học sinh vắng</div></div></div>
    <div class="card stat"><div><div class="label">Cần hỗ trợ</div><div class="value">${needsSupport}</div><div class="hint">Theo hồ sơ học sinh</div></div></div>
    <div class="card stat"><div><div class="label">Điểm thi đua TB</div><div class="value">${avg}</div><div class="hint">Theo dữ liệu hiện có</div></div></div>
  </div>
  <div class="grid grid-2" style="margin-top:18px">
    <div class="card"><div class="toolbar"><h3>Tình hình lớp</h3><button class="ghost" data-go="students">Xem học sinh</button></div>
      ${state.students.slice(0,8).map(s=>`<div style="margin:13px 0"><div class="toolbar" style="margin:0 0 6px"><span>${esc(s.full_name)}</span><span class="tiny">${Number(s.attendance_percent||0).toFixed(0)}% chuyên cần</span></div><div class="progress"><span style="width:${Number(s.attendance_percent||0)}%"></span></div></div>`).join("")}
    </div>
    <div class="card"><div class="toolbar"><h3>Ghi nhận nề nếp gần đây</h3><button class="ghost" data-go="discipline">Xem tất cả</button></div>
      ${recent.map(r=>`<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="toolbar" style="margin:0"><strong>${esc(state.students.find(s=>s.id===r.student_id)?.full_name||"—")}</strong></div><div class="tiny muted">${fmtDate(r.created_at)} · ${esc(r.level)}</div><div style="margin-top:6px">${esc(r.content)}</div></div>`).join("")}
    </div>
  </div>`;
}

function renderStudents(){
  return `<div class="card"><div class="toolbar"><div class="toolbar-left"><input id="student-search" class="search" placeholder="Tìm theo tên, mã học sinh..."></div><div class="toolbar-right"><button id="add-student" class="primary">+ Thêm học sinh</button></div></div></div>
  <div class="table-wrap"><table><thead><tr><th>Họ và tên</th><th>Mã HS</th><th>Tổ</th><th>Chuyên cần</th><th>Thi đua</th><th>Hỗ trợ</th></tr></thead><tbody id="student-rows">${studentRows(state.students)}</tbody></table></div>`;
}
function studentRows(list){ return list.length ? list.map(s=>`<tr><td><strong>${esc(s.full_name)}</strong><div class="tiny muted">${esc(s.email)}</div></td><td>${esc(s.student_code||"—")}</td><td>${esc(s.group||"—")}</td><td>${Number(s.attendance_percent||0).toFixed(0)}%</td><td>${s.competition_score||"—"}</td><td>${badge(s.support_level||"Không",s.support_level==="high"?"danger":s.support_level==="medium"?"warn":"good")}</td></tr>`).join(""):"<tr><td class=empty colspan=6>Không có dữ liệu</td></tr>"; }

function renderAttendance(){
  const d=today();
  const records=state.attendance.filter(x=>x.attendance_date===d);
  return `<div class="card"><div class="toolbar"><div><h3>Điểm danh ngày ${fmtDate(d)}</h3><div class="tiny muted">Cập nhật trạng thái cho từng học sinh.</div></div><button id="save-attendance" class="primary">Lưu điểm danh</button></div></div>
  <div class="table-wrap"><table><thead><tr><th>Học sinh</th><th>Trạng thái</th></tr></thead><tbody>${state.students.map(s=>{
    const r=records.find(x=>x.student_id===s.id);
    return `<tr><td>${esc(s.full_name)}</td><td><select class="att-select" data-student="${s.id}">${["present","late","absent","excused"].map(v=>`<option value="${v}" ${r?.status===v?"selected":""}>${["Có mặt","Đi trễ","Vắng","Có phép"][["present","late","absent","excused"].indexOf(v)]}</option>`).join("")}</select></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderLearning(){
  return `<div class="card"><div class="toolbar"><div><h3>Hồ sơ học tập</h3><div class="tiny muted">${state.learning.length} lượt ghi nhận</div></div><button id="add-learning" class="primary">+ Thêm ghi nhận</button></div></div>
  <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học sinh</th><th>Môn</th><th>Điểm</th><th>Nhận xét</th></tr></thead><tbody>${state.learning.length?state.learning.map(r=>`<tr><td>${fmtDate(r.created_at)}</td><td>${esc(state.students.find(s=>s.id===r.student_id)?.full_name||"—")}</td><td>${esc(r.subject)}</td><td>${r.score}</td><td>${esc(r.note||"—")}</td></tr>`).join(""):"<tr><td class=empty colspan=5>Không có ghi nhận nào</td></tr>"}</tbody></table></div>`;
}

function renderDiscipline(){
  return `<div class="card"><div class="toolbar"><div><h3>Nề nếp & kỷ luật</h3><div class="tiny muted">${state.discipline.length} ghi nhận</div></div><button id="add-discipline" class="primary">+ Thêm ghi nhận</button></div></div>
  <div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Học sinh</th><th>Mức độ</th><th>Nội dung</th></tr></thead><tbody>${state.discipline.length?state.discipline.map(r=>`<tr><td>${fmtDate(r.created_at)}</td><td>${esc(state.students.find(s=>s.id===r.student_id)?.full_name||"—")}</td><td>${badge(r.level)}</td><td>${esc(r.content)}</td></tr>`).join(""):"<tr><td class=empty colspan=4>Không có ghi nhận nào</td></tr>"}</tbody></table></div>`;
}

function renderCompetition(){
  return `<div class="card"><div class="toolbar"><div><h3>Thi đua - Điểm tích luỹ</h3><div class="tiny muted">${state.competition.length} ghi nhận</div></div><button id="add-competition" class="primary">+ Thêm điểm</button></div></div>
  <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học sinh</th><th>Điểm</th><th>Lý do</th><th>Ghi chú</th></tr></thead><tbody>${state.competition.length?state.competition.map(r=>`<tr><td>${fmtDate(r.record_date)}</td><td><strong>${esc(state.students.find(s=>s.id===r.student_id)?.full_name||"—")}</strong></td><td><strong>${r.points>0?"+":""} ${r.points}</strong></td><td>${esc(r.reason||"—")}</td><td>${esc(r.note||"—")}</td></tr>`).join(""):"<tr><td class=empty colspan=5>Chưa có ghi nhận nào. Thêm điểm thi đua cho học sinh.</td></tr>"}</tbody></table></div>`;
}

function renderFeedback(){
  return `<div class="card"><div class="toolbar"><div><h3>Phản hồi</h3><div class="tiny muted">Trao đổi giữa học sinh và giáo viên chủ nhiệm.</div></div></div>
  <div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Nội dung</th><th>Riêng tư</th><th>Phản hồi của GVCN</th></tr></thead><tbody>${state.feedback.length?state.feedback.map(r=>`<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.content.substring(0,50))}</td><td>${badge(r.is_private?"Có":"Không","neutral")}</td><td>${esc(r.teacher_response||"Chưa phản hồi")}</td></tr>`).join(""):"<tr><td class=empty colspan=4>Không có phản hồi nào</td></tr>"}</tbody></table></div>`;
}

function bindViewEvents(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{state.view=b.dataset.go;render()});
  $("#student-search")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#student-rows").innerHTML=studentRows(state.students.filter(s=>(s.full_name+" "+(s.student_code||"")).toLowerCase().includes(q)))});
  $("#add-student")?.addEventListener("click",()=>openStudentModal());
  $("#save-attendance")?.addEventListener("click",saveAttendance);
  $("#add-learning")?.addEventListener("click",()=>openLearningModal());
  $("#add-discipline")?.addEventListener("click",()=>openDisciplineModal());
  $("#add-competition")?.addEventListener("click",()=>openCompetitionModal());
}

async function saveAttendance(){
  const rows=[...document.querySelectorAll(".att-select")];
  const payload=rows.map(x=>({student_id:x.dataset.student,attendance_date:today(),status:x.value,created_by:state.user.id}));
  const {error}=await sb.from("attendance").upsert(payload,{onConflict:"student_id,attendance_date"});
  if(error){toast("Không lưu được điểm danh: "+error.message);return}
  toast("Đã lưu điểm danh"); await loadData();
}

function modal(title,body,onSave){
  const back=document.createElement("div");back.className="modal-backdrop";
  back.innerHTML=`<div class="modal"><div class="modal-head"><h3>${title}</h3><button class="icon-button close-modal">×</button></div>${body}<div class="modal-actions"><button class="ghost close-modal">Hủy</button><button class="primary save-modal">Lưu</button></div></div>`;
  document.body.appendChild(back);back.querySelectorAll(".close-modal").forEach(x=>x.onclick=()=>back.remove());back.querySelector(".save-modal").onclick=async()=>{await onSave(back)};
}
function openStudentModal(){
  modal("Thêm học sinh",`<div class="form-grid"><label class="wide">Họ và tên<input id="m-name" required></label><label>Mã học sinh<input id="m-code"></label><label>Email<input id="m-email" type=email></label><label>Tổ<input id="m-group"></label><label>Chuyên cần (%)<input id="m-attend" type=number min=0 max=100 value=0></label><label>Mức hỗ trợ<select id="m-support"><option value="">Không</option><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label></div>`,async back=>{
    const {error}=await sb.from("students").insert({full_name:back.querySelector("#m-name").value,student_code:back.querySelector("#m-code").value||null,email:back.querySelector("#m-email").value||null,group:back.querySelector("#m-group").value||null,attendance_percent:back.querySelector("#m-attend").value||0,support_level:back.querySelector("#m-support").value||null});
    if(error){toast("Không thêm được: "+error.message);return}back.remove();toast("Đã thêm học sinh");loadData();
  });
}
function openLearningModal(){
  modal("Ghi nhận học tập",`<div class="form-grid"><label class="wide">Học sinh<select id="m-student">${state.students.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join("")}</select></label><label>Môn học<input id="m-subject" required></label><label>Điểm<input id="m-score" type=number step=0.1 required></label><label class="wide">Nhận xét<textarea id="m-note"></textarea></label></div>`,async back=>{
    const {error}=await sb.from("learning_records").insert({student_id:back.querySelector("#m-student").value,subject:back.querySelector("#m-subject").value,score:back.querySelector("#m-score").value,note:back.querySelector("#m-note").value||null,created_at:new Date().toISOString()});
    if(error){toast("Không lưu được: "+error.message);return}back.remove();toast("Đã lưu ghi nhận học tập");loadData();
  });
}
function openDisciplineModal(){
  modal("Ghi nhận nề nếp",`<div class="form-grid"><label class="wide">Học sinh<select id="m-student">${state.students.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join("")}</select></label><label>Mức độ<select id="m-level"><option value="khen">Khen thưởng</option><option value="canh">Cảnh báo</option><option value="kyluật">Kỷ luật</option></select></label><label class="wide">Nội dung<textarea id="m-content" required></textarea></label></div>`,async back=>{
    const {error}=await sb.from("discipline_records").insert({student_id:back.querySelector("#m-student").value,level:back.querySelector("#m-level").value,content:back.querySelector("#m-content").value,created_at:new Date().toISOString()});
    if(error){toast("Không lưu được: "+error.message);return}back.remove();toast("Đã lưu ghi nhận nề nếp");loadData();
  });
}
function openCompetitionModal(){
  modal("Thêm điểm thi đua",`<div class="form-grid"><label class="wide">Học sinh<select id="m-student">${state.students.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join("")}</select></label><label>Điểm<input id="m-points" type=number step=0.5 required></label><label class="wide">Lý do<select id="m-reason"><option value="">Chọn lý do</option><option value="tập trung học tập">Tập trung học tập</option><option value="tích cực tham gia">Tích cực tham gia</option><option value="giúp đỡ bạn">Giúp đỡ bạn</option><option value="kỷ luật tốt">Kỷ luật tốt</option><option value="khác">Khác</option></select></label><label class="wide">Ghi chú<textarea id="m-note"></textarea></label><label class="wide">Ngày<input id="m-date" type=date value="${today()}"></label></div>`,async back=>{
    const {error}=await sb.from("competition_records").insert({student_id:back.querySelector("#m-student").value,points:parseFloat(back.querySelector("#m-points").value),reason:back.querySelector("#m-reason").value||null,note:back.querySelector("#m-note").value||null,record_date:back.querySelector("#m-date").value,created_at:new Date().toISOString()});
    if(error){toast("Không lưu được: "+error.message);return}back.remove();toast("Đã lưu điểm thi đua");loadData();
  });
}

$("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("#login-error").textContent="";
  const {data,error}=await sb.auth.signInWithPassword({email:$("#email").value,password:$("#password").value});
  if(error){$("#login-error").textContent="Đăng nhập không thành công. Kiểm tra email và mật khẩu.";return}
  state.user=data.user;$("#login-screen").classList.add("hidden");$("#app-shell").classList.remove("hidden");
  try{await loadData()}catch(err){$("#login-error").textContent=err.message;toast("Không tải được dữ liệu lớp.");}
});
$("#logout-btn").onclick=async()=>{await sb.auth.signOut();location.reload()};
$("#refresh-btn").onclick=()=>loadData().then(()=>toast("Đã cập nhật dữ liệu")).catch(()=>toast("Không thể cập nhật dữ liệu"));
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});

(async function boot(){
  const {data}=await sb.auth.getSession();
  if(data.session){state.user=data.session.user;$("#login-screen").classList.add("hidden");$("#app-shell").classList.remove("hidden");try{await loadData()}catch(e){toast("Không tải được dữ liệu lớp");}}
})();
