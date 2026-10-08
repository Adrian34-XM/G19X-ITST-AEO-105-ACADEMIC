-- Separar resultados internos de filas que también leen candidatos y participantes.
-- Las columnas anteriores se conservan vacías por compatibilidad y fallan cerrado.
begin;

create table public.application_assessments (
 application_id uuid primary key references public.applications(id) on delete cascade,
 result jsonb not null,
 model text,
 generated_at timestamptz not null default now()
);
create table public.climate_analyses (
 survey_id uuid primary key references public.climate_surveys(id) on delete cascade,
 summary jsonb not null,
 model text,
 generated_at timestamptz not null default now()
);
alter table public.application_assessments enable row level security;
alter table public.climate_analyses enable row level security;
revoke all on public.application_assessments, public.climate_analyses from public, anon, authenticated;
grant select on public.application_assessments, public.climate_analyses to authenticated;
grant all on public.application_assessments, public.climate_analyses to service_role;
create policy application_assessments_read on public.application_assessments
 for select using (public.is_hr());
create policy climate_analyses_read on public.climate_analyses
 for select using (public.manages_climate(survey_id));

insert into public.application_assessments(application_id,result)
 select id,ai_result from public.applications where ai_result is not null;
insert into public.climate_analyses(survey_id,summary,model)
 select id,summary,model from public.climate_surveys where summary is not null;
update public.applications set ai_result=null where ai_result is not null;
update public.climate_surveys set summary=null,model=null where summary is not null or model is not null;
alter table public.applications add constraint application_assessment_private check (ai_result is null);
alter table public.climate_surveys add constraint climate_analysis_private check (summary is null and model is null);

-- La copia histórica también pierde acceso al cambiar el rol de quien la solicitó.
drop policy ai_results_read on public.ai_results;
create policy ai_results_read on public.ai_results for select using (
 exists(select 1 from public.ai_requests r where r.id=request_id and r.user_id=auth.uid()
 and (r.use_case<>'recruitment' or public.is_hr()))
);

create or replace function public.finish_ai(request uuid, output jsonb, model_name text, succeeded boolean)
returns void language plpgsql security definer set search_path='' as $$
declare req public.ai_requests;
begin
 select * into req from public.ai_requests where id=request and status='PENDING' for update;
 if req.id is null then raise no_data_found; end if;
 update public.ai_requests set status=case when succeeded then 'COMPLETED' else 'FAILED' end where id=request;
 if not succeeded then return; end if;
 insert into public.ai_results(request_id,result,model) values(request,output,model_name);
 if req.use_case='recruitment' then
  insert into public.application_assessments(application_id,result,model) values(req.resource_id,output,model_name)
  on conflict(application_id) do update set result=excluded.result,model=excluded.model,generated_at=now();
 else
  update public.task_evidence set ai_result=output where id=req.resource_id;
 end if;
end $$;
revoke all on function public.finish_ai(uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_ai(uuid,jsonb,text,boolean) to service_role;

create or replace function public.invalidate_recommendations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.application_assessments e using public.applications a
 where e.application_id=a.id and (
  (TG_TABLE_NAME='candidates' and a.candidate_id=new.id) or
  (TG_TABLE_NAME='vacancies' and a.vacancy_id=new.id)
 );
 return new;
end $$;
-- El archivo del CV es otra representación del contexto profesional.
drop trigger candidate_ai_stale on public.candidates;
create trigger candidate_ai_stale after update of skills,experience_years,cv_text,cv_path on public.candidates
 for each row execute function public.invalidate_recommendations();
create function public.clear_reapplied_assessment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 delete from public.application_assessments where application_id=new.id;
 return new;
end $$;
revoke all on function public.clear_reapplied_assessment() from public,anon,authenticated;
create trigger reapplied_assessment after update of status on public.applications
 for each row when (old.status='RETIRADO' and new.status='POSTULADO')
 execute function public.clear_reapplied_assessment();

-- Conservar las autorizaciones y los umbrales de las RPC de resultados.
create or replace function public.climate_aggregate(sid uuid,actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys; total int; averages jsonb; comments jsonb; analysis jsonb;
begin
 select * into s from public.climate_surveys where id=sid;
 if not found or not exists(select 1 from public.profiles where id=actor and active and
  (role in ('RH_ADMIN','SUPERUSER') or (role='JEFE' and s.created_by=actor))) then raise insufficient_privilege; end if;
 if s.status<>'CLOSED' then raise exception 'CLIMATE_CLOSE_FIRST' using errcode='22023'; end if;
 select count(*) into total from public.climate_answers where survey_id=sid;
 if total<5 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('question_index',idx,'average',avg_rating) order by idx) into averages from
 (select item.ordinality as idx,round(avg((item.value#>>'{}')::numeric),2) avg_rating
 from public.climate_answers a cross join lateral jsonb_array_elements(a.ratings) with ordinality item
 where a.survey_id=sid group by item.ordinality) grouped;
 select coalesce(jsonb_agg(comment),'[]') into comments from
 (select comment from public.climate_answers where survey_id=sid and comment<>'' order by id limit 200) c;
 select summary into analysis from public.climate_analyses where survey_id=sid;
 return jsonb_build_object('title',s.title,'questions',s.questions,'response_count',total,
  'averages',averages,'comments',comments,'summary',analysis);
end $$;
revoke all on function public.climate_aggregate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.climate_aggregate(uuid,uuid) to service_role;

create or replace function public.climate_survey_results(sid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys; total int; invited int; result jsonb; analysis jsonb;
begin
 select * into s from public.climate_surveys where id=sid;
 if not found or not coalesce(public.manages_climate(sid),false) then raise insufficient_privilege; end if;
 select count(*) into total from public.climate_answers where survey_id=sid;
 select count(*) into invited from public.climate_assignments where survey_id=sid;
 select summary into analysis from public.climate_analyses where survey_id=sid;
 result:=jsonb_build_object('status',s.status,'title',s.title,'questions',s.questions,'summary',analysis,
  'responses',total,'invited',invited,'comments','[]'::jsonb,'averages','[]'::jsonb);
 if s.status='CLOSED' and total>=5 then
  result:=result || (public.climate_aggregate(sid,auth.uid()) - 'summary' - 'title' - 'questions');
 end if;
 return result;
end $$;
revoke all on function public.climate_survey_results(uuid) from public,anon,authenticated;

-- Guardado atómico: vuelve a comprobar responsable, cierre y cohorte suficiente.
create function public.save_climate_analysis(sid uuid,actor uuid,output jsonb,model_name text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.climate_surveys;
begin
 select * into s from public.climate_surveys where id=sid for update;
 if not found or not exists(select 1 from public.profiles where id=actor and active and
  (role in ('RH_ADMIN','SUPERUSER') or (role='JEFE' and s.created_by=actor))) then raise insufficient_privilege; end if;
 if s.status<>'CLOSED' then raise exception 'CLIMATE_CLOSE_FIRST' using errcode='22023'; end if;
 if (select count(*) from public.climate_answers where survey_id=sid)<5
  and (select count(*) from public.climate_feedback where survey_id=sid)<5
 then raise exception 'CLIMATE_MINIMUM' using errcode='22023'; end if;
 insert into public.climate_analyses(survey_id,summary,model) values(sid,output,model_name)
 on conflict(survey_id) do update set summary=excluded.summary,model=excluded.model,generated_at=now();
end $$;
revoke all on function public.save_climate_analysis(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_climate_analysis(uuid,uuid,jsonb,text) to service_role;
notify pgrst, 'reload schema';
commit;
