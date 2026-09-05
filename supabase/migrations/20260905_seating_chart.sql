/*
 * FILE: supabase/migrations/20260905_seating_chart.sql
 *
 * Mục đích:
 * Tạo dữ liệu bền vững cho sơ đồ chỗ ngồi và lịch sử quay tên của lớp.
 *
 * Phạm vi:
 * - 48 vị trí/lớp, 4 tổ.
 * - Ghi học sinh, ghi chú và trạng thái theo ghế.
 * - Lưu lịch sử quay tên.
 *
 * Không thay đổi bảng students hoặc dữ liệu thi đua.
 */

create table if not exists public.seating_positions (
    id uuid primary key default gen_random_uuid(),
    class_key text not null default '6/3',
    seat_number integer not null,
    row_number integer not null,
    column_number integer not null,
    team integer not null,
    student_id uuid null references public.students(id) on delete set null,
    note text null,
    status text null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (class_key, seat_number)
);

create unique index if not exists seating_positions_student_unique
on public.seating_positions (class_key, student_id)
where student_id is not null;

alter table public.seating_positions enable row level security;

drop policy if exists seating_teacher_select on public.seating_positions;
drop policy if exists seating_teacher_insert on public.seating_positions;
drop policy if exists seating_teacher_update on public.seating_positions;
drop policy if exists seating_teacher_delete on public.seating_positions;

create policy seating_teacher_select
on public.seating_positions
for select to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
);

create policy seating_teacher_insert
on public.seating_positions
for insert to authenticated
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
);

create policy seating_teacher_update
on public.seating_positions
for update to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
);

create policy seating_teacher_delete
on public.seating_positions
for delete to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
);

insert into public.seating_positions (
    class_key,
    seat_number,
    row_number,
    column_number,
    team
)
select
    '6/3',
    n,
    ((n - 1) / 12) + 1,
    ((n - 1) % 12) + 1,
    ((n - 1) / 12) + 1
from generate_series(1, 48) as g(n)
on conflict (class_key, seat_number) do nothing;

create table if not exists public.random_pick_history (
    id uuid primary key default gen_random_uuid(),
    class_key text not null default '6/3',
    student_id uuid not null references public.students(id) on delete cascade,
    scope text not null default 'all',
    scope_team integer null,
    picked_at timestamptz not null default now(),
    created_by uuid null references auth.users(id) on delete set null
);

create index if not exists random_pick_history_class_time_idx
on public.random_pick_history (class_key, picked_at desc);

alter table public.random_pick_history enable row level security;

drop policy if exists random_pick_teacher_all on public.random_pick_history;

create policy random_pick_teacher_all
on public.random_pick_history
for all to authenticated
using (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
)
with check (
    exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'teacher'
    )
);


/*
 * Atomic save RPC:
 * The UI sends the complete 48-seat snapshot. The function validates the
 * snapshot and replaces it atomically, so a failed save cannot leave the
 * class half-empty.
 */
create or replace function public.save_seating_positions(p_class_key text, p_assignments jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_assigned_count integer;
    v_assignment_count integer;
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher') then
        raise exception 'Không có quyền lưu sơ đồ chỗ ngồi.';
    end if;

    if p_class_key <> '6/3' then
        raise exception 'Lớp không hợp lệ.';
    end if;

    if jsonb_typeof(p_assignments) <> 'array' then
        raise exception 'Dữ liệu sơ đồ phải là một mảng.';
    end if;

    select count(*) into v_assignment_count from jsonb_array_elements(p_assignments);
    if v_assignment_count <> 48 then
        raise exception 'Sơ đồ phải có đúng 48 vị trí.';
    end if;

    if exists (
        select 1
        from (
            select nullif(item->>'student_id', '')::uuid student_id
            from jsonb_array_elements(p_assignments) item
            where nullif(item->>'student_id', '') is not null
        ) x
        group by student_id
        having count(*) > 1
    ) then
        raise exception 'Một học sinh không thể ngồi ở nhiều vị trí.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_assignments) item
        where not exists (
            select 1 from public.seating_positions sp
            where sp.id = (item->>'id')::uuid and sp.class_key = p_class_key
        )
    ) then
        raise exception 'Có vị trí chỗ ngồi không tồn tại.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_assignments) item
        where nullif(item->>'student_id', '') is not null
        and not exists (
            select 1 from public.students s where s.id = (item->>'student_id')::uuid
        )
    ) then
        raise exception 'Có học sinh không tồn tại trong danh sách lớp.';
    end if;

    create temporary table if not exists _seating_geometry on commit drop as
    select id, class_key, seat_number, row_number, column_number, team
    from public.seating_positions where false;

    truncate _seating_geometry;

    insert into _seating_geometry
    select id, class_key, seat_number, row_number, column_number, team
    from public.seating_positions
    where class_key = p_class_key;

    if (select count(*) from _seating_geometry) <> 48 then
        raise exception 'Cấu trúc 48 ghế hiện tại không hợp lệ.';
    end if;

    create temporary table if not exists _seating_save_payload (
        id uuid primary key,
        student_id uuid,
        note text,
        status text
    ) on commit drop;

    truncate _seating_save_payload;

    insert into _seating_save_payload
    select
        (item->>'id')::uuid,
        nullif(item->>'student_id', '')::uuid,
        nullif(item->>'note', ''),
        nullif(item->>'status', '')
    from jsonb_array_elements(p_assignments) item;

    delete from public.seating_positions
    where class_key = p_class_key;

    insert into public.seating_positions (
        id, class_key, seat_number, row_number, column_number, team,
        student_id, note, status, updated_at
    )
    select
        g.id, g.class_key, g.seat_number, g.row_number, g.column_number, g.team,
        p.student_id, p.note, p.status, now()
    from _seating_geometry g
    join _seating_save_payload p on p.id = g.id;

    select count(*) into v_assigned_count
    from public.seating_positions
    where class_key = p_class_key and student_id is not null;

    return v_assigned_count;
end;
$$;

revoke all on function public.save_seating_positions(text, jsonb) from public;
grant execute on function public.save_seating_positions(text, jsonb) to authenticated;
