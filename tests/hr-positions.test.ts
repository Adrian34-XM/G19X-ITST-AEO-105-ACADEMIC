import {it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
it('permite guardar puestos a RH y superusuario, sin ampliar otros roles',async()=>{
 const db=new PGlite();
 await db.exec(`create function public.test_command(op text,r text) returns boolean language plpgsql as $$begin case op
when 'position.save' then
 if r<>'SUPERUSER' then raise insufficient_privilege; end if;
else raise insufficient_privilege; end case;return true;end $$;`);
 await db.exec(readFileSync('supabase/migrations/202609280003_hr_positions.sql','utf8'));
 for(const role of ['RH_ADMIN','SUPERUSER']) expect((await db.query<{ok:boolean}>("select public.test_command('position.save',$1) ok",[role])).rows[0].ok).toBe(true);
 for(const role of ['JEFE','EMPLEADO','CANDIDATO']) await expect(db.query("select public.test_command('position.save',$1)",[role])).rejects.toThrow();
 await db.exec(readFileSync('supabase/migrations/202609280003_hr_positions.sql','utf8'));
 await db.close();
});
