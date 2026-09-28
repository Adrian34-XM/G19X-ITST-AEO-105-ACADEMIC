import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('solo elimina puestos sin empleados ni referencias y exige RH',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select '10000000-0000-4000-8000-000000000001'::uuid$$;
 create function public.current_role() returns text language sql as $$select current_setting('test.role')$$;
 create table positions(id uuid primary key);create table employees(id int,position_id uuid references positions,status text);
 create table vacancies(position_id uuid references positions);
 set test.role='RH_ADMIN';`);
 await db.exec(readFileSync('supabase/migrations/202609280004_delete_unused_positions.sql','utf8'));
 const id='20000000-0000-4000-8000-000000000001';await db.query('insert into positions values($1)',[id]);await db.query("insert into employees values(1,$1,'INACTIVE')",[id]);
 await expect(db.query('select delete_unused_position($1)',[id])).rejects.toThrow('POSITION_ASSIGNED');
 await db.exec('delete from employees');await db.query('insert into vacancies values($1)',[id]);await expect(db.query('select delete_unused_position($1)',[id])).rejects.toThrow();
 await db.exec('delete from vacancies');
 for(const role of ['JEFE','EMPLEADO','CANDIDATO']){await db.query("select set_config('test.role',$1,false)",[role]);await expect(db.query('select delete_unused_position($1)',[id])).rejects.toThrow();}
 await db.exec("set test.role='RH_ADMIN'");await db.query('select delete_unused_position($1)',[id]);expect((await db.query('select * from positions')).rows).toHaveLength(0);await db.close();
});
