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
