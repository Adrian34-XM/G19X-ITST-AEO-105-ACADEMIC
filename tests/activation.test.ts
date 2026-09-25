/** Valida el archivo que ejecutará el usuario, incluyendo su repetición sin duplicados. */
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
it("activa las tres mejoras pendientes y permite repetir el script", async () => {
  const db = new PGlite();
  try {
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
    await db.exec(await readFile("supabase/instalar-proyecto.sql", "utf8"));
    const activation = await readFile(
      "supabase/activar-mejoras-rh.sql",
      "utf8",
    );
    await db.exec(activation);
    await db.exec(activation);
    const result = await db.query(
      "select to_regclass('public.climate_surveys') is not null as climate, to_regclass('public.vacancy_documents') is not null as documents",
    );
    expect(result.rows).toEqual([{ climate: true, documents: true }]);
    const guard = await db.query(
      "select tgname from pg_trigger where tgname='candidate_interview'",
    );
    expect(guard.rows).toHaveLength(1);
    expect(
      (
        await db.query(
          "select to_regprocedure('public.assign_many(text,uuid[],jsonb)') is not null as ready",
        )
      ).rows,
    ).toEqual([{ ready: true }]);
  } finally {
    await db.close();
  }
});

it("rechaza una base vacía antes de intentar activar mejoras", async () => {
 const db = new PGlite();
 try {
  await expect(db.exec(await readFile("supabase/activar-mejoras-rh.sql","utf8"))).rejects.toThrow("BASE_RH_INCOMPLETA");
  await db.exec("rollback");
  expect((await db.query("select tablename from pg_tables where schemaname='public'")).rows).toEqual([]);
 } finally { await db.close(); }
});
