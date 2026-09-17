-- Auditoría exclusiva de SUPERUSER. El servidor también restringe las rutas.
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select using (public.current_role()='SUPERUSER');

-- Catálogo formativo visible a cuentas internas activas; asignación y progreso conservan sus permisos.
create policy courses_catalog_read on public.courses for select using (public.current_role() in ('RH_ADMIN','JEFE','EMPLEADO'));

-- Metadatos útiles sin copiar CV, contraseñas ni contenidos de documentos al registro.
create or replace function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; changed jsonb;
begin
 if TG_OP <> 'INSERT' then before_row=to_jsonb(old); end if;
 if TG_OP <> 'DELETE' then after_row=to_jsonb(new); end if;
 select coalesce(jsonb_agg(k),'[]'::jsonb) into changed from jsonb_object_keys(coalesce(after_row,before_row)) k
 where (before_row->k) is distinct from (after_row->k);
 insert into public.audit_logs(user_id,action,resource_type,resource_id,metadata)
 values(auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(new.id,old.id),jsonb_build_object('changed_fields',changed,'previous_status',before_row->>'status','new_status',after_row->>'status','actor_role',public.current_role()));
 if TG_OP='DELETE' then return old; end if; return new;
end $$;

create table public.orchestration_runs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles,
 area text not null check(area in ('overview','courses','tasks','performance','analytics')),
 status text not null default 'PENDING' check(status in ('PENDING','COMPLETED','FAILED')),
 result jsonb, model text, created_at timestamptz not null default now()
);
alter table public.orchestration_runs enable row level security;
grant select on public.orchestration_runs to authenticated;
grant all on public.orchestration_runs to service_role;
create policy orchestration_own on public.orchestration_runs for select using(user_id=auth.uid() and public.current_role() is not null);
create index on public.orchestration_runs(user_id,created_at desc);
create trigger audit after insert or update or delete on public.orchestration_runs for each row execute function public.audit_change();
create function public.begin_orchestration(section text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.app_role:=public.current_role(); rid uuid;
begin
 if uid is null or r is null then raise insufficient_privilege; end if;
 if section not in ('overview','courses','tasks','performance','analytics') then raise invalid_parameter_value; end if;
 if section<>'overview' and (r not in ('RH_ADMIN','JEFE','EMPLEADO') or (section='analytics' and r<>'RH_ADMIN')) then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 if exists(select 1 from public.orchestration_runs where user_id=uid and status='PENDING' and created_at>now()-interval '2 minutes') then raise exception 'AI_IN_PROGRESS' using errcode='23505'; end if;
 if (select count(*) from public.orchestration_runs where user_id=uid and created_at>now()-interval '1 minute')>=3 then raise exception 'RATE_LIMIT' using errcode='P0001'; end if;
 insert into public.orchestration_runs(user_id,area) values(uid,section) returning id into rid;
 return rid;
end $$;
revoke all on function public.begin_orchestration(text) from public,anon;
grant execute on function public.begin_orchestration(text) to authenticated;
