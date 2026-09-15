import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { home, mayEnter, type Role } from "@/lib/permissions";
import { publicSupabaseKey } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !publicSupabaseKey())
    return response;
  const client = createServerClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicSupabaseKey()!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  const protectedRoute = /^\/(admin|rh|manager|employee|candidate)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  if (protectedRoute) {
    const { data: p } = user
      ? await client
          .from("profiles")
          .select("role,active")
          .eq("id", user.id)
          .single()
      : { data: null };
    if (!p?.active || !mayEnter(p.role as Role, request.nextUrl.pathname)) {
      const redirect = NextResponse.redirect(
        new URL(p?.active ? home[p.role as Role] : "/login", request.url),
      );
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
