begin;
-- Corrige estados históricos finalizados por la ruta antigua de revisión.
update public.course_assignments set approved_progress=100, progress_review_pending=false where status='COMPLETED';
create or replace function public.flag_course_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='course_evidence' then
  update public.course_assignments set progress_review_pending=true where id=new.assignment_id and status<>'COMPLETED';
 elsif new.status='COMPLETED' then
  new.progress_review_pending:=false;
  new.approved_progress:=100;
 elsif new.progress is distinct from old.progress and public.owns_employee(new.employee_id) then
  new.progress_review_pending:=true;
 end if;
 return new;
end $$;
commit;
