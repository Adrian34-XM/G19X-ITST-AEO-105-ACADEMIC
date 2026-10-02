"use client";
import { useEffect } from "react";

/** Detecta contrataciones mientras el candidato mantiene abierta su pantalla. */
export function CandidateSession() {
  useEffect(() => {
    let active = true;
    let pending = false;
    const controller = new AbortController();
    async function check() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const response = await fetch("/api/auth/destination", { cache: "no-store", signal: controller.signal });
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          window.location.replace("/login"); return;
        }
        if (!response.ok) return;
        const { destination } = await response.json();
        if (active && ["/employee", "/manager", "/rh", "/admin"].includes(destination)) window.location.replace(destination);
      } catch { /* Un fallo temporal de red no cierra la sesión. */ }
      finally { pending = false; }
    }
    void check();
    const timer = window.setInterval(check, 15000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return null;
}
