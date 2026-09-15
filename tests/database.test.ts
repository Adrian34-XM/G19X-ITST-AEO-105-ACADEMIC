import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
let db: PGlite;
const ids = {
  hr: "30000000-0000-4000-8000-000000000001",
  candidate: "30000000-0000-4000-8000-000000000002",
  other: "30000000-0000-4000-8000-000000000003",
  admin: "30000000-0000-4000-8000-000000000004",
  manager: "30000000-0000-4000-8000-000000000005",
};
const pos = "20000000-0000-4000-8000-000000000001";
let vacancy: string, app: string, employee: string;
async function as(user: string, sql: string, params: unknown[] = []) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`,
  );
  return db.query(sql, params);
}
async function command(user: string, op: string, payload: unknown) {
  const r = await as(user, "select public.command($1,$2) as result", [
    op,
    JSON.stringify(payload),
  ]);
  return (r.rows[0] as { result: { id: string } }).result.id;
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
  for (const file of (await readdir("supabase/migrations")).sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  for (const [role, id] of Object.entries(ids))
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [
        id,
        role + "@test.local",
        JSON.stringify({ full_name: role, role: "SUPERUSER" }),
      ],
    );
  await db.exec(
    `update public.profiles set role='RH_ADMIN' where id='${ids.hr}';update public.profiles set role='SUPERUSER' where id='${ids.admin}';update public.profiles set role='JEFE' where id='${ids.manager}';`,
  );
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL real: transacciones, RLS y aislamiento", () => {
  it("registro ignora el rol del metadata", async () => {
    const r = await as(ids.candidate, "select role from profiles");
    expect(r.rows).toEqual([{ role: "CANDIDATO" }]);
  });
  it("rechaza acceso sin auth, roles erróneos y escritura directa", async () => {
    await expect(
      command("", "department.save", { name: "hack" }),
    ).rejects.toThrow();
    await expect(
      command(ids.candidate, "department.save", { name: "hack" }),
    ).rejects.toThrow();
    await expect(
      as(ids.candidate, "update profiles set role='SUPERUSER' where id=$1", [
        ids.candidate,
      ]),
    ).rejects.toThrow();
  });
  it("RH publica y candidato se postula; evita duplicados y aísla candidatos", async () => {
    vacancy = await command(ids.hr, "vacancy.save", {
      position_id: pos,
      title: "Full Stack",
      description: "Desarrollo de producto",
      requirements: "React PostgreSQL",
      skills: ["React"],
      experience_required: 2,
      status: "PUBLISHED",
    });
    app = await command(ids.candidate, "application.create", {
      vacancy_id: vacancy,
    });
    await expect(
      command(ids.candidate, "application.create", { vacancy_id: vacancy }),
    ).rejects.toThrow();
    expect(
      (await as(ids.other, "select * from applications where id=$1", [app]))
        .rows,
    ).toHaveLength(0);
    expect(
      (
        await as(ids.other, "select * from candidates where profile_id=$1", [
          ids.candidate,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("no permite saltar a contratado ni contratar sin entrevista", async () => {
    await expect(
      command(ids.hr, "application.status", { id: app, status: "CONTRATADO" }),
    ).rejects.toThrow();
    await expect(
      command(ids.hr, "application.hire", { id: app }),
    ).rejects.toThrow();
    expect((await as(ids.hr, "select * from employees")).rows).toHaveLength(0);
  });
  it("visitantes ven solo vacantes publicadas sin acceso a postulaciones", async () => {
    const draft = await command(ids.hr, "vacancy.save", {
      position_id: pos,
      title: "Borrador privado",
      description: "Borrador",
      requirements: "React",
      skills: [],
      experience_required: 0,
      status: "DRAFT",
    });
    await db.exec(
      "reset role;set role anon;select set_config('request.jwt.claim.sub','',false);",
    );
    const visible = await db.query("select id from public.vacancies");
    expect(visible.rows).toEqual([{ id: vacancy }]);
    expect(visible.rows).not.toContainEqual({ id: draft });
    await expect(
      db.query("select id from public.applications"),
    ).rejects.toThrow("permission denied");
  });
  it("agenda entrevista, detecta conflictos y contrata atómicamente", async () => {
    await command(ids.hr, "application.status", {
      id: app,
      status: "EN_REVISION",
    });
    await command(ids.hr, "application.status", {
      id: app,
      status: "PRESELECCIONADO",
    });
    await command(ids.hr, "interview.save", {
      application_id: app,
      scheduled_at: "2026-12-01T15:00:00Z",
      interviewer_id: ids.hr,
      notes: "Entrevista técnica",
      status: "SCHEDULED",
    });
    await expect(
      command(ids.hr, "interview.save", {
        application_id: app,
        scheduled_at: "2026-12-01T15:30:00Z",
        interviewer_id: ids.hr,
        notes: "Conflicto",
        status: "SCHEDULED",
      }),
    ).rejects.toThrow();
    await db.exec(
      `reset role;create function public.fail_assignment() returns trigger language plpgsql as $$begin raise exception 'injected transaction failure';end$$;create trigger injected_failure before insert on course_assignments for each row execute function public.fail_assignment();`,
    );
    await expect(
      command(ids.hr, "application.hire", { id: app }),
    ).rejects.toThrow("injected transaction failure");
    expect((await as(ids.hr, "select * from employees")).rows).toHaveLength(0);
    expect(
      (
        await as(ids.candidate, "select role from profiles where id=$1", [
          ids.candidate,
        ])
      ).rows,
    ).toEqual([{ role: "CANDIDATO" }]);
    expect(
      (await as(ids.hr, "select status from applications where id=$1", [app]))
        .rows,
    ).toEqual([{ status: "ENTREVISTA" }]);
    await db.exec(
      "reset role;drop trigger injected_failure on course_assignments;drop function public.fail_assignment();",
    );
    employee = await command(ids.hr, "application.hire", { id: app });
    expect(
      (
        await as(ids.candidate, "select role from profiles where id=$1", [
          ids.candidate,
        ])
      ).rows,
    ).toEqual([{ role: "EMPLEADO" }]);
    expect(
      (await as(ids.candidate, "select * from onboarding_items")).rows,
    ).toHaveLength(4);
    expect(
      (await as(ids.candidate, "select * from course_assignments")).rows,
    ).toHaveLength(2);
    expect((await as(ids.candidate, "select * from tasks")).rows).toHaveLength(
      1,
    );
    await expect(
      command(ids.hr, "application.hire", { id: app }),
    ).rejects.toThrow();
    expect(
      (await as(ids.hr, "select * from employees where id=$1", [employee]))
        .rows,
    ).toHaveLength(1);
  });
  it("onboarding, cursos, evidencia y revisión humana actualizan datos reales", async () => {
    const items = await as(ids.candidate, "select id from onboarding_items");
    for (const item of items.rows as { id: string }[])
      await command(ids.candidate, "onboarding.complete", item);
    expect(
      (await as(ids.candidate, "select status from onboarding")).rows,
    ).toEqual([{ status: "COMPLETED" }]);
    const courses = await as(
      ids.candidate,
      "select id from course_assignments",
    );
    for (const c of courses.rows as { id: string }[])
      await command(ids.candidate, "course.progress", {
        id: c.id,
        progress: 100,
      });
    const task = (await as(ids.candidate, "select id from tasks")).rows[0] as {
      id: string;
    };
    await command(ids.candidate, "task.status", {
      id: task.id,
      status: "IN_PROGRESS",
    });
    await as(
      ids.candidate,
      "insert into storage.objects(bucket_id,name) values($1,$2)",
      ["task-evidence", ids.candidate + "/evidence.txt"],
    );
    await command(ids.candidate, "file.attach", {
      id: task.id,
      bucket: "task-evidence",
      path: ids.candidate + "/evidence.txt",
      text: "Configuración completada",
    });
    await expect(
      command(ids.candidate, "task.status", {
        id: task.id,
        status: "APPROVED",
      }),
    ).rejects.toThrow();
    await command(ids.hr, "task.status", {
      id: task.id,
      status: "APPROVED",
      comments: "Revisado",
    });
    expect(
      (await as(ids.hr, "select status from tasks where id=$1", [task.id]))
        .rows,
    ).toEqual([{ status: "APPROVED" }]);
  });
  it("bloquea IDOR en lectura, acciones, Storage y AI", async () => {
    expect(
      (await as(ids.other, "select * from employees where id=$1", [employee]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await as(ids.other, "select * from task_evidence")).rows,
    ).toHaveLength(0);
    expect(
      (await as(ids.other, "select * from storage.objects")).rows,
    ).toHaveLength(0);
    await expect(
      as(
        ids.other,
        "insert into storage.objects(bucket_id,name) values($1,$2)",
        ["cvs", ids.candidate + "/hack.txt"],
      ),
    ).rejects.toThrow();
    await expect(
      command(ids.other, "ai.begin", {
        id: app,
        use_case: "recruitment",
        provider: "ollama",
      }),
    ).rejects.toThrow();
    await expect(
      as(ids.candidate, "select public.finish_ai($1,$2,$3,$4)", [
        crypto.randomUUID(),
        "{}",
        "fake",
        true,
      ]),
    ).rejects.toThrow();
  });
  it("jefe solo puede ver y asignar a su equipo", async () => {
    await db.exec("reset role");
    const m = (
      await db.query(
        "insert into employees(profile_id,position_id) values($1,$2) returning id",
        [ids.manager, pos],
      )
    ).rows[0] as { id: string };
    expect(
      (await as(ids.manager, "select * from employees where id=$1", [employee]))
        .rows,
    ).toHaveLength(0);
    await command(ids.hr, "employee.save", {
      id: employee,
      position_id: pos,
      manager_id: m.id,
      status: "ACTIVE",
    });
    expect(
      (await as(ids.manager, "select * from employees where id=$1", [employee]))
        .rows,
    ).toHaveLength(1);
    await command(ids.manager, "task.save", {
      employee_id: employee,
      title: "Revisión de equipo",
      description: "Documentar entrega",
      priority: "LOW",
      due_date: "2026-12-30",
    });
  });
  it("datos manuales asignan roles y equipo sin duplicar al repetir", async () => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
    for (const email of ['admin@nexo.test','rh@nexo.test','jefe@nexo.test','empleado1@nexo.test','candidato1@nexo.test']) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [crypto.randomUUID(),email]);
    }
    const sql = await readFile('supabase/datos-prueba-manuales.sql','utf8');
    await db.exec(sql);
    await db.exec(sql);
    expect((await db.query("select role from profiles where email='admin@nexo.test'")).rows).toEqual([{role:'SUPERUSER'}]);
    expect((await db.query("select role from profiles where email='candidato1@nexo.test'")).rows).toEqual([{role:'CANDIDATO'}]);
    expect((await db.query("select e.id from employees e join profiles p on p.id=e.profile_id join employees boss on boss.id=e.manager_id join profiles b on b.id=boss.profile_id where p.email='empleado1@nexo.test' and b.email='jefe@nexo.test'")).rows).toHaveLength(1);
    expect((await db.query("select id from tasks where title='Presentación de prueba'")).rows).toHaveLength(1);
    expect((await db.query("select id from vacancies where title='Desarrollador Full Stack — prueba'")).rows).toHaveLength(1);
  });
  it("jefe inicia análisis de evidencia sin ambigüedad de alias SQL", async () => {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
    const taskId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    await db.query("insert into tasks(id,title,description,employee_id,created_by,due_date,status) values($1,'Prueba IA','Revisar documento',$2,$3,current_date,'SUBMITTED')", [taskId,employee,ids.manager]);
    await db.query("insert into task_evidence(id,task_id,employee_id,file_path,evidence_text) values($1,$2,$3,'test/document.txt','Documento ficticio')", [evidenceId,taskId,employee]);
    const requestId = await command(ids.manager,'ai.begin',{id:evidenceId,use_case:'evidence',provider:'gemini'});
    expect(requestId).toBeTruthy();
    expect((await as(ids.manager,'select status from ai_requests where id=$1',[requestId])).rows).toEqual([{status:'PENDING'}]);
    await expect(command(ids.other,'ai.begin',{id:evidenceId,use_case:'evidence',provider:'gemini'})).rejects.toThrow();
  });
  it("desactivación revoca permisos y auditoría es inmutable", async () => {
    await command(ids.admin, "profile.admin", {
      id: ids.other,
      role: "CANDIDATO",
      active: false,
    });
    await expect(
      command(ids.other, "candidate.save", {
        phone: "",
        skills: [],
        experience_years: 0,
      }),
    ).rejects.toThrow();
    await expect(as(ids.hr, "delete from audit_logs")).rejects.toThrow();
    expect(
      (
        await as(
          ids.hr,
          "select * from audit_logs where action='candidate.hired'",
        )
      ).rows,
    ).toHaveLength(1);
  });
});
