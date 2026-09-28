import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("bloquea áreas con puestos o referencias y restringe la eliminación a RH", async () => {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-4000-8000-000000000001'::uuid$$;
 create function public.current_role() returns text language sql as $$select current_setting('test.role')$$;
 create table departments(id uuid primary key default gen_random_uuid(),name text);create table positions(id int,department_id uuid references departments,status text);
 create table vacancies(department_id uuid references departments);
 create function public.test_area_command(op text,r text) returns boolean language plpgsql as $$begin case op
when 'department.save' then
 if r<>'SUPERUSER' then raise insufficient_privilege; end if;
else raise insufficient_privilege; end case;return true;end $$;
 set test.role='RH_ADMIN';`);
  await db.exec(
    readFileSync("supabase/migrations/202609280005_hr_departments.sql", "utf8"),
  );
  const id = "20000000-0000-4000-8000-000000000001";
  await db.query("insert into departments(id) values($1)", [id]);
  await db.query("insert into positions values(1,$1,'INACTIVE')", [id]);
  await expect(
    db.query("select delete_unused_department($1)", [id]),
  ).rejects.toThrow("DEPARTMENT_IN_USE");
  await db.exec("delete from positions");
  await db.query("insert into vacancies values($1)", [id]);
  await expect(
    db.query("select delete_unused_department($1)", [id]),
  ).rejects.toThrow();
  await db.exec("delete from vacancies");
  for (const role of ["JEFE", "EMPLEADO", "CANDIDATO"]) {
    await db.query("select set_config('test.role',$1,false)", [role]);
    await expect(
      db.query("select delete_unused_department($1)", [id]),
    ).rejects.toThrow();
  }
  await db.exec("set test.role='RH_ADMIN'");
  await db.query("select delete_unused_department($1)", [id]);
  expect((await db.query("select * from departments")).rows).toHaveLength(0);
  const created = await db.query<{ result: { id: string } }>(
    "select save_department(null,'Nueva área') result",
  );
  await db.query("select save_department($1,'Área editada')", [
    created.rows[0].result.id,
  ]);
  expect(
    (await db.query<{ name: string }>("select name from departments")).rows[0]
      .name,
  ).toBe("Área editada");
  await db.exec("set test.role='JEFE'");
  await expect(
    db.query("select save_department(null,'Prohibida')"),
  ).rejects.toThrow();
  await db.exec(
    readFileSync("supabase/migrations/202609280005_hr_departments.sql", "utf8"),
  );
  await db.close();
});
