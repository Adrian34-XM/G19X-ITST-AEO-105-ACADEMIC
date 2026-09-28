import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("bloquea entrega sin aprobar y permite reprobar y repetir sin revelar claves", async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-4000-8000-000000000001'::uuid$$;
 create table public.profiles(id uuid primary key); insert into profiles values(auth.uid());
 create table public.onboarding(id uuid primary key,employee_id uuid); create table public.onboarding_items(id uuid primary key,onboarding_id uuid,owner_role text,status text);
 create function public.current_role() returns text language sql as $$select 'RH_ADMIN'::text$$;
 create function public.is_hr() returns boolean language sql as $$select true$$;
 create function public.owns_employee(uuid) returns boolean language sql as $$select true$$;
 create function public.manages_employee(uuid) returns boolean language sql as $$select true$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 insert into onboarding values('20000000-0000-4000-8000-000000000001',auth.uid());
 insert into onboarding_items values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','EMPLOYEE','PENDING');`);
  await db.exec(
    readFileSync(
      "supabase/migrations/202609280001_onboarding_learning.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/202609280002_optional_onboarding_quiz.sql",
      "utf8",
    ),
  );
  const id = "30000000-0000-4000-8000-000000000001";
  const rpc = async (op: string, payload: unknown) =>
    (
      await db.query<{ result: Record<string, unknown> }>(
        "select public.onboarding_learning_command($1,$2::jsonb) result",
        [op, JSON.stringify(payload)],
      )
    ).rows[0].result;
  await rpc("save", {
    id,
    material_path: "10000000-0000-4000-8000-000000000001/lectura.pdf",
    instructions: "Solo lectura",
    minimum: 1,
    questions: [],
  });
  await db.query("update onboarding_items set status='SUBMITTED' where id=$1", [
    id,
  ]);
  await db.query("update onboarding_items set status='PENDING' where id=$1", [
    id,
  ]);
  await expect(rpc("attempt", { id, answers: [] })).rejects.toThrow();
  await rpc("save", {
    id,
    material_path: "10000000-0000-4000-8000-000000000001/document.pdf",
    instructions: "Lee y responde",
    minimum: 80,
    questions: [
      { question: "Pregunta de prueba", options: ["A", "B"], correct: 1 },
    ],
  });
  expect(JSON.stringify(await rpc("read", { id }))).not.toContain("correct");
  expect(await rpc("attempt", { id, answers: [0] })).toMatchObject({
    score: 0,
    passed: false,
  });
  await expect(
    db.query("update onboarding_items set status='SUBMITTED' where id=$1", [
      id,
    ]),
  ).rejects.toThrow("LEARNING_REQUIRED");
  expect(await rpc("attempt", { id, answers: [1] })).toMatchObject({
    score: 100,
    passed: true,
  });
  await db.query("update onboarding_items set status='SUBMITTED' where id=$1", [
    id,
  ]);
  await db.close();
});
