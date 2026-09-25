begin;
-- Solo se conservan valores operativos permitidos. Documentos, prompts y comentarios quedan fuera.
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; changed jsonb; changes jsonb; actor text;
begin
 if TG_OP <> 'INSERT' then b:=to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then a:=to_jsonb(new); end if;
 if TG_OP='UPDATE' and a=b then return new; end if;
 select coalesce(jsonb_agg(k order by k),'[]'::jsonb) into changed
 from jsonb_object_keys(coalesce(a,b)) k where (b->k) is distinct from (a->k);
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',b->k,'after',a->k)),'{}'::jsonb) into changes
 from jsonb_object_keys(coalesce(a,b)) k where (b->k) is distinct from (a->k)
 and k=any(array['name','full_name','title','status','role','active','priority','due_date','scheduled_at','progress','position_id','department_id','manager_id','employee_id','course_id','owner_role','requires_document','required','hire_date']);
 select full_name into actor from public.profiles where id=auth.uid();
 insert into public.audit_logs(user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),jsonb_build_object(
 'changed_fields',changed,'changes',changes,'actor_name',actor,'actor_role',public.current_role(),
 'resource_name',coalesce(a->>'title',a->>'full_name',a->>'name',b->>'title',b->>'full_name',b->>'name'),
 'previous_status',b->>'status','new_status',a->>'status'));
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
-- No auditar respuestas ni recibos de participación: se preserva el anonimato.
create trigger audit after insert or update or delete on public.course_evidence for each row execute function public.audit_change();
create trigger audit after insert or update or delete on public.climate_surveys for each row execute function public.audit_change();
commit;
