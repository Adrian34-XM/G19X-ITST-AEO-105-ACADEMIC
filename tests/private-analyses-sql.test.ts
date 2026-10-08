import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";

let db: PGlite;
const migration = "202610080001_private_ai_analyses.sql";
const ids = {
  hr: "91000000-0000-4000-8000-000000000001",
  candidate: "91000000-0000-4000-8000-000000000002",
  other: "91000000-0000-4000-8000-000000000003",
  employee: "91000000-0000-4000-8000-000000000004",
  admin: "91000000-0000-4000-8000-000000000005",
  manager: "91000000-0000-4000-8000-000000000006",
  otherManager: "91000000-0000-4000-8000-000000000007",
};
let application: string, vacancy: string, candidate: string, survey: string;
const assessment = { score: 52, summary: "Evaluación interna ficticia" };
const climate = { summary: "Análisis reservado ficticio", response_count: 5 };
async function as(user: string, sql: string, params: unknown[] = [], service = false) {
  await db.exec(`reset role;set role ${service ? "service_role" : "authenticated"};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  return db.query(sql, params);
}
async function owner() {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.admin]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
    grant usage on schema auth,storage,public to authenticated,anon,service_role;
    grant select,insert on storage.objects to authenticated;`);
  for (const file of (await readdir("supabase/migrations")).sort()) {
    if (file === migration) continue;
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  }
  for (const [label, id] of Object.entries(ids))
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, label + "@fixture.invalid", JSON.stringify({ full_name: "Ficticio " + label })]);
  for (const [id, role] of [[ids.hr, "RH_ADMIN"], [ids.admin, "SUPERUSER"],
    [ids.employee, "EMPLEADO"], [ids.manager, "JEFE"], [ids.otherManager, "JEFE"]])
    await db.query("update profiles set role=$1::public.app_role where id=$2", [role, id]);
  await owner();
  const department = (await db.query<{ id: string }>("insert into departments(name) values('Seguridad ficticia') returning id")).rows[0].id;
  const position = (await db.query<{ id: string }>("insert into positions(name,department_id) values('Prueba',$1) returning id", [department])).rows[0].id;
  vacancy = (await db.query<{ id: string }>("insert into vacancies(position_id,title,description,requirements,created_by,status) values($1,'Prueba','Descripción','Requisitos',$2,'PUBLISHED') returning id", [position, ids.hr])).rows[0].id;
  candidate = (await db.query<{ id: string }>("select id from candidates where profile_id=$1", [ids.candidate])).rows[0].id;
  await db.query("update candidates set cv_path=$1 where id=$2", [ids.candidate + "/cv.pdf", candidate]);
  application = (await db.query<{ id: string }>("insert into applications(candidate_id,vacancy_id,ai_result) values($1,$2,$3) returning id", [candidate, vacancy, assessment])).rows[0].id;
  const employee = (await db.query<{ id: string }>("insert into employees(profile_id,position_id) values($1,$2) returning id", [ids.employee, position])).rows[0].id;
  survey = (await db.query<{ id: string }>("insert into climate_surveys(created_by,title,questions,status,summary,model) values($1,'Clima ficticio',$2,'CLOSED',$3,'modelo-anterior') returning id", [ids.manager, ["Uno", "Dos", "Tres"], climate])).rows[0].id;
  await db.query("insert into climate_assignments values($1,$2)", [survey, employee]);
  for (let i = 0; i < 5; i++)
    await db.query("insert into climate_answers(survey_id,ratings,comment) values($1,'[3,2,4]',$2)", [survey, "Comentario ficticio " + i]);
  await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
});
afterAll(async () => { await db?.close(); });

it("migra los análisis y deja vacías las columnas públicas sin perder datos", async () => {
  expect((await as(ids.candidate, "select ai_result,status from applications where id=$1", [application])).rows)
    .toEqual([{ ai_result: null, status: "POSTULADO" }]);
  expect((await as(ids.hr, "select result from application_assessments where application_id=$1", [application])).rows)
    .toEqual([{ result: assessment }]);
  expect((await as(ids.employee, "select summary,model from climate_surveys where id=$1", [survey])).rows)
    .toEqual([{ summary: null, model: null }]);
  expect((await as(ids.manager, "select summary,model from climate_analyses where survey_id=$1", [survey])).rows)
    .toEqual([{ summary: climate, model: "modelo-anterior" }]);
});
it.each(["candidate", "other", "employee", "manager", "otherManager"] as const)(
  "%s no puede leer evaluaciones de reclutamiento", async (role) => {
    expect((await as(ids[role], "select * from application_assessments")).rows).toEqual([]);
  });
it.each(["hr", "admin"] as const)("%s conserva las evaluaciones internas", async (role) => {
  expect((await as(ids[role], "select result from application_assessments")).rows).toEqual([{ result: assessment }]);
});
it.each(["employee", "candidate", "otherManager"] as const)(
  "%s no descarga el análisis de clima por tabla, RPC ni representación JSON", async (role) => {
    expect((await as(ids[role], "select * from climate_analyses")).rows).toEqual([]);
    expect(JSON.stringify((await as(ids[role], "select row_to_json(s) from climate_surveys s")).rows)).not.toContain(climate.summary);
    await expect(as(ids[role], "select climate_results($1)", [survey])).rejects.toThrow();
  });
it.each(["hr", "admin", "manager"] as const)(
  "%s sigue viendo los resultados y promedios autorizados", async (role) => {
    const group = (await as(ids[role], "select climate_results($1) as result", [survey])).rows[0] as { result: { summary: unknown; averages: unknown[] } };
    expect(group.result.summary).toEqual(climate);
    expect(group.result.averages).toHaveLength(3);
  });
it("nadie autenticado puede escribir las tablas privadas o llamar al guardado privilegiado", async () => {
  for (const user of Object.values(ids)) {
    await expect(as(user, "update application_assessments set result='{}' where application_id=$1", [application])).rejects.toThrow("permission denied");
    await expect(as(user, "update climate_analyses set summary='{}' where survey_id=$1", [survey])).rejects.toThrow("permission denied");
    await expect(as(user, "select save_climate_analysis($1,$2,$3,'modelo')", [survey, user, climate])).rejects.toThrow("permission denied");
  }
  await owner();
  await expect(db.query("update applications set ai_result=$1 where id=$2", [assessment, application])).rejects.toThrow("application_assessment_private");
  await expect(db.query("update climate_surveys set summary=$1 where id=$2", [climate, survey])).rejects.toThrow("climate_analysis_private");
});
it("el guardado de clima vuelve a validar actor, cierre y umbrales", async () => {
  await expect(as(ids.admin, "select save_climate_analysis($1,$2,$3,'modelo')", [survey, ids.employee, climate], true)).rejects.toThrow();
  await as(ids.admin, "select save_climate_analysis($1,$2,$3,'nuevo')", [survey, ids.manager, climate], true);
  expect((await as(ids.hr, "select model from climate_analyses where survey_id=$1", [survey])).rows).toEqual([{ model: "nuevo" }]);
  await owner();
  await db.query("update climate_surveys set status='OPEN' where id=$1", [survey]);
  await expect(as(ids.admin, "select save_climate_analysis($1,$2,$3,'modelo')", [survey, ids.manager, climate], true)).rejects.toThrow("CLIMATE_CLOSE_FIRST");
  await owner();
  await db.query("update climate_surveys set status='CLOSED' where id=$1", [survey]);
  await db.query("delete from climate_answers where id=(select id from climate_answers where survey_id=$1 limit 1)", [survey]);
  await expect(as(ids.admin, "select save_climate_analysis($1,$2,$3,'modelo')", [survey, ids.manager, climate], true)).rejects.toThrow("CLIMATE_MINIMUM");
  await owner();
  await db.query("insert into climate_answers(survey_id,ratings) values($1,'[3,2,4]')", [survey]);
});
it("finish_ai persiste en privado y revoca también la copia histórica al cambiar de rol", async () => {
  const run = (await as(ids.hr, "select command('ai.begin',$1) as result", [{ id: application, use_case: "recruitment", provider: "ollama" }])).rows[0] as { result: { id: string } };
  await as(ids.hr, "select finish_ai($1,$2,'modelo',true)", [run.result.id, assessment], true);
  expect((await as(ids.hr, "select result from ai_results where request_id=$1", [run.result.id])).rows).toEqual([{ result: assessment }]);
  await owner();
  await db.query("update profiles set role='CANDIDATO' where id=$1", [ids.hr]);
  expect((await as(ids.hr, "select * from ai_results where request_id=$1", [run.result.id])).rows).toEqual([]);
  expect((await as(ids.hr, "select * from application_assessments")).rows).toEqual([]);
  await owner();
  await db.query("update profiles set role='RH_ADMIN' where id=$1", [ids.hr]);
  expect((await as(ids.hr, "select result from application_assessments where application_id=$1", [application])).rows).toEqual([{ result: assessment }]);
});
it("cambios de CV/vacante y reaplicación invalidan la evaluación privada", async () => {
  async function restore() {
    await owner();
    await db.query("insert into application_assessments(application_id,result) values($1,$2) on conflict(application_id) do update set result=excluded.result", [application, assessment]);
  }
  await restore();
  await db.query("update candidates set cv_path=$1 where id=$2", [ids.candidate + "/nuevo.pdf", candidate]);
  expect((await as(ids.hr, "select * from application_assessments")).rows).toEqual([]);
  await restore();
  await db.query("update vacancies set title='Vacante actualizada' where id=$1", [vacancy]);
  expect((await as(ids.hr, "select * from application_assessments")).rows).toEqual([]);
  await restore();
  await as(ids.candidate, "select withdraw_application($1)", [application]);
  await as(ids.candidate, "select command('application.create',$1)", [{ vacancy_id: vacancy }]);
  expect((await as(ids.hr, "select * from application_assessments")).rows).toEqual([]);
  expect((await as(ids.candidate, "select status from applications where id=$1", [application])).rows).toEqual([{ status: "POSTULADO" }]);
});
