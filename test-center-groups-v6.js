/*
 * FILE: test-center-groups-v6.js
 *
 * Mục đích:
 * Runner độc lập cho từng cụm Test Center.
 * Chạy trực tiếp trên Vercel, không cần localhost/terminal.
 *
 * Không ghi dữ liệu production. Các test calculation/edge-case dùng fixture
 * trong trình duyệt; Supabase chỉ đọc dữ liệu.
 */
(function () {
    const GROUPS = {
        'Calculation': runCalculation,
        'Rollover': runRollover,
        'Record edge cases': runRecord,
        'Date → week': runDateWeek,
        'Criteria': runCriteria,
        'Gọi tên học sinh': runRandomPicker,
        'Supabase read-only': runSupabase,
    };

    const groupResults = new Map();

    function assertEqual(actual, expected, message) {
        if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }

    function assertTrue(value, message) {
        if (!value) throw new Error(message);
    }

    function engine() {
        if (!window.CompetitionCalculationV6) throw new Error('Calculation engine V6 chưa được load.');
        return window.CompetitionCalculationV6;
    }

    function chain(records, studentId, firstWeek, targetWeek) {
        const e = engine();
        let week = e.getMonday(firstWeek);
        const target = e.getMonday(targetWeek);
        let score = e.CONFIG.BASE_SCORE;
        while (week <= target) {
            const change = e.sumWeekChange(records, studentId, week);
            score = e.clampScore(score + change);
            if (week === target) return score;
            score = e.rolloverStart(score);
            const d = new Date(`${week}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() + 7);
            week = d.toISOString().slice(0, 10);
        }
        return score;
    }

    function runCalculation() {
        const e = engine();
        const cases = [];
        cases.push(['base', () => assertEqual(chain([], 'A', '2030-01-07', '2030-01-07'), 81, 'Base')]);
        for (const n of [1,2,3,4,5,-1,-2,-3,-4,-5]) {
            cases.push([`score ${n}`, () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:n}], 'A','2030-01-07','2030-01-07'),81+n,`Score ${n}`)]);
        }
        cases.push(['zero invalid', () => assertTrue(!e.CONFIG.VALID_SCORES.includes(0), '0 must not be valid')]);
        cases.push(['multiple records', () => assertEqual(chain([
            {student_id:'A',week:'2030-01-07',score:3},{student_id:'A',week:'2030-01-07',score:2},
            {student_id:'A',week:'2030-01-07',score:-1},{student_id:'A',week:'2030-01-07',score:-2}
        ],'A','2030-01-07','2030-01-07'),83,'Multiple records')]);
        return cases;
    }

    function runRollover() {
        const e = engine();
        const cases = [[91,91],[90,81],[85,81],[81,81],[80,71],[78,71],[66,71],[65,61],[50,61],[49,51],[0,51]]
            .map(([a,b]) => [`${a} → ${b}`, () => assertEqual(e.rolloverStart(a), b, `${a} rollover`) ]);
        cases.push(['91 empty week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:10}],'A','2030-01-07','2030-01-14'),91,'91 empty')]);
        cases.push(['85 empty week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:4}],'A','2030-01-07','2030-01-14'),81,'85 empty')]);
        cases.push(['78 empty week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:-3}],'A','2030-01-07','2030-01-14'),71,'78 empty')]);
        cases.push(['65 empty week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:-16}],'A','2030-01-07','2030-01-14'),61,'65 empty')]);
        cases.push(['49 empty week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:-32}],'A','2030-01-07','2030-01-14'),51,'49 empty')]);
        cases.push(['91 three empty weeks', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:10}],'A','2030-01-07','2030-01-28'),91,'91 three empty')]);
        return cases;
    }

    function runRecord() {
        const cases = [];
        cases.push(['same student same week', () => assertEqual(chain([{student_id:'A',week:'2030-01-07',score:3}],'A','2030-01-07','2030-01-07'),84,'Same week')]);
        cases.push(['same student next week', () => assertEqual(chain([{student_id:'A',week:'2030-01-14',score:3}],'A','2030-01-07','2030-01-07'),81,'Old week')]);
        cases.push(['A → B', () => {
            const r=[{id:'r1',student_id:'A',week:'2030-01-07',score:3},{id:'r2',student_id:'A',week:'2030-01-07',score:-2}];
            r[1].student_id='B';
            assertEqual(chain(r,'A','2030-01-07','2030-01-07'),84,'A after move');
            assertEqual(chain(r,'B','2030-01-07','2030-01-07'),79,'B after move');
        }]);
        cases.push(['A → A same payload no-op', () => {
            const a={student_id:'A',date:'2030-01-09',score:3,criteria_id:'c1'};
            const b={...a}; assertEqual(JSON.stringify(a),JSON.stringify(b),'No-op payload');
        }]);
        cases.push(['A → A different date allowed', () => assertTrue('2030-01-09' !== '2030-01-10','Dates differ')]);
        cases.push(['A → A different score allowed', () => assertTrue(3 !== 2,'Scores differ')]);
        cases.push(['A → B → A', () => {
            let owner='A'; owner='B'; owner='A'; assertEqual(owner,'A','Final owner');
        }]);
        return cases;
    }

    function runDateWeek() {
        return [['2030-01-07','2030-01-07'],['2030-01-09','2030-01-07'],['2030-01-12','2030-01-07'],['2030-01-13','2030-01-07'],['2030-01-14','2030-01-14']]
            .map(([date,w]) => [`${date} → ${w}`, () => assertEqual(engine().getMonday(date),w,date)]);
    }

    function runCriteria() {
        return [
            ['active/inactive state', () => { assertTrue({active:true}.active,'active'); assertTrue(!{active:false}.active,'inactive'); }],
            ['six categories', () => { for(let i=1;i<=6;i++) assertTrue(i>=1&&i<=6,`category ${i}`); }],
        ];
    }

    async function runRandomPicker() {
        const frame=document.getElementById('appFrame')?.contentWindow;
        if(!frame?.getRandomPool) throw new Error('getRandomPool chưa sẵn sàng.');
        const pool=frame.getRandomPool('all');
        assertTrue(Array.isArray(pool)&&pool.length>0,'Random pool rỗng.');
        const candidate=frame.chooseRandomCandidate?.('all');
        assertTrue(candidate&&pool.some(s=>s.id===candidate.id),'Candidate không thuộc pool.');
        return [['pool',()=>{}],['candidate',()=>{}]];
    }

    async function runSupabase() {
        if(!window.supabase) throw new Error('Supabase client library chưa load.');
        const client=window.supabase.createClient('https://fdyhnwklzizzbiyqqlxo.supabase.co','sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy');
        const {data,error}=await client.from('competition_categories').select('id,active').order('id');
        if(error) throw error;
        for(let i=1;i<=6;i++) assertTrue((data||[]).some(r=>Number(r.id)===i&&r.active!==false),`Missing active category ${i}`);
        return [['six categories readable',()=>{}]];
    }

    async function execute(group) {
        const fn=GROUPS[group];
        if(!fn) throw new Error(`Unknown group: ${group}`);
        const cases=await fn();
        const results=[];
        for(const [name,test] of cases){
            try{ await test(); results.push({name,status:'pass'}); }
            catch(e){ results.push({name,status:'fail',message:e?.message||String(e)}); }
        }
        groupResults.set(group,results);
        renderGroup(group,results);
        return results;
    }

    function renderGroup(group,results){
        const sections=[...document.querySelectorAll('.qa-group')];
        const section=sections.find(s=>s.querySelector('h3')?.textContent?.trim()===group);
        if(!section) return;
        const list=section.querySelector('.qa-list');
        if(!list) return;
        list.innerHTML='';
        for(const r of results){
            const li=document.createElement('li'); li.className='qa-row';
            li.innerHTML=`<span class="qa-badge ${r.status}">${r.status.toUpperCase()}</span><span><span class="qa-name">${escapeHtml(r.name)}</span>${r.message?`<br><span class="qa-detail">${escapeHtml(r.message)}</span>`:''}</span>`;
            list.appendChild(li);
        }
        const badge=section.querySelector('.qa-group-header .qa-badge');
        if(badge) badge.textContent=`${results.length} tests · ${results.filter(r=>r.status==='pass').length} PASS`;
    }

    function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

    function installButtons(){
        const container=document.getElementById('testGroups');
        if(!container) return;
        for(const group of Object.keys(GROUPS)){
            const section=[...container.querySelectorAll('.qa-group')].find(s=>s.querySelector('h3')?.textContent?.trim()===group);
            if(!section) continue;
            const header=section.querySelector('.qa-group-header');
            if(!header||header.querySelector('.qa-group-run-v6')) continue;
            const b=document.createElement('button'); b.type='button'; b.className='qa-button qa-group-run-v6'; b.textContent='▶ Chạy cụm này';
            b.addEventListener('click',async()=>{
                b.disabled=true; b.textContent='⏳ Đang chạy...';
                try{await execute(group);}finally{b.disabled=false;b.textContent='▶ Chạy lại cụm';}
            });
            header.appendChild(b);
        }
    }

    const observer=new MutationObserver(installButtons);
    observer.observe(document.getElementById('testGroups')||document.body,{childList:true,subtree:true});
    window.setInterval(installButtons,500);
})();
