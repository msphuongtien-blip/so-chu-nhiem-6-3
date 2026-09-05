/*
 * FILE: supabase/migrations/20260905123000_save_seating_positions_atomically.sql
 *
 * Mục đích:
 * Lưu toàn bộ sơ đồ chỗ ngồi trong một transaction.
 *
 * Lý do:
 * Không được xóa assignment cũ rồi cập nhật từng ghế từ trình duyệt,
 * vì nếu một update giữa chừng lỗi thì sơ đồ có thể bị mất một phần.
 *
 * Quy tắc:
 * - Chỉ giáo viên mới được gọi function.
 * - Payload phải chứa đủ 48 ghế của lớp.
 * - Một học sinh chỉ được xuất hiện tối đa một lần.
 * - Toàn bộ thao tác clear + ghi lại assignment phải thành công hoặc
 *   rollback toàn bộ.
 */

create or replace function public.save_seating_positions(
    p_class_key text,
    p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_assignment_count integer;
    v_distinct_seat_count integer;
    v_existing_seat_count integer;
    v_assigned_student_count integer;
    v_distinct_student_count integer;
begin
    if not exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'teacher'
    ) then
        raise exception 'Chỉ giáo viên mới có quyền lưu sơ đồ chỗ ngồi.'
            using errcode = '42501';
    end if;

    if jsonb_typeof(p_assignments) <> 'array' then
        raise exception 'Dữ liệu sơ đồ chỗ ngồi không hợp lệ.';
    end if;

    select
        count(*),
        count(distinct (item->>'id')::uuid),
        count(*) filter (where nullif(item->>'student_id', '') is not null),
        count(distinct nullif(item->>'student_id', '')::uuid)
    into
        v_assignment_count,
        v_distinct_seat_count,
        v_assigned_student_count,
        v_distinct_student_count
    from jsonb_array_elements(p_assignments) as payload(item);

    if v_assignment_count <> 48 or v_distinct_seat_count <> 48 then
        raise exception 'Sơ đồ phải chứa đúng 48 vị trí độc lập.';
    end if;

    select count(*)
    into v_existing_seat_count
    from public.seating_positions seat
    where seat.class_key = p_class_key
      and seat.id in (
          select (item->>'id')::uuid
          from jsonb_array_elements(p_assignments) as payload(item)
      );

    if v_existing_seat_count <> 48 then
        raise exception 'Một hoặc nhiều vị trí không thuộc sơ đồ lớp này.';
    end if;

    if v_assigned_student_count <> v_distinct_student_count then
        raise exception 'Một học sinh đang được gán vào nhiều vị trí.';
    end if;

    /*
     * Hai câu lệnh dưới đây nằm trong cùng transaction của function.
     * Nếu câu lệnh thứ hai lỗi, PostgreSQL tự rollback cả hai.
     */
    update public.seating_positions
    set
        student_id = null,
        updated_at = now()
    where class_key = p_class_key;

    update public.seating_positions as seat
    set
        student_id = nullif(payload.item->>'student_id', '')::uuid,
        note = nullif(payload.item->>'note', ''),
        status = nullif(payload.item->>'status', ''),
        updated_at = now()
    from jsonb_array_elements(p_assignments) as payload(item)
    where seat.class_key = p_class_key
      and seat.id = (payload.item->>'id')::uuid;

    return v_assigned_student_count;
end;
$$;

revoke all on function public.save_seating_positions(text, jsonb) from public;
revoke all on function public.save_seating_positions(text, jsonb) from anon;
grant execute on function public.save_seating_positions(text, jsonb) to authenticated;


/*
 * Team source-of-truth contract
 * -----------------------------
 * students.team is the canonical team assignment.
 * seating_positions.team is the fixed visual team container.
 *
 * A direct change to students.team automatically moves the student to an
 * empty seat in the new team. If that team is full, the change is rejected
 * instead of leaving the seating chart inconsistent.
 */
create or replace function public.sync_student_team_to_seating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    current_seat_team integer;
    target_seat_id uuid;
begin
    if NEW.team is null or OLD.team is not distinct from NEW.team then
        return NEW;
    end if;

    select sp.team into current_seat_team
    from public.seating_positions sp
    where sp.student_id = NEW.id
      and sp.class_key = '6/3'
    limit 1
    for update;

    if current_seat_team = NEW.team then
        return NEW;
    end if;

    select sp.id into target_seat_id
    from public.seating_positions sp
    where sp.class_key = '6/3'
      and sp.team = NEW.team
      and sp.student_id is null
    order by sp.seat_number
    limit 1
    for update;

    if target_seat_id is null then
        raise exception 'Tổ % đã đủ 12 chỗ. Không thể chuyển học sinh sang tổ này.', NEW.team;
    end if;

    update public.seating_positions
    set student_id = null, updated_at = now()
    where class_key = '6/3'
      and student_id = NEW.id;

    update public.seating_positions
    set student_id = NEW.id, updated_at = now()
    where id = target_seat_id;

    return NEW;
end;
$$;

drop trigger if exists trg_sync_student_team_to_seating on public.students;

create trigger trg_sync_student_team_to_seating
after update of team on public.students
for each row
when (OLD.team is distinct from NEW.team)
execute function public.sync_student_team_to_seating();

/*
 * Atomic save for the complete 48-seat snapshot.
 * Saving the seating chart also synchronizes students.team to the team
 * container where each student is placed.
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
    v_student_count integer;
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'teacher'
    ) then
        raise exception 'Không có quyền lưu sơ đồ chỗ ngồi.';
    end if;

    if p_class_key <> '6/3' then
        raise exception 'Lớp không hợp lệ.';
    end if;

    if jsonb_typeof(p_assignments) <> 'array' then
        raise exception 'Dữ liệu sơ đồ phải là một mảng.';
    end if;

    select count(*) into v_assignment_count
    from jsonb_array_elements(p_assignments);

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

    select count(*) into v_student_count from public.students;

    select count(*) into v_assigned_count
    from jsonb_array_elements(p_assignments) item
    where nullif(item->>'student_id', '') is not null;

    if v_assigned_count <> v_student_count then
        raise exception 'Sơ đồ phải có đủ % học sinh; hiện có %.', v_student_count, v_assigned_count;
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_assignments) item
        where nullif(item->>'student_id', '') is not null
          and not exists (
              select 1 from public.students s
              where s.id = (item->>'student_id')::uuid
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

    /*
     * The seating snapshot is now the desired visual arrangement.
     * The trigger sees each student already in the target team and therefore
     * does not move the student a second time.
     */
    update public.students s
    set team = x.team, updated_at = now()
    from (
        select p.student_id, g.team
        from _seating_save_payload p
        join _seating_geometry g on g.id = p.id
        where p.student_id is not null
    ) x
    where s.id = x.student_id
      and s.team is distinct from x.team;

    select count(*) into v_assigned_count
    from public.seating_positions
    where class_key = p_class_key
      and student_id is not null;

    return v_assigned_count;
end;
$$;

revoke all on function public.save_seating_positions(text, jsonb) from public;
grant execute on function public.save_seating_positions(text, jsonb) to authenticated;
