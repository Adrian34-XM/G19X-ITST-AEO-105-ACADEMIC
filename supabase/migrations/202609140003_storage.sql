-- Crea depósitos privados y políticas de acceso a objetos. Relaciona rutas de archivos con propietarios y recursos autorizados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('cvs','cvs',false,5242880,array['application/pdf','text/plain']),
('task-evidence','task-evidence',false,5242880,array['application/pdf','text/plain','image/png','image/jpeg']),
('onboarding-documents','onboarding-documents',false,5242880,array['application/pdf','text/plain','image/png','image/jpeg']);
create policy files_insert on storage.objects for insert to authenticated with check (
(storage.foldername(name))[1]=auth.uid()::text and
((bucket_id='cvs' and public.current_role()='CANDIDATO') or (bucket_id in ('task-evidence','onboarding-documents') and public.current_role() in ('EMPLEADO','JEFE'))));
create policy files_read on storage.objects for select to authenticated using (
public.current_role() is not null and (
((storage.foldername(name))[1]=auth.uid()::text and bucket_id in ('cvs','task-evidence','onboarding-documents')) or
(bucket_id='cvs' and public.is_hr() and exists(select 1 from public.candidates c where c.cv_path=name)) or
(bucket_id='task-evidence' and exists(select 1 from public.task_evidence e where e.file_path=name and public.manages_employee(e.employee_id))) or
(bucket_id='onboarding-documents' and public.is_hr() and exists(select 1 from public.onboarding_documents d where d.file_path=name))));
-- Sin políticas de sobrescritura ni eliminación: el usuario no modifica evidencias ya enviadas.
