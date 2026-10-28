/**
 * Notas internas de entrevista: el candidato lee sus entrevistas, pero no las notas, ni con su
 * token en PostgreSQL ni por las respuestas de la API. RH conserva lectura y edición.
 */
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { interviewNotes } from "@/lib/private-analyses";

let db: PGlite;
const migration = "202610280001_private_interview_notes.sql";
const ids = {
  hr: "92000000-0000-4000-8000-000000000001",
  candidate: "92000000-0000-4000-8000-000000000002",
  admin: "92000000-0000-4000-8000-000000000003",
  manager: "92000000-0000-4000-8000-000000000004",
};
const legacyNote = "Nota previa ficticia: dudas sobre la expectativa salarial";
const newNote = "Nota interna ficticia: perfil fuerte en SQL";
let application: string, legacyInterview: string;
async function as(user: string, sql: string, params: unknown[] = []) {
  await db.exec("reset role;set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  return db.query(sql, params);
}
async function command(user: string, op: string, payload: unknown) {
  const r = await as(user, "select public.command($1,$2) as result", [op, JSON.stringify(payload)]);
  return (r.rows[0] as { result: { id: string } }).result.id;
}
async function owner() {
  await db.exec("reset role");
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
  for (const [id, role] of [[ids.hr, "RH_ADMIN"], [ids.admin, "SUPERUSER"], [ids.manager, "JEFE"]])
    await db.query("update profiles set role=$1::public.app_role where id=$2", [role, id]);
  const department = (await db.query<{ id: string }>("insert into departments(name) values('Entrevistas ficticias') returning id")).rows[0].id;
  const position = (await db.query<{ id: string }>("insert into positions(name,department_id) values('Analista',$1) returning id", [department])).rows[0].id;
  const vacancy = (await db.query<{ id: string }>("insert into vacancies(position_id,title,description,requirements,created_by,status) values($1,'Analista','Descripción','Requisitos',$2,'PUBLISHED') returning id", [position, ids.hr])).rows[0].id;
  const candidate = (await db.query<{ id: string }>("select id from candidates where profile_id=$1", [ids.candidate])).rows[0].id;
  await db.query("update candidates set cv_path=$1 where id=$2", [ids.candidate + "/cv.pdf", candidate]);
  application = (await db.query<{ id: string }>("insert into applications(candidate_id,vacancy_id,status) values($1,$2,'PRESELECCIONADO') returning id", [candidate, vacancy])).rows[0].id;
  // Entrevista anterior a la migración, con la nota todavía en la columna pública.
  legacyInterview = (await db.query<{ id: string }>("insert into interviews(application_id,scheduled_at,interviewer_id,notes,status,created_by) values($1,'2027-01-05T15:00:00Z',$2,$3,'CANCELLED',$2) returning id", [application, ids.hr, legacyNote])).rows[0].id;
  await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
});
afterAll(async () => { await db?.close(); });

it("migra las notas existentes a la tabla privada y vacía la columna pública", async () => {
  await owner();
  expect((await db.query("select notes from interviews where id=$1", [legacyInterview])).rows).toEqual([{ notes: "" }]);
  expect((await as(ids.hr, "select notes from interview_notes where interview_id=$1", [legacyInterview])).rows)
    .toEqual([{ notes: legacyNote }]);
});

it("guarda las notas nuevas en privado y el candidato no puede leerlas con su token", async () => {
  const interview = await command(ids.hr, "interview.save", {
    application_id: application,
    scheduled_at: "2027-01-06T15:00:00Z",
    interviewer_id: ids.hr,
    notes: newNote,
    status: "SCHEDULED",
  });
  const own = await as(ids.candidate, "select id,status,notes from interviews where application_id=$1 order by scheduled_at", [application]);
  expect(own.rows).toEqual([
    { id: legacyInterview, status: "CANCELLED", notes: "" },
    { id: interview, status: "SCHEDULED", notes: "" },
  ]);
  expect((await as(ids.candidate, "select * from interview_notes")).rows).toEqual([]);
  const json = JSON.stringify((await as(ids.candidate, "select row_to_json(i) from interviews i")).rows);
  expect(json).not.toContain(newNote);
  expect(json).not.toContain(legacyNote);
  expect((await as(ids.manager, "select * from interview_notes")).rows).toEqual([]);
  for (const user of [ids.hr, ids.admin])
    expect((await as(user, "select notes from interview_notes where interview_id=$1", [interview])).rows)
      .toEqual([{ notes: newNote }]);
});

it("nadie escribe la tabla privada directamente y la columna pública falla cerrado", async () => {
  for (const user of Object.values(ids))
    await expect(as(user, "insert into interview_notes(interview_id,notes) values($1,'x')", [legacyInterview]))
      .rejects.toThrow("permission denied");
  await owner();
  // Aunque el disparador se desactivara, la restricción impide volver a guardar notas públicas.
  await db.exec("alter table interviews disable trigger interview_notes_private");
  try {
    await expect(db.query("update interviews set notes='filtrada' where id=$1", [legacyInterview]))
      .rejects.toThrow("interview_notes_private");
  } finally {
    await db.exec("alter table interviews enable trigger interview_notes_private");
  }
});

it("cancelar conserva la nota y editarla sin texto la elimina", async () => {
  const payload = {
    application_id: application,
    scheduled_at: "2027-01-07T15:00:00Z",
    interviewer_id: ids.hr,
    notes: newNote,
    status: "SCHEDULED",
  };
  await owner();
  await db.query("update interviews set status='CANCELLED' where application_id=$1 and status='SCHEDULED'", [application]);
  const interview = await command(ids.hr, "interview.save", payload);
  await command(ids.hr, "interview.cancel", { id: interview });
  expect((await as(ids.hr, "select notes from interview_notes where interview_id=$1", [interview])).rows)
    .toEqual([{ notes: newNote }]);
  await command(ids.hr, "interview.save", { ...payload, id: interview, notes: "", status: "CANCELLED" });
  expect((await as(ids.hr, "select * from interview_notes where interview_id=$1", [interview])).rows).toEqual([]);
});

function fakeClient(rows: { interview_id: string; notes: string }[]) {
  const query = { select: vi.fn(), in: vi.fn() };
  query.select.mockReturnValue(query);
  query.in.mockResolvedValue({ data: rows, error: null });
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as unknown as SupabaseClient, from };
}

it("la API quita las notas al candidato aunque la base esté desactualizada", async () => {
  const { client, from } = fakeClient([{ interview_id: "i1", notes: newNote }]);
  const result = await interviewNotes(client, [{ id: "i1", status: "SCHEDULED", notes: legacyNote }], "CANDIDATO");
  expect(result).toEqual([{ id: "i1", status: "SCHEDULED" }]);
  expect(JSON.stringify(result)).not.toContain(legacyNote);
  expect(from).not.toHaveBeenCalled();
});

it("la API devuelve a RH las notas desde la tabla privada", async () => {
  const { client, from } = fakeClient([{ interview_id: "i1", notes: newNote }]);
  const result = await interviewNotes(client, [{ id: "i1", notes: "" }, { id: "i2" }], "RH_ADMIN");
  expect(from).toHaveBeenCalledWith("interview_notes");
  expect(result).toEqual([{ id: "i1", notes: newNote }, { id: "i2", notes: "" }]);
});
