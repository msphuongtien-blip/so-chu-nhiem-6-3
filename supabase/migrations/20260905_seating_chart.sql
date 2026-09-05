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
