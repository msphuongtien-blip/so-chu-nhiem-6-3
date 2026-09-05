-- Student avatar storage for seating chart
alter table public.students
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('student-avatars', 'student-avatars', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Teachers can upload student avatars'
  ) then
    create policy "Teachers can upload student avatars"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'student-avatars'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.role = 'teacher'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Teachers can update student avatars'
  ) then
    create policy "Teachers can update student avatars"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'student-avatars'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.role = 'teacher'
        )
      )
      with check (
        bucket_id = 'student-avatars'
        and exists (
          select 1 from public.profiles
          where profiles.id = auth.uid() and profiles.role = 'teacher'
        )
      );
  end if;
end $$;
