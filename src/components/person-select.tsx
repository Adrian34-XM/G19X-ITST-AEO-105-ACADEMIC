"use client";
/**
 * @file Selector de persona con búsqueda textual y opciones desplegables. Reutiliza identificadores
 * de las opciones recibidas sin crear personas ni resolver permisos de jerarquía.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useId, useState } from "react";
/** Buscador que guarda únicamente una persona seleccionada, nunca texto libre. */
export function PersonSelect({
  label,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  emptyLabel: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = options.filter((o) =>
    normalize(o.name).includes(normalize(query)),
  );
  return (
    <div className="person-select">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={open ? query : (options.find((o) => o.id === value)?.name ?? "")}
        placeholder="Escribe para buscar…"
        role="combobox"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div
          id={`${id}-options`}
          className="person-select-options"
          role="dialog"
          aria-label={`Opciones de ${label}`}
        >
          <button
            type="button"
            className="secondary"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {emptyLabel}
          </button>
          {matches.map((o) => (
            <button
              type="button"
              className="secondary"
              key={o.id}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.name}
            </button>
          ))}
          {!matches.length && <p>No hay coincidencias.</p>}
          <button
            type="button"
            className="quiet"
            onClick={() => setOpen(false)}
          >
            Cerrar opciones
          </button>
        </div>
      )}
    </div>
  );
}
