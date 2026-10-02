-- Conservar retiros en historial y exigir CV incluso al invocar directamente la RPC.
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check check(status in ('POSTULADO','EN_REVISION','PRESELECCIONADO','ENTREVISTA','CONTRATADO','RECHAZADO','RETIRADO'));
create function public.guard_application_candidate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if not exists(select 1 from public.candidates where id=new.candidate_id and nullif(trim(cv_path),'') is not null) then
   raise exception 'CV_REQUIRED' using errcode='22023';
  end if;
 elsif old.status='RETIRADO' and new.status<>'RETIRADO' then
  raise exception 'APPLICATION_WITHDRAWN' using errcode='22023';
 end if;
 return new;
end $$;
create trigger candidate_application_guard before insert or update on public.applications for each row execute function public.guard_application_candidate();
create function public.withdraw_application(target uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 if public.current_role() is distinct from 'CANDIDATO'::public.app_role then raise insufficient_privilege; end if;
 select * into a from public.applications where id=target for update;
 if a.id is null or not exists(select 1 from public.candidates where id=a.candidate_id and profile_id=auth.uid()) then raise insufficient_privilege; end if;
 if a.status not in ('POSTULADO','EN_REVISION','PRESELECCIONADO','ENTREVISTA') then raise exception 'INVALID_TRANSITION' using errcode='22023'; end if;
 update public.applications set status='RETIRADO',updated_at=now() where id=target;
 update public.interviews set status='CANCELLED' where application_id=target and status='SCHEDULED';
 return jsonb_build_object('id',target);
end $$;
revoke all on function public.withdraw_application(uuid) from public,anon;
grant execute on function public.withdraw_application(uuid) to authenticated;
