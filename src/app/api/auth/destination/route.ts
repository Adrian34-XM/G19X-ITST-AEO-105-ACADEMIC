import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { home } from "@/lib/permissions";
import { failure } from "@/lib/api";

/** Consulta el rol vigente del propio usuario; nunca confía en el rol del navegador. */
export async function GET() {
  try {
    const { profile } = await authenticate();
    return NextResponse.json({ destination: home[profile.role] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
