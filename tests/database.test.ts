/**
 * Pruebas sobre PostgreSQL embebido mediante PGlite. Preparan esquemas auxiliares de Auth y Storage, aplican migraciones y comprueban transacciones, RLS y permisos.
 */
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mexicoDate, nonWorkingDay } from "@/lib/working-days";
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
beforeAll(async () => {
  await db.exec(
    "reset role; update public.candidates set cv_path='fixture/cv.pdf'",
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
    for (const item of items.rows as { id: string }[]) {
      await command(ids.candidate, "onboarding.complete", item);
      expect(
        (
          await as(
            ids.candidate,
            "select status from onboarding_items where id=$1",
            [item.id],
          )
        ).rows,
      ).toEqual([{ status: "SUBMITTED" }]);
      await as(ids.hr, "select onboarding_command($1,$2)", [
        "item.review",
        JSON.stringify({
          id: item.id,
          status: "COMPLETED",
          comments: "Verificado",
        }),
      ]);
    }
    expect(
      (await as(ids.candidate, "select status from onboarding")).rows,
    ).toEqual([{ status: "COMPLETED" }]);
    const courses = await as(
      ids.candidate,
      "select id from course_assignments",
    );
    for (const c of courses.rows as { id: string }[]) {
      await expect(
        command(ids.candidate, "course.progress", { id: c.id, progress: 100 }),
      ).rejects.toThrow("COURSE_EVIDENCE_REQUIRED");
      const path = `${ids.candidate}/${c.id}.txt`;
      await as(
        ids.candidate,
        "insert into storage.objects(bucket_id,name) values('course-evidence',$1)",
        [path],
      );
      await expect(
        as(ids.other, "select attach_course_evidence($1,$2,$3,100)", [
          c.id,
          path,
          "Texto de prueba",
        ]),
      ).rejects.toThrow();
      await as(ids.candidate, "select attach_course_evidence($1,$2,$3,100)", [
        c.id,
        path,
        "Texto de prueba",
      ]);
      expect(
        (
          await as(
            ids.other,
            "select id from course_evidence where assignment_id=$1",
            [c.id],
          )
        ).rows,
      ).toHaveLength(0);
      await command(ids.candidate, "course.progress", {
        id: c.id,
        progress: 100,
      });
      expect(
        (
          await as(
            ids.candidate,
            "select status from course_assignments where id=$1",
            [c.id],
          )
        ).rows,
      ).toEqual([{ status: "SUBMITTED" }]);
      await expect(
        command(ids.candidate, "course.review", {
          id: c.id,
          status: "COMPLETED",
          comments: "Yo mismo",
        }),
      ).rejects.toThrow();
      await command(ids.hr, "course.review", {
        id: c.id,
        status: "IN_PROGRESS",
        comments: "Adjunta corrección",
      });
      await expect(
        command(ids.candidate, "course.progress", { id: c.id, progress: 100 }),
      ).rejects.toThrow("COURSE_EVIDENCE_REQUIRED");
      const corrected = `${ids.candidate}/${c.id}-corregida.txt`;
      await as(
        ids.candidate,
        "insert into storage.objects(bucket_id,name) values('course-evidence',$1)",
        [corrected],
      );
      await as(ids.candidate, "select attach_course_evidence($1,$2,$3,100)", [
        c.id,
        corrected,
        "Evidencia corregida",
      ]);
      await command(ids.candidate, "course.progress", {
        id: c.id,
        progress: 100,
      });
      await command(ids.hr, "course.review", {
        id: c.id,
        status: "COMPLETED",
        comments: "Comprobado",
      });
      expect(
        (
          await as(
            ids.candidate,
            "select status from course_assignments where id=$1",
            [c.id],
          )
        ).rows,
      ).toEqual([{ status: "COMPLETED" }]);
    }
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
      status: "REJECTED",
      comments: "Incluye los pasos de configuración y el resultado obtenido.",
    });
    expect((await as(ids.candidate, "select status,comments from tasks where id=$1", [task.id])).rows).toEqual([
      { status: "REJECTED", comments: "Incluye los pasos de configuración y el resultado obtenido." },
    ]);
    await as(ids.candidate, "insert into storage.objects(bucket_id,name) values($1,$2)", ["task-evidence", ids.candidate + "/correction.txt"]);
    await command(ids.candidate, "file.attach", {
      id: task.id,
      bucket: "task-evidence",
      path: ids.candidate + "/correction.txt",
      text: "Pasos de configuración y resultado corregidos",
    });
    expect((await as(ids.hr, "select status from tasks where id=$1", [task.id])).rows).toEqual([{ status: "SUBMITTED" }]);
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
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false)",
    );
    for (const email of [
      "admin@nexo.test",
      "rh@nexo.test",
      "jefe@nexo.test",
      "empleado1@nexo.test",
      "candidato1@nexo.test",
    ]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        crypto.randomUUID(),
        email,
      ]);
    }
    const sql = await readFile("supabase/datos-prueba-manuales.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);
    expect(
      (
        await db.query(
          "select role from profiles where email='admin@nexo.test'",
        )
      ).rows,
    ).toEqual([{ role: "SUPERUSER" }]);
    expect(
      (
        await db.query(
          "select role from profiles where email='candidato1@nexo.test'",
        )
      ).rows,
    ).toEqual([{ role: "CANDIDATO" }]);
    expect(
      (
        await db.query(
          "select e.id from employees e join profiles p on p.id=e.profile_id join employees boss on boss.id=e.manager_id join profiles b on b.id=boss.profile_id where p.email='empleado1@nexo.test' and b.email='jefe@nexo.test'",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select id from tasks where title='Presentación de prueba'",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select id from vacancies where title='Desarrollador Full Stack — prueba'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("jefe inicia análisis de evidencia sin ambigüedad de alias SQL", async () => {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false)",
    );
    const taskId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();
    await db.query(
      "insert into tasks(id,title,description,employee_id,created_by,due_date,status) values($1,'Prueba IA','Revisar documento',$2,$3,public.next_working_day(current_date),'SUBMITTED')",
      [taskId, employee, ids.manager],
    );
    await db.query(
      "insert into task_evidence(id,task_id,employee_id,file_path,evidence_text) values($1,$2,$3,'test/document.txt','Documento ficticio')",
      [evidenceId, taskId, employee],
    );
    const requestId = await command(ids.manager, "ai.begin", {
      id: evidenceId,
      use_case: "evidence",
      provider: "gemini",
    });
    expect(requestId).toBeTruthy();
    expect(
      (
        await as(ids.manager, "select status from ai_requests where id=$1", [
          requestId,
        ])
      ).rows,
    ).toEqual([{ status: "PENDING" }]);
    await expect(
      command(ids.other, "ai.begin", {
        id: evidenceId,
        use_case: "evidence",
        provider: "gemini",
      }),
    ).rejects.toThrow();
  });
  it("entrevistas: editar, cancelar, liberar horario y rechazar cambios ajenos", async () => {
    const candidateId = (await as(ids.other, "select id from candidates"))
      .rows[0] as { id: string };
    await db.exec("reset role");
    const newApp = crypto.randomUUID();
    await db.query(
      "insert into applications(id,candidate_id,vacancy_id,status) values($1,$2,$3,'PRESELECCIONADO')",
      [newApp, candidateId.id, vacancy],
    );
    const payload = {
      application_id: newApp,
      scheduled_at: "2027-01-05T15:00:00Z",
      interviewer_id: ids.hr,
      notes: "Prueba agenda",
      status: "SCHEDULED",
    };
    const interview = await command(ids.hr, "interview.save", payload);
    await command(ids.hr, "interview.save", {
      ...payload,
      id: interview,
      scheduled_at: "2027-01-05T16:00:00Z",
    });
    await expect(
      command(ids.other, "interview.cancel", { id: interview }),
    ).rejects.toThrow();
    await command(ids.hr, "interview.cancel", { id: interview });
    const replacement = await command(ids.hr, "interview.save", {
      ...payload,
      scheduled_at: "2027-01-05T16:00:00Z",
    });
    expect(replacement).not.toBe(interview);
    expect(
      (
        await as(ids.other, "select status from interviews where id=$1", [
          interview,
        ])
      ).rows,
    ).toEqual([{ status: "CANCELLED" }]);
  });
  it("onboarding y evidencias: impide operar fuera del equipo", async () => {
    const item = (await as(ids.hr, "select id from onboarding_items limit 1"))
      .rows[0] as { id: string };
    await expect(
      command(ids.other, "onboarding.complete", { id: item.id }),
    ).rejects.toThrow();
    const foreign = (
      await as(
        ids.hr,
        "select e.id from employees e join profiles p on p.id=e.profile_id where p.email='empleado1@nexo.test'",
      )
    ).rows[0] as { id: string };
    expect(
      (
        await as(ids.manager, "select id from tasks where employee_id=$1", [
          foreign.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await as(
          ids.manager,
          "select id from task_evidence where employee_id=$1",
          [foreign.id],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      command(ids.manager, "task.save", {
        employee_id: foreign.id,
        title: "No autorizado",
        description: "Fuera del equipo",
        priority: "LOW",
        due_date: "2027-01-01",
      }),
    ).rejects.toThrow();
  });
  it("auditoría solo superadmin y orquestación privada con bloqueo de concurrencia", async () => {
    expect((await as(ids.hr, "select id from audit_logs")).rows).toHaveLength(
      0,
    );
    const audit = await as(
      ids.admin,
      "select metadata from audit_logs where action='UPDATE' and resource_type='interviews' order by created_at desc limit 1",
    );
    expect(
      (audit.rows[0] as { metadata: { changed_fields: string[] } }).metadata
        .changed_fields,
    ).toContain("status");
    const run = await as(
      ids.manager,
      "select public.begin_orchestration('tasks') as id",
    );
    const id = (run.rows[0] as { id: string }).id;
    expect(
      (await as(ids.hr, "select * from orchestration_runs where id=$1", [id]))
        .rows,
    ).toHaveLength(0);
    await expect(
      as(ids.manager, "select public.begin_orchestration('tasks')"),
    ).rejects.toThrow("AI_IN_PROGRESS");
    await expect(
      as(ids.other, "select public.begin_orchestration('performance')"),
    ).rejects.toThrow();
    await expect(
      as(
        ids.manager,
        "update orchestration_runs set status='COMPLETED' where id=$1",
        [id],
      ),
    ).rejects.toThrow();
  });
  it("superadmin da de alta RH y opera vacantes, tareas, encuestas y analíticas", async () => {
    await db.exec(
      "reset role; select set_config('request.jwt.claim.sub','',false)",
    );
    const newUser = crypto.randomUUID();
    await db.query(
      "insert into auth.users(id,email) values($1,'nuevo-rh@test.local')",
      [newUser],
    );
    await command(ids.admin, "profile.admin", {
      id: newUser,
      role: "RH_ADMIN",
      active: true,
    });
    expect(
      (await as(newUser, "select public.is_hr() as allowed")).rows,
    ).toEqual([{ allowed: true }]);
    const v = await command(ids.admin, "vacancy.save", {
      position_id: pos,
      title: "Vacante de superadmin",
      description: "Puesto de prueba",
      requirements: "Requisitos",
      skills: [],
      experience_required: 0,
      status: "DRAFT",
    });
    expect(
      (await as(ids.admin, "select id from vacancies where id=$1", [v])).rows,
    ).toHaveLength(1);
    expect(
      (await as(ids.other, "select id from vacancies where id=$1", [v])).rows,
    ).toHaveLength(0);
    await command(ids.admin, "task.save", {
      employee_id: employee,
      title: "Seguimiento admin",
      description: "Revisión",
      priority: "LOW",
      due_date: "2027-02-02",
    });
    await as(ids.admin, "select public.climate_command('save',$1)", [
      JSON.stringify({
        title: "Encuesta admin",
        description: "Prueba",
        questions: ["Pregunta uno", "Pregunta dos", "Pregunta tres"],
      }),
    ]);
    await as(ids.admin, "select public.begin_orchestration('analytics')");
    expect(
      (
        await as(
          ids.admin,
          "select metadata from audit_logs where resource_id=$1 and action='INSERT'",
          [v],
        )
      ).rows,
    ).toEqual([
      expect.objectContaining({
        metadata: expect.objectContaining({ actor_role: "SUPERUSER" }),
      }),
    ]);
  });
  it("no permite otra entrevista pendiente del candidato en una segunda vacante", async () => {
    const candidateRow = (await as(ids.other, "select id from candidates"))
      .rows[0] as { id: string };
    const v = await command(ids.admin, "vacancy.save", {
      position_id: pos,
      title: "Otra oportunidad",
      description: "Prueba",
      requirements: "Prueba",
      skills: [],
      experience_required: 0,
      status: "PUBLISHED",
    });
    const application = await command(ids.other, "application.create", {
      vacancy_id: v,
    });
    await command(ids.admin, "application.status", {
      id: application,
      status: "EN_REVISION",
    });
    await command(ids.admin, "application.status", {
      id: application,
      status: "PRESELECCIONADO",
    });
    const input = {
      application_id: application,
      scheduled_at: "2027-03-01T12:00:00Z",
      interviewer_id: ids.admin,
      notes: "",
      status: "SCHEDULED",
    };
    await expect(command(ids.admin, "interview.save", input)).rejects.toThrow(
      "CANDIDATE_SCHEDULED",
    );
    const previous = (
      await as(
        ids.admin,
        "select i.id from interviews i join applications a on a.id=i.application_id where a.candidate_id=$1 and i.status='SCHEDULED'",
        [candidateRow.id],
      )
    ).rows[0] as { id: string };
    await command(ids.admin, "interview.cancel", { id: previous.id });
    const id = await command(ids.admin, "interview.save", input);
    await command(ids.admin, "interview.save", {
      ...input,
      id,
      scheduled_at: "2027-03-02T12:00:00Z",
    });
    expect(
      (await as(ids.admin, "select id from interviews where id=$1", [id])).rows,
    ).toHaveLength(1);
  });
  it("documentos de vacantes son privados y exigen ruta propia y objeto existente", async () => {
    const path = ids.admin + "/referencia.txt";
    await as(
      ids.admin,
      "insert into storage.objects(bucket_id,name) values('vacancy-documents',$1)",
      [path],
    );
    await as(
      ids.admin,
      "select public.attach_vacancy_document($1,$2,'Referencia.txt')",
      [vacancy, path],
    );
    expect(
      (
        await as(
          ids.hr,
          "select id from vacancy_documents where vacancy_id=$1",
          [vacancy],
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (await as(ids.other, "select id from vacancy_documents")).rows,
    ).toHaveLength(0);
    expect(
      (
        await as(
          ids.other,
          "select name from storage.objects where bucket_id='vacancy-documents'",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      as(
        ids.hr,
        "select public.attach_vacancy_document($1,$2,'Referencia.txt')",
        [vacancy, path],
      ),
    ).rejects.toThrow();
    await expect(
      as(
        ids.other,
        "insert into storage.objects(bucket_id,name) values('vacancy-documents',$1)",
        [ids.other + "/hack.txt"],
      ),
    ).rejects.toThrow();
  });
  it("encuesta anónima: mínimo, duplicados, bloqueo y agregado sin autores", async () => {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
    const people: { user: string; employee: string }[] = [];
    for (let n = 0; n < 5; n++) {
      const user = crypto.randomUUID();
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        user,
        `clima${n}@test.local`,
      ]);
      await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
      const row = (
        await db.query(
          "insert into employees(profile_id,position_id) values($1,$2) returning id",
          [user, pos],
        )
      ).rows[0] as { id: string };
      people.push({ user, employee: row.id });
    }
    const draft = {
      title: "Ambiente prueba",
      description: "Prueba",
      questions: [
        "Recursos adecuados",
        "Comunicación clara",
        "Colaboración positiva",
      ],
    };
    const saved = (
      await as(
        ids.admin,
        "select public.climate_command('save',$1) as result",
        [JSON.stringify(draft)],
      )
    ).rows[0] as { result: { id: string } };
    const sid = saved.result.id;
    const climate = (user: string, op: string, payload: unknown) =>
      as(user, "select public.climate_command($1,$2)", [
        op,
        JSON.stringify(payload),
      ]);
    await expect(
      climate(ids.admin, "publish", {
        id: sid,
        employees: [],
      }),
    ).rejects.toThrow("CLIMATE_RECIPIENT_REQUIRED");
    const smallSurvey = (await climate(ids.admin, "save", draft)).rows[0] as {
      climate_command: { id: string };
    };
    await climate(ids.admin, "publish", {
      id: smallSurvey.climate_command.id,
      employees: [people[0].employee],
    });
    await climate(ids.admin, "publish", {
      id: sid,
      employees: people.map((p) => p.employee),
    });
    await expect(
      climate(ids.admin, "save", { ...draft, id: sid }),
    ).rejects.toThrow("CLIMATE_FROZEN");
    await expect(
      climate(ids.other, "respond", {
        id: sid,
        ratings: [3, 3, 3],
        comment: "",
      }),
    ).rejects.toThrow();
    await climate(people[0].user, "respond", {
      id: sid,
      ratings: [4, 3, 5],
      comment: "Mejorar comunicación",
    });
    await expect(
      climate(people[0].user, "respond", {
        id: sid,
        ratings: [4, 3, 5],
        comment: "",
      }),
    ).rejects.toThrow();
    expect(
      (
        await as(
          ids.admin,
          "select * from climate_participation where survey_id=$1",
          [sid],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      as(ids.admin, "select * from climate_answers"),
    ).rejects.toThrow();
    await expect(
      as(ids.admin, "select public.climate_aggregate($1,$2)", [sid, ids.admin]),
    ).rejects.toThrow();
    for (const p of people.slice(1))
      await climate(p.user, "respond", {
        id: sid,
        ratings: [4, 3, 5],
        comment: "",
      });
    await db.exec("reset role;set role service_role");
    await expect(
      db.query("select public.climate_aggregate($1,$2)", [sid, ids.admin]),
    ).rejects.toThrow("CLIMATE_CLOSE_FIRST");
    await climate(ids.admin, "close", { id: sid });
    await db.exec("reset role;set role service_role");
    const aggregate = (
      await db.query("select public.climate_aggregate($1,$2) as result", [
        sid,
        ids.admin,
      ])
    ).rows[0] as { result: Record<string, unknown> };
    expect(aggregate.result.response_count).toBe(5);
    expect(aggregate.result.averages).toEqual([
      { question_index: 1, average: 4 },
      { question_index: 2, average: 3 },
      { question_index: 3, average: 5 },
    ]);
    for (const p of people)
      expect(JSON.stringify(aggregate)).not.toContain(p.user);
  });
  it("jerarquía multinivel permite subordinados y rechaza ciclos de jefaturas", async () => {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
    const middleUser = crypto.randomUUID();
    await db.query(
      "insert into auth.users(id,email) values($1,'jefe-intermedio@test.local')",
      [middleUser],
    );
    await db.query("update profiles set role='JEFE' where id=$1", [middleUser]);
    const boss = (
      await db.query("select id from employees where profile_id=$1", [
        ids.manager,
      ])
    ).rows[0] as { id: string };
    const middle = (
      await db.query(
        "insert into employees(profile_id,position_id,manager_id) values($1,$2,$3) returning id",
        [middleUser, pos, boss.id],
      )
    ).rows[0] as { id: string };
    await as(ids.admin, "select public.assign_team_manager($1,$2)", [
      employee,
      middle.id,
    ]);
    expect(
      (
        await as(ids.manager, "select id from employees where id=$1", [
          employee,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (await as(middleUser, "select id from employees where id=$1", [employee]))
        .rows,
    ).toHaveLength(1);
    await expect(
      as(ids.admin, "select public.assign_team_manager($1,$2)", [
        boss.id,
        middle.id,
      ]),
    ).rejects.toThrow("HIERARCHY_CYCLE");
    await expect(
      as(middleUser, "select public.assign_team_manager($1,$2)", [
        boss.id,
        middle.id,
      ]),
    ).rejects.toThrow();
    const task = {
      title: "Asignación por jerarquía",
      description: "Solo subordinados",
      priority: "LOW",
      due_date: "2027-02-02",
    };
    // El jefe superior asigna a un jefe intermedio y a un descendiente indirecto.
    for (const recipient of [middle.id, employee])
      await command(ids.manager, "task.save", {
        ...task,
        employee_id: recipient,
      });
    const ownTask = await command(ids.admin, "task.save", {
      ...task,
      employee_id: middle.id,
    });
    // La misma regla protege la llamada individual, la edición y el lote completo.
    for (const forbidden of [middle.id, boss.id]) {
      await expect(
        command(middleUser, "task.save", { ...task, employee_id: forbidden }),
      ).rejects.toThrow();
      await expect(
        as(middleUser, "select public.assign_many('task',$1,$2)", [
          [employee, forbidden],
          JSON.stringify({ ...task, title: "Lote jerarquía rechazado" }),
        ]),
      ).rejects.toThrow();
    }
    await expect(
      command(middleUser, "task.save", {
        ...task,
        id: ownTask,
        employee_id: employee,
      }),
    ).rejects.toThrow();
    expect(
      (
        await as(
          ids.admin,
          "select id from tasks where title='Lote jerarquía rechazado'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("asignaciones múltiples respetan jerarquía, omiten cursos existentes y son atómicas", async () => {
    await db.exec(
      "reset role;select set_config('request.jwt.claim.sub','',false)",
    );
    const boss = (
      await db.query("select id from employees where profile_id=$1", [
        ids.manager,
      ])
    ).rows[0] as { id: string };
    const people: string[] = [];
    for (let i = 0; i < 3; i++) {
      const user = crypto.randomUUID();
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        user,
        `lote-${i}@test.local`,
      ]);
      await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
      const e = (
        await db.query(
          "insert into employees(profile_id,position_id,manager_id) values($1,$2,$3) returning id",
          [user, pos, i < 2 ? boss.id : null],
        )
      ).rows[0] as { id: string };
      people.push(e.id);
    }
    const course = await command(ids.admin, "course.save", {
      title: "Curso en lote",
      description: "Capacitación",
      content: "Contenido",
      duration_minutes: 30,
      required: false,
    });
    const batch = (
      user: string,
      kind: string,
      ids: string[],
      payload: unknown,
    ) =>
      as(user, "select public.assign_many($1,$2,$3) as result", [
        kind,
        ids,
        JSON.stringify(payload),
      ]);
    expect(
      (
        await batch(ids.manager, "course", people.slice(0, 2), {
          id: course,
          due_date: "2027-02-02",
        })
      ).rows,
    ).toEqual([{ result: { created: 2, skipped: 0 } }]);
    expect(
      (
        await batch(ids.manager, "course", people.slice(0, 2), {
          id: course,
          due_date: "2028-02-01",
        })
      ).rows,
    ).toEqual([{ result: { created: 0, skipped: 2 } }]);
    const dates = await as(
      ids.admin,
      "select due_date::text from course_assignments where course_id=$1",
      [course],
    );
    expect(dates.rows).toEqual([
      { due_date: "2027-02-02" },
      { due_date: "2027-02-02" },
    ]);
    const task = {
      title: "Tarea lote seguro",
      description: "Entregar evidencia",
      priority: "LOW",
      due_date: "2027-02-02",
    };
    await expect(
      batch(ids.manager, "task", [people[0], people[2]], task),
    ).rejects.toThrow();
    expect(
      (
        await as(
          ids.admin,
          "select id from tasks where title='Tarea lote seguro'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await batch(ids.manager, "task", people.slice(0, 2), task)).rows,
    ).toEqual([{ result: { created: 2, skipped: 0 } }]);
    const tasks = await as(
      ids.admin,
      "select id,employee_id from tasks where title='Tarea lote seguro'",
    );
    expect(tasks.rows).toHaveLength(2);
    await expect(batch(ids.other, "task", [people[0]], task)).rejects.toThrow();
    await expect(
      batch(ids.manager, "task", [people[0], people[0]], task),
    ).rejects.toThrow();
    await expect(
      batch(ids.manager, "course", [people[2]], {
        id: course,
        due_date: "2027-02-02",
      }),
    ).rejects.toThrow();
    await db.exec("reset role");
    await db.query("update employees set status='INACTIVE' where id=$1", [
      people[0],
    ]);
    await expect(batch(ids.admin, "task", [people[0]], task)).rejects.toThrow();
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
          ids.admin,
          "select * from audit_logs where action='candidate.hired'",
        )
      ).rows,
    ).toHaveLength(1);
  });
});
it("planes de onboarding: plantillas automáticas, responsabilidades, documentos y aislamiento", async () => {
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',false)",
  );
  const user = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'onboarding-plan@test.local')",
    [user],
  );
  await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
  const boss = (
    await db.query("select id from employees where profile_id=$1", [
      ids.manager,
    ])
  ).rows[0] as { id: string };
  const person = (
    await db.query(
      "insert into employees(profile_id,position_id,manager_id) values($1,$2,$3) returning id",
      [user, pos, boss.id],
    )
  ).rows[0] as { id: string };
  const process = (
    await db.query(
      "insert into onboarding(employee_id) values($1) returning id",
      [person.id],
    )
  ).rows[0] as { id: string };
  const op = (who: string, action: string, payload: unknown) =>
    as(who, "select onboarding_command($1,$2) as result", [
      action,
      JSON.stringify(payload),
    ]);
  const steps = [
    {
      title: "Documentación",
      description: "Expediente aprobado",
      owner_role: "EMPLOYEE",
      days: 2,
      requires_document: true,
    },
    {
      title: "Bienvenida",
      description: "Conocer al equipo",
      owner_role: "MANAGER",
      days: 1,
      requires_document: false,
    },
  ];
  await expect(
    op(ids.manager, "template.save", { title: "No autorizado", steps }),
  ).rejects.toThrow();
  const saved = await op(ids.hr, "template.save", {
    title: "Plan del puesto",
    position_id: pos,
    steps,
  });
  const template = (saved.rows[0] as { result: { id: string } }).result.id;
  // Mismo inicializador que utiliza el comando de contratación, con identidad RH.
  await db.exec("reset role");
  await db.query("select initialize_onboarding($1)", [process.id]);
  const items = (
    await as(
      ids.hr,
      "select * from onboarding_items where onboarding_id=$1 order by title",
      [process.id],
    )
  ).rows as { id: string; title: string; due_date: string }[];
  expect(items).toHaveLength(2);
  const docStep = items.find((i) => i.title === "Documentación")!.id,
    bossStep = items.find((i) => i.title === "Bienvenida")!.id;
  expect(
    (
      await as(ids.hr, "select template_id from onboarding where id=$1", [
        process.id,
      ])
    ).rows,
  ).toEqual([{ template_id: template }]);
  await expect(
    op(ids.other, "plan.apply", {
      id: process.id,
      steps,
      start_date: "2026-10-01",
    }),
  ).rejects.toThrow();
  await op(ids.manager, "item.save", {
    id: bossStep,
    owner_role: "MANAGER",
    due_date: "2026-10-02",
  });
  await expect(op(user, "item.complete", { id: bossStep })).rejects.toThrow();
  await expect(
    command(user, "onboarding.complete", { id: bossStep }),
  ).rejects.toThrow();
  await expect(op(user, "item.complete", { id: docStep })).rejects.toThrow(
    "DOCUMENT_REQUIRED",
  );
  await op(ids.manager, "item.complete", { id: bossStep });
  await expect(
    op(ids.hr, "plan.apply", {
      id: process.id,
      steps,
      start_date: "2026-10-01",
    }),
  ).rejects.toThrow("PLAN_STARTED");
  await db.exec("reset role");
  const document = (
    await db.query(
      "insert into onboarding_documents(onboarding_id,item_id,file_path) values($1,$2,'private/test.pdf') returning id",
      [process.id, docStep],
    )
  ).rows[0] as { id: string };
  await expect(
    op(ids.manager, "document.review", {
      id: document.id,
      status: "APPROVED",
      comments: "No autorizado",
    }),
  ).rejects.toThrow();
  expect(
    (
      await as(ids.manager, "select id from onboarding_documents where id=$1", [
        document.id,
      ])
    ).rows,
  ).toHaveLength(0);
  await op(ids.hr, "document.review", {
    id: document.id,
    status: "REJECTED",
    comments: "Sube una versión legible",
  });
  await expect(op(user, "item.complete", { id: docStep })).rejects.toThrow(
    "DOCUMENT_REQUIRED",
  );
  await db.exec("reset role");
  const revision = (
    await db.query(
      "insert into onboarding_documents(onboarding_id,item_id,file_path) values($1,$2,'private/revision.pdf') returning id",
      [process.id, docStep],
    )
  ).rows[0] as { id: string };
  await op(ids.hr, "document.review", {
    id: revision.id,
    status: "APPROVED",
    comments: "Revisión completada",
  });
  await op(user, "item.complete", { id: docStep });
  await expect(
    op(user, "item.review", {
      id: docStep,
      status: "COMPLETED",
      comments: "Auto aprobación",
    }),
  ).rejects.toThrow();
  for (const id of [docStep, bossStep])
    await op(ids.hr, "item.review", {
      id,
      status: "COMPLETED",
      comments: "RH confirma",
    });
  expect(
    (await as(user, "select status from onboarding where id=$1", [process.id]))
      .rows,
  ).toEqual([{ status: "COMPLETED" }]);
});

it("RH aparece en jerarquía, admite superior y no cambia su propio puesto ni usa funciones antiguas", async () => {
  const hrEmployee = await command(ids.admin, "employee.enroll", {
    profile_id: ids.hr,
    position_id: pos,
    manager_id: "",
  });
  const boss = (
    await as(ids.admin, "select id from employees where profile_id=$1", [
      ids.manager,
    ])
  ).rows[0] as { id: string };
  await as(ids.admin, "select assign_team_manager($1,$2)", [
    hrEmployee,
    boss.id,
  ]);
  // Un responsable de RH también puede ser superior de otro equipo.
  await as(ids.admin, "select assign_team_manager($1,$2)", [
    employee,
    hrEmployee,
  ]);
  const position = (
    await as(ids.admin, "select id from positions where id<>$1 limit 1", [pos])
  ).rows[0] as { id: string };
  await expect(
    command(ids.hr, "employee.save", {
      id: hrEmployee,
      position_id: position.id,
      manager_id: boss.id,
      status: "ACTIVE",
    }),
  ).rejects.toThrow();
  await command(ids.admin, "employee.save", {
    id: hrEmployee,
    position_id: position.id,
    manager_id: boss.id,
    status: "ACTIVE",
  });
  for (const fn of ["workforce_legacy_command", "onboarding_legacy_command"])
    await expect(
      as(ids.hr, `select ${fn}($1,$2)`, [
        "employee.save",
        JSON.stringify({ id: hrEmployee }),
      ]),
    ).rejects.toThrow();
  await expect(
    as(ids.admin, "select assign_team_manager($1,$2)", [boss.id, hrEmployee]),
  ).rejects.toThrow("HIERARCHY_CYCLE");
});

it("onboarding nuevo: varios adjuntos, revisión obligatoria y bloqueo de entregas ajenas", async () => {
  await db.exec(
    "reset role; select set_config('request.jwt.claim.sub','',false)",
  );
  const user = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'new-flow@test.local')",
    [user],
  );
  await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
  const e = await command(ids.admin, "employee.enroll", {
    profile_id: user,
    position_id: pos,
    manager_id: "",
  });
  const op = (who: string, action: string, payload: unknown) =>
    as(who, "select onboarding_command($1,$2) as result", [
      action,
      JSON.stringify(payload),
    ]);
  const r = await op(ids.hr, "plan.start", { employee_id: e });
  const process = (r.rows[0] as { result: { id: string } }).result.id;
  await expect(op(ids.hr, "plan.start", { employee_id: e })).rejects.toThrow();
  const step = (
    await as(
      user,
      "select id from onboarding_items where onboarding_id=$1 and requires_document",
      [process],
    )
  ).rows[0] as { id: string };
  await expect(
    op(ids.hr, "item.review", {
      id: step.id,
      status: "COMPLETED",
      comments: "Sin entrega",
    }),
  ).rejects.toThrow();
  await expect(op(ids.hr, "item.complete", { id: step.id })).rejects.toThrow();
  await expect(
    op(ids.hr, "document.attach", { id: step.id, path: ids.hr + "/fake.pdf" }),
  ).rejects.toThrow();
  for (const name of ["uno.pdf", "dos.pdf"])
    await op(user, "document.attach", { id: step.id, path: user + "/" + name });
  await op(user, "item.complete", { id: step.id });
  await expect(
    op(user, "document.attach", { id: step.id, path: user + "/tres.pdf" }),
  ).rejects.toThrow();
  const docs = (
    await as(ids.hr, "select id from onboarding_documents where item_id=$1", [
      step.id,
    ])
  ).rows as { id: string }[];
  expect(docs).toHaveLength(2);
  await op(ids.hr, "document.review", {
    id: docs[0].id,
    status: "APPROVED",
    comments: "Revisado",
  });
  await expect(
    op(ids.hr, "item.review", {
      id: step.id,
      status: "COMPLETED",
      comments: "Hay otro pendiente",
    }),
  ).rejects.toThrow("DOCUMENT_REVIEW_PENDING");
  await op(ids.hr, "document.review", {
    id: docs[1].id,
    status: "APPROVED",
    comments: "Revisado",
  });
  await op(ids.hr, "item.review", {
    id: step.id,
    status: "COMPLETED",
    comments: "Expediente completo",
  });
  expect(
    (
      await as(
        user,
        "select status,reviewed_by from onboarding_items where id=$1",
        [step.id],
      )
    ).rows,
  ).toEqual([{ status: "COMPLETED", reviewed_by: ids.hr }]);
});

it("buzón anónimo: no expone identidades, limita envíos y agrupa comentarios al cierre", async () => {
  await db.exec(
    "reset role; select set_config('request.jwt.claim.sub','',false)",
  );
  const people: { user: string; employee: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const user = crypto.randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      `feedback-${i}@test.local`,
    ]);
    await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
    const e = (
      await db.query(
        "insert into employees(profile_id,position_id) values($1,$2) returning id",
        [user, pos],
      )
    ).rows[0] as { id: string };
    people.push({ user, employee: e.id });
  }
  const op = (action: string, payload: unknown) =>
    as(ids.hr, "select climate_command($1,$2) as result", [
      action,
      JSON.stringify(payload),
    ]);
  const created = await op("save", {
    title: "Buzón",
    description: "Mejoras",
    questions: ["Uno", "Dos", "Tres"],
  });
  const sid = (created.rows[0] as { result: { id: string } }).result.id;
  await op("publish", { id: sid, employees: people.map((p) => p.employee) });
  for (let i = 0; i < 5; i++)
    await as(people[i].user, "select climate_comment($1,$2)", [
      sid,
      `Comentario número ${i}`,
    ]);
  await expect(
    as(people[0].user, "select climate_comment($1,$2)", [sid, "Duplicado"]),
  ).rejects.toThrow();
  await expect(
    as(people[0].user, "select climate_results($1)", [sid]),
  ).rejects.toThrow();
  for (const table of ["climate_feedback", "climate_feedback_receipts"])
    await expect(as(ids.hr, `select * from ${table}`)).rejects.toThrow();
  const before = (
    await as(ids.hr, "select climate_results($1) as result", [sid])
  ).rows[0] as { result: Record<string, unknown> };
  expect(before.result.feedback).toBeUndefined();
  expect(before.result.invited).toBe(5);
  await op("close", { id: sid });
  const after = (
    await as(ids.hr, "select climate_results($1) as result", [sid])
  ).rows[0] as { result: { feedback: string[] } };
  expect(after.result.feedback).toHaveLength(5);
  for (const p of people) expect(JSON.stringify(after)).not.toContain(p.user);
});
it("agenda rechaza el pasado y contratación asigna área, jefe y plantilla en una transacción", async () => {
  await db.exec("reset role");
  const candidate = crypto.randomUUID(),
    manager = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'hire-new@test.local'),($2,'hire-boss@test.local')",
    [candidate, manager],
  );
  await db.query("update profiles set role='JEFE' where id=$1", [manager]);
  await db.query(
    "update candidates set cv_path='fixture/cv.pdf' where profile_id=$1",
    [candidate],
  );
  const dep = await command(ids.admin, "department.save", {
    name: "Área de contratación nueva",
  });
  const position = await command(ids.admin, "position.save", {
    name: "Puesto de contratación",
    department_id: dep,
  });
  const boss = await command(ids.hr, "employee.enroll", {
    profile_id: manager,
    position_id: position,
    manager_id: "",
  });
  await as(ids.hr, "select onboarding_command($1,$2)", [
    "template.save",
    JSON.stringify({
      title: "Plan del destino final",
      position_id: position,
      department_id: dep,
      steps: [
        {
          title: "Bienvenida al área final",
          description: "Presentación",
          owner_role: "EMPLOYEE",
          days: 1,
          requires_document: false,
        },
      ],
    }),
  ]);
  const vacancy = await command(ids.hr, "vacancy.save", {
    position_id: pos,
    title: "Prueba de contratación con destino",
    description: "Prueba",
    requirements: "Prueba",
    skills: [],
    experience_required: 0,
    status: "PUBLISHED",
  });
  const application = await command(candidate, "application.create", {
    vacancy_id: vacancy,
  });
  await command(ids.hr, "application.status", {
    id: application,
    status: "EN_REVISION",
  });
  await command(ids.hr, "application.status", {
    id: application,
    status: "PRESELECCIONADO",
  });
  const appointment = {
    application_id: application,
    interviewer_id: ids.hr,
    notes: "Prueba",
    status: "SCHEDULED",
    scheduled_at: "2000-01-01T10:00:00Z",
  };
  await expect(command(ids.hr, "interview.save", appointment)).rejects.toThrow(
    "INTERVIEW_IN_PAST",
  );
  const futureDate = new Date(Date.now() + 40 * 86400000);
  while (nonWorkingDay(mexicoDate(futureDate.toISOString())))
    futureDate.setUTCDate(futureDate.getUTCDate() + 1);
  const future = futureDate.toISOString();
  const interview = await command(ids.hr, "interview.save", {
    ...appointment,
    scheduled_at: future,
  });
  await expect(
    command(ids.hr, "interview.save", { ...appointment, id: interview }),
  ).rejects.toThrow("INTERVIEW_IN_PAST");
  await command(ids.hr, "interview.save", {
    ...appointment,
    id: interview,
    scheduled_at: future,
    status: "COMPLETED",
  });
  await expect(
    command(ids.hr, "application.hire", {
      id: application,
      position_id: pos,
      department_id: dep,
      manager_id: boss,
    }),
  ).rejects.toThrow("INVALID_HIRING_AREA");
  expect(
    (await db.query("select role from profiles where id=$1", [candidate])).rows,
  ).toEqual([{ role: "CANDIDATO" }]);
  const hired = await command(ids.hr, "application.hire", {
    id: application,
    position_id: position,
    department_id: dep,
    manager_id: boss,
  });
  expect(
    (
      await db.query(
        "select position_id,manager_id from employees where id=$1",
        [hired],
      )
    ).rows,
  ).toEqual([{ position_id: position, manager_id: boss }]);
  expect(
    (
      await db.query(
        "select i.title from onboarding_items i join onboarding o on o.id=i.onboarding_id where o.employee_id=$1",
        [hired],
      )
    ).rows,
  ).toEqual([{ title: "Bienvenida al área final" }]);
});

it("solo el superior de RH más alto o superusuario modifica la jerarquía de RH", async () => {
  await db.exec("reset role");
  const users = [
    "60000000-0000-4000-8000-000000000001",
    "60000000-0000-4000-8000-000000000002",
    "60000000-0000-4000-8000-000000000003",
    "60000000-0000-4000-8000-000000000004",
  ];
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids.admin,
  ]);
  const staff: string[] = [];
  for (const user of users) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      user,
      user + "@test.local",
    ]);
    await db.query("update profiles set role='RH_ADMIN' where id=$1", [user]);
    const result = await db.query<{ id: string }>(
      "insert into employees(profile_id,position_id,manager_id) values($1,$2,$3) returning id",
      [
        user,
        pos,
        staff.length === 1 ? staff[0] : staff.length === 2 ? staff[1] : null,
      ],
    );
    staff.push(result.rows[0].id);
  }
  const department = (
    await db.query<{ department_id: string }>(
      "select department_id from positions where id=$1",
      [pos],
    )
  ).rows[0].department_id;
  const promoted = await command(ids.admin, "position.save", {
    name: "Dirección RH de prueba",
    department_id: department,
  });
  await expect(
    command(users[1], "employee.save", {
      id: staff[0],
      position_id: promoted,
      manager_id: "",
      status: "ACTIVE",
    }),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  await expect(
    command(users[0], "employee.save", {
      id: staff[2],
      position_id: promoted,
      manager_id: staff[1],
      status: "ACTIVE",
    }),
  ).resolves.toBe(staff[2]);
  const save = (id: string) => ({
    id,
    position_id: pos,
    manager_id: "",
    status: "ACTIVE",
  });
  // Un subordinado y un RH de otra rama no pueden cambiar al superior.
  await expect(
    command(users[1], "employee.save", {
      ...save(staff[0]),
      status: "INACTIVE",
    }),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  await expect(
    as(users[3], "select assign_team_manager($1,$2)", [staff[0], staff[3]]),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  // El superior intermedio tampoco sustituye la autoridad del RH más alto.
  await expect(
    as(users[1], "select assign_team_manager($1,null)", [staff[2]]),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  await expect(
    as(users[3], "select assign_team_manager($1,$2)", [staff[2], staff[3]]),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  await expect(
    as(users[0], "select assign_team_manager($1,$2)", [staff[2], staff[0]]),
  ).resolves.toBeDefined();
  // Ni siquiera el RH superior se puede dar otra posición jerárquica a sí mismo.
  await expect(
    as(users[0], "select assign_team_manager($1,$2)", [staff[0], staff[3]]),
  ).rejects.toThrow("HR_HIERARCHY_FORBIDDEN");
  await expect(
    command(users[0], "employee.save", {
      ...save(staff[1]),
      manager_id: staff[0],
      status: "INACTIVE",
    }),
  ).resolves.toBe(staff[1]);
  await expect(
    as(ids.admin, "select assign_team_manager($1,$2)", [staff[0], staff[3]]),
  ).resolves.toBeDefined();
});

it("auditoría detalla cambios operativos solo para superusuario", async () => {
  const id = await command(ids.admin, "department.save", {
    name: "Área auditoría inicial",
  });
  await command(ids.admin, "department.save", {
    id,
    name: "Área auditoría actualizada",
  });
  const logs = await as(
    ids.admin,
    "select metadata from audit_logs where resource_id=$1 and action='UPDATE' order by created_at desc",
    [id],
  );
  const meta = (logs.rows[0] as { metadata: unknown }).metadata as {
    changes: Record<string, { before: unknown; after: unknown }>;
    actor_name: string;
  };
  expect(meta.changes.name).toEqual({
    before: "Área auditoría inicial",
    after: "Área auditoría actualizada",
  });
  expect(meta.actor_name).toBeTruthy();
  expect(
    (await as(ids.hr, "select * from audit_logs where resource_id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  expect(
    (
      await as(ids.manager, "select * from audit_logs where resource_id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role");
  const triggers = await db.query<{ name: string }>(
    "select c.relname as name from pg_trigger t join pg_class c on c.oid=t.tgrelid where t.tgname='audit'",
  );
  expect(triggers.rows.map((r) => r.name)).toContain("course_evidence");
  expect(triggers.rows.map((r) => r.name)).toContain("climate_surveys");
  expect(triggers.rows.map((r) => r.name)).not.toContain("climate_answers");
  expect(triggers.rows.map((r) => r.name)).not.toContain("climate_feedback");
});

it("la contratación genera un aviso persistente y RH confirma la asignación", async () => {
  await db.exec("reset role");
  const result = await db.query<{
    id: string;
    position_id: string;
    department_id: string;
    manager_id: string | null;
  }>(
    "select e.id,e.position_id,p.department_id,e.manager_id from employees e join positions p on p.id=e.position_id where e.assignment_pending and e.status='ACTIVE' limit 1",
  );
  expect(result.rows).toHaveLength(1);
  const e = result.rows[0];
  const params = [e.id, e.department_id, e.position_id, e.manager_id];
  const sql = "select complete_hiring_assignment($1,$2,$3,$4)";
  await expect(as(ids.manager, sql, params)).rejects.toThrow();
  await expect(as(ids.candidate, sql, params)).rejects.toThrow();
  await expect(
    as(ids.hr, sql, [
      e.id,
      "00000000-0000-4000-8000-000000000000",
      e.position_id,
      e.manager_id,
    ]),
  ).rejects.toThrow("INVALID_HIRING_AREA");
  await expect(as(ids.hr, sql, params)).resolves.toBeDefined();
  expect(
    (
      await as(
        ids.admin,
        "select assignment_pending from employees where id=$1",
        [e.id],
      )
    ).rows,
  ).toEqual([{ assignment_pending: false }]);
  await expect(as(ids.hr, sql, params)).rejects.toThrow(
    "ASSIGNMENT_NOT_PENDING",
  );
});

it("conversaciones de tarea: acceso, autor, reintentos e historial cerrado", async () => {
  await db.exec("reset role");
  const user = "70000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into auth.users(id,email) values($1,'chat@test.local')",
    [user],
  );
  await db.query("update profiles set role='EMPLEADO' where id=$1", [user]);
  const boss = (
    await db.query<{ id: string }>(
      "select id from employees where profile_id=$1",
      [ids.manager],
    )
  ).rows[0];
  const eid = await command(ids.admin, "employee.enroll", {
    profile_id: user,
    position_id: pos,
    manager_id: boss.id,
  });
  const task = await command(ids.hr, "task.save", {
    title: "Conversación de prueba",
    description: "Prueba de permisos",
    employee_id: eid,
    priority: "MEDIUM",
    due_date: "2026-12-31",
  });
  const mid = "71000000-0000-4000-8000-000000000001";
  const send = (who: string, message: string, id = mid) =>
    as(who, "select send_task_message($1,$2,$3)", [task, message, id]);
  await expect(send(user, "¿Qué debo entregar?")).resolves.toBeDefined();
  await expect(send(user, "¿Qué debo entregar?")).resolves.toBeDefined();
  const rows = await as(
    ids.manager,
    "select author_id,body from task_messages where task_id=$1",
    [task],
  );
  expect(rows.rows).toEqual([{ author_id: user, body: "¿Qué debo entregar?" }]);
  await expect(
    send(
      ids.manager,
      "Adjunta un informe PDF.",
      "71000000-0000-4000-8000-000000000002",
    ),
  ).resolves.toBeDefined();
  await expect(
    send(
      ids.hr,
      "RH confirma la instrucción.",
      "71000000-0000-4000-8000-000000000003",
    ),
  ).resolves.toBeDefined();
  await expect(
    send(ids.other, "Mensaje ajeno", "71000000-0000-4000-8000-000000000004"),
  ).rejects.toThrow();
  const unread = async (who: string) =>
    (
      await as(who, "select * from unread_task_messages() where task_id=$1", [
        task,
      ])
    ).rows as { unread_count: number }[];
  expect(Number((await unread(user))[0].unread_count)).toBe(2);
  expect(Number((await unread(ids.manager))[0].unread_count)).toBe(2);
  expect(await unread(ids.other)).toHaveLength(0);
  expect(await unread(ids.candidate)).toHaveLength(0);
  const sequences = (
    await as(
      user,
      "select sequence from task_messages where task_id=$1 order by sequence",
      [task],
    )
  ).rows as { sequence: number }[];
  const mark = (who: string, sequence: number) =>
    as(who, "select mark_task_messages_read($1,$2)", [task, sequence]);
  await expect(mark(ids.other, sequences[2].sequence)).rejects.toThrow();
  await expect(mark(user, 99999999)).rejects.toThrow();
  await mark(user, sequences[1].sequence);
  expect(Number((await unread(user))[0].unread_count)).toBe(1);
  await mark(user, sequences[0].sequence);
  expect(Number((await unread(user))[0].unread_count)).toBe(1);
  await mark(user, sequences[2].sequence);
  expect(await unread(user)).toHaveLength(0);
  expect(Number((await unread(ids.manager))[0].unread_count)).toBe(2);
  expect(
    (
      await as(ids.other, "select * from task_messages where task_id=$1", [
        task,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    send(user, "   ", "71000000-0000-4000-8000-000000000005"),
  ).rejects.toThrow();
  await expect(
    as(user, "update task_messages set body='alterado' where id=$1", [mid]),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query("update tasks set status='APPROVED' where id=$1", [task]);
  await expect(
    send(user, "Otro mensaje", "71000000-0000-4000-8000-000000000006"),
  ).rejects.toThrow("TASK_CHAT_CLOSED");
  expect(
    (await as(user, "select * from task_messages where task_id=$1", [task]))
      .rows,
  ).toHaveLength(3);
});

it("revisión parcial de capacitación: avisos, permisos, corrección y aprobación", async () => {
  await db.exec("reset role");
  const user = "70000000-0000-4000-8000-000000000001";
  const e = (
    await db.query<{ id: string }>(
      "select id from employees where profile_id=$1",
      [user],
    )
  ).rows[0];
  const c = (
    await db.query<{ id: string }>(
      "insert into courses(title,description,content,duration_minutes) values('Prueba parcial','prueba','prueba',20) returning id",
    )
  ).rows[0];
  const a = (
    await db.query<{ id: string }>(
      "insert into course_assignments(course_id,employee_id) values($1,$2) returning id",
      [c.id, e.id],
    )
  ).rows[0];
  const attach = async (p: number) => {
    const path = user + "/" + crypto.randomUUID() + ".txt";
    await as(
      user,
      "insert into storage.objects(bucket_id,name) values('course-evidence',$1)",
      [path],
    );
    await as(
      user,
      "select attach_course_evidence($1,$2,'Evidencia sintética',$3)",
      [a.id, path, p],
    );
  };
  const review = (who: string, decision: string, p: number) =>
    as(who, "select review_course_progress($1,$2,$3,'Prueba de revisión')", [
      a.id,
      decision,
      p,
    ]);
  const state = async () =>
    (
      await as(
        user,
        "select progress,approved_progress,progress_review_pending,status from course_assignments where id=$1",
        [a.id],
      )
    ).rows[0];
  await attach(25);
  await command(user, "course.progress", { id: a.id, progress: 25 });
  expect(await state()).toMatchObject({
    progress_review_pending: true,
    progress: 25,
  });
  await expect(review(user, "ACCEPT", 25)).rejects.toThrow();
  await expect(review(ids.other, "ACCEPT", 25)).rejects.toThrow();
  await expect(review(ids.manager, "ACCEPT", 50)).rejects.toThrow(
    "COURSE_EVIDENCE_REQUIRED",
  );
  await review(ids.manager, "ACCEPT", 20);
  expect(await state()).toMatchObject({
    progress: 20,
    approved_progress: 20,
    progress_review_pending: false,
  });
  await expect(review(ids.hr, "ACCEPT", 20)).rejects.toThrow(
    "NO_PENDING_REVIEW",
  );
  await attach(50);
  await expect(review(ids.manager, "REJECT", 50)).rejects.toThrow(
    "REJECTED_PROGRESS_INCREASE",
  );
  await review(ids.hr, "REJECT", 20);
  await attach(100);
  await review(ids.manager, "ACCEPT", 100);
  expect(await state()).toMatchObject({
    status: "COMPLETED",
    progress: 100,
    progress_review_pending: false,
  });
});
it("desplaza la tarea automática de bienvenida sin perder la contratación", async () => {
  await db.exec("reset role");
  const result = await db.query(
    `select public.next_working_day('2026-12-25'::date)::text as holiday, public.next_working_day('2026-09-26'::date)::text as weekend, public.next_working_day('2026-09-28'::date)::text as working`,
  );
  expect(result.rows).toEqual([
    { holiday: "2026-12-28", weekend: "2026-09-28", working: "2026-09-28" },
  ]);
  const source = await db.query<{ definition: string }>(
    `select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname like '%command%'`,
  );
  expect(
    source.rows.some((r) =>
      String(r.definition).includes("eid,uid,current_date+7)"),
    ),
  ).toBe(false);
  expect(
    source.rows.some((r) =>
      String(r.definition).includes(
        "eid,uid,public.next_working_day(current_date+7))",
      ),
    ),
  ).toBe(true);
});

it("correcciones de perfil: propiedad, revisión de RH, duplicados y aplicación atómica", async () => {
  const person = "90000000-0000-4000-8000-000000000091";
  await db.exec("reset role");
  await db.query(
    "insert into auth.users(id,email) values($1,'correction@test.local')",
    [person],
  );
  await db.query("update profiles set role='EMPLEADO' where id=$1", [person]);
  const created = await db.query<{ id: string }>(
    "insert into employees(profile_id,position_id,hire_date,status) values($1,$2,'2026-01-01','ACTIVE') returning id",
    [person, pos],
  );
  const eid = created.rows[0].id;
  const sql =
    "select request_profile_correction($1,'full_name','Nombre corregido','Nombre incompleto') as id";
  await expect(as(ids.other, sql, [eid])).rejects.toThrow();
  const requested = await as(person, sql, [eid]);
  const rid = (requested.rows[0] as { id: string }).id;
  await expect(as(person, sql, [eid])).rejects.toThrow();
  expect(
    (
      await as(ids.manager, "select * from profile_corrections where id=$1", [
        rid,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    as(person, "select review_profile_correction($1,true,'Confirmado')", [rid]),
  ).rejects.toThrow();
  await as(
    ids.hr,
    "select review_profile_correction($1,true,'Nombre verificado')",
    [rid],
  );
  expect(
    (await as(person, "select full_name from profiles where id=$1", [person]))
      .rows,
  ).toEqual([{ full_name: "Nombre corregido" }]);
  const result = await as(
    person,
    "select status,review_comment from profile_corrections where id=$1",
    [rid],
  );
  expect(result.rows).toEqual([
    { status: "APPROVED", review_comment: "Nombre verificado" },
  ]);
  await expect(
    as(ids.hr, "select review_profile_correction($1,true,'Otra vez')", [rid]),
  ).rejects.toThrow("CORRECTION_NOT_PENDING");
  const rejected = await as(
    person,
    "select request_profile_correction($1,'hire_date','2026-01-02','Revisar fecha') as id",
    [eid],
  );
  await as(
    ids.hr,
    "select review_profile_correction($1,false,'La fecha original es correcta')",
    [(rejected.rows[0] as { id: string }).id],
  );
  expect(
    (
      await as(person, "select hire_date::text from employees where id=$1", [
        eid,
      ])
    ).rows,
  ).toEqual([{ hire_date: "2026-01-01" }]);
});

it("requiere CV y permite retirar solo la postulación propia, conservando historial", async () => {
  await db.exec("reset role");
  const user = crypto.randomUUID();
  await db.query(
    "insert into auth.users(id,email) values($1,'withdraw@test.local')",
    [user],
  );
  const vacancyId = await command(ids.hr, "vacancy.save", {
    position_id: pos,
    title: "Retiro",
    description: "Prueba",
    requirements: "Prueba",
    skills: [],
    experience_required: 0,
    status: "PUBLISHED",
  });
  await expect(
    command(user, "application.create", { vacancy_id: vacancyId }),
  ).rejects.toThrow("CV_REQUIRED");
  await db.exec("reset role");
  await db.query(
    "update candidates set cv_path='fixture/cv.pdf' where profile_id=$1",
    [user],
  );
  const application = await command(user, "application.create", {
    vacancy_id: vacancyId,
  });
  await expect(
    as(ids.other, "select withdraw_application($1)", [application]),
  ).rejects.toThrow();
  await as(user, "select withdraw_application($1)", [application]);
  const result = await as(user, "select status from applications where id=$1", [
    application,
  ]);
  expect(result.rows[0]).toEqual({ status: "RETIRADO" });
  expect(await command(user, "application.create", { vacancy_id: vacancyId })).toBe(application);
  const reopened = await as(user, "select status from applications where id=$1", [application]);
  expect(reopened.rows[0]).toEqual({ status: "POSTULADO" });
  await expect(command(user, "application.create", { vacancy_id: vacancyId })).rejects.toThrow();
  await as(user, "select withdraw_application($1)", [application]);
  await db.exec("reset role");
  await db.query("update vacancies set status='CLOSED' where id=$1", [vacancyId]);
  await expect(command(user, "application.create", { vacancy_id: vacancyId })).rejects.toThrow("VACANCY_CLOSED");
  await expect(
    as(user, "select withdraw_application($1)", [application]),
  ).rejects.toThrow("INVALID_TRANSITION");
  await expect(
    command(ids.hr, "application.status", {
      id: application,
      status: "EN_REVISION",
    }),
  ).rejects.toThrow();
});
