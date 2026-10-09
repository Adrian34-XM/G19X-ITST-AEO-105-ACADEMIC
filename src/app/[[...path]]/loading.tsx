"use client";

import { usePathname } from "next/navigation";
import Loading from "../loading";
import { WorkspaceSkeleton } from "@/components/loading-skeleton";

/** Las rutas públicas conservan una espera sencilla, sin simular un espacio privado. */
export default function ModuleLoading() {
  const pathname = usePathname();
  return /^\/(admin|rh|manager|employee|candidate)(\/|$)/.test(pathname) ? (
    <WorkspaceSkeleton />
  ) : (
    <Loading />
  );
}
