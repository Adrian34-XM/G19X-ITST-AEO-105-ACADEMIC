import {expect,it} from "vitest";
import {currentWeek} from "@/modules/workspace/current-week";
it("usa lunes de México incluso durante el lunes UTC que aún es domingo local",()=>{
 expect(currentWeek(new Date("2026-10-05T05:59:59Z"))).toMatchObject({start:"2026-09-28T06:00:00.000Z",end:"2026-10-05T06:00:00.000Z"});
 expect(currentWeek(new Date("2026-10-05T06:00:00Z"))).toMatchObject({start:"2026-10-05T06:00:00.000Z",end:"2026-10-12T06:00:00.000Z"});
});
it("resuelve semanas que cruzan el año",()=>{
 expect(currentWeek(new Date("2027-01-01T18:00:00Z"))).toMatchObject({start:"2026-12-28T06:00:00.000Z",end:"2027-01-04T06:00:00.000Z"});
});
