-- Fotos privadas. Cada cuenta modifica únicamente su foto, sin editar datos laborales.
begin;
alter table public.profiles add column if not exists photo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,2097152,array['image/png'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/png'];

drop policy if exists profile_photo_insert on storage.objects;
create policy profile_photo_insert on storage.objects for insert to authenticated with check (
 bucket_id='profile-photos' and public.current_role() is not null
 and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists profile_photo_read on storage.objects;
create policy profile_photo_read on storage.objects for select to authenticated using (
 bucket_id='profile-photos' and public.current_role() is not null and (
 (storage.foldername(name))[1]=auth.uid()::text or
 exists(select 1 from public.profiles p where p.photo_path=name)));
drop policy if exists profile_photo_cleanup on storage.objects;
create policy profile_photo_cleanup on storage.objects for delete to authenticated using (
 bucket_id='profile-photos' and public.current_role() is not null
 and (storage.foldername(name))[1]=auth.uid()::text
 and not exists(select 1 from public.profiles p where p.photo_path=name));

create or replace function public.set_profile_photo(path text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); previous text;
begin
 if uid is null or public.current_role() is null then raise insufficient_privilege; end if;
 select photo_path into previous from public.profiles where id=uid for update;
 if path is not null and (
   path !~ ('^'||uid::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$')
   or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=path)
 ) then raise insufficient_privilege; end if;
 update public.profiles set photo_path=path where id=uid;
 return jsonb_build_object('photo_path',path,'previous_path',previous);
end $$;
revoke all on function public.set_profile_photo(text) from public,anon;
grant execute on function public.set_profile_photo(text) to authenticated;
commit;
