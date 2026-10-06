"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const event = "nexo-theme-change";
function subscribe(notify: () => void) {
  const sync = (change: StorageEvent) => {
    if (change.key !== "nexo-theme") return;
    if (change.newValue !== "light" && change.newValue !== "dark") return;
    document.documentElement.dataset.theme = change.newValue;
    notify();
  };
  window.addEventListener(event, notify);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(event, notify);
    window.removeEventListener("storage", sync);
  };
}
function snapshot() {
  return document.documentElement.dataset.theme === "dark";
}
/** La preferencia pertenece al navegador y se conserva al cambiar de módulo. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  return (
    <button
      type="button"
      className="secondary theme-toggle"
      aria-label="Modo oscuro"
      aria-pressed={dark}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => {
        const theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = theme;
        try {
          localStorage.setItem("nexo-theme", theme);
        } catch {
          /* El tema funciona también sin almacenamiento. */
        }
        window.dispatchEvent(new Event(event));
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
