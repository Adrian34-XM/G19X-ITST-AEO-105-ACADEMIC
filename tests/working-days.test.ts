import {expect,it} from 'vitest';
import {nonWorkingDay,mexicoDate} from '@/lib/working-days';
it('bloquea fines de semana y descansos mexicanos y no inventa festivos',()=>{
 for(const d of ['2026-01-01','2026-02-02','2026-03-16','2026-05-01','2026-09-16','2026-11-16','2026-12-25','2026-09-26','2026-09-27','2030-10-01'])expect(nonWorkingDay(d)).toBeTruthy();
 for(const d of ['2026-02-05','2026-09-28','2026-10-01','2026-12-24'])expect(nonWorkingDay(d)).toBeNull();
 expect(mexicoDate('2026-09-29T02:00:00Z')).toBe('2026-09-28');
});
