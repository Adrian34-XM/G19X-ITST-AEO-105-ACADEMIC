"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/** Campo de contraseña con control accesible para alternar su visibilidad. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  maxLength,
  required = false,
}: {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
      />
      <button
        className="password-visibility-toggle"
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-controls={id}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
      </button>
    </span>
  );
}
