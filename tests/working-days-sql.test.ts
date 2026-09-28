import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('protege tareas y entrevistas incluso con escrituras directas y conserva fechas históricas', async () => {
 const db = new PGlite();
 await db.exec(`create table tasks(id int, due_date date, status text);create table interviews(id int, scheduled_at timestamptz,status text);insert into tasks values(1,'2026-09-26','PENDING');`);
 await db.exec(readFileSync('supabase/migrations/202609280006_working_days.sql','utf8'));
 await expect(db.exec(`insert into tasks values(2,'2026-09-16','PENDING')`)).rejects.toThrow('día hábil');
 await db.exec(`update tasks set status='APPROVED' where id=1;insert into tasks values(3,'2026-09-28','PENDING')`);
 await expect(db.exec(`update tasks set due_date='2026-09-27' where id=3`)).rejects.toThrow('día hábil');
 await expect(db.exec(`insert into interviews values(1,'2026-09-27T18:00:00Z','SCHEDULED')`)).rejects.toThrow('día hábil');
 await db.exec(`insert into interviews values(2,'2026-09-29T02:00:00Z','SCHEDULED')`);
 await db.close();
},20000);
